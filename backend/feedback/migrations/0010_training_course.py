from django.db import migrations, models
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0009_work_task'),
    ]

    operations = [
        migrations.CreateModel(
            name='TrainingCourse',
            fields=[
                ('courseID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=160)),
                ('description', models.TextField(blank=True)),
                ('category', models.CharField(choices=[('Technical', 'Technical'), ('Compliance', 'Compliance'), ('Leadership', 'Leadership'), ('Soft Skills', 'Soft Skills')], default='Technical', max_length=30)),
                ('durationHours', models.PositiveIntegerField(default=1)),
                ('assignedEmployeeIDs', models.JSONField(blank=True, default=list)),
                ('completionData', models.JSONField(blank=True, default=dict)),
                ('dueDate', models.DateField(blank=True, null=True)),
                ('createdBy', models.CharField(blank=True, max_length=150)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'TrainingCourse',
                'ordering': ['dueDate', '-createdAt'],
            },
        ),
    ]
