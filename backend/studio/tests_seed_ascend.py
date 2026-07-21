import io
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image

from accounts.models import PlatformAdmin, User, Workspace
from studio.models import (
    AdProject,
    AdTemplate,
    BrandAsset,
    BrandKit,
    BrandRule,
    CreativeAngle,
    CreativeRecipe,
    Product,
    ProjectInputAsset,
    WorkspacePreference,
)


ASSET_FILENAMES = (
    "PFP_ascend transparente.png",
    "PFP_ascend transparente 2.png",
    "PFP_ascend fondo blanco.png",
    "PFP_ascend fondo blanco 2.png",
    "PFP_icono fondo blanco 2.png",
    "PFP_icono fondo blanco.png",
    "PFP_ICONO TRANSPARENTE-07.png",
    "PFP_ICONO TRANSPARENTE-08.png",
    "PFP_1.png",
    "PFP_2.png",
    "PFP_3.png",
    "PFP_4.png",
)


class SeedAscendBrandingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            email="admin@ascend.test", password="Testing12345!"
        )
        PlatformAdmin.objects.create(
            user=self.user, role="super_admin", is_active=True
        )
        self.workspace = Workspace.objects.create(
            name="Ascend Test",
            slug="ascend-test",
            workspace_type="individual",
            owner=self.user,
        )

    def test_seed_is_idempotent_and_dry_run_rolls_back(self):
        with tempfile.TemporaryDirectory() as directory:
            branding_dir = Path(directory) / "BRANDING"
            media_dir = Path(directory) / "media"
            branding_dir.mkdir()
            for filename in ASSET_FILENAMES:
                Image.new("RGBA", (8, 8), "#35D0C9").save(
                    branding_dir / filename, format="PNG"
                )

            arguments = {
                "workspace_slug": self.workspace.slug,
                "user_email": self.user.email,
                "branding_dir": str(branding_dir),
                "stdout": io.StringIO(),
                "stderr": io.StringIO(),
            }
            with override_settings(MEDIA_ROOT=media_dir):
                call_command("seed_ascend_branding", **arguments)
                call_command("seed_ascend_branding", **arguments)

                self.assertEqual(BrandAsset.objects.count(), 12)
                self.assertEqual(BrandKit.objects.count(), 1)
                self.assertEqual(BrandRule.objects.count(), 1)
                self.assertEqual(WorkspacePreference.objects.count(), 1)
                self.assertEqual(Product.objects.count(), 1)
                self.assertEqual(
                    CreativeAngle.objects.filter(
                        code__in=(
                            "problem_solution",
                            "benefit",
                            "features",
                            "premium",
                            "educational",
                            "minimalist",
                        )
                    ).count(),
                    6,
                )
                self.assertEqual(CreativeRecipe.objects.count(), 3)
                self.assertEqual(AdTemplate.objects.count(), 2)
                self.assertEqual(AdProject.objects.count(), 3)
                self.assertEqual(ProjectInputAsset.objects.count(), 7)
                self.assertEqual(len(list(media_dir.rglob("*.png"))), 12)

                before = {
                    model: model.objects.count()
                    for model in (
                        BrandAsset,
                        BrandKit,
                        Product,
                        CreativeRecipe,
                        AdTemplate,
                        AdProject,
                        ProjectInputAsset,
                    )
                }
                call_command(
                    "seed_ascend_branding",
                    **arguments,
                    dry_run=True,
                )
                self.assertEqual(
                    before,
                    {model: model.objects.count() for model in before},
                )
