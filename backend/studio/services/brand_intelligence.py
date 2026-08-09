import json
import re
from typing import Any

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
from studio.models import (
    BrandIntelligenceProfile,
    BrandKit,
    BrandRule,
)


class BrandIntelligenceGenerationError(Exception):
    """
    Error controlado al generar el banco
    de inteligencia de marca.
    """


DEFAULT_BRAND_INTELLIGENCE_MODEL = "gemini-2.5-pro"

DEFAULT_BRAND_INTELLIGENCE_TIMEOUT = 120

BRAND_INTELLIGENCE_ENDPOINT = (
    "https://generativelanguage.googleapis.com/" "v1beta/models/{model}:generateContent"
)


def _brand_intelligence_model():
    return getattr(
        settings,
        "GEMINI_BRAND_INTELLIGENCE_MODEL",
        DEFAULT_BRAND_INTELLIGENCE_MODEL,
    )


def _brand_intelligence_timeout():
    return int(
        getattr(
            settings,
            "GEMINI_BRAND_INTELLIGENCE_TIMEOUT",
            DEFAULT_BRAND_INTELLIGENCE_TIMEOUT,
        )
    )


def get_brand_intelligence_connection(
    workspace,
):
    queryset = AIProviderConnection.objects.filter(
        workspace=workspace,
        provider=(AIProviderConnection.Provider.GEMINI),
        status=(AIProviderConnection.Status.ACTIVE),
    ).exclude(encrypted_api_key="")

    connection = queryset.filter(is_default=True).first()

    connection = connection or queryset.first()

    if not connection:
        raise BrandIntelligenceGenerationError(
            "El workspace no tiene una conexión "
            "Gemini activa para generar "
            "Brand Intelligence."
        )

    return connection


def build_brand_intelligence_prompt(
    workspace,
    research_notes: str,
    number_of_profiles: int,
) -> str:
    brand_kit = (
        BrandKit.objects.filter(workspace=workspace).select_related("rules").first()
    )

    if not brand_kit:
        raise BrandIntelligenceGenerationError(
            "El workspace debe tener un " "Brand Kit antes de generar perfiles."
        )

    try:
        rules = brand_kit.rules
    except BrandRule.DoesNotExist:
        rules = None

    brand_context = {
        "brand_name": (brand_kit.brand_name),
        "brand_description": (brand_kit.brand_description),
        "tone_of_voice": (brand_kit.tone_of_voice),
        "default_call_to_action": (brand_kit.default_call_to_action),
        "primary_color": (brand_kit.primary_color),
        "secondary_color": (brand_kit.secondary_color),
        "accent_color": (brand_kit.accent_color),
        "preferred_terms": (rules.preferred_terms if rules else []),
        "forbidden_terms": (rules.forbidden_terms if rules else []),
        "required_elements": (rules.required_elements if rules else []),
        "forbidden_elements": (rules.forbidden_elements if rules else []),
    }

    return f"""
Actúa como estratega senior de marca, investigación
de audiencias y publicidad.

Tu tarea es generar EXACTAMENTE {number_of_profiles}
perfiles reutilizables de inteligencia de marca.

CONTEXTO DE MARCA:
{json.dumps(
    brand_context,
    ensure_ascii=False,
    indent=2,
)}

NOTAS DE INVESTIGACIÓN:
{research_notes}

OBJETIVO:
Crear un banco reutilizable que posteriormente pueda ser
seleccionado por un planificador de conceptos. Estos perfiles
NO pertenecen a un anuncio ni a un proyecto específico.

REGLAS:
- Devuelve únicamente JSON válido.
- No uses Markdown.
- Todo el contenido debe estar en español.
- Debes devolver exactamente {number_of_profiles} perfiles.
- Cada perfil debe representar una combinación útil y
  suficientemente distinta de audiencia, problema,
  emoción y enfoque persuasivo.
- No generes duplicados semánticos.
- No inventes información demográfica demasiado específica
  cuando las notas no la respalden.
- persona debe describir a quién se dirige la comunicación.
- pain_point debe describir un problema o tensión real.
- angle debe indicar el enfoque persuasivo.
- visual_direction debe poder convertirse en una escena.
- emotion debe ser la emoción principal a provocar o representar.
- copy_hook debe ser una idea breve de apertura, no un anuncio
  completo ni una afirmación inventada.

ESQUEMA EXACTO:
{{
  "profiles": [
    {{
      "persona": "string",
      "pain_point": "string",
      "angle": "string",
      "visual_direction": "string",
      "emotion": "string",
      "copy_hook": "string"
    }}
  ]
}}
""".strip()


def normalize_brand_intelligence_response(
    raw_response: str | dict[str, Any],
    expected_count: int,
) -> list[dict[str, str]]:
    if isinstance(
        raw_response,
        str,
    ):
        cleaned = raw_response.strip()

        cleaned = re.sub(
            r"^\s*```(?:json)?\s*",
            "",
            cleaned,
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
            raise BrandIntelligenceGenerationError(
                "Gemini devolvió una respuesta " "que no contiene JSON válido."
            ) from exc

    else:
        payload = raw_response

    if not isinstance(payload, dict):
        raise BrandIntelligenceGenerationError(
            "La respuesta de Gemini debe ser " "un objeto JSON."
        )

    profiles = payload.get("profiles")

    if not isinstance(
        profiles,
        list,
    ):
        raise BrandIntelligenceGenerationError(
            "La respuesta no contiene " "una lista 'profiles'."
        )

    if len(profiles) != expected_count:
        raise BrandIntelligenceGenerationError(
            "Gemini devolvió una cantidad incorrecta "
            "de perfiles. "
            f"Esperados: {expected_count}. "
            f"Recibidos: {len(profiles)}."
        )

    normalized = []

    required_fields = (
        "persona",
        "pain_point",
        "angle",
        "visual_direction",
        "emotion",
        "copy_hook",
    )

    fingerprints = set()

    for index, profile in enumerate(
        profiles,
        start=1,
    ):
        if not isinstance(
            profile,
            dict,
        ):
            raise BrandIntelligenceGenerationError(
                f"El perfil {index} no es " "un objeto JSON."
            )

        normalized_profile = {}

        for field in required_fields:
            value = profile.get(
                field,
                "",
            )

            if not isinstance(
                value,
                str,
            ):
                value = str(value)

            value = value.strip()

            if not value:
                raise BrandIntelligenceGenerationError(
                    f"El perfil {index} no contiene " f"el campo obligatorio '{field}'."
                )

            normalized_profile[field] = value

        fingerprint = (
            normalized_profile["persona"].casefold(),
            normalized_profile["pain_point"].casefold(),
            normalized_profile["angle"].casefold(),
        )

        if fingerprint in fingerprints:
            raise BrandIntelligenceGenerationError(
                "Gemini devolvió perfiles " "duplicados."
            )

        fingerprints.add(fingerprint)

        normalized.append(normalized_profile)

    return normalized


def _extract_gemini_text(
    data,
):
    candidates = data.get("candidates") or []

    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason")

        message = "Gemini no devolvió perfiles."

        if reason:
            message += f" Motivo de bloqueo: {reason}."

        raise BrandIntelligenceGenerationError(message)

    parts = candidates[0].get("content", {}).get("parts", [])

    text = "\n".join(
        str(
            part.get(
                "text",
                "",
            )
        )
        for part in parts
        if part.get("text")
    ).strip()

    if not text:
        raise BrandIntelligenceGenerationError(
            "Gemini respondió correctamente " "pero no incluyó texto."
        )

    return text


@transaction.atomic
def save_brand_intelligence_profiles(
    workspace,
    profiles: list[dict[str, str]],
    *,
    replace_existing: bool = False,
    generation_metadata: dict[str, Any] | None = None,
) -> list[BrandIntelligenceProfile]:
    if replace_existing:
        (
            BrandIntelligenceProfile.objects.filter(
                workspace=workspace,
                is_active=True,
            ).update(is_active=False)
        )

    metadata = generation_metadata or {}

    objects = [
        BrandIntelligenceProfile(
            workspace=workspace,
            persona=profile["persona"],
            pain_point=profile["pain_point"],
            angle=profile["angle"],
            visual_direction=profile["visual_direction"],
            emotion=profile["emotion"],
            copy_hook=profile["copy_hook"],
            metadata=dict(metadata),
            is_active=True,
        )
        for profile in profiles
    ]

    return BrandIntelligenceProfile.objects.bulk_create(objects)


def generate_brand_intelligence(
    workspace,
    research_notes,
    *,
    number_of_profiles=10,
    replace_existing=False,
    connection=None,
):
    connection = connection or get_brand_intelligence_connection(workspace)

    prompt = build_brand_intelligence_prompt(
        workspace,
        research_notes,
        number_of_profiles,
    )

    api_key = decrypt_api_key(connection.encrypted_api_key)

    model = _brand_intelligence_model()

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": prompt,
                    }
                ],
            }
        ],
        "generationConfig": {
            "responseMimeType": ("application/json"),
            "temperature": 0.55,
            "topP": 0.9,
            "maxOutputTokens": 8192,
        },
    }

    try:
        response = requests.post(
            BRAND_INTELLIGENCE_ENDPOINT.format(model=model),
            headers={
                "x-goog-api-key": (api_key),
                "Content-Type": ("application/json"),
            },
            json=payload,
            timeout=(_brand_intelligence_timeout()),
        )

    except requests.RequestException as exc:
        raise BrandIntelligenceGenerationError(
            "No se pudo conectar con Gemini " "para generar Brand Intelligence."
        ) from exc

    if not response.ok:
        try:
            detail = response.json().get("error", {}).get("message", "")
        except (
            TypeError,
            ValueError,
        ):
            detail = ""

        connection.last_error_message = detail or (
            "Gemini devolvió el estado " f"{response.status_code}."
        )

        connection.save(
            update_fields=[
                "last_error_message",
                "updated_at",
            ]
        )

        raise BrandIntelligenceGenerationError(connection.last_error_message)

    try:
        data = response.json()
    except ValueError as exc:
        raise BrandIntelligenceGenerationError(
            "Gemini devolvió una respuesta " "HTTP no válida."
        ) from exc

    raw_text = _extract_gemini_text(data)

    profiles = normalize_brand_intelligence_response(
        raw_text,
        expected_count=(number_of_profiles),
    )

    saved = save_brand_intelligence_profiles(
        workspace,
        profiles,
        replace_existing=(replace_existing),
        generation_metadata={
            "provider": "gemini",
            "model": model,
            "source": ("brand_intelligence_generate"),
        },
    )

    connection.last_success_at = timezone.now()

    connection.last_error_message = ""

    connection.save(
        update_fields=[
            "last_success_at",
            "last_error_message",
            "updated_at",
        ]
    )

    return saved
