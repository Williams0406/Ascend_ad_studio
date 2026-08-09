import hashlib
import json
import random
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
    AdProject,
    AdTemplate,
    BrandIntelligenceProfile,
    ConceptPlan,
)


class ConceptPlannerError(Exception):
    """
    Error base del Concept Planner.
    """


class ConceptPlannerValidationError(ConceptPlannerError):
    """
    Error de inputs o recursos seleccionados.
    """


class ConceptPlannerGeminiError(ConceptPlannerError):
    """
    Error de Gemini que puede resolverse mediante fallback.
    """


DEFAULT_CONCEPT_PLANNER_MODEL = "gemini-2.5-pro"

DEFAULT_CONCEPT_PLANNER_TIMEOUT = 120

CONCEPT_PLANNER_ENDPOINT = (
    "https://generativelanguage.googleapis.com/" "v1beta/models/{model}:generateContent"
)


def _planner_model():
    return getattr(
        settings,
        "GEMINI_CONCEPT_PLANNER_MODEL",
        DEFAULT_CONCEPT_PLANNER_MODEL,
    )


def _planner_timeout():
    return int(
        getattr(
            settings,
            "GEMINI_CONCEPT_PLANNER_TIMEOUT",
            DEFAULT_CONCEPT_PLANNER_TIMEOUT,
        )
    )


def _stable_seed(
    total_ads_requested,
    profile_ids,
    template_ids,
):
    """
    Seed reproducible para fallback y distribución de volumen.

    No usa hash() de Python porque cambia entre procesos.
    """

    raw = "|".join(
        [
            str(total_ads_requested),
            *sorted(str(value) for value in profile_ids),
            *sorted(str(value) for value in template_ids),
        ]
    )

    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    return int(
        digest[:16],
        16,
    )


def get_concept_planner_connection(
    workspace,
):
    queryset = AIProviderConnection.objects.filter(
        workspace=workspace,
        provider=(AIProviderConnection.Provider.GEMINI),
        status=(AIProviderConnection.Status.ACTIVE),
    ).exclude(encrypted_api_key="")

    connection = queryset.filter(is_default=True).first()

    return connection or queryset.first()


def _load_profiles(
    workspace,
    profile_ids,
):
    ids = list(dict.fromkeys(profile_ids))

    profiles = list(
        BrandIntelligenceProfile.objects.filter(
            workspace=workspace,
            is_active=True,
            id__in=ids,
        )
    )

    by_id = {str(profile.id): profile for profile in profiles}

    missing = [str(profile_id) for profile_id in ids if str(profile_id) not in by_id]

    if missing:
        raise ConceptPlannerValidationError(
            "Uno o más perfiles no existen, "
            "están inactivos o pertenecen "
            "a otro workspace."
        )

    # Recuperar el orden recibido por el frontend.
    return [by_id[str(profile_id)] for profile_id in ids]


def _load_templates(
    workspace,
    template_ids,
):
    ids = list(dict.fromkeys(template_ids))

    templates = list(
        AdTemplate.objects.filter(
            workspace=workspace,
            is_active=True,
            id__in=ids,
        ).prefetch_related(
            "example_images__image",
        )
    )

    by_id = {str(template.id): template for template in templates}

    missing = [str(template_id) for template_id in ids if str(template_id) not in by_id]

    if missing:
        raise ConceptPlannerValidationError(
            "Una o más plantillas no existen, "
            "están inactivas o pertenecen "
            "a otro workspace."
        )

    return [by_id[str(template_id)] for template_id in ids]


def _profile_summary(profile):
    return {
        "id": str(profile.id),
        "persona": profile.persona,
        "pain_point": profile.pain_point,
        "angle": profile.angle,
        "emotion": profile.emotion,
        "visual_direction": (profile.visual_direction),
        "copy_hook": (profile.copy_hook),
    }


def _template_summary(template):
    return {
        "id": str(template.id),
        "name": template.name,
        "format": template.format,
        "description": template.description,
        "layout_constraints": (template.layout_constraints or {}),
        "visual_structure": (template.visual_structure),
        "copy_structure": (template.copy_structure),
        "prompt_guidance": (template.prompt_guidance),
        "do_rules": (template.do_rules or []),
        "dont_rules": (template.dont_rules or []),
        "example_notes": [
            example.gemini_vision_notes
            for example in (template.example_images.all())
            if example.gemini_vision_notes
        ],
    }


def build_concept_planner_prompt(
    *,
    concept_count,
    total_ads_requested,
    profiles,
    templates,
):
    profile_payload = [_profile_summary(profile) for profile in profiles]

    template_payload = [_template_summary(template) for template in templates]

    return f"""
Actúa como estratega creativo senior y copywriter
especializado en publicidad digital.

Debes crear EXACTAMENTE {concept_count} conceptos
publicitarios distintos para un volumen final de
{total_ads_requested} anuncios.

PERFILES DISPONIBLES:
{json.dumps(
    profile_payload,
    ensure_ascii=False,
    indent=2,
)}

PLANTILLAS DISPONIBLES:
{json.dumps(
    template_payload,
    ensure_ascii=False,
    indent=2,
)}

REGLAS DURAS:
- layout_constraints contiene restricciones estructurales
  obligatorias de cada plantilla. No debes contradecirlas.
- visual_structure, copy_structure, prompt_guidance,
  do_rules y dont_rules describen la interpretación
  creativa de cada plantilla.
- Las restricciones de layout tienen prioridad sobre
  cualquier propuesta creativa incompatible.
- Devuelve únicamente JSON válido.
- No uses Markdown.
- Todo el copy debe estar en español.
- Devuelve exactamente {concept_count} conceptos.
- Cada concepto DEBE utilizar una plantilla diferente.
- No repitas ad_template_id.
- Solo puedes utilizar IDs incluidos en este prompt.
- profile_id puede repetirse entre conceptos.
- ad_template_id nunca puede repetirse.
- No inventes perfiles ni plantillas.
- Cada concepto debe contener copy publicitario REAL.
- hook_variants debe contener 2 o 3 hooks reales.
- body_copy_primary debe ser copy publicitario listo para usar.
- body_copy_variant_a debe ser una variante real del body.
- cta debe ser una llamada a la acción real.
- visual_direction debe describir cómo aterrizar visualmente
  el concepto utilizando la plantilla seleccionada.
- rationale debe explicar brevemente por qué la combinación
  perfil + plantilla + enfoque tiene sentido.
- No escribas nombres internos como:
  "Concept 1 for Persona X",
  "Template concept for Y",
  "Concepto para perfil X"
  como si fueran copy publicitario.
- No incluyas ads_count. El backend lo calculará.
- No modifiques persona, pain_point, angle ni emotion.
  El backend los rehidratará desde la base de datos.

ESQUEMA EXACTO:
{{
  "concepts": [
    {{
      "ad_template_id": "uuid",
      "profile_id": "uuid",
      "hook_variants": [
        "hook real 1",
        "hook real 2"
      ],
      "body_copy_primary": "string",
      "body_copy_variant_a": "string",
      "cta": "string",
      "visual_direction": "string",
      "rationale": "string"
    }}
  ]
}}
""".strip()


def _extract_response_text(data):
    candidates = data.get("candidates") or []

    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason")

        message = "Gemini no devolvió conceptos."

        if reason:
            message += f" Motivo de bloqueo: {reason}."

        raise ConceptPlannerGeminiError(message)

    parts = candidates[0].get("content", {}).get("parts", [])

    text = "\n".join(
        str(part.get("text") or "") for part in parts if part.get("text")
    ).strip()

    if not text:
        raise ConceptPlannerGeminiError(
            "Gemini respondió sin contenido " "para el Concept Planner."
        )

    return text


def _parse_gemini_payload(raw_text):
    cleaned = str(raw_text or "").strip()

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
        raise ConceptPlannerGeminiError(
            "Gemini devolvió JSON inválido " "para el Concept Planner."
        ) from exc

    if not isinstance(
        payload,
        dict,
    ):
        raise ConceptPlannerGeminiError(
            "La respuesta del Concept Planner " "debe ser un objeto JSON."
        )

    concepts = payload.get("concepts")

    if not isinstance(
        concepts,
        list,
    ):
        raise ConceptPlannerGeminiError(
            "La respuesta no contiene " "una lista 'concepts'."
        )

    return concepts


FAKE_COPY_PATTERNS = (
    re.compile(
        r"^\s*concept(?:o)?\s*\d*\s+" r"(?:for|para)\s+.+$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^\s*.{1,70}\s+concept\s+" r"(?:for|para)\s+.{1,70}\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^\s*template\s+concept\s+" r"(?:for|para)\s+.+$",
        re.IGNORECASE,
    ),
)


def _looks_like_fake_copy_label(
    value,
):
    text = str(value or "").strip()

    if not text:
        return False

    if len(text) > 180:
        return False

    return any(pattern.match(text) for pattern in FAKE_COPY_PATTERNS)


def _clean_copy_value(
    value,
):
    text = str(value or "").strip()

    if not text:
        return ""

    if _looks_like_fake_copy_label(text):
        return ""

    return text


def _normalize_hooks(
    value,
):
    if not isinstance(
        value,
        list,
    ):
        return []

    normalized = []

    for item in value:
        text = _clean_copy_value(item)

        if text and text not in normalized:
            normalized.append(text)

        if len(normalized) == 3:
            break

    return normalized


def _normalize_gemini_concepts(
    raw_concepts,
    *,
    profiles_by_id,
    templates_by_id,
):
    """
    Normaliza y deduplica la salida de Gemini.

    Un concepto con IDs alucinados o sin copy real
    se descarta. El fallback cubrirá después la plantilla.
    """

    normalized = []

    used_templates = set()

    for raw in raw_concepts:
        if not isinstance(
            raw,
            dict,
        ):
            continue

        template_id = str(
            raw.get(
                "ad_template_id",
                "",
            )
        ).strip()

        profile_id = str(
            raw.get(
                "profile_id",
                "",
            )
        ).strip()

        if template_id not in templates_by_id:
            continue

        if profile_id not in profiles_by_id:
            continue

        if template_id in used_templates:
            continue

        hooks = _normalize_hooks(
            raw.get(
                "hook_variants",
                [],
            )
        )

        body_primary = _clean_copy_value(
            raw.get(
                "body_copy_primary",
                "",
            )
        )

        body_variant = _clean_copy_value(
            raw.get(
                "body_copy_variant_a",
                "",
            )
        )

        cta = _clean_copy_value(
            raw.get(
                "cta",
                "",
            )
        )

        visual_direction = str(
            raw.get(
                "visual_direction",
                "",
            )
            or ""
        ).strip()

        rationale = str(
            raw.get(
                "rationale",
                "",
            )
            or ""
        ).strip()

        # Los conceptos Gemini deben traer copy real.
        # Si no lo traen, dejamos esa plantilla para fallback.
        if len(hooks) < 2 or not body_primary or not body_variant or not cta:
            continue

        used_templates.add(template_id)

        normalized.append(
            {
                "ad_template_id": (template_id),
                "profile_id": profile_id,
                "hook_variants": hooks,
                "body_copy_primary": (body_primary),
                "body_copy_variant_a": (body_variant),
                "cta": cta,
                "generated_visual_direction": (visual_direction),
                "rationale": rationale,
                "source": "gemini",
            }
        )

    return normalized


def _request_gemini_concepts(
    *,
    connection,
    concept_count,
    total_ads_requested,
    profiles,
    templates,
):
    if not connection:
        raise ConceptPlannerGeminiError("No existe una conexión Gemini activa.")

    api_key = decrypt_api_key(connection.encrypted_api_key)

    model = _planner_model()

    prompt = build_concept_planner_prompt(
        concept_count=concept_count,
        total_ads_requested=(total_ads_requested),
        profiles=profiles,
        templates=templates,
    )

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
            "temperature": 0.65,
            "topP": 0.9,
            "maxOutputTokens": 8192,
        },
    }

    try:
        response = requests.post(
            CONCEPT_PLANNER_ENDPOINT.format(model=model),
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": ("application/json"),
            },
            json=payload,
            timeout=_planner_timeout(),
        )

    except requests.RequestException as exc:
        raise ConceptPlannerGeminiError(
            "No se pudo conectar con Gemini " "para planificar conceptos."
        ) from exc

    if not response.ok:
        try:
            detail = response.json().get("error", {}).get("message", "")
        except (
            TypeError,
            ValueError,
        ):
            detail = ""

        error = detail or (
            "Gemini devolvió el estado "
            f"{response.status_code} "
            "al planificar conceptos."
        )

        connection.last_error_message = error

        connection.save(
            update_fields=[
                "last_error_message",
                "updated_at",
            ]
        )

        raise ConceptPlannerGeminiError(error)

    try:
        data = response.json()
    except ValueError as exc:
        raise ConceptPlannerGeminiError(
            "Gemini devolvió una respuesta " "HTTP no válida."
        ) from exc

    text = _extract_response_text(data)

    raw_concepts = _parse_gemini_payload(text)

    connection.last_success_at = timezone.now()

    connection.last_error_message = ""

    connection.save(
        update_fields=[
            "last_success_at",
            "last_error_message",
            "updated_at",
        ]
    )

    return raw_concepts


def _fallback_concept(
    template,
    profile,
):
    """
    Fallback sin copy real, tal como define el plan.
    """

    return {
        "ad_template_id": str(template.id),
        "profile_id": str(profile.id),
        "hook_variants": [],
        "body_copy_primary": "",
        "body_copy_variant_a": "",
        "cta": "",
        "generated_visual_direction": "",
        "rationale": (
            "Concepto de respaldo creado "
            "determinísticamente porque Gemini "
            "no produjo una combinación utilizable "
            "para esta plantilla."
        ),
        "source": "fallback",
    }


def _fill_missing_concepts(
    concepts,
    *,
    concept_count,
    templates,
    profiles,
    rng,
):
    used_template_ids = {concept["ad_template_id"] for concept in concepts}

    available_templates = [
        template for template in templates if str(template.id) not in used_template_ids
    ]

    rng.shuffle(available_templates)

    profile_order = list(profiles)

    rng.shuffle(profile_order)

    profile_cursor = 0

    while len(concepts) < concept_count and available_templates:
        template = available_templates.pop(0)

        profile = profile_order[profile_cursor % len(profile_order)]

        profile_cursor += 1

        concepts.append(
            _fallback_concept(
                template,
                profile,
            )
        )

    return concepts[:concept_count]


def _rehydrate_concept(
    concept,
    *,
    concept_index,
    profiles_by_id,
    templates_by_id,
):
    """
    Sustituye los datos derivados de perfil/plantilla
    por los valores reales almacenados en BD.
    """

    profile = profiles_by_id[concept["profile_id"]]

    template = templates_by_id[concept["ad_template_id"]]

    generated_visual = str(
        concept.get(
            "generated_visual_direction",
            "",
        )
        or ""
    ).strip()

    visual_direction = (
        profile.visual_direction
        or generated_visual
        or template.prompt_guidance
        or template.visual_structure
    )

    return {
        "concept_index": concept_index,
        # IDs reales.
        "ad_template_id": str(template.id),
        "profile_id": str(profile.id),
        # Snapshot REAL de perfil.
        "persona": profile.persona,
        "pain_point": (profile.pain_point),
        "angle": profile.angle,
        "emotion": (profile.emotion),
        "profile_visual_direction": (profile.visual_direction),
        "profile_copy_hook": (profile.copy_hook),
        # Snapshot REAL de plantilla.
        "template_name": (template.name),
        "template_format": (template.format),
        "template_description": (template.description),
        "template_visual_structure": (template.visual_structure),
        "template_copy_structure": (template.copy_structure),
        "template_prompt_guidance": (template.prompt_guidance),
        "template_do_rules": list(template.do_rules or []),
        "template_dont_rules": list(template.dont_rules or []),
        # Dirección/copy del concepto.
        "visual_direction": (visual_direction),
        "hook_variants": list(
            concept.get(
                "hook_variants",
                [],
            )
        ),
        "body_copy_primary": (
            concept.get(
                "body_copy_primary",
                "",
            )
        ),
        "body_copy_variant_a": (
            concept.get(
                "body_copy_variant_a",
                "",
            )
        ),
        "cta": concept.get(
            "cta",
            "",
        ),
        "rationale": (
            concept.get(
                "rationale",
                "",
            )
        ),
        "source": concept.get(
            "source",
            "fallback",
        ),
        # Se reparte posteriormente.
        "ads_count": 1,
    }


def _distribute_ads_count(
    concepts,
    *,
    total_ads_requested,
    rng,
):
    concept_count = len(concepts)

    if not concept_count:
        return concepts

    remaining = total_ads_requested - concept_count

    if remaining <= 0:
        return concepts

    order = list(range(concept_count))

    rng.shuffle(order)

    for offset in range(remaining):
        index = order[offset % concept_count]

        concepts[index]["ads_count"] += 1

    return concepts


@transaction.atomic
def plan_concepts(
    *,
    workspace,
    project,
    requested_by,
    total_ads_requested,
    profile_ids,
    template_ids,
    connection=None,
):
    """
    Pieza C.

    Crea un ConceptPlan para revisión.
    No crea GenerationBatch ni GenerationJob.
    """
    if not isinstance(
        project,
        AdProject,
    ):
        raise ConceptPlannerValidationError("Debes proporcionar un AdProject válido.")

    if project.workspace_id != workspace.id:
        raise ConceptPlannerValidationError(
            "El proyecto no pertenece " "al workspace activo."
        )

    if project.status in {
        "archived",
        "cancelled",
    }:
        raise ConceptPlannerValidationError(
            "No se puede planificar una campaña "
            "sobre un proyecto archivado o cancelado."
        )

    if total_ads_requested < 1:
        raise ConceptPlannerValidationError(
            "total_ads_requested debe ser " "mayor que cero."
        )

    profiles = _load_profiles(
        workspace,
        profile_ids,
    )

    templates = _load_templates(
        workspace,
        template_ids,
    )

    if not profiles:
        raise ConceptPlannerValidationError("Selecciona al menos un perfil activo.")

    if not templates:
        raise ConceptPlannerValidationError("Selecciona al menos una plantilla activa.")

    concept_count = min(
        total_ads_requested,
        len(templates),
    )

    seed = _stable_seed(
        total_ads_requested,
        profile_ids,
        template_ids,
    )

    rng = random.Random(seed)

    profiles_by_id = {str(profile.id): profile for profile in profiles}

    templates_by_id = {str(template.id): template for template in templates}

    planner_connection = connection or get_concept_planner_connection(workspace)

    gemini_error = ""

    try:
        raw_concepts = _request_gemini_concepts(
            connection=(planner_connection),
            concept_count=(concept_count),
            total_ads_requested=(total_ads_requested),
            profiles=profiles,
            templates=templates,
        )

        normalized = _normalize_gemini_concepts(
            raw_concepts,
            profiles_by_id=(profiles_by_id),
            templates_by_id=(templates_by_id),
        )

    except ConceptPlannerGeminiError as exc:
        gemini_error = str(exc)

        normalized = []

    gemini_concept_count = len(normalized)

    normalized = _fill_missing_concepts(
        normalized,
        concept_count=concept_count,
        templates=templates,
        profiles=profiles,
        rng=rng,
    )

    concepts = [
        _rehydrate_concept(
            concept,
            concept_index=index,
            profiles_by_id=(profiles_by_id),
            templates_by_id=(templates_by_id),
        )
        for index, concept in enumerate(
            normalized,
            start=1,
        )
    ]

    concepts = _distribute_ads_count(
        concepts,
        total_ads_requested=(total_ads_requested),
        rng=rng,
    )

    fallback_count = sum(concept["source"] == "fallback" for concept in concepts)

    if fallback_count == 0:
        planner_mode = "gemini"

    elif gemini_concept_count == 0:
        planner_mode = "fallback"

    else:
        planner_mode = "hybrid"

    planned_ads = sum(concept["ads_count"] for concept in concepts)

    summary = {
        "total_ads_requested": (total_ads_requested),
        "planned_ads": (planned_ads),
        "concept_count": (concept_count),
        "gemini_concepts": (gemini_concept_count),
        "fallback_concepts": (fallback_count),
        "planner_mode": (planner_mode),
        "selected_profiles": (len(profiles)),
        "selected_templates": (len(templates)),
        "unique_templates_used": len(
            {concept["ad_template_id"] for concept in concepts}
        ),
        "gemini_model": (_planner_model() if planner_connection else ""),
        "gemini_error": (gemini_error),
        "distribution_seed": (seed),
    }

    if planned_ads != total_ads_requested:
        raise ConceptPlannerError(
            "La distribución interna de "
            "ads_count no coincide con "
            "total_ads_requested."
        )

    if len(concepts) != concept_count:
        raise ConceptPlannerError(
            "El planner no pudo construir " "el número esperado de conceptos."
        )

    if summary["unique_templates_used"] != concept_count:
        raise ConceptPlannerError(
            "El planner repitió una plantilla " "entre conceptos."
        )

    plan_data = {
        "schema_version": 1,
        "concepts": concepts,
        "summary": summary,
    }

    concept_plan = ConceptPlan.objects.create(
        workspace=workspace,
        project=project,
        requested_by=requested_by,
        total_ads_requested=(total_ads_requested),
        status="ready",
        plan_data=plan_data,
    )

    return concept_plan
