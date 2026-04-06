from django.db import migrations, models
import django.db.models.deletion
import feedback.models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0006_attendance_leave'),
    ]

    operations = [
        migrations.CreateModel(
            name='PayrollRecord',
            fields=[
                ('payrollID', models.CharField(default=feedback.models.gen_id, max_length=50, primary_key=True, serialize=False)),
                ('payPeriod', models.CharField(max_length=20)),
                ('baseSalary', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('allowances', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('deductions', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('bonus', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('netPay', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('status', models.CharField(choices=[('Draft', 'Draft'), ('Paid', 'Paid')], default='Draft', max_length=20)),
                ('paymentDate', models.DateField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('employee', models.ForeignKey(db_column='employeeID', on_delete=django.db.models.deletion.CASCADE, related_name='payroll_records', to='feedback.employee')),
            ],
            options={
                'db_table': 'PayrollRecord',
                'ordering': ['-payPeriod', '-createdAt'],
                'unique_together': {('employee', 'payPeriod')},
            },
        ),
    ]
