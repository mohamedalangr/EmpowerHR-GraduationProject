from django.db import migrations


def sync_employee_schema(apps, schema_editor):
    cursor = schema_editor.connection.cursor()
    cursor.execute("PRAGMA table_info(feedback_employee)")
    existing_columns = {row[1] for row in cursor.fetchall()}

    if 'companySize' not in existing_columns:
        schema_editor.execute("ALTER TABLE feedback_employee ADD COLUMN companySize integer NULL")
    if 'companyTenure' not in existing_columns:
        schema_editor.execute("ALTER TABLE feedback_employee ADD COLUMN companyTenure integer NULL")


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0003_employee_directory_fields'),
    ]

    operations = [
        migrations.RunPython(sync_employee_schema, migrations.RunPython.noop),
    ]
