from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0020_employee_companysize_employee_companytenure_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='policyannouncement',
            name='lastReminderAt',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='policyannouncement',
            name='lastReminderNote',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='policyannouncement',
            name='reminderCount',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='policyannouncement',
            name='reminderHistory',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
