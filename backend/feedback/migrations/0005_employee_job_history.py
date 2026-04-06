from django.db import migrations, models
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0004_sync_employee_schema'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployeeJobHistory',
            fields=[
                ('historyID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('action', models.CharField(choices=[('Promotion', 'Promotion'), ('Demotion', 'Demotion'), ('Role Change', 'Role Change')], max_length=20)),
                ('previousJobTitle', models.CharField(blank=True, max_length=100)),
                ('newJobTitle', models.CharField(blank=True, max_length=100)),
                ('previousRole', models.CharField(blank=True, max_length=50)),
                ('newRole', models.CharField(blank=True, max_length=50)),
                ('previousDepartment', models.CharField(blank=True, max_length=100)),
                ('newDepartment', models.CharField(blank=True, max_length=100)),
                ('previousTeam', models.CharField(blank=True, max_length=100)),
                ('newTeam', models.CharField(blank=True, max_length=100)),
                ('previousMonthlyIncome', models.IntegerField(blank=True, null=True)),
                ('newMonthlyIncome', models.IntegerField(blank=True, null=True)),
                ('changedBy', models.CharField(blank=True, max_length=150)),
                ('notes', models.TextField(blank=True)),
                ('changedAt', models.DateTimeField(auto_now_add=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=models.deletion.CASCADE, related_name='job_history', to='feedback.employee')),
            ],
            options={
                'db_table': 'EmployeeJobHistory',
                'ordering': ['-changedAt'],
            },
        ),
    ]
