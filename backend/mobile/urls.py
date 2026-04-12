from django.urls import path
from . import views

urlpatterns = [
    path('notifications/', views.NotificationListView.as_view()),
    path('dashboard/', views.MobileDashboardView.as_view()),
    path('hr/dashboard/', views.HRDashboardView.as_view()),
    path('hr/attendance-analytics/', views.HRAttendanceAnalyticsView.as_view()),
    path('hr/employees/', views.HREmployeeListView.as_view()),
    path('attendance/clock-in/', views.AttendanceClockInView.as_view()),
    path('leave-requests/', views.LeaveRequestView.as_view()),
    path('tickets/', views.TicketView.as_view()),
    path('tasks/', views.TaskListView.as_view()),
    path('manager/leave-requests/<int:id>/action/', views.ManagerLeaveActionView.as_view()),
    path('manager/attendance-corrections/<int:id>/action/', views.ManagerAttendanceCorrectionActionView.as_view()),
]
