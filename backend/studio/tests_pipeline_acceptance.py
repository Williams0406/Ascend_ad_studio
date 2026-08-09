from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import (
    SimpleUploadedFile,
)
from django.test import TestCase
from PIL import Image

from accounts.models import (
    User,
    Workspace,
)
from studio.models import (
    AdProject,
    BrandAsset,
    CreativeReference,
    GenerationJob,
    GenerationJobInputAsset,
    GenerationJobReference,
)
from studio.services.generation_inputs import (
    ordered_generation_image_sources,
)
from studio.services.prompts import (
    build_generation_prompt,
)


class ThreeStagePipelineAcceptanceTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()

        self.media_override = self.settings(MEDIA_ROOT=self.media.name)

        self.media_override.enable()

        self.user = User.objects.create_user(
            email="acceptance@example.com",
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Acceptance",
            slug="acceptance",
            workspace_type="individual",
            owner=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            name="Acceptance project",
            headline="Construye mejor",
        )

        self.job = GenerationJob.objects.create(
            project=self.project,
            requested_by=self.user,
            provider="fal",
            model_name=("fal-ai/" "nano-banana-pro/edit"),
            prompt="",
            status="draft",
        )

        def png(name):
            buffer = BytesIO()

            Image.new(
                "RGB",
                (10, 10),
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

        reference = CreativeReference.objects.create(
            workspace=self.workspace,
            title="Referencia editorial",
            category="reference_ad",
            image=png("reference.png"),
            created_by=self.user,
        )

        GenerationJobReference.objects.create(
            generation_job=self.job,
            reference=reference,
            input_role="reference_ad",
            weight=100,
        )

        product = BrandAsset.objects.create(
            workspace=self.workspace,
            category="product",
            name="Producto real",
            file=png("product.png"),
            mime_type="image/png",
            uploaded_by=self.user,
        )

        GenerationJobInputAsset.objects.create(
            generation_job=self.job,
            brand_asset=product,
            input_role="product_image",
            sort_order=1,
        )

        persona = BrandAsset.objects.create(
            workspace=self.workspace,
            category="persona",
            name="Persona real",
            file=png("persona.png"),
            mime_type="image/png",
            uploaded_by=self.user,
        )

        GenerationJobInputAsset.objects.create(
            generation_job=self.job,
            brand_asset=persona,
            input_role=("character_reference"),
            sort_order=2,
        )

    def tearDown(self):
        self.media_override.disable()
        self.media.cleanup()

    def test_image_manifest_has_one_canonical_order(
        self,
    ):
        sources = ordered_generation_image_sources(self.job)

        self.assertEqual(
            [source.name for source in sources],
            [
                "Referencia editorial",
                "Producto real",
                "Persona real",
            ],
        )

        self.assertEqual(
            [source.image_number for source in sources],
            [
                1,
                2,
                3,
            ],
        )

        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertIn(
            ("Image 1: nombre=" '"Referencia editorial"'),
            prompt,
        )

        self.assertIn(
            ("Image 2: nombre=" '"Producto real"'),
            prompt,
        )

        self.assertIn(
            ("Image 3: nombre=" '"Persona real"'),
            prompt,
        )

    @patch("studio.services.generation." "FalGenerationProvider._upload_source")
    def test_fal_uploads_same_canonical_order(
        self,
        upload,
    ):
        from studio.services.generation import (
            FalGenerationProvider,
        )

        provider = object.__new__(FalGenerationProvider)

        uploaded_names = []

        def upload_side_effect(source):
            uploaded_names.append(source.name)

            return f"https://fal.media/" f"{source.image_number}.png"

        upload.side_effect = upload_side_effect

        urls = provider._image_urls(self.job)

        self.assertEqual(
            uploaded_names,
            [
                "Referencia editorial",
                "Producto real",
                "Persona real",
            ],
        )

        self.assertEqual(
            urls,
            [
                "https://fal.media/1.png",
                "https://fal.media/2.png",
                "https://fal.media/3.png",
            ],
        )
