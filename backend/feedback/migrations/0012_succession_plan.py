from django.db import migrations, models
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0011_performance_review'),
    ]

    operations = [
        migrations.CreateModel(
            name='SuccessionPlan',
            fields=[
                ('planID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('targetRole', models.CharField(max_length=120)),
                ('readiness', models.CharField(choices=[('Ready Now', 'Ready Now'), ('6-12 Months', '6-12 Months'), ('1-2 Years', '1-2 Years'), ('Long Term', 'Long Term')], default='1-2 Years', max_length=20)),
                ('status', models.CharField(choices=[('Active', 'Active'), ('On Track', 'On Track'), ('Acknowledged', 'Acknowledged'), ('Completed', 'Completed'), ('On Hold', 'On Hold')], default='Active', max_length=20)),
                ('retentionRisk', models.CharField(choices=[('Low', 'Low'), ('Medium', 'Medium'), ('High', 'High')], default='Low', max_length=10)),
                ('developmentActions', models.TextField(blank=True)),
                ('notes', models.TextField(blank=True)),
                ('employeeNote', models.TextField(blank=True)),
                ('acknowledgedAt', models.DateTimeField(blank=True, null=True)),
                ('createdBy', models.CharField(blank=True, max_length=150)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('updatedAt', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=models.CASCADE, related_name='succession_plans', to='feedback.employee')),
            ],
            options={
                'db_table': 'SuccessionPlan',
                'ordering': ['-updatedAt', '-createdAt'],
            },
        ),
    ]
