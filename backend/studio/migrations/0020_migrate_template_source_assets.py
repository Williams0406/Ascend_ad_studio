from django.core.files.base import ContentFile
from django.db import migrations


def migrate_source_assets(
    apps,
    schema_editor,
):
    AdTemplate = apps.get_model(
        "studio",
        "AdTemplate",
    )

    CreativeReference = apps.get_model(
        "studio",
        "CreativeReference",
    )

    AdTemplateExampleImage = apps.get_model(
        "studio",
        "AdTemplateExampleImage",
    )

    templates = AdTemplate.objects.exclude(
        source_asset_id=None,
    )

    for template in templates.iterator():
        # Si ya tiene example images, no hacemos nada.
        if AdTemplateExampleImage.objects.filter(
            ad_template_id=template.id,
        ).exists():
            continue

        asset = template.source_asset

        if not asset:
            continue

        if not asset.file:
            continue

        # Crear una CreativeReference nueva
        # usando una copia del archivo del BrandAsset.
        reference = CreativeReference(
            workspace_id=template.workspace_id,
            title=(f"{template.name} · " "Referencia migrada"),
            category="template",
            source="legacy_source_asset",
            notes=("Migrada automáticamente desde " "AdTemplate.source_asset."),
            tags=[
                "legacy_source_asset",
            ],
            created_by_id=template.created_by_id,
        )

        asset.file.open("rb")

        try:
            content = ContentFile(asset.file.read())

        finally:
            asset.file.close()

        original_name = asset.file.name.rsplit("/", 1)[-1]

        reference.image.save(
            original_name,
            content,
            save=False,
        )

        reference.save()

        AdTemplateExampleImage.objects.create(
            ad_template_id=template.id,
            image_id=reference.id,
            sort_order=0,
        )


class Migration(migrations.Migration):

    dependencies = [
        (
            "studio",
            "0019_remove_adproject_target_audience",
        ),
    ]

    operations = [
        migrations.RunPython(
            migrate_source_assets,
            migrations.RunPython.noop,
        ),
    ]
