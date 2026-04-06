from django.db import migrations, models
import django.db.models.deletion
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0007_payroll_record'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployeeGoal',
            fields=[
                ('goalID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=160)),
                ('description', models.TextField(blank=True)),
                ('category', models.CharField(choices=[('Performance', 'Performance'), ('Development', 'Development'), ('Leadership', 'Leadership'), ('Attendance', 'Attendance')], default='Performance', max_length=30)),
                ('priority', models.CharField(choices=[('Low', 'Low'), ('Medium', 'Medium'), ('High', 'High')], default='Medium', max_length=20)),
                ('status', models.CharField(choices=[('Not Started', 'Not Started'), ('In Progress', 'In Progress'), ('Completed', 'Completed'), ('On Hold', 'On Hold')], default='Not Started', max_length=20)),
                ('progress', models.PositiveIntegerField(default=0)),
                ('dueDate', models.DateField(blank=True, null=True)),
                ('createdBy', models.CharField(blank=True, max_length=150)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('updatedAt', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=django.db.models.deletion.CASCADE, related_name='goals', to='feedback.employee')),
            ],
            options={
                'db_table': 'EmployeeGoal',
                'ordering': ['dueDate', '-createdAt'],
            },
        ),
    ]
