from django.db import migrations, models
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0013_onboarding_plan'),
    ]

    operations = [
        migrations.CreateModel(
            name='ShiftSchedule',
            fields=[
                ('scheduleID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('shiftDate', models.DateField()),
                ('shiftType', models.CharField(choices=[('Morning', 'Morning'), ('Evening', 'Evening'), ('Night', 'Night'), ('Remote', 'Remote'), ('Flexible', 'Flexible')], default='Morning', max_length=20)),
                ('startTime', models.TimeField()),
                ('endTime', models.TimeField()),
                ('location', models.CharField(blank=True, max_length=120)),
                ('status', models.CharField(choices=[('Planned', 'Planned'), ('Confirmed', 'Confirmed'), ('Completed', 'Completed'), ('Swapped', 'Swapped')], default='Planned', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('employeeNote', models.TextField(blank=True)),
                ('acknowledgedAt', models.DateTimeField(blank=True, null=True)),
                ('createdBy', models.CharField(blank=True, max_length=150)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('updatedAt', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=models.CASCADE, related_name='shift_schedules', to='feedback.employee')),
            ],
            options={
                'db_table': 'ShiftSchedule',
                'ordering': ['shiftDate', 'startTime', '-createdAt'],
                'unique_together': {('employee', 'shiftDate', 'startTime')},
            },
        ),
    ]
