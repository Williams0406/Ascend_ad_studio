import hashlib
import json
import mimetypes
import os
import re
from collections import Counter
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import PlatformAdmin, User, Workspace, WorkspaceMember
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


SPECIFICATION_FILENAME = "ascend_django_seed_specification.html"
MANIFEST_PATTERN = re.compile(
    r'<script[^>]+id=["\']ascend-seed-manifest["\'][^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)


class Command(BaseCommand):
    help = "Crea o actualiza la identidad y los escenarios iniciales de Ascend."

    def add_arguments(self, parser):
        workspace = parser.add_mutually_exclusive_group(required=True)
        workspace.add_argument("--workspace-id")
        workspace.add_argument("--workspace-slug")
        parser.add_argument("--user-email", required=True)
        parser.add_argument("--branding-dir", required=True)
        parser.add_argument(
            "--base-url",
            default=os.getenv("PUBLIC_BACKEND_URL", "http://localhost:8000"),
            help="Origen público usado para construir las URL de los logos.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        self.counts = Counter(created=0, updated=0, skipped=0, errors=0)
        self.model_counts = {}
        self.dry_run = options["dry_run"]
        self.branding_dir = Path(options["branding_dir"]).expanduser().resolve()
        self.base_url = options["base_url"].rstrip("/") + "/"

        manifest = self._load_manifest()
        self._validate_branding_dir()
        workspace = self._resolve_workspace(options)
        user = self._resolve_admin(options["user_email"], workspace)

        self.stdout.write(
            f'Workspace: {workspace.name} ({workspace.id}) | Administrador: {user.email}'
        )
        if self.dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN: no se conservarán cambios."))

        try:
            with transaction.atomic():
                assets = self._seed_assets(manifest["assets"], workspace, user)
                brand_kit = self._seed_brand_kit(
                    manifest["brand_kit"], workspace, assets
                )
                self._upsert(
                    BrandRule,
                    {"brand_kit": brand_kit},
                    manifest["brand_rules"],
                )
                self._upsert(
                    WorkspacePreference,
                    {"workspace": workspace},
                    manifest["workspace_preferences"],
                )
                product = self._seed_product(
                    manifest["product"], workspace, assets
                )
                angles = self._seed_angles(manifest["creative_angles"])
                recipes = self._seed_recipes(
                    manifest["recipes"], workspace, user, angles
                )
                templates = self._seed_templates(
                    manifest["templates"], workspace, user, assets
                )
                self._seed_projects(
                    manifest["sample_projects"],
                    workspace,
                    user,
                    product,
                    assets,
                    angles,
                    recipes,
                    templates,
                )
                if self.dry_run:
                    transaction.set_rollback(True)
        except Exception as exc:
            self._print_summary()
            raise CommandError(
                f"El seed se revirtió completamente por un error: {exc}"
            ) from exc
        else:
            self._print_summary()

    def _load_manifest(self):
        candidates = [
            Path(settings.BASE_DIR).parent / SPECIFICATION_FILENAME,
            Path.cwd() / SPECIFICATION_FILENAME,
            Path.cwd().parent / SPECIFICATION_FILENAME,
        ]
        specification = next((path for path in candidates if path.is_file()), None)
        if specification is None:
            raise CommandError(
                f"No se encontró {SPECIFICATION_FILENAME} en la raíz del proyecto."
            )

        match = MANIFEST_PATTERN.search(
            specification.read_text(encoding="utf-8")
        )
        if not match:
            raise CommandError('No se encontró el bloque "ascend-seed-manifest".')
        try:
            manifest = json.loads(unescape(match.group(1)))
        except json.JSONDecodeError as exc:
            raise CommandError(f"El manifiesto JSON es inválido: {exc}") from exc

        required = {
            "brand_kit",
            "brand_rules",
            "workspace_preferences",
            "assets",
            "product",
            "creative_angles",
            "recipes",
            "templates",
            "sample_projects",
        }
        missing = sorted(required - manifest.keys())
        if missing:
            raise CommandError(f"Faltan secciones del manifiesto: {', '.join(missing)}")
        return manifest

    def _validate_branding_dir(self):
        if not self.branding_dir.is_dir():
            raise CommandError(
                f'La carpeta BRANDING no existe: "{self.branding_dir}".'
            )

    def _resolve_workspace(self, options):
        lookup = (
            {"id": options["workspace_id"]}
            if options.get("workspace_id")
            else {"slug": options["workspace_slug"]}
        )
        try:
            return Workspace.objects.get(**lookup)
        except (Workspace.DoesNotExist, ValueError) as exc:
            value = next(iter(lookup.values()))
            raise CommandError(f'No existe el workspace "{value}".') from exc

    def _resolve_admin(self, email, workspace):
        normalized_email = User.objects.normalize_email(email).lower()
        try:
            user = User.objects.get(email__iexact=normalized_email)
        except User.DoesNotExist as exc:
            raise CommandError(
                f'No existe el usuario administrador "{normalized_email}".'
            ) from exc

        is_platform_admin = PlatformAdmin.objects.filter(
            user=user, is_active=True
        ).exists()
        if not (user.is_superuser and user.is_staff and is_platform_admin):
            raise CommandError(
                f'El usuario "{user.email}" no es un administrador activo creado '
                "por create_platform_admin."
            )

        linked = workspace.owner_id == user.id or WorkspaceMember.objects.filter(
            workspace=workspace, user=user, is_active=True
        ).exists()
        if not linked:
            raise CommandError(
                f'El administrador "{user.email}" no pertenece al workspace '
                f'"{workspace.slug}".'
            )
        return user

    def _seed_assets(self, entries, workspace, user):
        assets = {}
        valid_categories = self._choice_values(BrandAsset, "category")
        for entry in entries:
            name = entry["name"]
            if entry["category"] not in valid_categories:
                self._error(
                    BrandAsset,
                    name,
                    f'category inválida: {entry["category"]}',
                )
                continue

            source = self.branding_dir / entry["source_filename"]
            existing = BrandAsset.objects.filter(
                workspace=workspace, name=name
            ).first()
            if not source.is_file():
                self.stdout.write(
                    self.style.WARNING(f'ARCHIVO FALTANTE: "{source}"')
                )
                if existing:
                    assets[name] = existing
                    self._skip(BrandAsset, name, "se conserva el asset existente")
                else:
                    self._error(BrandAsset, name, "archivo fuente faltante")
                continue

            defaults = {
                "category": entry["category"],
                "is_favorite": entry["is_favorite"],
                "metadata": entry["metadata"],
                "uploaded_by": user,
                "mime_type": mimetypes.guess_type(source.name)[0]
                or "application/octet-stream",
                "file_size": source.stat().st_size,
            }
            width, height = self._image_dimensions(source)
            defaults.update(width=width, height=height)

            should_write_file = not self.dry_run and (
                existing is None or not self._same_file(existing, source)
            )
            if should_write_file:
                with source.open("rb") as source_file:
                    defaults["file"] = File(source_file, name=source.name)
                    asset = self._upsert(
                        BrandAsset,
                        {"workspace": workspace, "name": name},
                        defaults,
                    )
            else:
                if self.dry_run and existing is None:
                    defaults["file"] = f"brand-assets/{source.name}"
                asset = self._upsert(
                    BrandAsset,
                    {"workspace": workspace, "name": name},
                    defaults,
                )
            assets[name] = asset
        return assets

    def _seed_brand_kit(self, data, workspace, assets):
        defaults = {
            key: value
            for key, value in data.items()
            if key != "logo_asset_names"
        }
        for field, asset_name in data["logo_asset_names"].items():
            asset = assets.get(asset_name)
            if asset and asset.file:
                defaults[field] = urljoin(
                    self.base_url, asset.file.url.lstrip("/")
                )
            else:
                defaults[field] = ""
                self._skip(BrandKit, field, f'asset no disponible: "{asset_name}"')
        return self._upsert(BrandKit, {"workspace": workspace}, defaults)

    def _seed_product(self, data, workspace, assets):
        defaults = dict(data)
        asset_name = defaults.pop("main_image_asset_name")
        defaults["main_image_asset"] = assets.get(asset_name)
        if defaults["main_image_asset"] is None:
            self._skip(Product, data["name"], f'asset no disponible: "{asset_name}"')
        return self._upsert(
            Product,
            {"workspace": workspace, "name": data["name"]},
            {key: value for key, value in defaults.items() if key != "name"},
        )

    def _seed_angles(self, entries):
        result = {}
        choices = self._choice_values(CreativeAngle, "code")
        for entry in entries:
            code = entry["code"]
            if code not in choices:
                self._error(CreativeAngle, code, "code fuera de choices")
                continue
            result[code] = self._upsert(
                CreativeAngle,
                {"code": code},
                {key: value for key, value in entry.items() if key != "code"},
            )
        return result

    def _seed_recipes(self, entries, workspace, user, angles):
        result = {}
        choices = self._choice_values(CreativeRecipe, "content_type")
        for entry in entries:
            name = entry["name"]
            angle = angles.get(entry["creative_angle_code"])
            if entry["content_type"] not in choices or angle is None:
                self._error(CreativeRecipe, name, "choice o CreativeAngle inválido")
                continue
            defaults = {
                key: value
                for key, value in entry.items()
                if key not in {"name", "creative_angle_code"}
            }
            defaults.update(creative_angle=angle, created_by=user)
            result[name] = self._upsert(
                CreativeRecipe,
                {"workspace": workspace, "name": name},
                defaults,
            )
        return result

    def _seed_templates(self, entries, workspace, user, assets):
        result = {}
        content_types = self._choice_values(AdTemplate, "content_type")
        formats = self._choice_values(AdTemplate, "format")
        for entry in entries:
            name = entry["name"]
            source_asset = assets.get(entry["source_asset_name"])
            if (
                source_asset is None
                or entry["content_type"] not in content_types
                or entry["format"] not in formats
            ):
                self._error(AdTemplate, name, "asset o choice inválido")
                continue
            defaults = {
                key: value
                for key, value in entry.items()
                if key not in {"name", "source_asset_name"}
            }
            defaults.update(source_asset=source_asset, created_by=user)
            result[name] = self._upsert(
                AdTemplate,
                {"workspace": workspace, "name": name},
                defaults,
            )
        return result

    def _seed_projects(
        self,
        entries,
        workspace,
        user,
        product,
        assets,
        angles,
        recipes,
        templates,
    ):
        content_types = self._choice_values(AdProject, "content_type")
        statuses = self._choice_values(AdProject, "status")
        input_roles = self._choice_values(ProjectInputAsset, "input_role")
        for entry in entries:
            name = entry["name"]
            angle = angles.get(entry["creative_angle_code"])
            recipe = recipes.get(entry["recipe_name"])
            template = (
                templates.get(entry["template_name"])
                if entry["template_name"]
                else None
            )
            dependencies_ok = (
                product is not None
                and product.name == entry["product_name"]
                and angle is not None
                and recipe is not None
                and (entry["template_name"] is None or template is not None)
            )
            if (
                not dependencies_ok
                or entry["content_type"] not in content_types
                or entry["status"] not in statuses
            ):
                self._error(AdProject, name, "relación o choice inválido")
                continue

            defaults = {
                key: value
                for key, value in entry.items()
                if key
                not in {
                    "name",
                    "product_name",
                    "template_name",
                    "recipe_name",
                    "creative_angle_code",
                    "input_assets",
                }
            }
            defaults.update(
                created_by=user,
                product=product,
                template=template,
                recipe=recipe,
                creative_angle=angle,
            )
            project = self._upsert(
                AdProject,
                {"workspace": workspace, "name": name},
                defaults,
            )
            for input_entry in entry["input_assets"]:
                asset = assets.get(input_entry["asset_name"])
                role = input_entry["input_role"]
                if asset is None or role not in input_roles:
                    self._error(
                        ProjectInputAsset,
                        f"{name} / {input_entry['asset_name']}",
                        "asset o input_role inválido",
                    )
                    continue
                self._upsert(
                    ProjectInputAsset,
                    {
                        "ad_project": project,
                        "brand_asset": asset,
                        "input_role": role,
                    },
                    {"sort_order": input_entry["sort_order"]},
                )

    def _upsert(self, model, lookup, defaults):
        label = model.__name__
        identifier = lookup.get("name") or lookup.get("code") or label
        try:
            with transaction.atomic():
                instance, created = model.objects.update_or_create(
                    **lookup, defaults=defaults
                )
            status = "created" if created else "updated"
            self.counts[status] += 1
            self._model_counter(label)[status] += 1
            self.stdout.write(f'{label}: {"creado" if created else "actualizado"} — {identifier}')
            return instance
        except Exception as exc:
            self._error(model, str(identifier), str(exc))
            raise

    def _choice_values(self, model, field_name):
        return {value for value, _label in model._meta.get_field(field_name).choices}

    def _image_dimensions(self, source):
        try:
            from PIL import Image

            with Image.open(source) as image:
                return image.size
        except Exception:
            return None, None

    def _same_file(self, asset, source):
        if not asset.file or asset.file_size != source.stat().st_size:
            return False
        try:
            with asset.file.open("rb") as stored:
                return self._digest(stored) == self._digest(source.open("rb"))
        except (FileNotFoundError, OSError):
            return False

    @staticmethod
    def _digest(stream):
        try:
            digest = hashlib.sha256()
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
            return digest.digest()
        finally:
            stream.close()

    def _model_counter(self, model_name):
        return self.model_counts.setdefault(model_name, Counter())

    def _skip(self, model, identifier, reason):
        label = model.__name__
        self.counts["skipped"] += 1
        self._model_counter(label)["skipped"] += 1
        self.stdout.write(self.style.WARNING(f"{label}: omitido — {identifier}: {reason}"))

    def _error(self, model, identifier, reason):
        label = model.__name__
        self.counts["errors"] += 1
        self._model_counter(label)["errors"] += 1
        self.stderr.write(self.style.ERROR(f"{label}: error — {identifier}: {reason}"))

    def _print_summary(self):
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Resumen Ascend"))
        for model_name, counts in self.model_counts.items():
            self.stdout.write(
                f"{model_name}: creados={counts['created']}, "
                f"actualizados={counts['updated']}, "
                f"omitidos={counts['skipped']}, errores={counts['errors']}"
            )
        prefix = "DRY RUN — " if self.dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}TOTAL: creados={self.counts['created']}, "
                f"actualizados={self.counts['updated']}, "
                f"omitidos={self.counts['skipped']}, errores={self.counts['errors']}"
            )
        )
