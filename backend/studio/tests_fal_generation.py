from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import (
    SimpleUploadedFile,
)
from django.test import (
    TestCase,
    override_settings,
)
from PIL import Image

from accounts.models import User, Workspace
from integrations.models import AIProviderConnection
from integrations.services.encryption import (
    encrypt_api_key,
)
from studio.models import (
    AdProject,
    BrandAsset,
    GeneratedAsset,
    GenerationJob,
    GenerationJobInputAsset,
)
from studio.services.generation import (
    FalGenerationProvider,
    GenerationProviderError,
)


@override_settings(
    API_KEY_ENCRYPTION_SECRET=("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0" "NTY3ODlhYmNkZWY="),
    FAL_GENERATION_TIMEOUT=30,
    FAL_UPLOAD_TIMEOUT=30,
    FAL_OUTPUT_DOWNLOAD_TIMEOUT=30,
    FAL_SAFETY_TOLERANCE="4",
    FAL_STORE_IO=False,
)
class FalGenerationProviderTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()

        self.media_override = self.settings(MEDIA_ROOT=self.media.name)

        self.media_override.enable()

        self.user = User.objects.create_user(
            email="fal@example.com",
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="FAL",
            slug="fal-tests",
            workspace_type="individual",
            owner=self.user,
        )

        self.connection = AIProviderConnection.objects.create(
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
            name="FAL project",
            headline="Compra mejor",
        )

        self.job = GenerationJob.objects.create(
            project=self.project,
            requested_by=self.user,
            provider_connection=self.connection,
            provider="fal",
            model_name=("fal-ai/" "nano-banana-pro/edit"),
            prompt="Brief original",
            composed_prompt=(
                "Create one premium integrated "
                "advertising image. "
                "Use the exact Spanish headline "
                '"Compra mejor". '
                "Image 1 is the real product."
            ),
            parameters={
                "aspect_ratio": "4:5",
                "resolution": "1K",
                "output_format": "png",
            },
            number_of_outputs=1,
            status="processing",
        )

        image_buffer = BytesIO()

        Image.new(
            "RGB",
            (20, 30),
            "white",
        ).save(
            image_buffer,
            format="PNG",
        )

        asset = BrandAsset.objects.create(
            workspace=self.workspace,
            category="product",
            name="Producto",
            file=SimpleUploadedFile(
                "product.png",
                image_buffer.getvalue(),
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

    def tearDown(self):
        self.media_override.disable()
        self.media.cleanup()

    def generated_png(self):
        buffer = BytesIO()

        Image.new(
            "RGB",
            (80, 100),
            "white",
        ).save(
            buffer,
            format="PNG",
        )

        return buffer.getvalue()

    @patch("studio.services.generation." "fal_client.SyncClient")
    @patch("studio.services.generation." "requests.get")
    def test_generates_asset_with_composed_prompt(
        self,
        requests_get,
        sync_client_class,
    ):
        client = Mock()

        sync_client_class.return_value = client

        client.upload.return_value = "https://fal.media/input.png"

        def subscribe_side_effect(
            application,
            **kwargs,
        ):
            kwargs["on_enqueue"]("request-123")

            return {
                "images": [
                    {
                        "url": ("https://fal.media/" "output.png"),
                        "content_type": ("image/png"),
                    }
                ],
                "description": "",
            }

        client.subscribe.side_effect = subscribe_side_effect

        download = Mock()
        download.content = self.generated_png()
        download.headers = {"Content-Type": "image/png"}
        download.raise_for_status.return_value = None

        requests_get.return_value = download

        outputs = FalGenerationProvider(self.connection).generate(self.job)

        self.assertEqual(
            len(outputs),
            1,
        )

        output = outputs[0]

        self.assertEqual(
            output.prompt_used,
            self.job.composed_prompt,
        )

        self.assertEqual(
            output.metadata["provider"],
            "fal",
        )

        self.assertEqual(
            output.metadata["model"],
            ("fal-ai/" "nano-banana-pro/edit"),
        )

        self.assertEqual(
            (
                output.width,
                output.height,
            ),
            (
                80,
                100,
            ),
        )

        self.job.refresh_from_db()

        self.assertEqual(
            self.job.provider_request_id,
            "request-123",
        )

        self.assertEqual(
            self.job.status,
            "completed",
        )

        client.upload.assert_called_once()

        arguments = client.subscribe.call_args.kwargs["arguments"]

        self.assertEqual(
            arguments["prompt"],
            self.job.composed_prompt,
        )

        self.assertEqual(
            arguments["image_urls"],
            [
                "https://fal.media/input.png",
            ],
        )

        self.assertEqual(
            arguments["aspect_ratio"],
            "4:5",
        )

    @patch("studio.services.generation." "fal_client.SyncClient")
    def test_rejects_missing_composed_prompt(
        self,
        sync_client_class,
    ):
        self.job.composed_prompt = None

        self.job.save(
            update_fields=[
                "composed_prompt",
            ]
        )

        provider = FalGenerationProvider(self.connection)

        with self.assertRaises(GenerationProviderError):
            provider.generate(self.job)

        sync_client_class.return_value.subscribe.assert_not_called()

    @patch("studio.services.generation." "fal_client.SyncClient")
    @patch("studio.services.generation." "requests.get")
    def test_fal_never_uses_raw_brief(
        self,
        requests_get,
        sync_client_class,
    ):
        self.job.prompt = "ESTE BRIEF NO DEBE LLEGAR A FAL"

        self.job.composed_prompt = "ESTE ES EL PROMPT FINAL " "QUE DEBE UTILIZAR FAL"

        self.job.save(
            update_fields=[
                "prompt",
                "composed_prompt",
            ]
        )

        client = Mock()
        sync_client_class.return_value = client

        client.upload.return_value = "https://fal.media/input.png"

        client.subscribe.return_value = {
            "images": [
                {
                    "url": ("https://fal.media/output.png"),
                    "content_type": "image/png",
                }
            ]
        }

        download = Mock()
        download.content = self.generated_png()
        download.headers = {"Content-Type": "image/png"}
        download.raise_for_status.return_value = None

        requests_get.return_value = download

        FalGenerationProvider(self.connection).generate(self.job)

        arguments = client.subscribe.call_args.kwargs["arguments"]

        self.assertEqual(
            arguments["prompt"],
            self.job.composed_prompt,
        )

        self.assertNotEqual(
            arguments["prompt"],
            self.job.prompt,
        )

        asset = GeneratedAsset.objects.get(job=self.job)

        self.assertEqual(
            asset.prompt_used,
            self.job.composed_prompt,
        )

        self.assertNotEqual(
            asset.prompt_used,
            self.job.prompt,
        )

    @patch("studio.services.generation." "fal_client.SyncClient")
    def test_rejects_inactive_fal_connection(
        self,
        sync_client_class,
    ):
        self.connection.status = "revoked"

        self.connection.save(
            update_fields=[
                "status",
            ]
        )

        with self.assertRaises(GenerationProviderError):
            FalGenerationProvider(self.connection)

        sync_client_class.assert_not_called()

    @patch("studio.services.generation." "fal_client.SyncClient")
    @patch("studio.services.generation." "requests.get")
    def test_failed_multiple_output_does_not_leave_partial_assets(
        self,
        requests_get,
        sync_client_class,
    ):
        self.job.number_of_outputs = 2

        self.job.save(
            update_fields=[
                "number_of_outputs",
            ]
        )

        client = Mock()

        sync_client_class.return_value = client

        client.upload.return_value = "https://fal.media/input.png"

        client.subscribe.return_value = {
            "images": [
                {
                    "url": ("https://fal.media/output-1.png"),
                    "content_type": "image/png",
                },
                {
                    "url": ("https://fal.media/output-2.png"),
                    "content_type": "image/png",
                },
            ]
        }

        valid_download = Mock()
        valid_download.content = self.generated_png()
        valid_download.headers = {"Content-Type": "image/png"}
        valid_download.raise_for_status.return_value = None

        invalid_download = Mock()
        invalid_download.content = b""
        invalid_download.headers = {}
        invalid_download.raise_for_status.return_value = None

        requests_get.side_effect = [
            valid_download,
            invalid_download,
        ]

        provider = FalGenerationProvider(self.connection)

        with self.assertRaises(GenerationProviderError):
            provider.generate(self.job)

        self.assertEqual(
            GeneratedAsset.objects.filter(job=self.job).count(),
            0,
        )
