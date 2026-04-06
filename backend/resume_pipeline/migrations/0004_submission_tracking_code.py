import secrets

from django.db import migrations, models
import resume_pipeline.models


def seed_tracking_codes(apps, schema_editor):
    Submission = apps.get_model("resume_pipeline", "Submission")
    used_codes = set()

    for submission in Submission.objects.all().order_by("id"):
        code = (submission.tracking_code or "").strip().upper()
        while not code or code in used_codes:
            code = secrets.token_hex(4).upper()
        submission.tracking_code = code
        submission.save(update_fields=["tracking_code"])
        used_codes.add(code)


class Migration(migrations.Migration):

    dependencies = [
        ("resume_pipeline", "0003_submission_stage_history"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="tracking_code",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.RunPython(seed_tracking_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="submission",
            name="tracking_code",
            field=models.CharField(default=resume_pipeline.models.generate_tracking_code, editable=False, max_length=16, unique=True),
        ),
    ]
