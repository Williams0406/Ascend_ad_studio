from io import BytesIO
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import (
    SimpleUploadedFile,
)
from django.test import (
    TestCase,
    override_settings,
)
from PIL import Image

from accounts.models import (
    User,
    Workspace,
    WorkspaceMember,
)
from billing.models import Plan, Subscription
from integrations.models import (
    AIProviderConnection,
)
from integrations.services.encryption import (
    encrypt_api_key,
)
from studio.models import (
    AdProject,
    AdTemplate,
    AdTemplateExampleImage,
    BrandIntelligenceProfile,
    ConceptPlan,
    CreativeReference,
    GenerationBatch,
    GenerationJob,
)
from studio.services.concept_expansion import (
    concept_reference_seed,
    expand_plan_to_jobs,
)
from rest_framework.test import APIClient


@override_settings(
    API_KEY_ENCRYPTION_SECRET=("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0" "NTY3ODlhYmNkZWY="),
)
class ConceptExpansionTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()

        self.media_override = self.settings(MEDIA_ROOT=self.media.name)

        self.media_override.enable()

        self.user = User.objects.create_user(
            email="expansion@example.com",
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Expansion",
            slug="expansion",
            workspace_type="individual",
            owner=self.user,
        )

        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.user,
            role="owner",
            is_active=True,
        )

        plan = Plan.objects.create(
            name="Concept Expansion Plan",
            max_members=1,
        )

        Subscription.objects.create(
            workspace=self.workspace,
            plan=plan,
            status="active",
        )

        self.connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider="fal",
            encrypted_api_key=(encrypt_api_key("fal-expansion-test-key")),
            status="active",
            is_default=True,
            created_by=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            name="Proyecto expansion",
            campaign_theme=("Campaña principal"),
            status="draft",
        )

        self.profile_1 = BrandIntelligenceProfile.objects.create(
            workspace=self.workspace,
            persona="Emprendedor",
            pain_point="Poco tiempo",
            angle="Ahorro de tiempo",
            visual_direction=("Escena profesional"),
            emotion="Alivio",
            copy_hook=("Recupera tus horas"),
        )

        self.profile_2 = BrandIntelligenceProfile.objects.create(
            workspace=self.workspace,
            persona="Marketing interno",
            pain_point=("Producción lenta"),
            angle=("Automatización"),
            visual_direction=("Equipo eficiente"),
            emotion="Confianza",
            copy_hook=("Crea más rápido"),
        )

        self.template_1 = AdTemplate.objects.create(
            workspace=self.workspace,
            name="Template Uno",
            format=("instagram_post_portrait"),
            layout_constraints={
                "canvas_mode": "single",
                "allow_split_screen": False,
                "allow_collage": False,
            },
            visual_structure=("Producto central"),
            created_by=self.user,
        )

        self.template_2 = AdTemplate.objects.create(
            workspace=self.workspace,
            name="Template Dos",
            format=("instagram_post_square"),
            layout_constraints={
                "canvas_mode": "single",
                "allow_split_screen": False,
                "allow_collage": False,
            },
            visual_structure=("Composición editorial"),
            created_by=self.user,
        )

        self.example_a = AdTemplateExampleImage.objects.create(
            ad_template=(self.template_1),
            image=self.make_reference(
                "Ejemplo A",
                "example-a.png",
            ),
            sort_order=0,
        )

        self.example_b = AdTemplateExampleImage.objects.create(
            ad_template=(self.template_1),
            image=self.make_reference(
                "Ejemplo B",
                "example-b.png",
            ),
            sort_order=1,
        )

        self.plan = ConceptPlan.objects.create(
            workspace=self.workspace,
            project=self.project,
            requested_by=self.user,
            total_ads_requested=5,
            status="ready",
            plan_data={
                "schema_version": 1,
                "concepts": [
                    {
                        "concept_index": 1,
                        "ad_template_id": str(self.template_1.id),
                        "profile_id": str(self.profile_1.id),
                        "persona": (self.profile_1.persona),
                        "pain_point": (self.profile_1.pain_point),
                        "angle": (self.profile_1.angle),
                        "emotion": (self.profile_1.emotion),
                        "visual_direction": ("Dirección uno"),
                        "hook_variants": [
                            "Hook 1A",
                            "Hook 1B",
                        ],
                        "body_copy_primary": ("Body uno"),
                        "body_copy_variant_a": ("Body uno variante"),
                        "cta": ("Empieza ahora"),
                        "rationale": ("Rationale uno"),
                        "source": "gemini",
                        "ads_count": 3,
                    },
                    {
                        "concept_index": 2,
                        "ad_template_id": str(self.template_2.id),
                        "profile_id": str(self.profile_2.id),
                        "persona": (self.profile_2.persona),
                        "pain_point": (self.profile_2.pain_point),
                        "angle": (self.profile_2.angle),
                        "emotion": (self.profile_2.emotion),
                        "visual_direction": ("Dirección dos"),
                        "hook_variants": [
                            "Hook 2A",
                            "Hook 2B",
                        ],
                        "body_copy_primary": ("Body dos"),
                        "body_copy_variant_a": ("Body dos variante"),
                        "cta": ("Descubre más"),
                        "rationale": ("Rationale dos"),
                        "source": "gemini",
                        "ads_count": 2,
                    },
                ],
                "summary": {
                    "planned_ads": 5,
                    "concept_count": 2,
                },
            },
        )

        self.client = APIClient()

        self.client.force_authenticate(self.user)

        self.headers = {
            "HTTP_X_WORKSPACE_ID": str(self.workspace.id),
        }

    def tearDown(self):
        self.media_override.disable()
        self.media.cleanup()

    def make_reference(
        self,
        title,
        name,
    ):
        buffer = BytesIO()

        Image.new(
            "RGB",
            (20, 20),
            "white",
        ).save(
            buffer,
            format="PNG",
        )

        return CreativeReference.objects.create(
            workspace=self.workspace,
            title=title,
            category="template",
            image=SimpleUploadedFile(
                name,
                buffer.getvalue(),
                content_type="image/png",
            ),
            created_by=self.user,
        )

    def test_expands_exact_total_ads(self):
        batch = expand_plan_to_jobs(self.plan)

        self.assertEqual(
            batch.status,
            "draft",
        )

        self.assertEqual(
            batch.project_id,
            self.project.id,
        )

        self.assertEqual(
            batch.concept_plan_id,
            self.plan.id,
        )

        self.assertEqual(
            batch.total_jobs,
            5,
        )

        self.assertEqual(
            GenerationJob.objects.filter(batch=batch).count(),
            5,
        )

    def test_expands_ads_count_per_concept(self):
        batch = expand_plan_to_jobs(self.plan)

        self.assertEqual(
            batch.jobs.filter(concept_index=1).count(),
            3,
        )

        self.assertEqual(
            batch.jobs.filter(concept_index=2).count(),
            2,
        )

    def test_job_carries_profile_and_template(
        self,
    ):
        batch = expand_plan_to_jobs(self.plan)

        job = batch.jobs.filter(concept_index=1).order_by("queue_position").first()

        self.assertEqual(
            job.profile_used_id,
            self.profile_1.id,
        )

        self.assertIsNotNone(
            job.profile_used,
        )

        self.assertEqual(
            job.target_audience,
            "",
        )

        self.assertEqual(
            job.template_id,
            self.template_1.id,
        )

        self.assertEqual(
            job.format_used_id,
            self.template_1.id,
        )

        self.assertEqual(
            job.body_copy_primary,
            "Body uno",
        )

        self.assertEqual(
            job.body_copy_variant_a,
            "Body uno variante",
        )

        self.assertEqual(
            job.rationale,
            "Rationale uno",
        )

    def test_concept_plan_jobs_do_not_copy_profile_into_target_audience(
        self,
    ):
        batch = expand_plan_to_jobs(self.plan)

        jobs = list(batch.jobs.order_by("queue_position"))

        self.assertEqual(
            len(jobs),
            5,
        )

        for job in jobs:
            self.assertIsNotNone(
                job.profile_used,
            )

            self.assertEqual(
                job.target_audience,
                "",
            )

    def test_hook_variants_rotate_without_rewriting(
        self,
    ):
        batch = expand_plan_to_jobs(self.plan)

        hooks = list(
            batch.jobs.filter(concept_index=1)
            .order_by("queue_position")
            .values_list(
                "hook_variant",
                flat=True,
            )
        )

        self.assertEqual(
            hooks,
            [
                "Hook 1A",
                "Hook 1B",
                "Hook 1A",
            ],
        )

    def test_reference_selection_is_deterministic(
        self,
    ):
        batch = expand_plan_to_jobs(self.plan)

        jobs = list(batch.jobs.filter(concept_index=1).order_by("queue_position"))

        examples = [
            self.example_a,
            self.example_b,
        ]

        for work_index, job in enumerate(
            jobs,
            start=1,
        ):
            seed = concept_reference_seed(
                concept_plan=self.plan,
                concept_index=1,
                work_index=work_index,
            )

            expected = examples[seed % len(examples)]

            template_reference = job.references.get(input_role="template")

            self.assertEqual(
                template_reference.reference_id,
                expected.image_id,
            )

            self.assertEqual(
                job.parameters["concept"]["reference_seed"],
                seed,
            )

    def test_second_expansion_is_idempotent(
        self,
    ):
        first = expand_plan_to_jobs(self.plan)

        second = expand_plan_to_jobs(self.plan)

        self.assertEqual(
            first.id,
            second.id,
        )

        self.assertEqual(
            GenerationBatch.objects.filter(concept_plan=self.plan).count(),
            1,
        )

        self.assertEqual(
            GenerationJob.objects.filter(batch=first).count(),
            5,
        )

    def test_plan_becomes_generated(self):
        batch = expand_plan_to_jobs(self.plan)

        self.plan.refresh_from_db()

        self.assertEqual(
            self.plan.status,
            "generated",
        )

        self.assertEqual(
            self.plan.plan_data["summary"]["generated_batch_id"],
            str(batch.id),
        )

    def test_created_jobs_use_fal_pipeline(
        self,
    ):
        batch = expand_plan_to_jobs(self.plan)

        for job in batch.jobs.all():
            self.assertEqual(
                job.provider,
                "fal",
            )

            self.assertEqual(
                job.model_name,
                ("fal-ai/" "nano-banana-pro/edit"),
            )

            self.assertEqual(
                job.status,
                "draft",
            )

            self.assertIsNone(job.composed_prompt)

    def test_generate_endpoint_returns_batch(
        self,
    ):
        response = self.client.post(
            (f"/api/studio/concept-plans/" f"{self.plan.id}/generate/"),
            {},
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

        self.assertEqual(
            response.data["concept_plan_id"],
            str(self.plan.id),
        )

        self.assertEqual(
            response.data["concept_plan_status"],
            "generated",
        )

        batch = response.data["batch"]

        self.assertEqual(
            batch["status"],
            "draft",
        )

        self.assertEqual(
            batch["total_jobs"],
            5,
        )

        self.assertEqual(
            len(batch["jobs"]),
            5,
        )

    def test_generate_endpoint_is_idempotent(
        self,
    ):
        first = self.client.post(
            (f"/api/studio/concept-plans/" f"{self.plan.id}/generate/"),
            {},
            format="json",
            **self.headers,
        )

        second = self.client.post(
            (f"/api/studio/concept-plans/" f"{self.plan.id}/generate/"),
            {},
            format="json",
            **self.headers,
        )

        self.assertEqual(
            first.status_code,
            201,
            first.data,
        )

        self.assertEqual(
            second.status_code,
            201,
            second.data,
        )

        self.assertEqual(
            first.data["batch"]["id"],
            second.data["batch"]["id"],
        )

        self.assertEqual(
            GenerationBatch.objects.filter(concept_plan=self.plan).count(),
            1,
        )

        self.assertEqual(
            GenerationJob.objects.filter(batch_id=first.data["batch"]["id"]).count(),
            5,
        )

    def test_template_without_example_does_not_attach_legacy_reference(
        self,
    ):
        self.template_1.example_images.all().delete()

        batch = expand_plan_to_jobs(self.plan)

        job = (
            batch.jobs.filter(
                template=self.template_1,
            )
            .order_by("queue_position")
            .first()
        )

        template_references = job.references.filter(input_role="template")

        self.assertFalse(template_references.exists())
