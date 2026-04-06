from django.db import migrations, models
import django.db.models.deletion
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0008_employee_goal'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkTask',
            fields=[
                ('taskID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=160)),
                ('description', models.TextField(blank=True)),
                ('priority', models.CharField(choices=[('Low', 'Low'), ('Medium', 'Medium'), ('High', 'High')], default='Medium', max_length=20)),
                ('status', models.CharField(choices=[('To Do', 'To Do'), ('In Progress', 'In Progress'), ('Done', 'Done'), ('Blocked', 'Blocked')], default='To Do', max_length=20)),
                ('progress', models.PositiveIntegerField(default=0)),
                ('estimatedHours', models.PositiveIntegerField(blank=True, null=True)),
                ('dueDate', models.DateField(blank=True, null=True)),
                ('assignedBy', models.CharField(blank=True, max_length=150)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('updatedAt', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='feedback.employee')),
            ],
            options={
                'db_table': 'WorkTask',
                'ordering': ['dueDate', '-createdAt'],
            },
        ),
    ]
