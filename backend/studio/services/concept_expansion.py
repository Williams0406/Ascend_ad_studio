from django.db import transaction

from studio.models import (
    FORMAT_SPECS,
    AdTemplate,
    BrandIntelligenceProfile,
    ConceptPlan,
    GenerationBatch,
    GenerationJob,
    GenerationJobInputAsset,
    GenerationJobReference,
)
from studio.services.generation_queue import (
    resolve_connection,
)
from studio.services.prompts import (
    build_generation_prompt,
)


class ConceptExpansionError(Exception):
    """
    Error controlado durante la expansión
    ConceptPlan -> GenerationJob.
    """


FAL_MODEL_CODE = "nano-banana-pro-edit"

FAL_PROVIDER_MODEL = "fal-ai/nano-banana-pro/edit"


def _concept_plan_uuid_mod(
    concept_plan,
):
    """
    Parte estable de la semilla definida
    por la Pieza D.

    concept_plan_id % 997
    """

    return concept_plan.id.int % 997


def concept_reference_seed(
    *,
    concept_plan,
    concept_index,
    work_index,
):
    """
    Fórmula de la Pieza D:

    work_index*7
    + concept_index*3
    + concept_plan_id % 997
    """

    return (
        int(work_index) * 7
        + int(concept_index) * 3
        + _concept_plan_uuid_mod(concept_plan)
    )


def _validate_plan_data(
    concept_plan,
):
    plan_data = concept_plan.plan_data or {}

    concepts = plan_data.get("concepts")

    if (
        not isinstance(
            concepts,
            list,
        )
        or not concepts
    ):
        raise ConceptExpansionError("El ConceptPlan no contiene " "conceptos válidos.")

    total = 0

    concept_indexes = set()

    for concept in concepts:
        if not isinstance(
            concept,
            dict,
        ):
            raise ConceptExpansionError(
                "El ConceptPlan contiene " "un concepto inválido."
            )

        try:
            concept_index = int(concept["concept_index"])

            ads_count = int(concept["ads_count"])

        except (
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            raise ConceptExpansionError(
                "Cada concepto debe contener " "concept_index y ads_count válidos."
            ) from exc

        if concept_index < 1:
            raise ConceptExpansionError("concept_index debe empezar en 1.")

        if concept_index in concept_indexes:
            raise ConceptExpansionError(
                "El ConceptPlan contiene " "concept_index duplicados."
            )

        if ads_count < 1:
            raise ConceptExpansionError("ads_count debe ser mayor que cero.")

        if not concept.get("ad_template_id"):
            raise ConceptExpansionError("Un concepto no contiene " "ad_template_id.")

        if not concept.get("profile_id"):
            raise ConceptExpansionError("Un concepto no contiene " "profile_id.")

        concept_indexes.add(concept_index)

        total += ads_count

    if total != concept_plan.total_ads_requested:
        raise ConceptExpansionError(
            "La suma de ads_count del plan " "no coincide con " "total_ads_requested."
        )

    return concepts


def _load_plan_resources(
    concept_plan,
    concepts,
):
    template_ids = {str(concept["ad_template_id"]) for concept in concepts}

    profile_ids = {str(concept["profile_id"]) for concept in concepts}

    templates = AdTemplate.objects.filter(
        workspace=concept_plan.workspace,
        id__in=template_ids,
        is_active=True,
    ).prefetch_related(
        "example_images__image",
    )

    profiles = BrandIntelligenceProfile.objects.filter(
        workspace=concept_plan.workspace,
        id__in=profile_ids,
        is_active=True,
    )

    templates_by_id = {str(template.id): template for template in templates}

    profiles_by_id = {str(profile.id): profile for profile in profiles}

    if set(templates_by_id) != template_ids:
        raise ConceptExpansionError(
            "Una o más plantillas del plan " "ya no existen o están inactivas."
        )

    if set(profiles_by_id) != profile_ids:
        raise ConceptExpansionError(
            "Uno o más perfiles del plan " "ya no existen o están inactivos."
        )

    return (
        templates_by_id,
        profiles_by_id,
    )


def _select_template_example(
    *,
    template,
    seed,
):
    """
    Selección determinística de una imagen de ejemplo.

    La fórmula genera el seed y este seed decide
    qué AdTemplateExampleImage usar.
    """

    examples = list(
        template.example_images.select_related("image").order_by(
            "sort_order",
            "created_at",
        )
    )

    if not examples:
        return None

    index = seed % len(examples)

    return examples[index]


def _select_hook(
    concept,
    *,
    work_index,
):
    """
    No reescribe copy.

    Selecciona mecánicamente uno de los hooks
    que ya produjo ConceptPlan.
    """

    hooks = concept.get(
        "hook_variants",
        [],
    )

    if not isinstance(
        hooks,
        list,
    ):
        return ""

    hooks = [str(hook).strip() for hook in hooks if str(hook).strip()]

    if not hooks:
        return ""

    return hooks[(work_index - 1) % len(hooks)]


def _copy_project_inputs(
    project,
    job,
):
    """
    Snapshot de BrandAssets del proyecto.

    Se excluye input_role=template porque la plantilla
    del ConceptPlan es la fuente de verdad del job.
    """

    sources = (
        project.input_assets.exclude(input_role="template")
        .select_related("brand_asset")
        .prefetch_related("purpose")
        .order_by(
            "sort_order",
            "id",
        )
    )

    for source in sources:
        snapshot = GenerationJobInputAsset.objects.create(
            generation_job=job,
            brand_asset=source.brand_asset,
            input_role=source.input_role,
            sort_order=source.sort_order,
        )

        snapshot.purpose.set(source.purpose.all())


def _copy_project_references(
    project,
    job,
):
    """
    Snapshot de CreativeReferences del proyecto.

    También excluimos role=template para evitar mezclar
    una plantilla manual antigua con la seleccionada
    por ConceptPlan.
    """

    sources = (
        project.references.exclude(input_role="template")
        .select_related("reference")
        .prefetch_related("purpose")
    )

    for source in sources:
        snapshot = GenerationJobReference.objects.create(
            generation_job=job,
            reference=source.reference,
            input_role=source.input_role,
            weight=source.weight,
        )

        snapshot.purpose.set(source.purpose.all())


def _attach_template_reference(
    *,
    job,
    selected_example,
):
    """
    Añade al job la referencia visual de plantilla
    seleccionada previamente de forma determinística.

    La única fuente visual válida de AdTemplate
    es AdTemplateExampleImage.

    Si la plantilla no tiene imágenes de ejemplo,
    el job continúa utilizando:
    - layout_constraints
    - visual_structure
    - copy_structure
    - prompt_guidance
    - do_rules
    - dont_rules
    """

    if selected_example is None:
        return {
            "source_type": "none",
            "example_id": None,
        }

    reference = selected_example.image

    snapshot = GenerationJobReference.objects.create(
        generation_job=job,
        reference=reference,
        input_role="template",
        # Las referencias se envían al proveedor por peso descendente.
        # La plantilla debe conservar Image 1 para que el manifiesto del
        # prompt, Gemini Composer y FAL compartan la misma numeración.
        weight=1000,
    )

    return {
        "source_type": "example_image",
        "example_id": str(selected_example.id),
        "reference_id": str(reference.id),
        "job_reference_id": str(snapshot.id),
    }


def _build_job_parameters(
    *,
    template,
    concept,
    reference_seed,
    selected_reference,
):
    format_code = template.format or "portrait"

    format_specs = FORMAT_SPECS.get(format_code) or FORMAT_SPECS["portrait"]

    return {
        "schema_version": 3,
        "model_code": (FAL_MODEL_CODE),
        "format": (format_code),
        "format_specs": (format_specs),
        "aspect_ratio": (format_specs["aspect_ratio"]),
        "resolution": "1K",
        "quality_mode": ("standard"),
        "output_format": "png",
        # No se usa este seed para FAL.
        # La variedad propia del modelo se mantiene.
        "seed": None,
        "guidance_scale": None,
        "temperature": None,
        "style_strength": None,
        "reference_strength": None,
        "concept": {
            "concept_index": (concept["concept_index"]),
            "reference_seed": (reference_seed),
            "selected_template_reference": (selected_reference),
            "planner_source": (
                concept.get(
                    "source",
                    "",
                )
            ),
        },
        "custom": {},
    }


def _create_job(
    *,
    batch,
    project,
    user,
    connection,
    concept_plan,
    concept,
    template,
    profile,
    work_index,
    queue_position,
):
    reference_seed = concept_reference_seed(
        concept_plan=concept_plan,
        concept_index=(concept["concept_index"]),
        work_index=(work_index),
    )

    selected_example = _select_template_example(
        template=template,
        seed=reference_seed,
    )

    hook_variant = _select_hook(
        concept,
        work_index=work_index,
    )

    body_primary = str(
        concept.get(
            "body_copy_primary",
            "",
        )
        or ""
    ).strip()

    body_variant = str(
        concept.get(
            "body_copy_variant_a",
            "",
        )
        or ""
    ).strip()

    cta = str(
        concept.get(
            "cta",
            "",
        )
        or ""
    ).strip()

    rationale = str(
        concept.get(
            "rationale",
            "",
        )
        or ""
    ).strip()

    job = GenerationJob.objects.create(
        batch=batch,
        project=project,
        requested_by=user,
        provider_connection=connection,
        # Snapshot base del proyecto.
        product=project.product,
        recipe=project.recipe,
        creative_angle=(project.creative_angle),
        # La plantilla del concepto sustituye
        # a project.template.
        template=template,
        # Trazabilidad Pieza D.
        concept_index=(concept["concept_index"]),
        format_used=template,
        profile_used=profile,
        body_copy_primary=(body_primary),
        body_copy_variant_a=(body_variant),
        hook_variant=(hook_variant),
        rationale=rationale,
        # Snapshot compatible con el sistema actual.
        name=(
            f"{project.name} · "
            f"Concepto "
            f"{concept['concept_index']} · "
            f"Variante {work_index}"
        ),
        message_type=(project.message_type),
        campaign_theme=(project.campaign_theme),
        # Compatibilidad con la Etapa 1 actual.
        # Fase 9 añadirá la sección conceptual estructurada.
        headline=(hook_variant or project.headline),
        offer_text=(body_primary or project.offer_text),
        call_to_action=(cta or project.call_to_action),
        target_audience="",
        focus_tags=(project.focus_tags),
        use_brand_kit=(project.use_brand_kit),
        provider="fal",
        model_name=(FAL_PROVIDER_MODEL),
        prompt="",
        composed_prompt=None,
        negative_prompt="",
        parameters={},
        number_of_outputs=1,
        status="draft",
        queue_position=(queue_position),
        priority=5,
        # No usamos este campo para sustituir el concepto.
        # El concepto ya está estructurado en campos propios.
        prompt_modifier="",
    )

    _copy_project_inputs(
        project,
        job,
    )

    _copy_project_references(
        project,
        job,
    )

    selected_reference = _attach_template_reference(
        job=job,
        selected_example=(selected_example),
    )

    job.parameters = _build_job_parameters(
        template=template,
        concept=concept,
        reference_seed=(reference_seed),
        selected_reference=(selected_reference),
    )

    #
    # ETAPA 1
    #
    # Por ahora ya toma headline/body/CTA/template
    # procedentes del concepto.
    #
    # En la Fase 9 build_generation_prompt()
    # leerá también profile_used, rationale,
    # emotion, pain_point, etc. directamente.
    #
    job.prompt = build_generation_prompt(
        project,
        job=job,
    )

    job.save(
        update_fields=[
            "parameters",
            "prompt",
            "updated_at",
        ]
    )

    return job


@transaction.atomic
def expand_plan_to_jobs(
    concept_plan,
):
    """
    Pieza D.

    Convierte un ConceptPlan aprobado en:

        GenerationBatch draft
            └── GenerationJob × total_ads_requested

    No despacha el batch automáticamente.

    Esto permite que el frontend reutilice la cola actual
    y que el usuario vea/revise los jobs antes de generar.
    """

    concept_plan = (
        ConceptPlan.objects.select_for_update()
        .select_related(
            "workspace",
            "project",
            "requested_by",
        )
        .get(id=concept_plan.id)
    )

    #
    # IDEMPOTENCIA
    #
    existing_batch = GenerationBatch.objects.filter(concept_plan=concept_plan).first()

    if existing_batch:
        return existing_batch

    if concept_plan.status == "cancelled":
        raise ConceptExpansionError("No se puede expandir " "un ConceptPlan cancelado.")

    if concept_plan.status not in {
        "ready",
        "generated",
    }:
        raise ConceptExpansionError(
            "El ConceptPlan no está " "disponible para expansión."
        )

    project = concept_plan.project

    if not project:
        raise ConceptExpansionError(
            "Este ConceptPlan fue creado antes "
            "de la relación con AdProject. "
            "Crea un plan nuevo antes de generar."
        )

    if project.workspace_id != concept_plan.workspace_id:
        raise ConceptExpansionError(
            "El proyecto del ConceptPlan " "no pertenece a su workspace."
        )

    if project.status in {
        "archived",
        "cancelled",
    }:
        raise ConceptExpansionError(
            "El AdProject ya no está disponible " "para generación."
        )

    concepts = _validate_plan_data(concept_plan)

    (
        templates_by_id,
        profiles_by_id,
    ) = _load_plan_resources(
        concept_plan,
        concepts,
    )

    #
    # El pipeline nuevo tiene FAL como Etapa 3.
    #
    connection = resolve_connection(
        concept_plan.workspace,
        "fal",
    )

    if not connection:
        raise ConceptExpansionError(
            "Conecta una cuenta fal.ai activa " "antes de expandir el ConceptPlan."
        )

    batch = GenerationBatch.objects.create(
        project=project,
        concept_plan=concept_plan,
        requested_by=(concept_plan.requested_by),
        name=(f"{project.name} · " f"Plan {str(concept_plan.id)[:8]}"),
        status="draft",
        total_jobs=(concept_plan.total_ads_requested),
        metadata={
            "schema_version": 3,
            "source": ("concept_plan"),
            "concept_plan_id": str(concept_plan.id),
            "concept_count": len(concepts),
            "total_ads_requested": (concept_plan.total_ads_requested),
        },
    )

    queue_position = 0

    for concept in concepts:
        concept_index = int(concept["concept_index"])

        ads_count = int(concept["ads_count"])

        template = templates_by_id[str(concept["ad_template_id"])]

        profile = profiles_by_id[str(concept["profile_id"])]

        for work_index in range(
            1,
            ads_count + 1,
        ):
            queue_position += 1

            _create_job(
                batch=batch,
                project=project,
                user=(concept_plan.requested_by),
                connection=connection,
                concept_plan=(concept_plan),
                concept=concept,
                template=template,
                profile=profile,
                work_index=(work_index),
                queue_position=(queue_position),
            )

    if queue_position != concept_plan.total_ads_requested:
        raise ConceptExpansionError(
            "La expansión produjo una cantidad " "de jobs distinta de la solicitada."
        )

    concept_plan.status = "generated"

    plan_data = dict(concept_plan.plan_data or {})

    summary = dict(plan_data.get("summary", {}))

    summary["generated_batch_id"] = str(batch.id)

    summary["expanded_jobs"] = queue_position

    plan_data["summary"] = summary

    concept_plan.plan_data = plan_data

    concept_plan.save(
        update_fields=[
            "status",
            "plan_data",
            "updated_at",
        ]
    )

    return batch
