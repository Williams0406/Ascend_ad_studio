import json
from collections.abc import Iterable

from studio.models import FORMAT_SPECS
from studio.services.generation_inputs import (
    GenerationImageSource,
    ordered_generation_image_sources,
)

SINGLE_CANVAS_KEYS = {
    "single",
    "single_canvas",
    "single-canvas",
    "single_scene",
    "single-scene",
    "one_canvas",
    "one-canvas",
    "unified",
    "unified_canvas",
}

SPLIT_LAYOUT_TERMS = {
    "split",
    "split_screen",
    "split-screen",
    "before_after",
    "before-after",
    "before/after",
    "comparison_split",
    "comparison-split",
}


def _json(value):
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _text(value, fallback="No definido"):
    value = str(value or "").strip()
    return value or fallback


def _optional_text(value):
    return str(value or "").strip()


def _field(source, fallback, field_name):
    """
    Obtiene el valor del snapshot del job cuando existe.

    No usa `or` deliberadamente: un string vacío del job puede ser una
    edición intencional y no debe sustituirse silenciosamente por el proyecto.
    """

    if source is not None and hasattr(source, field_name):
        return getattr(source, field_name)

    return getattr(fallback, field_name)


def _related(source, fallback, field_name):
    """
    Igual que _field, pero para relaciones FK del proyecto/job.
    """

    if source is not None and hasattr(source, field_name):
        return getattr(source, field_name)

    return getattr(fallback, field_name)


def _effective_layout_constraints(template):
    """
    Devuelve exclusivamente las restricciones
    estructurales actuales del AdTemplate.

    layout_schema es legacy y no participa
    en nuevas generaciones.
    """

    if template is None:
        return {}

    constraints = getattr(
        template,
        "layout_constraints",
        None,
    )

    if isinstance(constraints, dict):
        return constraints

    return {}


def _effective_target_audience(
    *,
    job=None,
):
    """
    Resuelve la única audiencia efectiva del job.

    Prioridad:
    1. profile_used.persona
    2. target_audience manual

    Si existe profile_used, target_audience se ignora
    completamente aunque tenga contenido.
    """

    if job is None:
        return ""

    profile = getattr(
        job,
        "profile_used",
        None,
    )

    if profile is not None:
        return (
            getattr(
                profile,
                "persona",
                "",
            )
            or ""
        ).strip()

    return (
        getattr(
            job,
            "target_audience",
            "",
        )
        or ""
    ).strip()


def _normalize_layout_value(value):
    if value is None:
        return ""

    if isinstance(value, bool):
        return "true" if value else "false"

    return str(value).strip().lower().replace(" ", "_")


def _walk_layout_constraints(value) -> Iterable[tuple[str, object]]:
    """
    Recorre recursivamente layout_schema para admitir esquemas con distinta
    estructura sin imponer todavía un contrato rígido.
    """

    if isinstance(value, dict):
        for key, nested_value in value.items():
            yield str(key), nested_value
            yield from _walk_layout_constraints(nested_value)

    elif isinstance(value, list):
        for nested_value in value:
            yield from _walk_layout_constraints(nested_value)


def layout_requires_single_canvas(layout_constraints):
    """
    Detecta señales explícitas de composición de lienzo único.

    Ejemplos admitidos:
    {"canvas_mode": "single"}
    {"layout_type": "single_canvas"}
    {"single_canvas": True}
    {"composition": {"mode": "unified"}}
    {"composition": {"mode": "single_canvas"}}
    """

    if not isinstance(layout_constraints, dict):
        return False

    for key, value in _walk_layout_constraints(layout_constraints):
        normalized_key = _normalize_layout_value(key)
        normalized_value = _normalize_layout_value(value)

        # Casos booleanos:
        # {"single_canvas": True}
        # {"single_scene": True}
        if (
            normalized_key
            in {
                "single_canvas",
                "single_scene",
                "unified_canvas",
            }
            and normalized_value == "true"
        ):
            return True

        # Casos directos:
        # {"canvas_mode": "single"}
        # {"layout_type": "single_canvas"}
        if (
            normalized_key
            in {
                "canvas_mode",
                "layout_mode",
                "layout_type",
                "composition",
                "composition_mode",
                "scene_mode",
            }
            and normalized_value in SINGLE_CANVAS_KEYS
        ):
            return True

        # Casos anidados:
        # {"composition": {"mode": "single_canvas"}}
        # {"layout": {"mode": "unified"}}
        if normalized_key == "mode" and normalized_value in SINGLE_CANVAS_KEYS:
            return True

    return False


def layout_explicitly_allows_split(layout_constraints):
    """
    Detecta si la plantilla pide expresamente una composición dividida.
    """

    if not isinstance(layout_constraints, dict):
        return False

    for key, value in _walk_layout_constraints(layout_constraints):
        normalized_key = _normalize_layout_value(key)
        normalized_value = _normalize_layout_value(value)

        if (
            normalized_key
            in {
                "allow_split_screen",
                "split_screen",
                "before_after",
            }
            and normalized_value == "true"
        ):
            return True

        if normalized_value in SPLIT_LAYOUT_TERMS:
            return True

    return False


def _concept_strategy_section(job):
    """
    Construye la estrategia conceptual de un GenerationJob
    originado por ConceptPlan.

    BrandIntelligenceProfile es la fuente de verdad para:
    - persona
    - pain_point
    - angle
    - emotion
    - visual_direction
    - copy_hook

    No lee estos valores desde ConceptPlan.plan_data.
    """

    if job is None:
        return None

    profile = getattr(
        job,
        "profile_used",
        None,
    )

    if profile is None:
        return None

    lines = [
        "ESTRATEGIA DEL CONCEPTO",
    ]

    if job.concept_index is not None:
        lines.append(f"Índice del concepto: " f"{job.concept_index}")

    lines.extend(
        [
            ("Persona objetivo: " f"{_text(profile.persona)}"),
            ("Pain point principal: " f"{_text(profile.pain_point)}"),
            ("Ángulo persuasivo: " f"{_text(profile.angle)}"),
            ("Emoción objetivo: " f"{_text(profile.emotion)}"),
            ("Hook estratégico del perfil: " f"{_text(profile.copy_hook)}"),
        ]
    )

    rationale = _optional_text(
        getattr(
            job,
            "rationale",
            "",
        )
    )

    if rationale:
        lines.append(f"Rationale del concepto: " f"{rationale}")

    lines.extend(
        [
            (
                "Usa esta estrategia para orientar "
                "las decisiones visuales y persuasivas."
            ),
            ("No inventes una persona, pain point, " "ángulo o emoción diferentes."),
        ]
    )

    return "\n".join(lines)


def _concept_visual_direction_section(job):
    """
    Dirección visual procedente del
    BrandIntelligenceProfile asociado al job.
    """

    if job is None:
        return None

    profile = getattr(
        job,
        "profile_used",
        None,
    )

    if profile is None:
        return None

    visual_direction = _optional_text(profile.visual_direction)

    if not visual_direction:
        return None

    return (
        "DIRECCIÓN VISUAL DEL CONCEPTO\n"
        f"{visual_direction}\n"
        "Interpreta esta dirección dentro de las "
        "restricciones de la plantilla, la marca, "
        "el producto y las referencias visuales. "
        "No sustituye las reglas duras de layout."
    )


def _template_creative_section(template):
    """
    Expone las instrucciones creativas enriquecidas
    de AdTemplate.

    layout_constraints continúa siendo procesado
    separadamente como restricción dura.
    """

    if template is None:
        return None

    visual_structure = _optional_text(template.visual_structure)

    copy_structure = _optional_text(template.copy_structure)

    prompt_guidance = _optional_text(template.prompt_guidance)

    do_rules = template.do_rules or []
    dont_rules = template.dont_rules or []

    if not any(
        [
            visual_structure,
            copy_structure,
            prompt_guidance,
            do_rules,
            dont_rules,
        ]
    ):
        return None

    lines = [
        "ESTRUCTURA CREATIVA DE LA PLANTILLA",
    ]

    if visual_structure:
        lines.append("Estructura visual: " f"{visual_structure}")

    if copy_structure:
        lines.append("Estructura de copy: " f"{copy_structure}")

    if prompt_guidance:
        lines.append("Guía de generación: " f"{prompt_guidance}")

    if do_rules:
        lines.append("Reglas que debes cumplir: " f"{_json(do_rules)}")

    if dont_rules:
        lines.append("Reglas que debes evitar: " f"{_json(dont_rules)}")

    lines.append(
        "Estas instrucciones describen cómo interpretar "
        "creativamente la plantilla. No deben contradecir "
        "las restricciones estructurales duras definidas "
        "en layout_constraints."
    )

    return "\n".join(lines)


def _concept_copy_section(job):
    """
    Expone el copy estructurado producido
    por ConceptPlan.

    Esta sección proporciona contexto creativo.
    La sección COPY OBLIGATORIO continúa siendo
    la autoridad sobre el texto que debe aparecer
    literalmente en la imagen.
    """

    if job is None:
        return None

    profile = getattr(
        job,
        "profile_used",
        None,
    )

    if profile is None:
        return None

    hook_variant = _optional_text(
        getattr(
            job,
            "hook_variant",
            "",
        )
    )

    body_primary = _optional_text(
        getattr(
            job,
            "body_copy_primary",
            "",
        )
    )

    body_variant = _optional_text(
        getattr(
            job,
            "body_copy_variant_a",
            "",
        )
    )

    call_to_action = _optional_text(
        getattr(
            job,
            "call_to_action",
            "",
        )
    )

    lines = [
        "COPY DEL CONCEPTO",
    ]

    if hook_variant:
        lines.append(f"Hook seleccionado: " f"{hook_variant}")

    if body_primary:
        lines.append(f"Body copy principal: " f"{body_primary}")

    if body_variant:
        lines.append(f"Body copy variante A: " f"{body_variant}")

    if call_to_action:
        lines.append(f"CTA del concepto: " f"{call_to_action}")

    lines.append(
        "El hook seleccionado y el body principal "
        "definen la variante actual. La variante A "
        "es contexto creativo alternativo y no debe "
        "sustituir automáticamente al copy obligatorio."
    )

    return "\n".join(lines)


def _format_section(template):
    if not template:
        return None

    specs = FORMAT_SPECS.get(template.format, {})

    return (
        "FORMATO DE SALIDA\n"
        f"Identificador de formato: {_text(template.format)}\n"
        f"Dimensiones objetivo: "
        f"{_text(specs.get('width'))} × {_text(specs.get('height'))} px\n"
        f"Proporción: {_text(specs.get('aspect_ratio'))}\n"
        "Estas dimensiones definen únicamente el lienzo técnico. "
        "La dirección creativa y la estructura de composición provienen "
        "de la plantilla."
    )


def _layout_lock_section(template):
    if not template:
        return None

    constraints = _effective_layout_constraints(template)

    if not constraints:
        return None

    lines = [
        "RESTRICCIONES ESTRUCTURALES DE LAYOUT",
        (
            "Estas reglas son restricciones "
            "de producción y no sugerencias "
            "creativas opcionales."
        ),
        ("Restricciones estructurales: " f"{_json(constraints)}"),
    ]

    if layout_requires_single_canvas(constraints):
        lines.extend(
            [
                (
                    "REGLA DURA: usa un único lienzo "
                    "y una única escena visual integrada."
                ),
                (
                    "PROHIBIDO: split-screen, pantalla "
                    "dividida, mosaico de escenas, "
                    "before/after, comparación lado a lado "
                    "o paneles independientes."
                ),
                (
                    "Todos los elementos deben coexistir "
                    "dentro de una misma composición."
                ),
            ]
        )

    elif layout_explicitly_allows_split(constraints):
        lines.append(
            "La plantilla permite o solicita una "
            "composición dividida. Respeta las "
            "restricciones estructurales indicadas."
        )

    else:
        lines.append("No agregues estructuras que contradigan " "estas restricciones.")

    return "\n".join(lines)


def _copy_section(headline, offer_text, call_to_action):
    headline = _optional_text(headline)
    offer_text = _optional_text(offer_text)
    call_to_action = _optional_text(call_to_action)

    lines = [
        "COPY OBLIGATORIO",
        "Todo texto visible dentro de la imagen debe estar en español.",
        "Conserva exactamente la ortografía, los acentos, la puntuación, "
        "las mayúsculas y las cifras proporcionadas.",
        "No traduzcas, parafrasees, resumas ni reemplaces el copy obligatorio.",
    ]

    if headline:
        lines.append(f'TITULAR LITERAL OBLIGATORIO: "{headline}"')
    else:
        lines.append(
            "No existe un titular obligatorio. No inventes uno salvo que "
            "la receta o la plantilla lo exijan expresamente."
        )

    if offer_text:
        lines.append(f'TEXTO DE OFERTA O ARGUMENTO: "{offer_text}"')

    if call_to_action:
        lines.append(f'CTA LITERAL OBLIGATORIO: "{call_to_action}"')
    else:
        lines.append(
            "No existe un CTA obligatorio definido. No inventes promociones, "
            "precios ni urgencia artificial."
        )

    lines.extend(
        [
            "No inventes precios, porcentajes, descuentos, garantías, "
            "funcionalidades, testimonios ni afirmaciones.",
            "El titular y el CTA deben ser legibles y tener jerarquía visual clara.",
        ]
    )

    return "\n".join(lines)


def _role_instruction(source: GenerationImageSource):
    role = source.input_role
    purposes = set(source.purpose_codes)
    image_label = f"Image {source.image_number}"

    instructions = {
        "product_image": (
            f"{image_label} contiene el producto real. Conserva su identidad, "
            "forma, materiales, proporciones, empaque, colores y elementos "
            "distintivos. No lo reemplaces por un producto genérico."
        ),
        "character_reference": (
            f"{image_label} es la referencia visual del personaje. Usa la "
            "persona, apariencia, rostro, cabello, complexión y rasgos visuales "
            "de esa referencia de forma consistente. No sustituyas al personaje "
            "por otra persona."
        ),
        "background": (
            f"{image_label} es una referencia de fondo. Usa su ambiente, "
            "espacio o contexto según el brief, sin convertirlo en el sujeto principal."
        ),
        "lifestyle_reference": (
            f"{image_label} define una referencia lifestyle. Usa su lenguaje "
            "visual, contexto cotidiano, energía y naturalidad."
        ),
        "template": (
            f"{image_label} es una referencia de plantilla. Usa su lógica de "
            "jerarquía y distribución sin copiar textos ajenos."
        ),
        "packaging": (
            f"{image_label} contiene el empaque real. Conserva su identidad "
            "visual y no inventes etiquetas o información inexistente."
        ),
        "logo": (
            f"{image_label} contiene el logo oficial. Respeta su forma, "
            "proporción, orientación y colores. No lo redibujes ni alteres."
        ),
        "icon": (
            f"{image_label} contiene un icono autorizado. Úsalo solo como "
            "elemento de apoyo y conserva su diseño."
        ),
        "reference_ad": (
            f"{image_label} es una referencia publicitaria. Toma inspiración "
            "de sus atributos autorizados, pero no copies literalmente su texto, "
            "marca, producto ni composición completa."
        ),
    }

    instruction = instructions.get(
        role,
        f"{image_label} debe interpretarse según el rol {role}.",
    )

    purpose_instructions = []

    if "pose" in purposes:
        purpose_instructions.append(
            "Replica o adapta específicamente la pose corporal."
        )

    if "mood" in purposes:
        purpose_instructions.append(
            "Usa la emoción, atmósfera y actitud como referencia."
        )

    if "persona" in purposes:
        purpose_instructions.append(
            "Mantén la identidad visual del personaje como referencia principal."
        )

    if "style" in purposes:
        purpose_instructions.append("Toma el estilo visual, no el copy ni las marcas.")

    if "composition" in purposes:
        purpose_instructions.append(
            "Toma la lógica compositiva y la jerarquía espacial."
        )

    if "lighting" in purposes:
        purpose_instructions.append(
            "Toma la dirección, dureza, temperatura y contraste de la iluminación."
        )

    if "color" in purposes:
        purpose_instructions.append(
            "Toma la relación cromática permitida, subordinada a las reglas de marca."
        )

    if "typography" in purposes:
        purpose_instructions.append(
            "Toma la jerarquía tipográfica, sin copiar textos existentes."
        )

    if purpose_instructions:
        instruction += " " + " ".join(purpose_instructions)

    return instruction


def _image_manifest_section(job):
    if job is None:
        return None

    sources = ordered_generation_image_sources(job)

    if not sources:
        return (
            "DIRECCIÓN DE ESCENA POR IMAGEN\n"
            "Este job no contiene imágenes visuales adjuntas."
        )

    lines = [
        "DIRECCIÓN DE ESCENA POR IMAGEN",
        "La numeración siguiente coincide exactamente con el orden en que "
        "las imágenes serán enviadas al modelo.",
        "No intercambies los roles entre imágenes.",
    ]

    for source in sources:
        purposes = ", ".join(source.purpose_codes) or "sin propósito adicional"

        lines.append(
            f"Image {source.image_number}: "
            f'nombre="{source.name}"; '
            f"tipo={source.source_type}; "
            f"rol={source.input_role}; "
            f"propósitos={purposes}."
        )
        lines.append(_role_instruction(source))

        if source.notes:
            lines.append(
                f"Notas curatoriales de Image {source.image_number}: " f"{source.notes}"
            )

    character_images = [
        source.image_number
        for source in sources
        if source.input_role == "character_reference"
    ]

    if character_images:
        labels = ", ".join(f"Image {number}" for number in character_images)
        lines.append(
            f"REGLA DURA DE PERSONA: {labels} contiene la referencia específica "
            "del personaje que debe aparecer. Mantén continuidad visual y no "
            "introduzcas una persona distinta."
        )

    reference_ad_count = sum(source.input_role == "reference_ad" for source in sources)

    if reference_ad_count:
        lines.append(
            f"Hay {reference_ad_count} referencia(s) publicitaria(s). "
            "Mantén coherencia estilística, pero no copies marcas, textos, "
            "productos ni layouts completos."
        )

    return "\n".join(lines)


def build_generation_prompt(project, job=None):
    """
    Etapa 1 del pipeline.

    Produce un brief determinístico. No llama a ningún LLM y no inspecciona
    píxeles. Cuando se proporciona `job`, utiliza su snapshot editable.
    """

    workspace = project.workspace

    product = _related(job, project, "product")
    recipe = _related(job, project, "recipe")
    template = _related(job, project, "template")
    creative_angle = _related(job, project, "creative_angle")

    angle = creative_angle or (recipe.creative_angle if recipe else None)

    name = _field(job, project, "name")
    message_type = _field(job, project, "message_type")
    campaign_theme = _field(job, project, "campaign_theme")
    headline = _field(job, project, "headline")
    offer_text = _field(job, project, "offer_text")
    call_to_action = _field(job, project, "call_to_action")
    target_audience = _effective_target_audience(
        job=job,
    )
    focus_tags = _field(job, project, "focus_tags")
    use_brand_kit = _field(job, project, "use_brand_kit")

    brand_kit = getattr(workspace, "brand_kit", None)
    brand_rules = getattr(brand_kit, "rules", None) if brand_kit else None
    preferences = getattr(workspace, "preferences", None)

    if not _optional_text(call_to_action) and use_brand_kit and brand_kit:
        call_to_action = brand_kit.default_call_to_action

    sections = [
        (
            "ROL Y OBJETIVO\n"
            "Actúa como director de arte senior especializado en campañas "
            "publicitarias premium para ecommerce. Crea una pieza para "
            f"{_text(product.name if product else name)}. "
            "La imagen debe ser clara, creíble, comercialmente útil y "
            "consistente con todas las restricciones del brief."
        ),
        (
            "BRIEF DEL PROYECTO\n"
            f"Proyecto: {_text(name)}\n"
            f"Tema de campaña: {_text(campaign_theme)}\n"
            f"Tipo de mensaje: {_text(message_type)}\n"
            f"Audiencia objetivo: {_text(target_audience)}\n"
            f"Temas prioritarios: {_json(focus_tags or [])}"
        ),
    ]

    concept_strategy = _concept_strategy_section(job)

    if concept_strategy:
        sections.append(concept_strategy)

    concept_visual_direction = _concept_visual_direction_section(job)

    if concept_visual_direction:
        sections.append(concept_visual_direction)

    if product:
        sections.append(
            "PRODUCTO\n"
            f"Nombre: {_text(product.name)}\n"
            f"Marca: {_text(product.brand_name)}\n"
            f"Categoría: {_text(product.product_category)}\n"
            f"Descripción breve: {_text(product.short_description)}\n"
            f"Descripción completa: {_text(product.description)}\n"
            f"Beneficio principal: {_text(product.primary_benefit)}\n"
            f"Cliente objetivo: {_text(product.target_customer)}\n"
            f"Beneficios: {_json(product.benefits or [])}\n"
            f"Características: {_json(product.features or [])}"
        )

    if use_brand_kit and brand_kit:
        sections.append(
            "IDENTIDAD DE MARCA OBLIGATORIA\n"
            f"Marca: {_text(brand_kit.brand_name)}\n"
            f"Descripción: {_text(brand_kit.brand_description)}\n"
            f"Color primario: {_text(brand_kit.primary_color)}\n"
            f"Color secundario: {_text(brand_kit.secondary_color)}\n"
            f"Color de acento: {_text(brand_kit.accent_color)}\n"
            f"Tipografía principal: {_text(brand_kit.font_primary)}\n"
            f"Tipografía secundaria: {_text(brand_kit.font_secondary)}\n"
            f"Tono de voz: {_text(brand_kit.tone_of_voice)}"
        )

    if use_brand_kit and brand_rules:
        sections.append(
            "REGLAS DE MARCA\n"
            f"Colores permitidos: {_json(brand_rules.allowed_colors)}\n"
            f"Colores prohibidos: {_json(brand_rules.forbidden_colors)}\n"
            f"Fuentes permitidas: {_json(brand_rules.allowed_fonts)}\n"
            f"Elementos obligatorios: {_json(brand_rules.required_elements)}\n"
            f"Elementos prohibidos: {_json(brand_rules.forbidden_elements)}\n"
            f"Términos preferidos: {_json(brand_rules.preferred_terms)}\n"
            f"Términos prohibidos: {_json(brand_rules.forbidden_terms)}"
        )

    if preferences:
        sections.append(
            "PREFERENCIAS VISUALES DEL WORKSPACE\n"
            f"Preferencias aprendidas: "
            f"{_json(preferences.learned_preferences)}"
        )

    if angle:
        sections.append(
            "ÁNGULO CREATIVO\n"
            f"Nombre: {_text(angle.name)}\n"
            f"Descripción: {_text(angle.description)}\n"
            f"Ejemplo de titular: {_text(angle.example_headline)}"
        )

    if recipe:
        sections.append(
            "RECETA CREATIVA\n"
            f"Nombre: {_text(recipe.name)}\n"
            f"Descripción: {_text(recipe.description)}\n"
            f"Reglas de copy: {_json(recipe.copy_rules)}\n"
            f"Reglas visuales: {_json(recipe.visual_rules)}\n"
            f"Plantilla de prompt: {_text(recipe.prompt_template)}"
        )

    if template:
        sections.append(
            "PLANTILLA DE COMPOSICIÓN\n"
            f"Nombre: {_text(template.name)}\n"
            f"Descripción: {_text(template.description)}\n"
            f"Formato: {_text(template.format)}\n"
            "Las imágenes concretas de referencia de "
            "plantilla, cuando existan, aparecen en la "
            "sección DIRECCIÓN DE ESCENA POR IMAGEN."
        )

        template_creative = _template_creative_section(template)

        if template_creative:
            sections.append(template_creative)

        format_section = _format_section(template)
        if format_section:
            sections.append(format_section)

        layout_section = _layout_lock_section(template)
        if layout_section:
            sections.append(layout_section)

    concept_copy = _concept_copy_section(job)

    if concept_copy:
        sections.append(concept_copy)

    sections.append(
        _copy_section(
            headline=headline,
            offer_text=offer_text,
            call_to_action=call_to_action,
        )
    )

    image_manifest = _image_manifest_section(job)

    if image_manifest:
        sections.append(image_manifest)

    sections.append(
        "SALIDA Y CRITERIOS DE CALIDAD\n"
        "Entrega una sola imagen final profesional, lista para una campaña real. "
        "Respeta el formato, la plantilla, la marca, el copy literal y el rol "
        "de cada imagen. Evita ruido visual, elementos genéricos y detalles "
        "contrarios al brief. No incluyas explicaciones, Markdown, JSON, "
        "metadatos ni texto fuera de la pieza."
    )

    return "\n\n".join(section for section in sections if section)
