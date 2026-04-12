from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import *

# Dummy data for demonstration. Replace with real queries.

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        data = [
            {"id": 1, "title": "Welcome", "message": "Welcome to EmpowerHR!", "created_at": "2026-04-12T10:00:00Z"},
        ]
        return Response(NotificationSerializer(data, many=True).data)

class MobileDashboardView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        data = {
            "total_employees": 100,
            "active_jobs": 5,
            "attendance_rate": 0.97,
            "attrition_risk": 0.12,
        }
        return Response(DashboardSerializer(data).data)

class HRDashboardView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        data = {
            "company_health": "Good",
            "attendance_rate": 0.97,
            "attrition_risk": 0.12,
        }
        return Response(data)

class HRAttendanceAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        data = {"attendance_rate": 0.97, "date": "2026-04-12"}
        return Response(data)

class HREmployeeListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        data = [
            {"id": 1, "full_name": "John Doe", "department": "IT", "role": "Employee"},
        ]
        return Response(EmployeeListSerializer(data, many=True).data)

class AttendanceClockInView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        # Save attendance record here
        data = {"timestamp": "2026-04-12T08:00:00Z", "status": "Clocked In"}
        return Response(AttendanceClockInSerializer(data).data)

class LeaveRequestView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        # Save leave request here
        data = {"id": 1, "start_date": "2026-04-15", "end_date": "2026-04-17", "status": "Pending", "reason": "Vacation"}
        return Response(LeaveRequestSerializer(data).data)

class TicketView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        # Save ticket here
        data = {"id": 1, "subject": "Help needed", "status": "Open", "created_at": "2026-04-12T09:00:00Z"}
        return Response(TicketSerializer(data).data)

class TaskListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        data = [
            {"id": 1, "title": "Complete Report", "description": "Finish the Q1 report", "due_date": "2026-04-20", "status": "Pending"},
        ]
        return Response(TaskSerializer(data, many=True).data)

class ManagerLeaveActionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, id):
        # Approve/reject leave
        action = request.data.get("action")
        comment = request.data.get("comment", "")
        return Response({"id": id, "action": action, "comment": comment, "result": "success"})

class ManagerAttendanceCorrectionActionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, id):
        # Approve/reject correction
        action = request.data.get("action")
        comment = request.data.get("comment", "")
        return Response({"id": id, "action": action, "comment": comment, "result": "success"})
