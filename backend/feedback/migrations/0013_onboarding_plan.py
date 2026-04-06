from django.db import migrations, models
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0012_succession_plan'),
    ]

    operations = [
        migrations.CreateModel(
            name='OnboardingPlan',
            fields=[
                ('planID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('planType', models.CharField(choices=[('Onboarding', 'Onboarding'), ('Offboarding', 'Offboarding'), ('Transition', 'Transition')], default='Onboarding', max_length=20)),
                ('title', models.CharField(max_length=160)),
                ('status', models.CharField(choices=[('Not Started', 'Not Started'), ('In Progress', 'In Progress'), ('Completed', 'Completed'), ('Blocked', 'Blocked')], default='Not Started', max_length=20)),
                ('progress', models.PositiveIntegerField(default=0)),
                ('startDate', models.DateField(blank=True, null=True)),
                ('targetDate', models.DateField(blank=True, null=True)),
                ('checklistItems', models.JSONField(blank=True, default=list)),
                ('notes', models.TextField(blank=True)),
                ('employeeNote', models.TextField(blank=True)),
                ('createdBy', models.CharField(blank=True, max_length=150)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('updatedAt', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=models.CASCADE, related_name='onboarding_plans', to='feedback.employee')),
            ],
            options={
                'db_table': 'OnboardingPlan',
                'ordering': ['targetDate', '-createdAt'],
            },
        ),
    ]
