from django.db import migrations, models
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0010_training_course'),
    ]

    operations = [
        migrations.CreateModel(
            name='PerformanceReview',
            fields=[
                ('reviewID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('reviewPeriod', models.CharField(max_length=50)),
                ('reviewType', models.CharField(choices=[('Quarterly', 'Quarterly'), ('Annual', 'Annual'), ('Probation', 'Probation'), ('Spot', 'Spot')], default='Quarterly', max_length=20)),
                ('overallRating', models.PositiveIntegerField(default=3)),
                ('status', models.CharField(choices=[('Draft', 'Draft'), ('Submitted', 'Submitted'), ('Acknowledged', 'Acknowledged')], default='Draft', max_length=20)),
                ('strengths', models.TextField(blank=True)),
                ('improvementAreas', models.TextField(blank=True)),
                ('goalsSummary', models.TextField(blank=True)),
                ('employeeNote', models.TextField(blank=True)),
                ('reviewDate', models.DateField(blank=True, null=True)),
                ('acknowledgedAt', models.DateTimeField(blank=True, null=True)),
                ('createdBy', models.CharField(blank=True, max_length=150)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('updatedAt', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=models.CASCADE, related_name='performance_reviews', to='feedback.employee')),
            ],
            options={
                'db_table': 'PerformanceReview',
                'ordering': ['-reviewDate', '-createdAt'],
            },
        ),
    ]
