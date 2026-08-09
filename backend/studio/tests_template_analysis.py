import json
from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import (
    Mock,
    patch,
)

from django.core.files.uploadedfile import (
    SimpleUploadedFile,
)
from django.test import (
    TestCase,
    override_settings,
)
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import (
    User,
    Workspace,
    WorkspaceMember,
)
from billing.models import (
    Plan,
    Subscription,
)
from integrations.models import (
    AIProviderConnection,
)
from integrations.services.encryption import (
    encrypt_api_key,
)
from studio.models import (
    AdTemplate,
    AdTemplateExampleImage,
    CreativeReference,
)


@override_settings(
    API_KEY_ENCRYPTION_SECRET=("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0" "NTY3ODlhYmNkZWY="),
    GEMINI_TEMPLATE_ANALYSIS_MODEL=("gemini-2.5-pro"),
    GEMINI_TEMPLATE_ANALYSIS_TIMEOUT=30,
)
class TemplateAnalysisTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()

        self.media_override = self.settings(MEDIA_ROOT=self.media.name)

        self.media_override.enable()

        self.user = User.objects.create_user(
            email="template-analysis@example.com",
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Template Analysis",
            slug="template-analysis",
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
            name="Template Plan",
            max_members=1,
        )

        Subscription.objects.create(
            workspace=self.workspace,
            plan=plan,
            status="active",
        )

        self.connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider="gemini",
            encrypted_api_key=(encrypt_api_key("AIza-template-test")),
            status="active",
            is_default=True,
            created_by=self.user,
        )

        self.template = AdTemplate.objects.create(
            workspace=self.workspace,
            name="Bold Billboard",
            description=("Plantilla de alto impacto."),
            format="instagram_post_portrait",
            layout_constraints={
                "canvas_mode": "single",
                "allow_split_screen": False,
                "allow_collage": False,
                "max_product_instances": 1,
            },
            created_by=self.user,
        )

        self.reference = CreativeReference.objects.create(
            workspace=self.workspace,
            title="Ejemplo Bold",
            category="template",
            image=self.make_image("bold.png"),
            created_by=self.user,
        )

        self.client = APIClient()

        self.client.force_authenticate(self.user)

        self.headers = {
            "HTTP_X_WORKSPACE_ID": (str(self.workspace.id)),
        }

    def tearDown(self):
        self.media_override.disable()
        self.media.cleanup()

    def make_image(self, name):
        buffer = BytesIO()

        Image.new(
            "RGB",
            (30, 40),
            "white",
        ).save(
            buffer,
            format="PNG",
        )

        return SimpleUploadedFile(
            name,
            buffer.getvalue(),
            content_type="image/png",
        )

    def test_add_example(self):
        response = self.client.post(
            (f"/api/studio/ad-templates/" f"{self.template.id}/examples/"),
            {
                "image": self.reference.id,
                "sort_order": 1,
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

        self.assertEqual(
            AdTemplateExampleImage.objects.filter(ad_template=self.template).count(),
            1,
        )

    @patch("studio.services." "template_analysis.requests.post")
    def test_reanalyze_updates_template(
        self,
        request_post,
    ):
        example = AdTemplateExampleImage.objects.create(
            ad_template=self.template,
            image=self.reference,
            sort_order=0,
        )

        payload = {
            "visual_structure": ("Producto central con alto contraste."),
            "copy_structure": ("Headline grande arriba, CTA abajo."),
            "prompt_guidance": ("Usar composición editorial " "de alto impacto."),
            "do_rules": [
                "Mantener jerarquía clara",
            ],
            "dont_rules": [
                "No dividir el lienzo",
            ],
            "image_notes": [
                {
                    "example_id": (str(example.id)),
                    "notes": ("Ejemplo con producto " "central dominante."),
                }
            ],
        }

        response_mock = Mock()
        response_mock.status_code = 200
        response_mock.ok = True

        response_mock.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": (
                                    json.dumps(
                                        payload,
                                        ensure_ascii=False,
                                    )
                                )
                            }
                        ]
                    }
                }
            ]
        }

        request_post.return_value = response_mock

        response = self.client.post(
            (f"/api/studio/ad-templates/" f"{self.template.id}/reanalyze/"),
            {},
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            200,
            response.data,
        )

        self.template.refresh_from_db()
        example.refresh_from_db()

        self.assertEqual(
            self.template.visual_structure,
            payload["visual_structure"],
        )

        self.assertEqual(
            self.template.copy_structure,
            payload["copy_structure"],
        )

        self.assertEqual(
            self.template.prompt_guidance,
            payload["prompt_guidance"],
        )

        self.assertEqual(
            self.template.do_rules,
            payload["do_rules"],
        )

        self.assertEqual(
            example.gemini_vision_notes,
            ("Ejemplo con producto " "central dominante."),
        )

    def test_reanalyze_requires_examples(self):
        response = self.client.post(
            (f"/api/studio/ad-templates/" f"{self.template.id}/reanalyze/"),
            {},
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            400,
        )

    def test_reanalyze_does_not_modify_layout_constraints(
        self,
    ):
        original_constraints = {
            "canvas_mode": "single",
            "allow_split_screen": False,
            "allow_collage": False,
            "max_product_instances": 1,
        }

        self.assertEqual(
            self.template.layout_constraints,
            original_constraints,
        )

        example = AdTemplateExampleImage.objects.create(
            ad_template=self.template,
            image=self.reference,
            sort_order=0,
        )

        payload = {
            "visual_structure": ("Producto central dominante."),
            "copy_structure": ("Headline superior y CTA inferior."),
            "prompt_guidance": ("Composición premium."),
            "do_rules": [
                "Mantener foco visual",
            ],
            "dont_rules": [
                "Evitar ruido visual",
            ],
            "image_notes": [
                {
                    "example_id": str(example.id),
                    "notes": ("Producto central."),
                }
            ],
        }

        response_mock = Mock()
        response_mock.status_code = 200
        response_mock.ok = True
        response_mock.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    payload,
                                    ensure_ascii=False,
                                )
                            }
                        ]
                    }
                }
            ]
        }

        with patch("studio.services.template_analysis.requests.post") as request_post:
            request_post.return_value = response_mock

            response = self.client.post(
                (f"/api/studio/ad-templates/" f"{self.template.id}/reanalyze/"),
                {},
                format="json",
                **self.headers,
            )

        self.assertEqual(
            response.status_code,
            200,
            response.data,
        )

        self.template.refresh_from_db()

        self.assertEqual(
            self.template.layout_constraints,
            original_constraints,
        )
