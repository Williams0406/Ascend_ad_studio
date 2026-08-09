import base64
import re
from dataclasses import dataclass

import requests
from django.conf import settings
from django.utils import timezone

from integrations.models import AIProviderConnection
from integrations.services.encryption import decrypt_api_key
from studio.services.generation_inputs import (
    GenerationImageSource,
    ordered_generation_image_sources,
)
from studio.services.prompts import layout_requires_single_canvas


class PromptComposerError(Exception):
    """
    Error controlado durante la composición del prompt.
    """


@dataclass(frozen=True)
class PromptQualityResult:
    is_valid: bool
    issues: tuple[str, ...]


DEFAULT_COMPOSER_MODEL = "gemini-2.5-pro"
DEFAULT_COMPOSER_TIMEOUT = 120
DEFAULT_COMPOSER_MAX_RETRIES = 2

COMPOSER_ENDPOINT = (
    "https://generativelanguage.googleapis.com/" "v1beta/models/{model}:generateContent"
)

FORBIDDEN_META_PHRASES = (
    "as an ai",
    "as a language model",
    "here is the prompt",
    "here's the prompt",
    "final prompt:",
    "prompt final:",
    "i cannot",
    "i can't",
    "no puedo",
    "lo siento",
    "markdown",
)

SPLIT_SCREEN_TERMS = (
    "split-screen",
    "split screen",
    "pantalla dividida",
    "before and after",
    "before/after",
    "antes y después",
    "side-by-side comparison",
    "comparación lado a lado",
    "two panels",
    "dos paneles",
)


def _composer_model() -> str:
    return getattr(
        settings,
        "GEMINI_PROMPT_COMPOSER_MODEL",
        DEFAULT_COMPOSER_MODEL,
    )


def _composer_timeout() -> int:
    return int(
        getattr(
            settings,
            "GEMINI_PROMPT_COMPOSER_TIMEOUT",
            DEFAULT_COMPOSER_TIMEOUT,
        )
    )


def _composer_max_retries() -> int:
    return int(
        getattr(
            settings,
            "GEMINI_PROMPT_COMPOSER_MAX_RETRIES",
            DEFAULT_COMPOSER_MAX_RETRIES,
        )
    )


def get_gemini_composer_connection(job) -> AIProviderConnection:
    """
    Obtiene una conexión Gemini activa del workspace del job.

    La conexión usada para componer no tiene que ser la misma conexión
    seleccionada como proveedor de generación. En el pipeline final,
    el job puede usar FAL para generar y Gemini únicamente para componer.
    """

    current_connection = job.provider_connection

    if (
        current_connection
        and current_connection.provider == AIProviderConnection.Provider.GEMINI
        and current_connection.status == AIProviderConnection.Status.ACTIVE
        and current_connection.encrypted_api_key
    ):
        return current_connection

    queryset = AIProviderConnection.objects.filter(
        workspace=job.project.workspace,
        provider=AIProviderConnection.Provider.GEMINI,
        status=AIProviderConnection.Status.ACTIVE,
    ).exclude(encrypted_api_key="")

    connection = queryset.filter(is_default=True).first()
    connection = connection or queryset.first()

    if not connection:
        raise PromptComposerError(
            "El workspace no tiene una conexión Gemini activa "
            "para componer el prompt."
        )

    return connection


def normalize_composed_prompt(text: str) -> str:
    """
    Elimina envoltorios habituales de modelos de lenguaje sin modificar
    el contenido creativo del prompt.
    """

    normalized = str(text or "").strip()

    if not normalized:
        return ""

    normalized = re.sub(
        r"^\s*```(?:text|markdown|md|plaintext)?\s*",
        "",
        normalized,
        flags=re.IGNORECASE,
    )

    normalized = re.sub(
        r"\s*```\s*$",
        "",
        normalized,
    )

    normalized = re.sub(
        r"^\s*(?:final\s+prompt|prompt\s+final|prompt)\s*:\s*",
        "",
        normalized,
        flags=re.IGNORECASE,
    )

    normalized = normalized.replace("\r\n", "\n")
    normalized = normalized.replace("\r", "\n")

    normalized = re.sub(
        r"[ \t]+\n",
        "\n",
        normalized,
    )

    normalized = re.sub(
        r"\n{4,}",
        "\n\n\n",
        normalized,
    )

    return normalized.strip()


def _effective_job_cta(job) -> str:
    cta = str(job.call_to_action or "").strip()

    if cta:
        return cta

    if job.use_brand_kit:
        brand_kit = getattr(job.project.workspace, "brand_kit", None)

        if brand_kit:
            return str(brand_kit.default_call_to_action or "").strip()

    return ""


def _contains_raw_json_document(text: str) -> bool:
    stripped = text.strip()

    if not stripped:
        return False

    if stripped.startswith("{") and stripped.endswith("}"):
        return True

    if stripped.startswith("[") and stripped.endswith("]"):
        return True

    json_markers = (
        '"layout_schema":',
        '"input_role":',
        '"purpose_codes":',
        '"schema_version":',
    )

    return any(marker in stripped for marker in json_markers)


def detect_composed_prompt_quality_issues(
    job,
    text: str,
) -> PromptQualityResult:
    """
    Valida el prompt final mediante reglas determinísticas.

    No realiza nuevas llamadas a IA.
    """

    normalized = normalize_composed_prompt(text)
    issues: list[str] = []

    if not normalized:
        issues.append("El prompt compuesto está vacío.")

        return PromptQualityResult(
            is_valid=False,
            issues=tuple(issues),
        )

    minimum_length = int(
        getattr(
            settings,
            "GEMINI_COMPOSED_PROMPT_MIN_LENGTH",
            600,
        )
    )

    if len(normalized) < minimum_length:
        issues.append(
            f"El prompt compuesto tiene menos de " f"{minimum_length} caracteres."
        )

    headline = str(job.headline or "").strip()

    if headline and headline not in normalized:
        issues.append("No contiene literalmente el titular obligatorio.")

    call_to_action = _effective_job_cta(job)

    if call_to_action and call_to_action not in normalized:
        issues.append("No contiene literalmente el CTA obligatorio.")

    sources = ordered_generation_image_sources(job)

    for source in sources:
        label = f"Image {source.image_number}"

        if label.lower() not in normalized.lower():
            issues.append(f"No contiene la referencia explícita a {label}.")

    if job.template_id:
        template = job.template

        if template.layout_constraints:
            layout_terms = (
                "layout",
                "composición",
                "composition",
                "estructura visual",
            )

            if not any(term in normalized.lower() for term in layout_terms):
                issues.append("No contiene instrucciones explícitas de layout.")

            if layout_requires_single_canvas(template.layout_constraints):
                found_forbidden_terms = [
                    term for term in SPLIT_SCREEN_TERMS if term in normalized.lower()
                ]

                if found_forbidden_terms:
                    issues.append(
                        "El prompt incluye una composición dividida "
                        "aunque la plantilla exige un lienzo único: "
                        + ", ".join(found_forbidden_terms)
                        + "."
                    )

    lower_text = normalized.lower()

    found_meta_phrases = [
        phrase for phrase in FORBIDDEN_META_PHRASES if phrase in lower_text
    ]

    if found_meta_phrases:
        issues.append(
            "Contiene lenguaje meta o explicativo no permitido: "
            + ", ".join(found_meta_phrases)
            + "."
        )

    if _contains_raw_json_document(normalized):
        issues.append(
            "El resultado parece contener JSON crudo en lugar "
            "de un prompt de producción."
        )

    return PromptQualityResult(
        is_valid=not issues,
        issues=tuple(issues),
    )


def _source_rule(source: GenerationImageSource) -> str:
    image_label = f"Image {source.image_number}"
    purposes = ", ".join(source.purpose_codes) or "ninguno"

    role_rules = {
        "product_image": (
            "Es la identidad visual del producto. Conserva forma, "
            "materiales, proporciones, colores, etiquetas y empaque."
        ),
        "character_reference": (
            "Es la referencia visual del personaje. Conserva identidad "
            "visual, rostro, cabello, complexión y rasgos principales."
        ),
        "reference_ad": (
            "Es una referencia publicitaria. Usa únicamente su dirección "
            "de estilo, composición o iluminación autorizada. No copies "
            "texto, marcas ni productos."
        ),
        "template": (
            "Es una referencia de plantilla. Usa su jerarquía y lógica "
            "compositiva sin copiar textos."
        ),
        "background": (
            "Es una referencia de fondo o escenario. Mantén su función "
            "ambiental sin convertirla en el sujeto principal."
        ),
        "lifestyle_reference": (
            "Es una referencia lifestyle. Usa su naturalidad, contexto, "
            "energía y relación entre sujetos."
        ),
        "packaging": (
            "Es el empaque real. Conserva su identidad visual, etiquetas "
            "y proporciones."
        ),
        "logo": (
            "Es el logotipo oficial. No lo redibujes, deformes, gires " "ni sustituyas."
        ),
        "icon": (
            "Es un icono autorizado. Úsalo como recurso de apoyo "
            "sin alterar su diseño."
        ),
    }

    rule = role_rules.get(
        source.input_role,
        "Respeta el rol asignado a esta imagen.",
    )

    return (
        f"{image_label}: {source.name}. "
        f"Rol: {source.input_role}. "
        f"Propósitos: {purposes}. "
        f"{rule}"
    )


def build_composer_system_instruction(job) -> str:
    sources = ordered_generation_image_sources(job)

    image_rules = "\n".join(_source_rule(source) for source in sources)

    if not image_rules:
        image_rules = (
            "El job no contiene imágenes adjuntas. No hagas referencias "
            "a imágenes inexistentes."
        )

    reference_ad_count = sum(source.input_role == "reference_ad" for source in sources)

    character_count = sum(
        source.input_role == "character_reference" for source in sources
    )

    return f"""
Eres un director creativo senior y especialista en prompt engineering
para modelos profesionales de generación y edición de imágenes.

Tu trabajo NO es generar una imagen.
Tu trabajo es convertir un brief estructurado en un único prompt final
de producción, listo para ser ejecutado por un modelo de imágenes.

REGLAS DE SALIDA:
- Devuelve únicamente el prompt final.
- No uses Markdown.
- No uses bloques de código.
- No escribas introducciones, explicaciones, notas ni conclusiones.
- No devuelvas JSON.
- Todo el copy visible dentro de la imagen debe estar en español.
- Conserva literalmente todo titular, oferta y CTA marcados como obligatorios.
- No inventes precios, descuentos, testimonios, garantías, cifras,
  funciones ni afirmaciones.
- No elimines restricciones del brief.
- No cambies los roles asignados a las imágenes.
- Usa la nomenclatura exacta Image 1, Image 2, etc.
- No menciones imágenes que no hayan sido proporcionadas.
- Produce instrucciones visuales concretas, ejecutables y sin ambigüedad.

REGLAS DE IMÁGENES:
{image_rules}

RESUMEN DE ENTRADAS:
- Número total de imágenes: {len(sources)}
- Referencias publicitarias: {reference_ad_count}
- Referencias de personaje: {character_count}

REGLA DE REFERENCIAS PUBLICITARIAS:
Las referencias publicitarias sirven para mantener coherencia de estilo,
composición o iluminación. Nunca copies literalmente sus textos,
logotipos, marcas, productos o layout completo.

REGLA DE PERSONAS:
Cuando exista una referencia de personaje, conserva la continuidad visual
indicada por el brief. No reemplaces esa referencia por una persona distinta.

El resultado debe ser un prompt de producción autocontenido, preciso,
ordenado y suficientemente detallado para que otro modelo genere la
pieza sin necesitar información adicional.
""".strip()


def _encode_image_part(
    source: GenerationImageSource,
) -> dict:
    try:
        with source.image_file.open("rb") as image_file:
            encoded = base64.b64encode(image_file.read()).decode("ascii")
    except OSError as exc:
        raise PromptComposerError(
            f"No se pudo leer {source.name}, correspondiente a "
            f"Image {source.image_number}."
        ) from exc

    return {
        "inlineData": {
            "mimeType": source.mime_type,
            "data": encoded,
        }
    }


def build_composer_image_parts(job) -> list[dict]:
    """
    Genera las imágenes inline usando el mismo orden canónico
    de las demás etapas.
    """

    return [
        _encode_image_part(source) for source in ordered_generation_image_sources(job)
    ]


def _extract_text_response(data: dict) -> str:
    candidates = data.get("candidates") or []

    if not candidates:
        block_reason = (data.get("promptFeedback") or {}).get("blockReason")

        message = "Gemini no devolvió un prompt compuesto."

        if block_reason:
            message += f" Motivo de bloqueo: {block_reason}."

        raise PromptComposerError(message)

    parts = candidates[0].get("content", {}).get("parts", [])

    text_parts = [str(part.get("text") or "") for part in parts if part.get("text")]

    text = "\n".join(text_parts).strip()

    if not text:
        raise PromptComposerError(
            "Gemini respondió correctamente, pero no incluyó texto."
        )

    return text


class GeminiPromptComposer:
    endpoint = COMPOSER_ENDPOINT

    def __init__(
        self,
        connection: AIProviderConnection,
        *,
        model: str | None = None,
        timeout: int | None = None,
        max_retries: int | None = None,
    ):
        if connection.provider != AIProviderConnection.Provider.GEMINI:
            raise PromptComposerError("El compositor requiere una conexión Gemini.")

        if connection.status != AIProviderConnection.Status.ACTIVE:
            raise PromptComposerError(
                "La conexión Gemini del compositor no está activa."
            )

        if not connection.encrypted_api_key:
            raise PromptComposerError("La conexión Gemini no contiene una API key.")

        self.connection = connection
        self.api_key = decrypt_api_key(connection.encrypted_api_key)
        self.model = model or _composer_model()
        self.timeout = timeout if timeout is not None else _composer_timeout()
        self.max_retries = (
            max_retries if max_retries is not None else _composer_max_retries()
        )

    def _build_user_instruction(
        self,
        job,
        *,
        previous_output: str = "",
        quality_issues: tuple[str, ...] = (),
    ) -> str:
        if not previous_output:
            return (
                "Convierte el siguiente brief en un prompt final de "
                "producción para generación de imágenes.\n\n"
                "BRIEF DETERMINÍSTICO:\n"
                f"{job.prompt}"
            )

        issues = "\n".join(f"- {issue}" for issue in quality_issues)

        return (
            "Reescribe completamente el prompt anterior corrigiendo "
            "todos los problemas detectados.\n\n"
            "PROBLEMAS QUE DEBES CORREGIR:\n"
            f"{issues}\n\n"
            "PROMPT ANTERIOR DEFECTUOSO:\n"
            f"{previous_output}\n\n"
            "BRIEF ORIGINAL, QUE SIGUE SIENDO OBLIGATORIO:\n"
            f"{job.prompt}"
        )

    def _request(
        self,
        job,
        *,
        previous_output: str = "",
        quality_issues: tuple[str, ...] = (),
    ) -> str:
        user_instruction = self._build_user_instruction(
            job,
            previous_output=previous_output,
            quality_issues=quality_issues,
        )

        payload = {
            "systemInstruction": {
                "parts": [{"text": build_composer_system_instruction(job)}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": user_instruction,
                        },
                        *build_composer_image_parts(job),
                    ],
                }
            ],
            "generationConfig": {
                "responseMimeType": "text/plain",
                "temperature": 0.35,
                "topP": 0.9,
                "maxOutputTokens": 8192,
            },
        }

        try:
            response = requests.post(
                self.endpoint.format(model=self.model),
                headers={
                    "x-goog-api-key": self.api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise PromptComposerError(
                "No se pudo conectar con Gemini para componer " "el prompt."
            ) from exc

        if response.status_code == 400:
            raise PromptComposerError(
                self._error_detail(
                    response,
                    "Gemini rechazó el payload del compositor.",
                )
            )

        if response.status_code == 401:
            raise PromptComposerError("Gemini rechazó la API key configurada.")

        if response.status_code == 403:
            raise PromptComposerError(
                "La API key no tiene permiso para utilizar " f"{self.model}."
            )

        if response.status_code == 404:
            raise PromptComposerError(
                f"El modelo {self.model} no está disponible "
                "para esta API key o endpoint."
            )

        if response.status_code == 429:
            raise PromptComposerError(
                "Gemini alcanzó su límite de cuota al componer " "el prompt."
            )

        if not response.ok:
            raise PromptComposerError(
                self._error_detail(
                    response,
                    f"Gemini devolvió el estado " f"{response.status_code}.",
                )
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise PromptComposerError(
                "Gemini devolvió una respuesta no válida."
            ) from exc

        return _extract_text_response(data)

    @staticmethod
    def _error_detail(
        response,
        fallback: str,
    ) -> str:
        try:
            detail = response.json().get("error", {}).get("message", "")
        except (TypeError, ValueError):
            detail = ""

        return detail or fallback

    def compose(self, job) -> str:
        """
        Realiza una primera composición y hasta max_retries
        reintentos correctivos.

        Con max_retries=2 puede efectuar como máximo 3 llamadas:
        1 intento inicial + 2 reintentos.
        """

        if not str(job.prompt or "").strip():
            raise PromptComposerError("El job no contiene el brief de la Etapa 1.")

        previous_output = ""
        previous_issues: tuple[str, ...] = ()

        total_attempts = self.max_retries + 1

        for attempt in range(total_attempts):
            raw_text = self._request(
                job,
                previous_output=previous_output,
                quality_issues=previous_issues,
            )

            normalized = normalize_composed_prompt(raw_text)

            quality = detect_composed_prompt_quality_issues(
                job,
                normalized,
            )

            if quality.is_valid:
                job.composed_prompt = normalized
                job.save(
                    update_fields=[
                        "composed_prompt",
                        "updated_at",
                    ]
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

            previous_output = normalized
            previous_issues = quality.issues

        error = (
            "Gemini no produjo un prompt válido después de "
            f"{total_attempts} intentos. Problemas finales: "
            + "; ".join(previous_issues)
        )

        self.connection.last_error_message = error
        self.connection.save(
            update_fields=[
                "last_error_message",
                "updated_at",
            ]
        )

        raise PromptComposerError(error)


def compose_prompt_with_gemini(
    job,
    *,
    connection: AIProviderConnection | None = None,
) -> str:
    """
    Punto de entrada de la Etapa 2.

    En la Fase 4 será llamado desde el worker de Celery.
    """

    composer_connection = connection or get_gemini_composer_connection(job)

    return GeminiPromptComposer(composer_connection).compose(job)
