from django.db import migrations


def sync_employee_schema(apps, schema_editor):
    """
    Legacy no-op.

    These columns are now added properly by a later schema migration
    (`0022_employee_companysize_employee_companytenure`).
    Keeping this migration as a no-op prevents fresh Railway/Postgres
    deployments from failing on SQLite-specific SQL or duplicate columns.
    """
    return


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0003_employee_directory_fields'),
    ]

    operations = [
        migrations.RunPython(sync_employee_schema, migrations.RunPython.noop),
    ]
