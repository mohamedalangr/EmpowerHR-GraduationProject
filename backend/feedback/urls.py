from django.urls import path
from .views import (
    # HR Manager
    HRFormListCreateView,
    HRFormDetailView,
    HRFormActivateView,
    HRQuestionListCreateView,
    HRQuestionDetailView,
    HRSubmissionInsightsView,
    HRFormResponseSnapshotView,
    HRApprovalSnapshotView,
    HRSubmissionsView,
    HRWorkforceInsightsView,
     HRPeopleIntelligenceView,
    HREmployeeListCreateView,
    HREmployeeDetailView,
    HREmployeeHistoryView,
    HRRosterHealthView,
    HREmployeeSnapshotView,
    HREmployeeRoleChangeView,
    EmployeeAttendanceListView,
    EmployeeAttendanceClockView,
    EmployeeLeaveRequestListCreateView,
    HRAttendanceWatchView,
    HRAttendanceListView,
    HRLeaveRequestListView,
    HRLeaveReviewView,
    HRPayrollWatchView,
    HRPayrollListCreateView,
    HRPayrollMarkPaidView,
    EmployeePayrollListView,
    EmployeeGoalListView,
    EmployeeGoalProgressView,
    TeamGoalListCreateView,
    TeamGoalDetailView,
    EmployeeTaskListView,
    EmployeeTaskProgressView,
    TeamTaskListCreateView,
    TeamTaskDetailView,
     HRActionPlanListCreateView,
     HRActionPlanStatusView,
    EmployeeRecognitionListView,
    TeamRecognitionListCreateView,
    HRRecognitionWatchView,
    EmployeeBenefitListView,
    EmployeeBenefitStatusView,
    HRBenefitWatchView,
    HRBenefitListCreateView,
    EmployeeExpenseListCreateView,
    HRExpenseWatchView,
    HRExpenseListView,
    HRExpenseReviewView,
    EmployeeDocumentListCreateView,
    HRDocumentListView,
    HRDocumentWatchView,
    HRDocumentIssueView,
    EmployeeTicketListCreateView,
    HRTicketListView,
    HRTicketWatchView,
    HRTicketStatusView,
    EmployeeTrainingListView,
    EmployeeTrainingProgressView,
    HRTrainingComplianceView,
    HRTrainingListCreateView,
    EmployeeReviewListView,
    EmployeeReviewAcknowledgeView,
    HRReviewCalibrationView,
    HRReviewListCreateView,
    EmployeeCareerPlanListView,
    EmployeeCareerPlanAcknowledgeView,
    HRSuccessionWatchView,
    HRSuccessionPlanListCreateView,
    EmployeeOnboardingListView,
    EmployeeOnboardingProgressView,
    HROnboardingWatchView,
    HROnboardingPlanListCreateView,
    EmployeeShiftListView,
    EmployeeShiftAcknowledgeView,
    HRShiftWatchView,
    HRShiftScheduleListCreateView,
     EmployeePolicyListView,
     EmployeePolicyAcknowledgeView,
     HRPolicyComplianceView,
     HRPolicyReminderView,
     HRPolicyListCreateView,
    # Employee
    FeedbackFormListView,
    FeedbackFormDetailView,
    FeedbackSubmitView,
)

urlpatterns = [

    # ── HR Manager endpoints ──────────────────────────────────────────────
    # GET  /api/feedback/hr/forms/                  list all forms
    # POST /api/feedback/hr/forms/                  create form
    path('hr/forms/', HRFormListCreateView.as_view(), name='hr-form-list-create'),

    # GET /api/feedback/hr/forms/response-snapshot/  response health and follow-up visibility
    path('hr/forms/response-snapshot/', HRFormResponseSnapshotView.as_view(), name='hr-form-response-snapshot'),

    # GET    /api/feedback/hr/forms/<id>/           get form detail
    # PUT    /api/feedback/hr/forms/<id>/           update form
    # DELETE /api/feedback/hr/forms/<id>/           delete form
    path('hr/forms/<str:form_id>/', HRFormDetailView.as_view(), name='hr-form-detail'),

    # POST /api/feedback/hr/forms/<id>/activate/    activate form
    # POST /api/feedback/hr/forms/<id>/deactivate/  deactivate form
    path('hr/forms/<str:form_id>/<str:action>/',
         HRFormActivateView.as_view(), name='hr-form-activate'),

    # GET  /api/feedback/hr/forms/<id>/questions/   list questions
    # POST /api/feedback/hr/forms/<id>/questions/   add question
    path('hr/forms/<str:form_id>/questions/',
         HRQuestionListCreateView.as_view(), name='hr-question-list-create'),

    # PUT    /api/feedback/hr/questions/<id>/        update question
    # DELETE /api/feedback/hr/questions/<id>/        delete question
    path('hr/questions/<str:question_id>/',
         HRQuestionDetailView.as_view(), name='hr-question-detail'),

    # GET /api/feedback/hr/approvals/snapshot/     queue SLA and escalation watch
    path('hr/approvals/snapshot/', HRApprovalSnapshotView.as_view(), name='hr-approval-snapshot'),

    # GET /api/feedback/hr/submissions/insights/   question-level response insights and follow-up priorities
    path('hr/submissions/insights/', HRSubmissionInsightsView.as_view(), name='hr-submission-insights'),

    # GET /api/feedback/hr/submissions/             all submissions
    # GET /api/feedback/hr/submissions/?form_id=    filter by form
    path('hr/submissions/', HRSubmissionsView.as_view(), name='hr-submissions'),

    # GET /api/feedback/hr/insights/                workforce analytics snapshot
    path('hr/insights/', HRWorkforceInsightsView.as_view(), name='hr-workforce-insights'),

     # GET /api/feedback/hr/intelligence/            executive people-intelligence board
     path('hr/intelligence/', HRPeopleIntelligenceView.as_view(), name='hr-people-intelligence'),

    # GET    /api/feedback/hr/employees/            list/search/filter employee records
    # POST   /api/feedback/hr/employees/            create employee record
    path('hr/employees/', HREmployeeListCreateView.as_view(), name='hr-employee-list-create'),

    # GET  /api/feedback/hr/employees/roster-health/     directory health and workforce follow-up watch
    path('hr/employees/roster-health/', HRRosterHealthView.as_view(), name='hr-roster-health'),

    # GET    /api/feedback/hr/employees/<id>/       retrieve employee record
    # PUT    /api/feedback/hr/employees/<id>/       update employee record
    # DELETE /api/feedback/hr/employees/<id>/       soft-delete employee record
    path('hr/employees/<str:employee_id>/', HREmployeeDetailView.as_view(), name='hr-employee-detail'),

    # GET  /api/feedback/hr/employees/<id>/history/      employee job history log
    path('hr/employees/<str:employee_id>/history/', HREmployeeHistoryView.as_view(), name='hr-employee-history'),

    # GET  /api/feedback/hr/employees/<id>/snapshot/     employee 360 overview
    path('hr/employees/<str:employee_id>/snapshot/', HREmployeeSnapshotView.as_view(), name='hr-employee-snapshot'),

    # POST /api/feedback/hr/employees/<id>/change-role/  promotion / demotion + history log
    path('hr/employees/<str:employee_id>/change-role/', HREmployeeRoleChangeView.as_view(), name='hr-employee-change-role'),

    # GET /api/feedback/hr/attendance/watch/       attendance and leave follow-up watch
    path('hr/attendance/watch/', HRAttendanceWatchView.as_view(), name='hr-attendance-watch'),

    # GET /api/feedback/hr/attendance/             attendance records overview
    path('hr/attendance/', HRAttendanceListView.as_view(), name='hr-attendance-list'),

    # GET /api/feedback/hr/leave-requests/         all leave requests
    path('hr/leave-requests/', HRLeaveRequestListView.as_view(), name='hr-leave-request-list'),

    # POST /api/feedback/hr/leave-requests/<id>/review/    approve / reject leave
    path('hr/leave-requests/<str:leave_request_id>/review/', HRLeaveReviewView.as_view(), name='hr-leave-review'),

    # GET  /api/feedback/hr/payroll/watch/          payroll processing follow-up watch
    path('hr/payroll/watch/', HRPayrollWatchView.as_view(), name='hr-payroll-watch'),

    # GET  /api/feedback/hr/payroll/                payroll overview
    # POST /api/feedback/hr/payroll/                create payroll record
    path('hr/payroll/', HRPayrollListCreateView.as_view(), name='hr-payroll-list-create'),

    # POST /api/feedback/hr/payroll/<id>/mark-paid/ mark payroll as paid
    path('hr/payroll/<str:payroll_id>/mark-paid/', HRPayrollMarkPaidView.as_view(), name='hr-payroll-mark-paid'),

    # GET /api/feedback/hr/recognition/watch/     recognition pulse and engagement follow-up watch
    path('hr/recognition/watch/', HRRecognitionWatchView.as_view(), name='hr-recognition-watch'),

    # ── Employee endpoints ────────────────────────────────────────────────
    # GET /api/feedback/forms/                      active form list
    path('forms/', FeedbackFormListView.as_view(), name='feedback-form-list'),

    # GET /api/feedback/forms/<id>/                 form detail + submission
    path('forms/<str:form_id>/', FeedbackFormDetailView.as_view(), name='feedback-form-detail'),

    # POST /api/feedback/forms/<id>/submit/         submit answers
    path('forms/<str:form_id>/submit/', FeedbackSubmitView.as_view(), name='feedback-submit'),

    # GET /api/feedback/employee/attendance/       own attendance history
    path('employee/attendance/', EmployeeAttendanceListView.as_view(), name='employee-attendance-list'),

    # POST /api/feedback/employee/attendance/clock/  clock in / out
    path('employee/attendance/clock/', EmployeeAttendanceClockView.as_view(), name='employee-attendance-clock'),

    # GET /api/feedback/employee/leave-requests/   own leave requests
    # POST /api/feedback/employee/leave-requests/  submit leave request
    path('employee/leave-requests/', EmployeeLeaveRequestListCreateView.as_view(), name='employee-leave-request-list-create'),

    # GET /api/feedback/employee/payroll/          own payroll records
    path('employee/payroll/', EmployeePayrollListView.as_view(), name='employee-payroll-list'),

    # GET /api/feedback/employee/reviews/          own performance reviews
    path('employee/reviews/', EmployeeReviewListView.as_view(), name='employee-review-list'),

    # POST /api/feedback/employee/reviews/<id>/acknowledge/ acknowledge own review
    path('employee/reviews/<str:review_id>/acknowledge/', EmployeeReviewAcknowledgeView.as_view(), name='employee-review-acknowledge'),

    # GET /api/feedback/employee/career-path/      own succession / career path plans
    path('employee/career-path/', EmployeeCareerPlanListView.as_view(), name='employee-career-plan-list'),

    # POST /api/feedback/employee/career-path/<id>/acknowledge/ acknowledge own career path
    path('employee/career-path/<str:plan_id>/acknowledge/', EmployeeCareerPlanAcknowledgeView.as_view(), name='employee-career-plan-acknowledge'),

    # GET /api/feedback/employee/onboarding/       own onboarding / transition plans
    path('employee/onboarding/', EmployeeOnboardingListView.as_view(), name='employee-onboarding-list'),

    # POST /api/feedback/employee/onboarding/<id>/progress/ update own onboarding progress
    path('employee/onboarding/<str:plan_id>/progress/', EmployeeOnboardingProgressView.as_view(), name='employee-onboarding-progress'),

    # GET /api/feedback/employee/shifts/           own assigned shifts
    path('employee/shifts/', EmployeeShiftListView.as_view(), name='employee-shift-list'),

    # POST /api/feedback/employee/shifts/<id>/acknowledge/ confirm or complete a shift
    path('employee/shifts/<str:schedule_id>/acknowledge/', EmployeeShiftAcknowledgeView.as_view(), name='employee-shift-acknowledge'),

     # GET /api/feedback/employee/policies/        published policy and announcement feed
     path('employee/policies/', EmployeePolicyListView.as_view(), name='employee-policy-list'),

    # GET /api/feedback/hr/policies/compliance/    compliance snapshot for policy acknowledgements
    path('hr/policies/compliance/', HRPolicyComplianceView.as_view(), name='hr-policy-compliance'),

    # POST /api/feedback/hr/policies/<id>/remind/  log a follow-up reminder for outstanding acknowledgements
    path('hr/policies/<str:policy_id>/remind/', HRPolicyReminderView.as_view(), name='hr-policy-remind'),

     # POST /api/feedback/employee/policies/<id>/acknowledge/ acknowledge policy announcement
     path('employee/policies/<str:policy_id>/acknowledge/', EmployeePolicyAcknowledgeView.as_view(), name='employee-policy-acknowledge'),

    # GET /api/feedback/employee/goals/            own goals
    path('employee/goals/', EmployeeGoalListView.as_view(), name='employee-goal-list'),

    # POST /api/feedback/employee/goals/<id>/progress/ update own goal progress
    path('employee/goals/<str:goal_id>/progress/', EmployeeGoalProgressView.as_view(), name='employee-goal-progress'),

    # GET  /api/feedback/team/goals/               team goal list
    # POST /api/feedback/team/goals/               create goal for team member
    path('team/goals/', TeamGoalListCreateView.as_view(), name='team-goal-list-create'),

    # PUT /api/feedback/team/goals/<id>/           update a team goal
    path('team/goals/<str:goal_id>/', TeamGoalDetailView.as_view(), name='team-goal-detail'),

    # GET /api/feedback/employee/tasks/            own tasks
    path('employee/tasks/', EmployeeTaskListView.as_view(), name='employee-task-list'),

    # POST /api/feedback/employee/tasks/<id>/progress/ update own task progress
    path('employee/tasks/<str:task_id>/progress/', EmployeeTaskProgressView.as_view(), name='employee-task-progress'),

    # GET /api/feedback/employee/recognition/      own recognition awards
    path('employee/recognition/', EmployeeRecognitionListView.as_view(), name='employee-recognition-list'),

    # GET  /api/feedback/team/recognition/         team recognition overview
    # POST /api/feedback/team/recognition/         create recognition award for team member
    path('team/recognition/', TeamRecognitionListCreateView.as_view(), name='team-recognition-list-create'),

    # GET /api/feedback/employee/benefits/         own benefit enrollments
    path('employee/benefits/', EmployeeBenefitListView.as_view(), name='employee-benefit-list'),

    # POST /api/feedback/employee/benefits/<id>/status/ update own benefit decision
    path('employee/benefits/<str:enrollment_id>/status/', EmployeeBenefitStatusView.as_view(), name='employee-benefit-status'),

    # GET  /api/feedback/employee/expenses/        own expense claims
    # POST /api/feedback/employee/expenses/        submit expense claim
    path('employee/expenses/', EmployeeExpenseListCreateView.as_view(), name='employee-expense-list-create'),

    # GET  /api/feedback/employee/documents/       own document requests
    # POST /api/feedback/employee/documents/       submit document request
    path('employee/documents/', EmployeeDocumentListCreateView.as_view(), name='employee-document-list-create'),

    # GET  /api/feedback/employee/tickets/         own support tickets
    # POST /api/feedback/employee/tickets/         create support ticket
    path('employee/tickets/', EmployeeTicketListCreateView.as_view(), name='employee-ticket-list-create'),

    # GET /api/feedback/employee/training/         own training list
    path('employee/training/', EmployeeTrainingListView.as_view(), name='employee-training-list'),

    # POST /api/feedback/employee/training/<id>/progress/ update own training progress
    path('employee/training/<str:course_id>/progress/', EmployeeTrainingProgressView.as_view(), name='employee-training-progress'),

    # GET  /api/feedback/team/tasks/               team task list
    # POST /api/feedback/team/tasks/               create task for team member
    path('team/tasks/', TeamTaskListCreateView.as_view(), name='team-task-list-create'),

    # PUT /api/feedback/team/tasks/<id>/           update a team task
    path('team/tasks/<str:task_id>/', TeamTaskDetailView.as_view(), name='team-task-detail'),

     # GET  /api/feedback/hr/action-plans/          list HR action plans
     # POST /api/feedback/hr/action-plans/          create HR action plan
     path('hr/action-plans/', HRActionPlanListCreateView.as_view(), name='hr-action-plan-list-create'),

     # POST /api/feedback/hr/action-plans/<id>/status/ update action plan status/progress
     path('hr/action-plans/<str:task_id>/status/', HRActionPlanStatusView.as_view(), name='hr-action-plan-status'),
    # GET  /api/feedback/hr/benefits/watch/       benefits enrollment follow-up watch
    path('hr/benefits/watch/', HRBenefitWatchView.as_view(), name='hr-benefit-watch'),
    # GET  /api/feedback/hr/benefits/              benefits enrollment overview
    # POST /api/feedback/hr/benefits/              create employee benefit enrollment
    path('hr/benefits/', HRBenefitListCreateView.as_view(), name='hr-benefit-list-create'),
    # GET  /api/feedback/hr/expenses/watch/       reimbursement follow-up watch
    path('hr/expenses/watch/', HRExpenseWatchView.as_view(), name='hr-expense-watch'),
    # GET /api/feedback/hr/expenses/               expense claims overview
    path('hr/expenses/', HRExpenseListView.as_view(), name='hr-expense-list'),

    # POST /api/feedback/hr/expenses/<id>/review/  approve or reject expense claim
    path('hr/expenses/<str:claim_id>/review/', HRExpenseReviewView.as_view(), name='hr-expense-review'),

    # GET /api/feedback/hr/documents/watch/        document issuance follow-up watch
    path('hr/documents/watch/', HRDocumentWatchView.as_view(), name='hr-document-watch'),

    # GET /api/feedback/hr/documents/              document request overview
    path('hr/documents/', HRDocumentListView.as_view(), name='hr-document-list'),

    # POST /api/feedback/hr/documents/<id>/issue/  issue or decline document request
    path('hr/documents/<str:request_id>/issue/', HRDocumentIssueView.as_view(), name='hr-document-issue'),

    # GET /api/feedback/hr/tickets/watch/          support queue follow-up watch
    path('hr/tickets/watch/', HRTicketWatchView.as_view(), name='hr-ticket-watch'),

    # GET /api/feedback/hr/tickets/                support ticket overview
    path('hr/tickets/', HRTicketListView.as_view(), name='hr-ticket-list'),

    # POST /api/feedback/hr/tickets/<id>/status/   update support ticket status
    path('hr/tickets/<str:ticket_id>/status/', HRTicketStatusView.as_view(), name='hr-ticket-status'),

    # GET /api/feedback/hr/training/compliance/    due-state watch for mandatory learning and overdue completions
    path('hr/training/compliance/', HRTrainingComplianceView.as_view(), name='hr-training-compliance'),

    # GET  /api/feedback/hr/training/              training overview
    # POST /api/feedback/hr/training/              create training course
    path('hr/training/', HRTrainingListCreateView.as_view(), name='hr-training-list-create'),

    # GET  /api/feedback/hr/reviews/calibration/   review calibration and follow-up snapshot
    path('hr/reviews/calibration/', HRReviewCalibrationView.as_view(), name='hr-review-calibration'),

    # GET  /api/feedback/hr/reviews/               performance review overview
    # POST /api/feedback/hr/reviews/               create performance review
    path('hr/reviews/', HRReviewListCreateView.as_view(), name='hr-review-list-create'),
    # GET  /api/feedback/hr/succession/watch/      succession readiness follow-up watch
    path('hr/succession/watch/', HRSuccessionWatchView.as_view(), name='hr-succession-watch'),
    # GET  /api/feedback/hr/succession/            succession planning overview
    # POST /api/feedback/hr/succession/            create succession plan
    path('hr/succession/', HRSuccessionPlanListCreateView.as_view(), name='hr-succession-list-create'),

    # GET  /api/feedback/hr/onboarding/watch/      onboarding risk / transition watch
    path('hr/onboarding/watch/', HROnboardingWatchView.as_view(), name='hr-onboarding-watch'),

    # GET  /api/feedback/hr/onboarding/            onboarding / transition overview
    # POST /api/feedback/hr/onboarding/            create onboarding / transition plan
    path('hr/onboarding/', HROnboardingPlanListCreateView.as_view(), name='hr-onboarding-list-create'),

    # GET  /api/feedback/hr/shifts/watch/          shift coverage follow-up watch
    path('hr/shifts/watch/', HRShiftWatchView.as_view(), name='hr-shift-watch'),

    # GET  /api/feedback/hr/shifts/                shift schedule overview
    # POST /api/feedback/hr/shifts/                create shift schedule
    path('hr/shifts/', HRShiftScheduleListCreateView.as_view(), name='hr-shift-list-create'),

     # GET  /api/feedback/hr/policies/              policy and announcement overview
     # POST /api/feedback/hr/policies/              create policy or announcement
     path('hr/policies/', HRPolicyListCreateView.as_view(), name='hr-policy-list-create'),
]
