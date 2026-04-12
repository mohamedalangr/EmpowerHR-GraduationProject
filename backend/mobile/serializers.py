from rest_framework import serializers

class NotificationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    message = serializers.CharField()
    created_at = serializers.DateTimeField()

class DashboardSerializer(serializers.Serializer):
    total_employees = serializers.IntegerField()
    active_jobs = serializers.IntegerField()
    attendance_rate = serializers.FloatField()
    attrition_risk = serializers.FloatField()

class EmployeeListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    department = serializers.CharField()
    role = serializers.CharField()

class TaskSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField()
    due_date = serializers.DateField()
    status = serializers.CharField()

class TicketSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    subject = serializers.CharField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()

class LeaveRequestSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    status = serializers.CharField()
    reason = serializers.CharField()

class AttendanceClockInSerializer(serializers.Serializer):
    timestamp = serializers.DateTimeField()
    status = serializers.CharField()

class ApprovalActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=[('approve', 'Approve'), ('reject', 'Reject')])
    comment = serializers.CharField(required=False)
