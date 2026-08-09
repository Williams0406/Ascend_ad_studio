import base64
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import (
    SimpleUploadedFile,
)
from django.test import TestCase, override_settings

from accounts.models import User, Workspace
from integrations.models import AIProviderConnection
from integrations.services.encryption import encrypt_api_key
from studio.models import (
    AdProject,
    AdTemplate,
    BrandAsset,
    BrandKit,
    GenerationJob,
    GenerationJobInputAsset,
)
from studio.services.prompt_composer import (
    GeminiPromptComposer,
    PromptComposerError,
    build_composer_image_parts,
    detect_composed_prompt_quality_issues,
    normalize_composed_prompt,
)


@override_settings(
    API_KEY_ENCRYPTION_SECRET=("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0" "NTY3ODlhYmNkZWY="),
    GEMINI_PROMPT_COMPOSER_MODEL="gemini-2.5-pro",
    GEMINI_PROMPT_COMPOSER_MAX_RETRIES=2,
    GEMINI_COMPOSED_PROMPT_MIN_LENGTH=100,
)
class GeminiPromptComposerTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.media_override = self.settings(MEDIA_ROOT=self.media.name)
        self.media_override.enable()

        self.user = User.objects.create_user(
            email="composer@example.com",
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Composer",
            slug="composer",
            workspace_type="individual",
            owner=self.user,
        )

        self.brand_kit = BrandKit.objects.create(
            workspace=self.workspace,
            brand_name="Ascend",
            default_call_to_action="Empieza ahora",
        )

        self.template = AdTemplate.objects.create(
            workspace=self.workspace,
            name="Single canvas",
            format="instagram_post_portrait",
            layout_constraints={
                "canvas_mode": "single",
            },
            created_by=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            template=self.template,
            name="Campaña Ascend",
            headline="Crea campañas que ascienden",
            call_to_action="Empieza ahora",
            use_brand_kit=True,
        )

        self.connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider=AIProviderConnection.Provider.GEMINI,
            encrypted_api_key=encrypt_api_key("AIza-composer-test-key"),
            api_key_last_four="-key",
            status=AIProviderConnection.Status.ACTIVE,
            is_default=True,
            created_by=self.user,
        )

        self.job = GenerationJob.objects.create(
            project=self.project,
            template=self.template,
            requested_by=self.user,
            provider_connection=self.connection,
            provider="gemini",
            model_name="gemini-2.5-flash-image",
            name="Job compositor",
            headline="Crea campañas que ascienden",
            offer_text="Publicidad clara y consistente",
            call_to_action="Empieza ahora",
            use_brand_kit=True,
            prompt=(
                "BRIEF DEL PROYECTO\n"
                "TITULAR LITERAL OBLIGATORIO: "
                '"Crea campañas que ascienden"\n'
                "CTA LITERAL OBLIGATORIO: "
                '"Empieza ahora"\n'
                "BLOQUEO DE LAYOUT\n"
                "Usa un único lienzo."
            ),
            parameters={
                "aspect_ratio": "4:5",
            },
            status="draft",
        )

    def tearDown(self):
        self.media_override.disable()
        self.media.cleanup()

    def valid_composed_prompt(self):
        return (
            "Create one integrated premium advertising composition "
            "using a single unified canvas and no divided panels. "
            "The visual layout must establish a clear editorial "
            "hierarchy with the product as the primary focal point. "
            "Render all visible advertising copy in Spanish. "
            'Include the exact headline "Crea campañas que ascienden" '
            "with correct spelling and high legibility. "
            'Include the exact CTA "Empieza ahora" in a clear '
            "secondary position. Do not invent prices, percentages, "
            "discounts, guarantees or additional claims. "
            "Maintain a polished, credible and commercially useful "
            "visual direction suitable for a real campaign."
        )

    def response_with_text(self, text):
        response = Mock()
        response.status_code = 200
        response.ok = True
        response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": text,
                            }
                        ]
                    }
                }
            ]
        }
        return response

    def test_normalize_removes_markdown_wrapper(self):
        result = normalize_composed_prompt(
            "```text\nFinal Prompt: Create an image.\n```"
        )

        self.assertEqual(
            result,
            "Create an image.",
        )

    def test_quality_rejects_missing_headline(self):
        result = detect_composed_prompt_quality_issues(
            self.job,
            (
                "Create a professional integrated composition "
                "with layout instructions and Empieza ahora. "
            )
            * 10,
        )

        self.assertFalse(result.is_valid)
        self.assertIn(
            "No contiene literalmente el titular obligatorio.",
            result.issues,
        )

    def test_quality_rejects_missing_cta(self):
        result = detect_composed_prompt_quality_issues(
            self.job,
            (
                "Create a professional integrated composition "
                "with layout instructions and the headline "
                "Crea campañas que ascienden. "
            )
            * 10,
        )

        self.assertFalse(result.is_valid)
        self.assertIn(
            "No contiene literalmente el CTA obligatorio.",
            result.issues,
        )

    def test_quality_rejects_split_screen_for_single_canvas(self):
        text = self.valid_composed_prompt() + " Use a split-screen layout."

        result = detect_composed_prompt_quality_issues(
            self.job,
            text,
        )

        self.assertFalse(result.is_valid)
        self.assertTrue(any("composición dividida" in issue for issue in result.issues))

    @patch("studio.services.prompt_composer.requests.post")
    def test_compose_saves_composed_prompt(
        self,
        request_post,
    ):
        request_post.return_value = self.response_with_text(
            self.valid_composed_prompt()
        )

        composer = GeminiPromptComposer(
            self.connection,
        )

        result = composer.compose(self.job)

        self.job.refresh_from_db()

        self.assertEqual(
            self.job.composed_prompt,
            result,
        )
        self.assertEqual(
            request_post.call_count,
            1,
        )

    @patch("studio.services.prompt_composer.requests.post")
    def test_compose_retries_quality_failures(
        self,
        request_post,
    ):
        invalid = "A short generic prompt without required copy."

        request_post.side_effect = [
            self.response_with_text(invalid),
            self.response_with_text(invalid),
            self.response_with_text(self.valid_composed_prompt()),
        ]

        composer = GeminiPromptComposer(
            self.connection,
            max_retries=2,
        )

        result = composer.compose(self.job)

        self.assertEqual(
            result,
            self.valid_composed_prompt(),
        )
        self.assertEqual(
            request_post.call_count,
            3,
        )

    @patch("studio.services.prompt_composer.requests.post")
    def test_compose_stops_after_two_retries(
        self,
        request_post,
    ):
        request_post.return_value = self.response_with_text("Prompt inválido.")

        composer = GeminiPromptComposer(
            self.connection,
            max_retries=2,
        )

        with self.assertRaises(PromptComposerError):
            composer.compose(self.job)

        self.assertEqual(
            request_post.call_count,
            3,
        )

        self.job.refresh_from_db()
        self.assertFalse(self.job.composed_prompt)

    def test_image_parts_use_job_images(self):
        image_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
            "CAQAAAC1HAwCAAAAC0lEQVR42mP8"
            "/x8AAusB9Wl2nQAAAABJRU5ErkJggg=="
        )

        asset = BrandAsset.objects.create(
            workspace=self.workspace,
            category="product",
            name="Producto principal",
            file=SimpleUploadedFile(
                "product.png",
                image_bytes,
                content_type="image/png",
            ),
            mime_type="image/png",
            uploaded_by=self.user,
        )

        GenerationJobInputAsset.objects.create(
            generation_job=self.job,
            brand_asset=asset,
            input_role="product_image",
            sort_order=0,
        )

        parts = build_composer_image_parts(self.job)

        self.assertEqual(len(parts), 1)
        self.assertEqual(
            parts[0]["inlineData"]["mimeType"],
            "image/png",
        )
        self.assertTrue(parts[0]["inlineData"]["data"])

    @patch("studio.services.prompt_composer.requests.post")
    def test_request_contains_text_and_images(
        self,
        request_post,
    ):
        image_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
            "CAQAAAC1HAwCAAAAC0lEQVR42mP8"
            "/x8AAusB9Wl2nQAAAABJRU5ErkJggg=="
        )

        asset = BrandAsset.objects.create(
            workspace=self.workspace,
            category="product",
            name="Producto principal",
            file=SimpleUploadedFile(
                "product.png",
                image_bytes,
                content_type="image/png",
            ),
            mime_type="image/png",
            uploaded_by=self.user,
        )

        GenerationJobInputAsset.objects.create(
            generation_job=self.job,
            brand_asset=asset,
            input_role="product_image",
            sort_order=0,
        )

        composed = (
            self.valid_composed_prompt() + " Image 1 is the real product identity."
        )

        request_post.return_value = self.response_with_text(composed)

        GeminiPromptComposer(self.connection).compose(self.job)

        payload = request_post.call_args.kwargs["json"]
        parts = payload["contents"][0]["parts"]

        self.assertIn(
            "BRIEF DETERMINÍSTICO",
            parts[0]["text"],
        )
        self.assertIn(
            "inlineData",
            parts[1],
        )
        self.assertIn(
            "Image 1",
            payload["systemInstruction"]["parts"][0]["text"],
        )

    def test_quality_rejects_raw_json_output(self):
        raw_json = (
            "{"
            '"layout_schema": {"canvas_mode": "single"}, '
            '"input_role": "product_image", '
            '"purpose_codes": ["style"]'
            "}"
        )

        result = detect_composed_prompt_quality_issues(
            self.job,
            raw_json,
        )

        self.assertFalse(result.is_valid)

        self.assertTrue(any("JSON crudo" in issue for issue in result.issues))

    @patch("studio.services.prompt_composer." "requests.post")
    def test_raw_json_triggers_retry(
        self,
        request_post,
    ):
        json_output = "{" '"layout_schema": {}, ' '"input_role": "product_image"' "}"

        request_post.side_effect = [
            self.response_with_text(json_output),
            self.response_with_text(self.valid_composed_prompt()),
        ]

        composer = GeminiPromptComposer(
            self.connection,
            max_retries=2,
        )

        result = composer.compose(self.job)

        self.assertEqual(
            result,
            self.valid_composed_prompt(),
        )

        self.assertEqual(
            request_post.call_count,
            2,
        )
