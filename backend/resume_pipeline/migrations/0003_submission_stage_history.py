from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resume_pipeline", "0002_submission_pipeline_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="stage_history",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
