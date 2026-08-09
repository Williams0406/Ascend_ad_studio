from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, Workspace, WorkspaceMember
from billing.models import Plan, Subscription
from integrations.models import AIProviderConnection
from integrations.services.encryption import encrypt_api_key
from studio.models import AdProject, GeneratedAsset, GenerationBatch, GenerationJob
from studio.services.generation import GenerationProviderError
from studio.services.generation_queue import (
    create_generation_batch,
    update_generation_batch_status,
)
from studio.tasks import dispatch_generation_batch, process_generation_job
from studio.views import ALLOWED_AI_MODELS


@override_settings(USE_MOCK_AI_GENERATION=True)
class GenerationQueueTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "queue@example.com",
            "StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Queue",
            slug="queue",
            workspace_type="company",
            owner=self.user,
        )

        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.user,
            role="owner",
        )

        self.plan = Plan.objects.create(
            name="Queue plan",
            max_members=3,
        )

        Subscription.objects.create(
            workspace=self.workspace,
            plan=self.plan,
            status="active",
        )

        self.connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider="gemini",
            encrypted_api_key=encrypt_api_key("test-key"),
            status="active",
            is_default=True,
            created_by=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            name="Queue project",
        )

        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.headers = {
            "HTTP_X_WORKSPACE_ID": str(self.workspace.id),
        }

    def item(self, **overrides):
        data = {
            "name": "Editorial",
            "provider": "gemini",
            "model_code": "gemini-2.5-flash-image",
            "number_of_outputs": 2,
            "aspect_ratio": "4:5",
            "resolution": "2K",
            "quality_mode": "high",
            "output_format": "png",
            "prompt_modifier": "Luz cálida",
            "negative_prompt": "",
            "seed": None,
            "priority": 5,
            "parameters": {},
        }
        data.update(overrides)
        return data

    def create_batch(self, items=None):
        with patch("studio.tasks.dispatch_generation_batch.apply_async"):
            with self.captureOnCommitCallbacks(execute=True):
                return create_generation_batch(
                    project=self.project,
                    user=self.user,
                    name="Exploración",
                    items=items or [self.item()],
                    allowed_models=ALLOWED_AI_MODELS,
                )

    def test_create_batch_with_multiple_jobs(self):
        batch = self.create_batch(
            [self.item(), self.item(name="Segundo", aspect_ratio="1:1")]
        )
        self.assertEqual(batch.jobs.count(), 2)

    def test_distinct_parameter_snapshots(self):
        batch = self.create_batch(
            [self.item(aspect_ratio="4:5"), self.item(aspect_ratio="1:1")]
        )
        self.assertEqual(
            [
                job.parameters["aspect_ratio"]
                for job in batch.jobs.order_by("queue_position")
            ],
            ["4:5", "1:1"],
        )

    def test_total_outputs(self):
        batch = self.create_batch(
            [self.item(number_of_outputs=2), self.item(number_of_outputs=3)]
        )
        self.assertEqual(sum(job.number_of_outputs for job in batch.jobs.all()), 5)

    def test_reject_empty_jobs(self):
        response = self.client.post(
            f"/api/studio/projects/{self.project.id}/generation-batches/",
            {"jobs": []},
            format="json",
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_reject_too_many_outputs(self):
        response = self.client.post(
            f"/api/studio/projects/{self.project.id}/generation-batches/",
            {"jobs": [self.item(number_of_outputs=6) for _ in range(9)]},
            format="json",
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_reject_missing_provider_connection(self):
        self.connection.delete()
        response = self.client.post(
            f"/api/studio/projects/{self.project.id}/generation-batches/",
            {"jobs": [self.item()]},
            format="json",
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_reject_incompatible_model(self):
        response = self.client.post(
            f"/api/studio/projects/{self.project.id}/generation-batches/",
            {"jobs": [self.item(model_code="flux-fast")]},
            format="json",
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_jobs_start_queued(self):
        self.assertEqual(self.create_batch().jobs.get().status, "queued")

    def test_request_does_not_call_provider(self):
        with patch(
            "studio.services.generation.GeminiGenerationProvider.generate"
        ) as generate:
            self.client.post(
                f"/api/studio/projects/{self.project.id}/generation-batches/",
                {"jobs": [self.item()]},
                format="json",
                **self.headers,
            )
            generate.assert_not_called()

    def test_process_job_successfully(self):
        job = self.create_batch().jobs.get()
        process_generation_job(str(job.id))
        job.refresh_from_db()
        self.assertEqual(job.status, "completed")

    @override_settings(USE_MOCK_AI_GENERATION=False)
    def test_failed_job_records_failure(self):
        job = self.create_batch().jobs.get()
        with patch(
            "studio.tasks.GeminiGenerationProvider.generate",
            side_effect=GenerationProviderError("falló"),
        ):
            process_generation_job(str(job.id))
        job.refresh_from_db()
        self.assertEqual(job.status, "failed")

    def test_cancel_queued_job(self):
        batch = self.create_batch()
        self.client.post(
            f"/api/studio/generation-batches/{batch.id}/cancel/",
            {},
            format="json",
            **self.headers,
        )
        self.assertEqual(batch.jobs.get().status, "cancelled")

    def test_cancel_batch(self):
        batch = self.create_batch([self.item(), self.item()])
        response = self.client.post(
            f"/api/studio/generation-batches/{batch.id}/cancel/",
            {},
            format="json",
            **self.headers,
        )
        self.assertEqual(response.data["status"], "cancelled")

    def test_batch_completed(self):
        batch = self.create_batch()
        batch.jobs.update(status="completed", completed_at=timezone.now())
        self.assertEqual(update_generation_batch_status(batch.id).status, "completed")

    def test_batch_partial(self):
        batch = self.create_batch([self.item(), self.item()])
        first, second = batch.jobs.all()
        first.status = "completed"
        first.save()
        second.status = "failed"
        second.save()
        self.assertEqual(update_generation_batch_status(batch.id).status, "partial")

    def test_batch_failed(self):
        batch = self.create_batch()
        batch.jobs.update(status="failed")
        self.assertEqual(update_generation_batch_status(batch.id).status, "failed")

    def test_worker_idempotence(self):
        job = self.create_batch().jobs.get()
        process_generation_job(str(job.id))
        asset_count = job.assets.count()
        process_generation_job(str(job.id))
        self.assertEqual(job.assets.count(), asset_count)

    def test_retry_failed_job(self):
        batch = self.create_batch()
        job = batch.jobs.get()
        job.status = "failed"
        job.retry_count = 1
        job.save()
        with patch("studio.tasks.process_generation_job.apply_async"):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    f"/api/studio/generation-jobs/{job.id}/retry/",
                    {},
                    format="json",
                    **self.headers,
                )
        self.assertEqual(response.status_code, 200)
        job.refresh_from_db()
        self.assertEqual(job.status, "queued")

    def test_workspace_isolation(self):
        other = Workspace.objects.create(
            name="Other",
            slug="other-queue",
            workspace_type="individual",
            owner=self.user,
        )
        WorkspaceMember.objects.create(workspace=other, user=self.user, role="owner")
        Subscription.objects.create(workspace=other, plan=self.plan, status="active")
        response = self.client.get(
            "/api/studio/generation-batches/", HTTP_X_WORKSPACE_ID=str(other.id)
        )
        self.assertEqual(response.data["count"], 0)
