from django.db import migrations, models


def include_main_images(apps, schema_editor):
    Product = apps.get_model("studio", "Product")
    through = Product.image_assets.through
    through.objects.bulk_create(
        [
            through(product_id=product.id, brandasset_id=product.main_image_asset_id)
            for product in Product.objects.exclude(main_image_asset_id=None)
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [("studio", "0006_creativereference_projectreference")]

    operations = [
        migrations.AddField(
            model_name="product",
            name="image_assets",
            field=models.ManyToManyField(
                blank=True,
                related_name="products",
                to="studio.brandasset",
            ),
        ),
        migrations.RunPython(include_main_images, migrations.RunPython.noop),
    ]
