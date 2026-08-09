from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from integrations.models import AIProviderConnection
from studio.models import (
    GenerationBatch,
    GenerationJob,
)
from studio.services.generation import (
    FalGenerationProvider,
    GenerationProviderError,
    GeminiGenerationProvider,
    MockGenerationProvider,
)
from studio.services.generation_queue import (
    update_generation_batch_status,
)
from studio.services.prompt_composer import (
    PromptComposerError,
    compose_prompt_with_gemini,
)


@shared_task
def dispatch_generation_batch(batch_id):
    job_ids = list(
        GenerationJob.objects.filter(
            batch_id=batch_id,
            status="queued",
            cancel_requested=False,
        )
        .order_by(
            "priority",
            "queue_position",
            "created_at",
        )
        .values_list(
            "id",
            flat=True,
        )
    )

    for job_id in job_ids:
        process_generation_job.apply_async(
            args=[
                str(job_id),
            ],
            queue="generation",
        )

    return len(job_ids)


@shared_task(bind=True)
def process_generation_job(
    self,
    job_id,
):
    with transaction.atomic():
        job = (
            GenerationJob.objects.select_for_update()
            .select_related(
                "project",
                "project__workspace",
                "provider_connection",
                "template",
                "product",
                "recipe",
                "creative_angle",
            )
            .get(id=job_id)
        )

        if job.status != "queued":
            return job.status

        if job.cancel_requested:
            job.status = "cancelled"
            job.completed_at = timezone.now()

            job.save(
                update_fields=[
                    "status",
                    "completed_at",
                    "updated_at",
                ]
            )

            if job.batch_id:
                update_generation_batch_status(job.batch_id)

            return "cancelled"

        job.status = "processing"
        job.started_at = timezone.now()
        job.error_message = ""

        job.save(
            update_fields=[
                "status",
                "started_at",
                "error_message",
                "updated_at",
            ]
        )

    if job.batch_id:
        update_generation_batch_status(job.batch_id)

    try:
        if settings.USE_MOCK_AI_GENERATION:
            MockGenerationProvider().generate(job)

        elif job.provider == AIProviderConnection.Provider.FAL:
            # ETAPA 2
            compose_prompt_with_gemini(job)

            job.refresh_from_db()

            if job.cancel_requested:
                job.status = "cancelled"
                job.completed_at = timezone.now()

                job.save(
                    update_fields=[
                        "status",
                        "completed_at",
                        "updated_at",
                    ]
                )

                return "cancelled"

            # ETAPA 3
            FalGenerationProvider(job.provider_connection).generate(job)

        elif job.provider == AIProviderConnection.Provider.GEMINI:
            # Compatibilidad legacy.
            # El pipeline objetivo nuevo usa FAL,
            # pero no rompemos jobs Gemini existentes.
            GeminiGenerationProvider(job.provider_connection).generate(job)

        else:
            raise GenerationProviderError(
                f'Proveedor "{job.provider}" ' "no soportado."
            )

        job.refresh_from_db()

        if job.cancel_requested:
            job.assets.all().delete()

            job.status = "cancelled"
            job.completed_at = timezone.now()

            job.save(
                update_fields=[
                    "status",
                    "completed_at",
                    "updated_at",
                ]
            )

    except Exception as exc:
        job.refresh_from_db()

        job.status = "failed"
        job.retry_count += 1

        if isinstance(
            exc,
            (
                GenerationProviderError,
                PromptComposerError,
            ),
        ):
            job.error_message = str(exc)
        else:
            job.error_message = "No se pudo completar " "la generación."

        job.completed_at = timezone.now()

        job.save(
            update_fields=[
                "status",
                "retry_count",
                "error_message",
                "completed_at",
                "updated_at",
            ]
        )

    finally:
        if job.batch_id:
            update_generation_batch_status(job.batch_id)

    return job.status


@shared_task
def delete_abandoned_generation_drafts(
    hours=24,
):
    threshold = timezone.now() - timedelta(hours=hours)

    draft_jobs = GenerationJob.objects.filter(
        status="draft",
        batch__isnull=True,
        updated_at__lt=threshold,
    )

    deleted_jobs = draft_jobs.delete()[0]

    empty_batches = GenerationBatch.objects.filter(
        status="draft",
        updated_at__lt=threshold,
        jobs__isnull=True,
    )

    deleted_batches = empty_batches.delete()[0]

    return {
        "deleted_jobs": deleted_jobs,
        "deleted_batches": deleted_batches,
    }
