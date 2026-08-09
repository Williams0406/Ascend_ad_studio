import base64
import json
import re

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from integrations.models import (
    AIProviderConnection,
)
from integrations.services.encryption import (
    decrypt_api_key,
)


class TemplateAnalysisError(Exception):
    """
    Error controlado durante el análisis visual
    de una plantilla.
    """


DEFAULT_TEMPLATE_ANALYSIS_MODEL = "gemini-2.5-pro"

DEFAULT_TEMPLATE_ANALYSIS_TIMEOUT = 120

TEMPLATE_ANALYSIS_ENDPOINT = (
    "https://generativelanguage.googleapis.com/" "v1beta/models/{model}:generateContent"
)


def _analysis_model():
    return getattr(
        settings,
        "GEMINI_TEMPLATE_ANALYSIS_MODEL",
        DEFAULT_TEMPLATE_ANALYSIS_MODEL,
    )


def _analysis_timeout():
    return int(
        getattr(
            settings,
            "GEMINI_TEMPLATE_ANALYSIS_TIMEOUT",
            DEFAULT_TEMPLATE_ANALYSIS_TIMEOUT,
        )
    )


def get_template_analysis_connection(
    template,
):
    queryset = AIProviderConnection.objects.filter(
        workspace=template.workspace,
        provider=(AIProviderConnection.Provider.GEMINI),
        status=(AIProviderConnection.Status.ACTIVE),
    ).exclude(encrypted_api_key="")

    connection = queryset.filter(is_default=True).first()

    connection = connection or queryset.first()

    if not connection:
        raise TemplateAnalysisError(
            "El workspace no tiene una conexión Gemini "
            "activa para analizar plantillas."
        )

    return connection


def _encode_image(
    image_file,
    *,
    mime_type="image/jpeg",
):
    try:
        with image_file.open("rb") as stream:
            encoded = base64.b64encode(stream.read()).decode("ascii")

    except OSError as exc:
        raise TemplateAnalysisError(
            "No se pudo leer una de las imágenes " "de ejemplo de la plantilla."
        ) from exc

    return {
        "inlineData": {
            "mimeType": mime_type,
            "data": encoded,
        }
    }


def _guess_mime_type(image):
    import mimetypes

    return mimetypes.guess_type(image.name)[0] or "image/jpeg"


def ordered_template_examples(template):
    """
    Devuelve exclusivamente los AdTemplateExampleImage
    explícitamente asociados a la plantilla.
    """

    examples = list(
        template.example_images.select_related("image").order_by(
            "sort_order",
            "created_at",
        )
    )

    if examples:
        return examples

    return []


def build_template_analysis_instruction(
    template,
):
    constraints = (
        getattr(
            template,
            "layout_constraints",
            {},
        )
        or {}
    )

    return f"""
Eres un director de arte senior especializado en analizar
plantillas publicitarias.

Analiza las imágenes adjuntas como ejemplos de UNA MISMA
familia creativa llamada:

{template.name}

DESCRIPCIÓN EXISTENTE:
{template.description or "No definida"}

FORMATO:
{template.format}

RESTRICCIONES ESTRUCTURALES CONFIRMADAS:
{json.dumps(
    constraints,
    ensure_ascii=False,
    indent=2,
)}

IMPORTANTE:
Las restricciones estructurales anteriores son datos
confirmados y no debes reescribirlas ni reinterpretarlas.
Tu análisis debe describir la capa creativa de la plantilla
sin duplicar esas restricciones innecesariamente.

Tu tarea es extraer únicamente patrones visuales
reutilizables de las imágenes.

No copies marcas, productos, personas, precios ni textos
particulares presentes en los ejemplos.

Devuelve exclusivamente JSON válido, sin Markdown.

ESQUEMA EXACTO:
{{
  "visual_structure": "string",
  "copy_structure": "string",
  "prompt_guidance": "string",
  "do_rules": [
    "string"
  ],
  "dont_rules": [
    "string"
  ],
  "image_notes": [
    {{
      "example_id": "uuid",
      "notes": "string"
    }}
  ]
}}

REGLAS:
- visual_structure debe describir composición,
  jerarquía visual, distribución espacial,
  sujeto principal y zonas generales de contenido.
- copy_structure debe describir la jerarquía
  visual del copy, sin inventar copy comercial.
- prompt_guidance debe ser una guía creativa
  reutilizable para un modelo generador de imágenes.
- do_rules y dont_rules deben centrarse en reglas
  creativas, estéticas o interpretativas.
- No uses do_rules/dont_rules para repetir
  restricciones estructurales que ya existan
  en layout_constraints.
- image_notes debe contener una entrada
  por cada imagen.
- No inventes información que no pueda inferirse
  de las imágenes.
""".strip()


def _extract_json_response(data):
    candidates = data.get("candidates") or []

    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason")

        message = "Gemini no devolvió análisis " "de la plantilla."

        if reason:
            message += f" Motivo de bloqueo: {reason}."

        raise TemplateAnalysisError(message)

    parts = candidates[0].get("content", {}).get("parts", [])

    text = "\n".join(
        str(part.get("text") or "") for part in parts if part.get("text")
    ).strip()

    if not text:
        raise TemplateAnalysisError("Gemini no devolvió texto " "para el análisis.")

    cleaned = re.sub(
        r"^\s*```(?:json)?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    cleaned = re.sub(
        r"\s*```\s*$",
        "",
        cleaned,
    ).strip()

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise TemplateAnalysisError(
            "Gemini devolvió un análisis " "que no contiene JSON válido."
        ) from exc

    if not isinstance(payload, dict):
        raise TemplateAnalysisError(
            "El análisis de plantilla debe " "ser un objeto JSON."
        )

    return payload


def normalize_template_analysis(
    payload,
    *,
    example_ids,
):
    required_text_fields = (
        "visual_structure",
        "copy_structure",
        "prompt_guidance",
    )

    normalized = {}

    for field in required_text_fields:
        value = payload.get(
            field,
            "",
        )

        if not isinstance(value, str):
            value = str(value)

        value = value.strip()

        if not value:
            raise TemplateAnalysisError(f"El análisis no contiene " f"'{field}'.")

        normalized[field] = value

    for field in (
        "do_rules",
        "dont_rules",
    ):
        value = payload.get(
            field,
            [],
        )

        if not isinstance(value, list):
            raise TemplateAnalysisError(f"'{field}' debe ser una lista.")

        normalized[field] = [str(item).strip() for item in value if str(item).strip()]

    notes_by_id = {}

    raw_notes = payload.get(
        "image_notes",
        [],
    )

    if isinstance(raw_notes, list):
        for item in raw_notes:
            if not isinstance(
                item,
                dict,
            ):
                continue

            example_id = str(
                item.get(
                    "example_id",
                    "",
                )
            ).strip()

            notes = str(
                item.get(
                    "notes",
                    "",
                )
            ).strip()

            if example_id and example_id in example_ids and notes:
                notes_by_id[example_id] = notes

    normalized["image_notes"] = notes_by_id

    return normalized


class GeminiTemplateAnalyzer:
    def __init__(
        self,
        connection,
        *,
        model=None,
        timeout=None,
    ):
        if connection.provider != AIProviderConnection.Provider.GEMINI:
            raise TemplateAnalysisError(
                "El análisis de plantillas " "requiere una conexión Gemini."
            )

        if connection.status != AIProviderConnection.Status.ACTIVE:
            raise TemplateAnalysisError("La conexión Gemini no está activa.")

        if not connection.encrypted_api_key:
            raise TemplateAnalysisError(
                "La conexión Gemini no contiene " "una API key."
            )

        self.connection = connection

        self.api_key = decrypt_api_key(connection.encrypted_api_key)

        self.model = model or _analysis_model()

        self.timeout = timeout if timeout is not None else _analysis_timeout()

    def analyze(self, template):
        examples = ordered_template_examples(template)

        if not examples:
            raise TemplateAnalysisError(
                "La plantilla necesita al menos "
                "una imagen de ejemplo antes "
                "de ejecutar reanalyze."
            )

        image_parts = []
        example_ids = set()

        for example in examples:
            reference = example.image

            if not reference.image:
                continue

            example_ids.add(str(example.id))

            image_parts.append({"text": (f"Example ID: " f"{example.id}")})

            image_parts.append(
                _encode_image(
                    reference.image,
                    mime_type=(_guess_mime_type(reference.image)),
                )
            )

        if not image_parts:
            raise TemplateAnalysisError(
                "Las imágenes de ejemplo " "no contienen archivos válidos."
            )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": (build_template_analysis_instruction(template))},
                        *image_parts,
                    ],
                }
            ],
            "generationConfig": {
                "responseMimeType": ("application/json"),
                "temperature": 0.2,
                "topP": 0.8,
                "maxOutputTokens": 4096,
            },
        }

        try:
            response = requests.post(
                TEMPLATE_ANALYSIS_ENDPOINT.format(model=self.model),
                headers={
                    "x-goog-api-key": (self.api_key),
                    "Content-Type": ("application/json"),
                },
                json=payload,
                timeout=self.timeout,
            )

        except requests.RequestException as exc:
            raise TemplateAnalysisError(
                "No se pudo conectar con Gemini " "para analizar la plantilla."
            ) from exc

        if not response.ok:
            try:
                detail = response.json().get("error", {}).get("message", "")
            except (
                TypeError,
                ValueError,
            ):
                detail = ""

            raise TemplateAnalysisError(
                detail
                or (
                    "Gemini devolvió el estado "
                    f"{response.status_code} "
                    "al analizar la plantilla."
                )
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise TemplateAnalysisError(
                "Gemini devolvió una respuesta " "HTTP no válida."
            ) from exc

        raw_analysis = _extract_json_response(data)

        normalized = normalize_template_analysis(
            raw_analysis,
            example_ids=example_ids,
        )

        self._persist(
            template,
            examples,
            normalized,
        )

        self.connection.last_success_at = timezone.now()

        self.connection.last_error_message = ""

        self.connection.save(
            update_fields=[
                "last_success_at",
                "last_error_message",
                "updated_at",
            ]
        )

        return normalized

    @transaction.atomic
    def _persist(
        self,
        template,
        examples,
        analysis,
    ):
        template.visual_structure = analysis["visual_structure"]

        template.copy_structure = analysis["copy_structure"]

        template.prompt_guidance = analysis["prompt_guidance"]

        template.do_rules = analysis["do_rules"]

        template.dont_rules = analysis["dont_rules"]

        template.save(
            update_fields=[
                "visual_structure",
                "copy_structure",
                "prompt_guidance",
                "do_rules",
                "dont_rules",
                "updated_at",
            ]
        )

        notes = analysis["image_notes"]

        for example in examples:
            note = notes.get(
                str(example.id),
                "",
            )

            if not note:
                continue

            example.gemini_vision_notes = note

            example.save(
                update_fields=[
                    "gemini_vision_notes",
                    "updated_at",
                ]
            )


def reanalyze_ad_template(
    template,
    *,
    connection=None,
):
    connection = connection or get_template_analysis_connection(template)

    return GeminiTemplateAnalyzer(connection).analyze(template)
