import json


def _json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _text(value, fallback="No definido"):
    value = str(value or "").strip()
    return value or fallback


def build_generation_prompt(project, job=None):
    workspace = project.workspace
    product = project.product
    recipe = project.recipe
    angle = project.creative_angle or (recipe.creative_angle if recipe else None)
    template = project.template
    brand_kit = getattr(workspace, "brand_kit", None)
    brand_rules = getattr(brand_kit, "rules", None) if brand_kit else None
    preferences = getattr(workspace, "preferences", None)
    if job is not None:
        inputs = job.input_assets.select_related("brand_asset").prefetch_related("purpose").order_by("sort_order")
        project_references = job.references.select_related("reference").prefetch_related("purpose").order_by("-weight")
    else:
        inputs = project.input_assets.select_related("brand_asset").prefetch_related("purpose").order_by("sort_order")
        project_references = project.references.select_related("reference").prefetch_related("purpose").order_by("-weight")

    sections = [
        "ROL Y OBJETIVO\n"
        "Actúa como director de arte senior especializado en campañas premium para ecommerce. "
        f"Crea una pieza publicitaria para {_text(product.name if product else project.name)}. "
        "La composición debe ser clara, creíble, comercialmente útil y visualmente consistente con toda la información siguiente.",
        "BRIEF DEL PROYECTO\n"
        f"Proyecto: {_text(project.name)}\n"
        f"Tema de campaña: {_text(project.campaign_theme)}\n"
        f"Tipo de mensaje: {_text(project.message_type)}\n"
        f"Titular exacto: {_text(project.headline)}\n"
        f"Oferta o argumento: {_text(project.offer_text)}\n"
        f"Llamada a la acción exacta: {_text(project.call_to_action)}\n"
        f"Audiencia: {_text(project.target_audience)}\n"
        f"Temas prioritarios: {_json(project.focus_tags or [])}",
    ]

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

    if project.use_brand_kit and brand_kit:
        sections.append(
            "IDENTIDAD DE MARCA OBLIGATORIA\n"
            f"Marca: {_text(brand_kit.brand_name)}\n"
            f"Descripción: {_text(brand_kit.brand_description)}\n"
            f"Colores: primario {brand_kit.primary_color}, secundario {brand_kit.secondary_color}, acento {brand_kit.accent_color}\n"
            f"Tipografías: {_text(brand_kit.font_primary)} para jerarquía principal y {_text(brand_kit.font_secondary)} para soporte\n"
            f"Tono de voz: {_text(brand_kit.tone_of_voice)}\n"
            f"CTA predeterminado: {_text(brand_kit.default_call_to_action)}"
        )
    if project.use_brand_kit and brand_rules:
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
            f"Preferencias aprendidas: {_json(preferences.learned_preferences)}"
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
            f"Plantilla de prompt de la receta: {_text(recipe.prompt_template)}"
        )
    if template:
        sections.append(
            "PLANTILLA DE COMPOSICIÓN\n"
            f"Nombre: {_text(template.name)}\n"
            f"Descripción: {_text(template.description)}\n"
            f"Formato: {_text(template.format)}\n"
            f"BrandAsset: {_text(template.source_asset.name if template.source_asset_id else '')}\n"
            f"CreativeReference: {_text(template.creative_reference.title if template.creative_reference_id else '')}\n"
            f"Layout: {_json(template.layout_schema)}"
        )

    asset_context = [
        {
            "orden": item.sort_order,
            "rol": item.input_role,
            "propositos": list(item.purpose.values_list("code", flat=True)),
            "nombre": item.brand_asset.name,
            "categoria": item.brand_asset.category,
            "metadata": item.brand_asset.metadata,
        }
        for item in inputs
    ]
    if asset_context:
        sections.append(
            "REFERENCIAS VISUALES ADJUNTAS\n"
            f"Respeta el rol indicado para cada imagen: {_json(asset_context)}"
        )
    reference_context = [
        {
            "titulo": item.reference.title,
            "propositos": list(item.purpose.values_list("code", flat=True)),
            "peso": item.weight,
            "fuente": item.reference.source,
            "autor": item.reference.author,
            "notas": item.reference.notes,
            "tags": item.reference.tags,
        }
        for item in project_references
    ]
    if reference_context:
        sections.append(
            "REFERENCIAS CREATIVAS CURADAS\n"
            "Interpreta cada referencia según su propósito y prioriza las de mayor peso: "
            f"{_json(reference_context)}"
        )

    sections.append(
        "SALIDA Y CRITERIOS DE CALIDAD\n"
        "Usa el texto solicitado con ortografía correcta y jerarquía legible. "
        "No inventes precios, descuentos, funcionalidades, logotipos ni afirmaciones. "
        "Evita ruido visual, recursos genéricos y cualquier elemento contrario a las reglas. "
        "Entrega una imagen final profesional, lista para una campaña real."
    )
    return "\n\n".join(sections)
