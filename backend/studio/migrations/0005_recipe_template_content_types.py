from django.db import migrations, models


def normalize_recipe_content_types(apps, schema_editor):
    CreativeRecipe = apps.get_model("studio", "CreativeRecipe")
    mappings = {
        "flyer": "image",
        "social_post": "image",
        "story": "image",
        "banner": "image",
        "short_video": "video",
        "product_video": "video",
    }
    for old_value, new_value in mappings.items():
        CreativeRecipe.objects.filter(content_type=old_value).update(
            content_type=new_value
        )


class Migration(migrations.Migration):
    dependencies = [
        ("studio", "0004_generationjob_operational_fields"),
    ]

    operations = [
        migrations.RunPython(
            normalize_recipe_content_types,
            migrations.RunPython.noop,
        ),
        migrations.RemoveField(
            model_name="adtemplate",
            name="editable_elements",
        ),
        migrations.RemoveField(
            model_name="creativerecipe",
            name="layout_rules",
        ),
        migrations.AddField(
            model_name="adtemplate",
            name="content_type",
            field=models.CharField(
                choices=[
                    ("image", "Imagen"),
                    ("video", "Video"),
                    ("carousel", "Carrusel"),
                ],
                default="image",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="adtemplate",
            name="format",
            field=models.CharField(
                choices=[
                    ("post", "Post"),
                    ("story", "Story"),
                    ("banner", "Banner"),
                    ("flyer", "Flyer"),
                    ("reel", "Reel"),
                ],
                default="post",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="creativerecipe",
            name="content_type",
            field=models.CharField(
                choices=[
                    ("image", "Imagen"),
                    ("video", "Video"),
                    ("carousel", "Carrusel"),
                ],
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="projectinputasset",
            name="input_role",
            field=models.CharField(
                choices=[
                    ("product_image", "Imagen del producto"),
                    ("logo", "Logo"),
                    ("background", "Fondo"),
                    ("style_reference", "Referencia de estilo"),
                    ("character_reference", "Referencia de personaje"),
                    ("packaging", "Empaque"),
                    ("other", "Otro"),
                ],
                max_length=50,
            ),
        ),
    ]
