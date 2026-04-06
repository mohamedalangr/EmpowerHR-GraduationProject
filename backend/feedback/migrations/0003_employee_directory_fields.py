from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0002_employee_department_employee_jobtitle_employee_team'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='employeeType',
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='employee',
            name='employmentStatus',
            field=models.CharField(default='Active', max_length=30),
        ),
        migrations.AddField(
            model_name='employee',
            name='isDeleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='employee',
            name='location',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='employee',
            name='role',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
