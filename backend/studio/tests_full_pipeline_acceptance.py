from unittest.mock import patch

from django.core.files.base import ContentFile
from django.test import TestCase

from integrations.models import AIProviderConnection
from studio.models import (
    AdProject,
    AdTemplate,
    AdTemplateExampleImage,
    BrandAsset,
    BrandIntelligenceProfile,
    ConceptPlan,
    CreativeReference,
    GeneratedAsset,
    GenerationJob,
    ProjectInputAsset,
    ProjectReference,
)
from studio.services.concept_expansion import (
    FAL_PROVIDER_MODEL,
    expand_plan_to_jobs,
)
from studio.services.generation_inputs import (
    ordered_generation_image_sources,
)
from studio.tasks import process_generation_job


class FullPipelineAcceptanceTests(TestCase):
    """
    Test de aceptación del pipeline completo:

    ConceptPlan
        -> GenerationBatch
        -> GenerationJob
        -> brief determinístico
        -> Gemini Composer
        -> composed_prompt
        -> FAL
        -> GeneratedAsset

    Gemini y FAL se simulan exclusivamente en sus fronteras externas.
    """

    def setUp(self):
        from django.contrib.auth import get_user_model
        from accounts.models import Workspace

        User = get_user_model()

        self.user = User.objects.create_user(
            email="pipeline@example.com",
            password="test-password",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Pipeline Acceptance Workspace",
            slug="pipeline-acceptance",
            workspace_type="individual",
            owner=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            name="Campaña aceptación",
            message_type="conversion",
            campaign_theme="Campaña de prueba",
            headline="Headline original",
            offer_text="Oferta original",
            call_to_action="Comprar ahora",
            use_brand_kit=False,
            status="ready",
        )

        self.profile = BrandIntelligenceProfile.objects.create(
            workspace=self.workspace,
            persona=(
                "Profesional de 25 a 40 años que busca "
                "una solución práctica y confiable."
            ),
            pain_point="Pierde tiempo utilizando soluciones complejas.",
            angle="Simplificar el proceso y ahorrar tiempo.",
            visual_direction=(
                "Fotografía publicitaria limpia, moderna " "y orientada al producto."
            ),
            emotion="confianza",
            copy_hook="Hazlo más simple.",
            is_active=True,
        )

        self.template_reference = CreativeReference.objects.create(
            workspace=self.workspace,
            title="Referencia plantilla",
            category="template",
            image=ContentFile(
                b"template-image",
                name="template.jpg",
            ),
            created_by=self.user,
        )

        self.template = AdTemplate.objects.create(
            workspace=self.workspace,
            name="Plantilla aceptación",
            format="instagram_post_portrait",
            visual_structure="Producto principal con copy superior.",
            copy_structure="Headline, cuerpo y CTA.",
            prompt_guidance="Mantener jerarquía visual clara.",
            is_active=True,
            created_by=self.user,
        )

        self.product_asset = BrandAsset.objects.create(
            workspace=self.workspace,
            category="product",
            name="Producto principal",
            file=ContentFile(
                b"product-image",
                name="product.png",
            ),
            mime_type="image/png",
            uploaded_by=self.user,
        )

        ProjectInputAsset.objects.create(
            ad_project=self.project,
            brand_asset=self.product_asset,
            input_role="product_image",
            sort_order=1,
        )

        self.reference_ad = CreativeReference.objects.create(
            workspace=self.workspace,
            title="Referencia publicitaria",
            category="reference_ad",
            image=ContentFile(
                b"reference-image",
                name="reference.jpg",
            ),
            created_by=self.user,
        )

        ProjectReference.objects.create(
            ad_project=self.project,
            reference=self.reference_ad,
            input_role="reference_ad",
            weight=80,
        )

        self.fal_connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider=AIProviderConnection.Provider.FAL,
            status=AIProviderConnection.Status.ACTIVE,
            encrypted_api_key="fake-fal-key",
            is_default=True,
            created_by=self.user,
        )

        AdTemplateExampleImage.objects.create(
            ad_template=self.template,
            image=self.template_reference,
            sort_order=0,
        )

        self.gemini_connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider=AIProviderConnection.Provider.GEMINI,
            status=AIProviderConnection.Status.ACTIVE,
            encrypted_api_key="fake-gemini-key",
            is_default=True,
            created_by=self.user,
        )

        self.concept_plan = ConceptPlan.objects.create(
            workspace=self.workspace,
            project=self.project,
            requested_by=self.user,
            total_ads_requested=2,
            status="ready",
            plan_data={
                "concepts": [
                    {
                        "concept_index": 1,
                        "ads_count": 2,
                        "ad_template_id": str(self.template.id),
                        "profile_id": str(self.profile.id),
                        "hook_variants": [
                            "Recupera tu tiempo",
                            "Hazlo simple",
                        ],
                        "body_copy_primary": (
                            "Una solución creada para simplificar " "tu trabajo diario."
                        ),
                        "body_copy_variant_a": (
                            "Menos complejidad. Más tiempo " "para lo importante."
                        ),
                        "cta": "Empieza ahora",
                        "rationale": (
                            "El concepto conecta el pain point "
                            "con una promesa de simplicidad."
                        ),
                        "source": "acceptance_test",
                    }
                ],
                "summary": {},
            },
        )

    @patch("studio.services.concept_expansion.resolve_connection")
    def test_expansion_preserves_concept_contract(
        self,
        resolve_connection,
    ):
        resolve_connection.return_value = self.fal_connection

        batch = expand_plan_to_jobs(self.concept_plan)

        self.concept_plan.refresh_from_db()

        self.assertEqual(
            self.concept_plan.status,
            "generated",
        )

        self.assertEqual(
            batch.status,
            "draft",
        )

        self.assertEqual(
            batch.total_jobs,
            2,
        )

        self.assertEqual(
            batch.jobs.count(),
            2,
        )

        jobs = list(batch.jobs.order_by("queue_position"))

        first_job = jobs[0]
        second_job = jobs[1]

        self.assertEqual(
            first_job.concept_index,
            1,
        )

        self.assertEqual(
            first_job.profile_used_id,
            self.profile.id,
        )

        self.assertEqual(
            first_job.template_id,
            self.template.id,
        )

        self.assertEqual(
            first_job.format_used_id,
            self.template.id,
        )

        self.assertEqual(
            first_job.provider,
            "fal",
        )

        self.assertEqual(
            first_job.model_name,
            FAL_PROVIDER_MODEL,
        )

        self.assertEqual(
            first_job.hook_variant,
            "Recupera tu tiempo",
        )

        self.assertEqual(
            second_job.hook_variant,
            "Hazlo simple",
        )

        self.assertEqual(
            first_job.headline,
            "Recupera tu tiempo",
        )

        self.assertEqual(
            first_job.call_to_action,
            "Empieza ahora",
        )

        self.assertEqual(
            first_job.target_audience,
            "",
        )

        self.assertTrue(first_job.prompt.strip())

        self.assertIsNone(first_job.composed_prompt)

        self.assertEqual(
            first_job.status,
            "draft",
        )

        self.assertEqual(
            first_job.parameters["schema_version"],
            3,
        )

        self.assertEqual(
            first_job.parameters["concept"]["concept_index"],
            1,
        )

        self.assertEqual(
            first_job.parameters["concept"]["planner_source"],
            "acceptance_test",
        )

        summary = self.concept_plan.plan_data["summary"]

        self.assertEqual(
            summary["generated_batch_id"],
            str(batch.id),
        )

        self.assertEqual(
            summary["expanded_jobs"],
            2,
        )

    @patch("studio.services.concept_expansion.resolve_connection")
    def test_image_order_is_stable_after_expansion(
        self,
        resolve_connection,
    ):
        resolve_connection.return_value = self.fal_connection

        batch = expand_plan_to_jobs(self.concept_plan)

        job = batch.jobs.order_by("queue_position").first()

        sources = ordered_generation_image_sources(job)

        self.assertEqual(
            len(sources),
            3,
        )

        self.assertEqual(
            [source.image_number for source in sources],
            [1, 2, 3],
        )

        self.assertEqual(
            sources[0].input_role,
            "template",
        )

        self.assertEqual(
            sources[1].input_role,
            "reference_ad",
        )

        self.assertEqual(
            sources[2].input_role,
            "product_image",
        )

        self.assertEqual(
            sources[0].name,
            "Referencia plantilla",
        )

        self.assertEqual(
            sources[1].name,
            "Referencia publicitaria",
        )

        self.assertEqual(
            sources[2].name,
            "Producto principal",
        )

    @patch("studio.tasks.FalGenerationProvider")
    @patch("studio.tasks.compose_prompt_with_gemini")
    @patch("studio.services.concept_expansion.resolve_connection")
    def test_complete_pipeline_from_plan_to_generated_asset(
        self,
        resolve_connection,
        compose_prompt,
        fal_provider_class,
    ):
        resolve_connection.return_value = self.fal_connection

        batch = expand_plan_to_jobs(self.concept_plan)

        job = batch.jobs.order_by("queue_position").first()

        original_brief = job.prompt

        composed_prompt = (
            "Create a premium advertising composition. "
            "Use Image 1 as the template reference. "
            "Use Image 2 only as advertising style reference. "
            "Use Image 3 as the exact product identity. "
            'Visible headline: "Recupera tu tiempo". '
            "Maintain a clear single-canvas composition. "
            'Visible CTA: "Empieza ahora". '
            "Preserve the product faithfully and create "
            "a polished commercial result."
        )

        def fake_compose(current_job):
            current_job.composed_prompt = composed_prompt

            current_job.save(
                update_fields=[
                    "composed_prompt",
                    "updated_at",
                ]
            )

            return composed_prompt

        compose_prompt.side_effect = fake_compose

        fal_instance = fal_provider_class.return_value

        def fake_generate(current_job):
            self.assertEqual(
                current_job.composed_prompt,
                composed_prompt,
            )

            self.assertNotEqual(
                current_job.composed_prompt,
                original_brief,
            )

            asset = GeneratedAsset.objects.create(
                job=current_job,
                project=current_job.project,
                file=ContentFile(
                    b"generated-image",
                    name="generated.png",
                ),
                mime_type="image/png",
                width=1080,
                height=1350,
                file_size=len(b"generated-image"),
                prompt_used=(current_job.composed_prompt),
                metadata={
                    "schema_version": 2,
                    "provider": "fal",
                    "model": FAL_PROVIDER_MODEL,
                    "variation": 1,
                    "generation": {
                        "aspect_ratio": "4:5",
                        "resolution": "1K",
                        "output_format": "png",
                        "input_image_count": 3,
                    },
                },
            )

            current_job.status = "completed"
            current_job.save(
                update_fields=[
                    "status",
                ]
            )

            return [asset]

        fal_instance.generate.side_effect = fake_generate

        job.status = "queued"

        job.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        result = process_generation_job(str(job.id))

        job.refresh_from_db()

        self.assertEqual(
            result,
            "completed",
        )

        self.assertEqual(
            job.status,
            "completed",
        )

        self.assertEqual(
            job.prompt,
            original_brief,
        )

        self.assertEqual(
            job.composed_prompt,
            composed_prompt,
        )

        compose_prompt.assert_called_once()

        fal_provider_class.assert_called_once_with(self.fal_connection)

        fal_instance.generate.assert_called_once()

        self.assertEqual(
            job.assets.count(),
            1,
        )

        asset = job.assets.get()

        self.assertEqual(
            asset.prompt_used,
            composed_prompt,
        )

        self.assertNotEqual(
            asset.prompt_used,
            original_brief,
        )

        self.assertEqual(
            asset.metadata["provider"],
            "fal",
        )

        self.assertEqual(
            asset.metadata["model"],
            FAL_PROVIDER_MODEL,
        )

        self.assertEqual(
            asset.metadata["generation"]["input_image_count"],
            3,
        )
