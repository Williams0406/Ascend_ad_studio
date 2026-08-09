import base64
from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User, Workspace, WorkspaceMember
from billing.models import Plan, Subscription
from integrations.models import AIProviderConnection
from integrations.services.encryption import encrypt_api_key
from studio.models import (
    AdProject,
    AdTemplate,
    BrandAsset,
    CreativeReference,
    GenerationJob,
    ProjectInputAsset,
    ProjectReference,
    Purpose,
)
from studio.services.generation import (
    GenerationProviderError,
    GeminiGenerationProvider,
    gemini_response_aspect_ratio,
)
from studio.services.prompts import build_generation_prompt


@override_settings(
    API_KEY_ENCRYPTION_SECRET="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
)
class GeminiGenerationProviderTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.media_override = self.settings(MEDIA_ROOT=self.media.name)
        self.media_override.enable()

        self.user = User.objects.create_user(
            "gemini-test@example.com",
            "SecureTest!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Gemini Test",
            slug="gemini-test",
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
            name="Gemini Test Plan",
            max_members=1,
        )

        Subscription.objects.create(
            workspace=self.workspace,
            plan=plan,
            status="trialing",
        )

        self.connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider="gemini",
            encrypted_api_key=encrypt_api_key("AIza-valid-test-key-123456789"),
            api_key_last_four="6789",
            status="active",
            is_default=True,
            created_by=self.user,
        )

        self.lighting_purpose, _ = Purpose.objects.update_or_create(
            code="lighting",
            defaults={
                "label": "Lighting",
            },
        )

        self.style_purpose, _ = Purpose.objects.update_or_create(
            code="style",
            defaults={
                "label": "Style",
            },
        )

        self.template = AdTemplate.objects.create(
            workspace=self.workspace,
            name="Post vertical Gemini",
            description="Composición editorial vertical.",
            format="instagram_post_portrait",
            layout_constraints={
                "canvas_mode": "single",
                "hierarchy": [
                    "headline",
                    "product",
                    "call_to_action",
                ],
            },
            created_by=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            template=self.template,
            name="Campaña Gemini",
            headline="Precisión creativa",
        )

        self.job = GenerationJob.objects.create(
            project=self.project,
            template=self.template,
            requested_by=self.user,
            provider_connection=self.connection,
            provider="gemini",
            model_name="gemini-2.5-flash-image",
            prompt="Crea una campaña editorial premium.",
            parameters={
                "aspect_ratio": "4:5",
                "resolution": "1K",
            },
            number_of_outputs=1,
            status="processing",
        )

    def tearDown(self):
        self.media_override.disable()
        self.media.cleanup()

    @patch("studio.services.generation.requests.post")
    def test_stores_real_image_response_and_generation_metadata(self, request_post):
        image_buffer = BytesIO()
        Image.new("RGB", (80, 100), "#B67A45").save(image_buffer, format="PNG")
        response = Mock(status_code=200, ok=True, content=b"response")
        response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": "image/png",
                                    "data": base64.b64encode(
                                        image_buffer.getvalue()
                                    ).decode("ascii"),
                                }
                            }
                        ]
                    }
                }
            ]
        }
        request_post.return_value = response

        outputs = GeminiGenerationProvider(self.connection).generate(self.job)

        self.assertEqual(len(outputs), 1)
        self.assertEqual((outputs[0].width, outputs[0].height), (80, 100))
        self.assertEqual(outputs[0].metadata["provider"], "gemini")
        self.job.refresh_from_db()
        self.project.refresh_from_db()
        self.assertEqual(self.job.status, "completed")
        self.assertEqual(self.project.status, "completed")
        payload = request_post.call_args.kwargs["json"]
        self.assertEqual(
            payload["generationConfig"]["responseFormat"]["image"]["aspectRatio"],
            "ASPECT_RATIO_FOUR_BY_FIVE",
        )

    def test_maps_supported_ratios_and_rejects_unknown_values(self):
        self.assertEqual(
            gemini_response_aspect_ratio("9:16"),
            "ASPECT_RATIO_NINE_BY_SIXTEEN",
        )
        with self.assertRaises(GenerationProviderError):
            gemini_response_aspect_ratio("7:5")

    def test_generation_prompt_contains_related_context_and_output_rules(self):
        prompt = build_generation_prompt(self.project)

        self.assertIn("ROL Y OBJETIVO", prompt)
        self.assertIn("BRIEF DEL PROYECTO", prompt)
        self.assertIn("SALIDA Y CRITERIOS DE CALIDAD", prompt)
        self.assertIn("Precisión creativa", prompt)
        self.assertIn("4:5", prompt)

    def test_project_input_assets_can_be_added_and_removed(self):
        asset = BrandAsset.objects.create(
            workspace=self.workspace,
            category="logo",
            name="Logo para proyecto",
            file="brand-assets/logo.png",
            uploaded_by=self.user,
        )
        client = APIClient()
        client.force_authenticate(self.user)
        headers = {"HTTP_X_WORKSPACE_ID": str(self.workspace.id)}

        response = client.post(
            f"/api/studio/projects/{self.project.id}/input-assets/",
            {"brand_asset": str(asset.id), "input_role": "logo", "sort_order": 0},
            format="json",
            **headers,
        )

        self.assertEqual(response.status_code, 201)
        input_asset = ProjectInputAsset.objects.get(ad_project=self.project)
        response = client.delete(
            f"/api/studio/projects/{self.project.id}/input-assets/{input_asset.id}/",
            **headers,
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ProjectInputAsset.objects.filter(id=input_asset.id).exists())
        self.assertTrue(BrandAsset.objects.filter(id=asset.id).exists())

    def test_creative_reference_can_be_created_and_assigned_to_project(self):
        image_buffer = BytesIO()

        Image.new(
            "RGB",
            (24, 18),
            "#35D0C9",
        ).save(
            image_buffer,
            format="PNG",
        )

        client = APIClient()
        client.force_authenticate(self.user)

        headers = {
            "HTTP_X_WORKSPACE_ID": str(self.workspace.id),
        }

        response = client.post(
            "/api/studio/creative-references/",
            {
                "title": "Dirección editorial",
                "image": SimpleUploadedFile(
                    "reference.png",
                    image_buffer.getvalue(),
                    "image/png",
                ),
                "source": "Archivo de prueba",
                "notes": "Usar la composición y la luz.",
                "tags": '["editorial", "luz"]',
            },
            format="multipart",
            **headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

        reference = CreativeReference.objects.get(title="Dirección editorial")

        response = client.post(
            (f"/api/studio/projects/" f"{self.project.id}/references/"),
            {
                "reference": reference.id,
                "input_role": "reference_ad",
                "purpose": ["lighting"],
                "weight": 85,
            },
            format="json",
            **headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

        relation = ProjectReference.objects.get(ad_project=self.project)

        self.assertEqual(
            relation.weight,
            85,
        )

        self.assertEqual(
            set(
                relation.purpose.values_list(
                    "code",
                    flat=True,
                )
            ),
            {"lighting"},
        )

        response = client.delete(
            (
                f"/api/studio/projects/"
                f"{self.project.id}/references/"
                f"{relation.id}/"
            ),
            **headers,
        )

        self.assertEqual(
            response.status_code,
            204,
        )

        self.assertTrue(CreativeReference.objects.filter(id=reference.id).exists())

        response = client.post(
            "/api/studio/projects/",
            {
                "name": "Proyecto con referencia",
                "content_type": "social_post",
                "references": [
                    {
                        "reference": reference.id,
                        "input_role": "reference_ad",
                        "purpose": ["style"],
                        "weight": 70,
                    }
                ],
            },
            format="json",
            **headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

        self.assertTrue(
            ProjectReference.objects.filter(
                ad_project_id=response.data["id"],
                reference=reference,
                purpose__code="style",
                weight=70,
            ).exists()
        )
