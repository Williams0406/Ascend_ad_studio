from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("studio", "0003_creativeangle_adproject_campaign_theme_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="generationjob",
            name="credits_consumed",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="generationjob",
            name="retry_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="generationjob",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name="generationjob",
            name="model_name",
            field=models.CharField(max_length=200),
        ),
        migrations.AlterField(
            model_name="generationjob",
            name="provider",
            field=models.CharField(max_length=100),
        ),
    ]
