from django.db import migrations, models
import django.db.models.deletion
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0005_employee_job_history'),
    ]

    operations = [
        migrations.CreateModel(
            name='AttendanceRecord',
            fields=[
                ('attendanceID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('date', models.DateField()),
                ('clockIn', models.DateTimeField(blank=True, null=True)),
                ('clockOut', models.DateTimeField(blank=True, null=True)),
                ('workedHours', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('status', models.CharField(choices=[('Clocked In', 'Clocked In'), ('Present', 'Present'), ('Partial', 'Partial')], default='Clocked In', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=django.db.models.deletion.CASCADE, related_name='attendance_records', to='feedback.employee')),
            ],
            options={
                'db_table': 'AttendanceRecord',
                'ordering': ['-date', '-clockIn'],
                'unique_together': {('employee', 'date')},
            },
        ),
        migrations.CreateModel(
            name='LeaveRequest',
            fields=[
                ('leaveRequestID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('leaveType', models.CharField(choices=[('Annual', 'Annual'), ('Sick', 'Sick'), ('Unpaid', 'Unpaid'), ('Casual', 'Casual')], max_length=20)),
                ('startDate', models.DateField()),
                ('endDate', models.DateField()),
                ('daysRequested', models.IntegerField(default=1)),
                ('reason', models.TextField()),
                ('status', models.CharField(choices=[('Pending', 'Pending'), ('Approved', 'Approved'), ('Rejected', 'Rejected')], default='Pending', max_length=20)),
                ('eligibilityMessage', models.CharField(blank=True, max_length=255)),
                ('reviewNotes', models.TextField(blank=True)),
                ('reviewedBy', models.CharField(blank=True, max_length=150)),
                ('reviewedAt', models.DateTimeField(blank=True, null=True)),
                ('requestedAt', models.DateTimeField(auto_now_add=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=django.db.models.deletion.CASCADE, related_name='leave_requests', to='feedback.employee')),
            ],
            options={
                'db_table': 'LeaveRequest',
                'ordering': ['-requestedAt'],
            },
        ),
    ]
