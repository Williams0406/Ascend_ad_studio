from django.db import transaction
from django.utils import timezone

from integrations.models import AIProviderConnection
from studio.models import (
    FORMAT_SPECS,
    GeneratedAsset,
    GenerationBatch,
    GenerationJob,
    GenerationJobInputAsset,
    GenerationJobReference,
)
from studio.services.prompts import build_generation_prompt


def resolve_connection(workspace, provider):
    queryset = AIProviderConnection.objects.filter(
        workspace=workspace, status=AIProviderConnection.Status.ACTIVE
    )
    connection = (
        queryset.filter(is_default=True).first()
        if provider == "auto"
        else queryset.filter(provider=provider).first()
    )
    return connection or (queryset.first() if provider == "auto" else None)


def update_generation_batch_status(batch_id):
    with transaction.atomic():
        batch = (
            GenerationBatch.objects.select_for_update()
            .select_related("project")
            .get(id=batch_id)
        )
        jobs = list(batch.jobs.all())
        counts = {
            status: sum(job.status == status for job in jobs)
            for status in ("queued", "processing", "completed", "failed", "cancelled")
        }
        finished = counts["completed"] + counts["failed"] + counts["cancelled"]
        if (
            counts["queued"]
            and not batch.started_at
            and not counts["processing"]
            and not finished
        ):
            new_status = "queued"
        elif counts["queued"] or counts["processing"]:
            new_status = "processing"
        elif counts["completed"] == len(jobs) and jobs:
            new_status = "completed"
        elif counts["completed"] and (counts["failed"] or counts["cancelled"]):
            new_status = "partial"
        elif counts["cancelled"] == len(jobs) and jobs:
            new_status = "cancelled"
        else:
            new_status = "failed"
        now = timezone.now()
        batch.status = new_status
        batch.total_jobs = len(jobs)
        batch.completed_jobs = counts["completed"]
        batch.failed_jobs = counts["failed"]
        if (counts["processing"] or finished) and not batch.started_at:
            batch.started_at = now
        batch.completed_at = (
            now if not counts["queued"] and not counts["processing"] else None
        )
        batch.save(
            update_fields=[
                "status",
                "total_jobs",
                "completed_jobs",
                "failed_jobs",
                "started_at",
                "completed_at",
                "updated_at",
            ]
        )
        project = batch.project
        if project.status not in ("archived", "cancelled"):
            pending = project.jobs.filter(status__in=("queued", "processing")).exists()
            project.status = (
                "generating"
                if pending
                else (
                    "completed"
                    if GeneratedAsset.objects.filter(project=project).exists()
                    else "ready"
                )
            )
            project.save(update_fields=["status", "updated_at"])
        return batch


def mark_dispatch_error(batch_id, message):
    batch = GenerationBatch.objects.get(id=batch_id)
    batch.metadata = {**batch.metadata, "dispatch_error": str(message)[:500]}
    batch.save(update_fields=["metadata", "updated_at"])


def create_generation_batch(*, project, user, name, items, allowed_models):
    with transaction.atomic():
        batch = GenerationBatch.objects.create(
            project=project,
            requested_by=user,
            name=name,
            status="queued",
            total_jobs=len(items),
            metadata={"schema_version": 1},
        )
        for position, item in enumerate(items, 1):
            connection = resolve_connection(project.workspace, item["provider"])
            if not connection:
                raise ValueError(
                    f"No existe una conexión activa para {item['provider']}."
                )
            provider = connection.provider
            models = allowed_models.get(provider, {})
            model_code = item.get("model_code") or next(iter(models), "")
            if model_code not in models:
                raise ValueError(
                    f'El modelo "{model_code}" no es compatible con {provider}.'
                )
            modifier = item.get("prompt_modifier", "").strip()
            source_job = None
            if item.get("source_job_id"):
                source_job = (
                    GenerationJob.objects.filter(
                        id=item["source_job_id"], project=project
                    )
                    .prefetch_related(
                        "input_assets__purpose",
                        "input_assets__brand_asset",
                        "references__purpose",
                        "references__reference",
                    )
                    .first()
                )
                if not source_job:
                    raise ValueError("El GenerationJob base no pertenece al proyecto.")
            format_code = item.get("format") or "portrait"
            format_specs = FORMAT_SPECS.get(format_code, FORMAT_SPECS["portrait"])
            parameters = {
                "schema_version": 2,
                "model_code": model_code,
                "format": format_code,
                "format_specs": format_specs,
                "aspect_ratio": item.get("aspect_ratio")
                or format_specs["aspect_ratio"],
                "resolution": item["resolution"],
                "quality_mode": item["quality_mode"],
                "output_format": item["output_format"],
                "seed": item.get("seed"),
                "guidance_scale": None,
                "temperature": None,
                "style_strength": None,
                "reference_strength": None,
                "custom": item.get("parameters") or {},
                "name": item.get("name", ""),
            }
            job = GenerationJob.objects.create(
                batch=batch,
                project=project,
                requested_by=user,
                provider_connection=connection,
                product=project.product,
                template=project.template,
                recipe=project.recipe,
                creative_angle=project.creative_angle,
                name=project.name,
                message_type=project.message_type,
                campaign_theme=project.campaign_theme,
                headline=project.headline,
                offer_text=project.offer_text,
                call_to_action=project.call_to_action,
                target_audience=(
                    item.get(
                        "target_audience",
                        "",
                    )
                    or ""
                ).strip(),
                focus_tags=project.focus_tags,
                use_brand_kit=project.use_brand_kit,
                provider=provider,
                model_name=models[model_code]["provider_model"],
                prompt="",
                negative_prompt=item.get("negative_prompt", ""),
                prompt_modifier=modifier,
                parameters=parameters,
                number_of_outputs=item["number_of_outputs"],
                status="queued",
                queue_position=position,
                priority=item.get("priority", 5),
            )
            input_sources = (
                source_job.input_assets.all()
                if source_job
                else project.input_assets.prefetch_related("purpose")
                .select_related("brand_asset")
                .all()
            )
            for source in input_sources:
                snapshot = GenerationJobInputAsset.objects.create(
                    generation_job=job,
                    brand_asset=source.brand_asset,
                    input_role=source.input_role,
                    sort_order=source.sort_order,
                )
                snapshot.purpose.set(source.purpose.all())
            reference_sources = (
                source_job.references.all()
                if source_job
                else project.references.prefetch_related("purpose")
                .select_related("reference")
                .all()
            )
            for source in reference_sources:
                snapshot = GenerationJobReference.objects.create(
                    generation_job=job,
                    reference=source.reference,
                    input_role=source.input_role,
                    weight=source.weight,
                )
                snapshot.purpose.set(source.purpose.all())
            base_prompt = build_generation_prompt(project, job=job)
            job.prompt = (
                f"{base_prompt}\n\nDirección adicional: {modifier}"
                if modifier
                else base_prompt
            )
            job.save(update_fields=["prompt", "updated_at"])
        project.status = "generating"
        project.save(update_fields=["status", "updated_at"])
        from studio.tasks import dispatch_generation_batch

        def dispatch():
            try:
                dispatch_generation_batch.apply_async(
                    args=[str(batch.id)], queue="generation"
                )
            except Exception as exc:
                mark_dispatch_error(batch.id, exc)

        transaction.on_commit(dispatch)
        return batch
