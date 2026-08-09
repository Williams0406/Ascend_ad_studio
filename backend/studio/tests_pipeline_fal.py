from unittest.mock import patch

from django.test import (
    TestCase,
    override_settings,
)

from accounts.models import (
    User,
    Workspace,
)
from integrations.models import (
    AIProviderConnection,
)
from integrations.services.encryption import (
    encrypt_api_key,
)
from studio.models import (
    AdProject,
    GenerationJob,
)
from studio.services.generation import (
    GenerationProviderError,
)
from studio.services.prompt_composer import (
    PromptComposerError,
)
from studio.tasks import (
    process_generation_job,
)


@override_settings(
    USE_MOCK_AI_GENERATION=False,
    API_KEY_ENCRYPTION_SECRET=("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0" "NTY3ODlhYmNkZWY="),
)
class FalPipelineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="pipeline@example.com",
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Pipeline",
            slug="pipeline",
            workspace_type="individual",
            owner=self.user,
        )

        self.gemini = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider="gemini",
            encrypted_api_key=(encrypt_api_key("AIza-test-gemini-key")),
            status="active",
            is_default=False,
            created_by=self.user,
        )

        self.fal = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider="fal",
            encrypted_api_key=(encrypt_api_key("fal-test-key-1234567890")),
            status="active",
            is_default=True,
            created_by=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            name="Pipeline project",
        )

        self.job = GenerationJob.objects.create(
            project=self.project,
            requested_by=self.user,
            provider_connection=self.fal,
            provider="fal",
            model_name=("fal-ai/" "nano-banana-pro/edit"),
            prompt="Brief Etapa 1",
            status="queued",
        )

    @patch("studio.tasks." "FalGenerationProvider.generate")
    @patch("studio.tasks." "compose_prompt_with_gemini")
    def test_fal_runs_composer_before_generation(
        self,
        compose,
        generate,
    ):
        execution_order = []

        def compose_side_effect(job):
            execution_order.append("composer")

            job.composed_prompt = "Prompt Etapa 2"

            job.save(
                update_fields=[
                    "composed_prompt",
                ]
            )

            return job.composed_prompt

        compose.side_effect = compose_side_effect

        def generate_side_effect(job):
            execution_order.append("fal")

            self.assertEqual(
                job.composed_prompt,
                "Prompt Etapa 2",
            )

            job.status = "completed"

            job.save(
                update_fields=[
                    "status",
                ]
            )

            return []

        generate.side_effect = generate_side_effect

        process_generation_job(str(self.job.id))

        self.job.refresh_from_db()

        self.assertEqual(
            execution_order,
            [
                "composer",
                "fal",
            ],
        )

        self.assertEqual(
            self.job.status,
            "completed",
        )

    @patch("studio.tasks." "FalGenerationProvider.generate")
    @patch(
        "studio.tasks." "compose_prompt_with_gemini",
        side_effect=PromptComposerError("Composer falló"),
    )
    def test_composer_failure_prevents_fal(
        self,
        compose,
        generate,
    ):
        result = process_generation_job(str(self.job.id))

        self.job.refresh_from_db()

        self.assertEqual(
            result,
            "failed",
        )

        self.assertEqual(
            self.job.status,
            "failed",
        )

        self.assertEqual(
            self.job.error_message,
            "Composer falló",
        )

        compose.assert_called_once()

        generate.assert_not_called()

    @patch(
        "studio.tasks." "FalGenerationProvider.generate",
        side_effect=GenerationProviderError("FAL falló"),
    )
    @patch("studio.tasks." "compose_prompt_with_gemini")
    def test_fal_failure_preserves_composed_prompt(
        self,
        compose,
        generate,
    ):
        def compose_side_effect(job):
            job.composed_prompt = "Prompt para depuración"

            job.save(
                update_fields=[
                    "composed_prompt",
                ]
            )

            return job.composed_prompt

        compose.side_effect = compose_side_effect

        process_generation_job(str(self.job.id))

        self.job.refresh_from_db()

        self.assertEqual(
            self.job.status,
            "failed",
        )

        self.assertEqual(
            self.job.error_message,
            "FAL falló",
        )

        self.assertEqual(
            self.job.composed_prompt,
            "Prompt para depuración",
        )

        generate.assert_called_once()

    @patch("studio.tasks." "FalGenerationProvider.generate")
    @patch("studio.tasks." "compose_prompt_with_gemini")
    def test_completed_job_is_idempotent(
        self,
        compose,
        generate,
    ):
        self.job.status = "completed"

        self.job.save(
            update_fields=[
                "status",
            ]
        )

        result = process_generation_job(str(self.job.id))

        self.assertEqual(
            result,
            "completed",
        )

        compose.assert_not_called()
        generate.assert_not_called()

    @override_settings(USE_MOCK_AI_GENERATION=True)
    @patch("studio.tasks." "MockGenerationProvider.generate")
    @patch("studio.tasks." "FalGenerationProvider.generate")
    @patch("studio.tasks." "compose_prompt_with_gemini")
    def test_mock_skips_composer_and_fal(
        self,
        compose,
        fal_generate,
        mock_generate,
    ):
        def mock_side_effect(job):
            job.status = "completed"

            job.save(
                update_fields=[
                    "status",
                ]
            )

            return []

        mock_generate.side_effect = mock_side_effect

        process_generation_job(str(self.job.id))

        self.job.refresh_from_db()

        self.assertEqual(
            self.job.status,
            "completed",
        )

        mock_generate.assert_called_once()
        compose.assert_not_called()
        fal_generate.assert_not_called()

    @patch("studio.tasks." "FalGenerationProvider.generate")
    @patch("studio.tasks." "compose_prompt_with_gemini")
    def test_cancel_between_composer_and_fal(
        self,
        compose,
        generate,
    ):
        def compose_side_effect(job):
            job.composed_prompt = "Prompt Etapa 2"

            job.cancel_requested = True

            job.save(
                update_fields=[
                    "composed_prompt",
                    "cancel_requested",
                ]
            )

            return job.composed_prompt

        compose.side_effect = compose_side_effect

        result = process_generation_job(str(self.job.id))

        self.job.refresh_from_db()

        self.assertEqual(
            result,
            "cancelled",
        )

        self.assertEqual(
            self.job.status,
            "cancelled",
        )

        generate.assert_not_called()
