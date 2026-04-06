from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resume_pipeline", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="review_stage",
            field=models.CharField(
                choices=[
                    ("Applied", "Applied"),
                    ("Shortlisted", "Shortlisted"),
                    ("Interview", "Interview"),
                    ("Hired", "Hired"),
                    ("Rejected", "Rejected"),
                ],
                default="Applied",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="stage_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="stage_updated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="talent_pool",
            field=models.BooleanField(default=True),
        ),
    ]
