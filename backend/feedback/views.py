from decimal import Decimal
from django.db.models import Avg, Count, Q
from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsHRManager, IsInternalEmployee, IsTeamLeader
from .models import (FeedbackForm, FeedbackQuestion,
                     FeedbackSubmission, FeedbackAnswer, Employee, EmployeeJobHistory,
                     AttendanceRecord, LeaveRequest, PayrollRecord, EmployeeGoal, WorkTask, TrainingCourse,
                     PerformanceReview, SuccessionPlan, OnboardingPlan, ShiftSchedule, PolicyAnnouncement,
                     RecognitionAward, BenefitEnrollment, ExpenseClaim, DocumentRequest, SupportTicket)
from .serializers import (
    EmployeeSerializer,
    EmployeeCreateUpdateSerializer,
    EmployeeJobHistorySerializer,
    EmployeeRoleChangeSerializer,
    AttendanceRecordSerializer,
    AttendanceClockSerializer,
    LeaveRequestSerializer,
    LeaveRequestCreateSerializer,
    LeaveReviewSerializer,
    PayrollRecordSerializer,
    PayrollRecordCreateSerializer,
    PayrollMarkPaidSerializer,
    EmployeeGoalSerializer,
    EmployeeGoalCreateSerializer,
    EmployeeGoalProgressSerializer,
    WorkTaskSerializer,
    WorkTaskCreateSerializer,
    WorkTaskProgressSerializer,
    TrainingCourseSerializer,
    TrainingCourseCreateSerializer,
    TrainingProgressSerializer,
    PerformanceReviewSerializer,
    PerformanceReviewCreateSerializer,
    PerformanceReviewAcknowledgeSerializer,
    SuccessionPlanSerializer,
    SuccessionPlanCreateSerializer,
    SuccessionPlanAcknowledgeSerializer,
    OnboardingPlanSerializer,
    OnboardingPlanCreateSerializer,
    OnboardingPlanProgressSerializer,
    ShiftScheduleSerializer,
    ShiftScheduleCreateSerializer,
    ShiftScheduleAcknowledgeSerializer,
    PolicyAnnouncementSerializer,
    PolicyAnnouncementCreateSerializer,
    PolicyAnnouncementAcknowledgeSerializer,
    PolicyAnnouncementReminderSerializer,
    RecognitionAwardSerializer,
    RecognitionAwardCreateSerializer,
    BenefitEnrollmentSerializer,
    BenefitEnrollmentCreateSerializer,
    BenefitEnrollmentStatusSerializer,
    ExpenseClaimSerializer,
    ExpenseClaimCreateSerializer,
    ExpenseClaimReviewSerializer,
    DocumentRequestSerializer,
    DocumentRequestCreateSerializer,
    DocumentRequestIssueSerializer,
    SupportTicketSerializer,
    SupportTicketCreateSerializer,
    SupportTicketStatusSerializer,
    FeedbackFormListSerializer,
    FeedbackFormDetailSerializer,
    FeedbackFormCreateUpdateSerializer,
    FeedbackQuestionCreateSerializer,
    FeedbackSubmissionSerializer,
    SubmitFeedbackSerializer,
)


# ---------------------------------------------------------------------------
# HR Manager -- Form Management
# ---------------------------------------------------------------------------

class HRFormListCreateView(APIView):
    """
    GET  /api/feedback/hr/forms/        list ALL forms (active and inactive)
    POST /api/feedback/hr/forms/        create a new form
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        forms = FeedbackForm.objects.prefetch_related(
            'questions', 'submissions').order_by('-createdAt')
        return Response(FeedbackFormListSerializer(forms, many=True).data)

    def post(self, request):
        serializer = FeedbackFormCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        form = serializer.save()
        return Response(
            FeedbackFormDetailSerializer(form).data,
            status=status.HTTP_201_CREATED
        )


class HRFormDetailView(APIView):
    """
    GET    /api/feedback/hr/forms/<form_id>/   get form with questions
    PUT    /api/feedback/hr/forms/<form_id>/   update form title/description
    DELETE /api/feedback/hr/forms/<form_id>/   delete form
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get_form(self, form_id):
        try:
            return FeedbackForm.objects.prefetch_related('questions').get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return None

    def get(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(FeedbackFormDetailSerializer(form).data)

    def put(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FeedbackFormCreateUpdateSerializer(form, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        form = serializer.save()
        return Response(FeedbackFormDetailSerializer(form).data)

    def delete(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        form.delete()
        return Response({'message': 'Form deleted.'}, status=status.HTTP_204_NO_CONTENT)


class HRFormActivateView(APIView):
    """
    POST /api/feedback/hr/forms/<form_id>/activate/
    Activates this form and deactivates all others.
    POST /api/feedback/hr/forms/<form_id>/deactivate/
    Deactivates this form.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, form_id, action):
        try:
            form = FeedbackForm.objects.get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'activate':
            form.isActive = True
            form.save()   # triggers save() which deactivates all others
            return Response({'message': f'Form "{form.title}" is now active.'})
        elif action == 'deactivate':
            form.isActive = False
            form.save(update_fields=['isActive'])
            return Response({'message': f'Form "{form.title}" has been deactivated.'})
        else:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# HR Manager -- Question Management
# ---------------------------------------------------------------------------

class HRQuestionListCreateView(APIView):
    """
    GET  /api/feedback/hr/forms/<form_id>/questions/    list questions
    POST /api/feedback/hr/forms/<form_id>/questions/    add a question
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get_form(self, form_id):
        try:
            return FeedbackForm.objects.get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return None

    def get(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        questions = form.questions.all()
        return Response(FeedbackQuestionCreateSerializer(questions, many=True).data)

    def post(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FeedbackQuestionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        question = serializer.save(formID=form)
        return Response(
            FeedbackQuestionCreateSerializer(question).data,
            status=status.HTTP_201_CREATED
        )


class HRQuestionDetailView(APIView):
    """
    PUT    /api/feedback/hr/questions/<question_id>/   update question
    DELETE /api/feedback/hr/questions/<question_id>/   delete question
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get_question(self, question_id):
        try:
            return FeedbackQuestion.objects.get(pk=question_id)
        except FeedbackQuestion.DoesNotExist:
            return None

    def put(self, request, question_id):
        question = self.get_question(question_id)
        if not question:
            return Response({'error': 'Question not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FeedbackQuestionCreateSerializer(
            question, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        question = serializer.save()
        return Response(FeedbackQuestionCreateSerializer(question).data)

    def delete(self, request, question_id):
        question = self.get_question(question_id)
        if not question:
            return Response({'error': 'Question not found.'}, status=status.HTTP_404_NOT_FOUND)
        question.delete()
        return Response({'message': 'Question deleted.'}, status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# HR Manager -- Approval snapshot and submissions
# ---------------------------------------------------------------------------

class HRApprovalSnapshotView(APIView):
    """
    GET /api/feedback/hr/approvals/snapshot/
    Returns queue totals plus SLA and escalation visibility for the HR approval center.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        now = timezone.now()
        today = timezone.localdate()

        pending_leaves = list(
            LeaveRequest.objects.filter(status=LeaveRequest.STATUS_PENDING).select_related('employee')
        )
        pending_expenses = list(
            ExpenseClaim.objects.filter(status__in=['Pending', 'Submitted']).select_related('employee')
        )
        pending_documents = list(
            DocumentRequest.objects.filter(status__in=['Pending', 'In Progress']).select_related('employee')
        )
        open_tickets = list(
            SupportTicket.objects.filter(status__in=['Open', 'In Progress']).select_related('employee')
        )

        def age_in_days(value):
            if not value:
                return 0
            if hasattr(value, 'hour'):
                delta = now - value
            else:
                delta = today - value
            return max(delta.days, 0)

        def classify_window(waiting_days, at_risk_after, overdue_after):
            if waiting_days >= overdue_after:
                return 'Overdue'
            if waiting_days >= at_risk_after:
                return 'At Risk'
            return 'On Track'

        def classify_leave(item):
            waiting_days = age_in_days(item.requestedAt)
            if item.startDate and item.startDate <= today:
                return waiting_days, 'Overdue'
            if item.startDate and item.startDate <= today + timedelta(days=2):
                return waiting_days, 'At Risk'
            return waiting_days, classify_window(waiting_days, at_risk_after=1, overdue_after=3)

        def classify_ticket(item):
            waiting_days = age_in_days(item.createdAt or item.updatedAt)
            overdue_after = {
                'Critical': 1,
                'High': 2,
                'Medium': 3,
                'Low': 5,
            }.get(item.priority or 'Medium', 3)
            state = classify_window(waiting_days, at_risk_after=max(1, overdue_after - 1), overdue_after=overdue_after)
            return waiting_days, state

        follow_up_items = []

        def push_item(item_type, item_id, employee_name, summary, status_label, waiting_days, sla_state, path):
            if sla_state == 'On Track':
                return
            follow_up_items.append({
                'id': f'{item_type.lower().replace(" ", "-")}-{item_id}',
                'type': item_type,
                'employeeName': employee_name,
                'summary': summary,
                'status': status_label,
                'waitingDays': waiting_days,
                'slaState': sla_state,
                'path': path,
            })

        for item in pending_leaves:
            waiting_days, sla_state = classify_leave(item)
            push_item(
                'Leave Request',
                item.leaveRequestID,
                item.employee.fullName,
                item.leaveType,
                item.status,
                waiting_days,
                sla_state,
                '/hr/attendance',
            )

        for item in pending_expenses:
            waiting_days = age_in_days(item.createdAt)
            push_item(
                'Expense Claim',
                item.claimID,
                item.employee.fullName,
                item.title,
                item.status,
                waiting_days,
                classify_window(waiting_days, at_risk_after=2, overdue_after=4),
                '/hr/expenses',
            )

        for item in pending_documents:
            waiting_days = age_in_days(item.createdAt)
            push_item(
                'Document Request',
                item.requestID,
                item.employee.fullName,
                item.documentType,
                item.status,
                waiting_days,
                classify_window(waiting_days, at_risk_after=1, overdue_after=3),
                '/hr/documents',
            )

        for item in open_tickets:
            waiting_days, sla_state = classify_ticket(item)
            push_item(
                'Support Ticket',
                item.ticketID,
                item.employee.fullName,
                item.subject,
                item.status,
                waiting_days,
                sla_state,
                '/hr/tickets',
            )

        sorted_follow_up = sorted(
            follow_up_items,
            key=lambda item: ((item['slaState'] == 'Overdue'), item['waitingDays']),
            reverse=True,
        )[:6]

        return Response({
            'totals': {
                'totalPending': len(pending_leaves) + len(pending_expenses) + len(pending_documents) + len(open_tickets),
                'leaveApprovals': len(pending_leaves),
                'expenseReviews': len(pending_expenses),
                'documentUpdates': len(pending_documents),
                'supportFollowUp': len(open_tickets),
            },
            'slaSummary': {
                'atRiskCount': sum(1 for item in sorted_follow_up if item['slaState'] == 'At Risk'),
                'overdueCount': sum(1 for item in sorted_follow_up if item['slaState'] == 'Overdue'),
                'criticalTickets': sum(1 for item in open_tickets if item.priority == 'Critical'),
                'oldestOpenDays': max((item['waitingDays'] for item in follow_up_items), default=0),
            },
            'followUpItems': sorted_follow_up,
        })


class HRSubmissionsView(APIView):
    """
    GET /api/feedback/hr/submissions/               all submissions across all forms
    GET /api/feedback/hr/submissions/?form_id=<id>  filter by form
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        qs = FeedbackSubmission.objects.select_related(
            'employeeID', 'formID'
        ).prefetch_related('answers__questionID').order_by('-submittedAt')

        form_id = request.query_params.get('form_id')
        status_filter = (request.query_params.get('status') or '').strip()
        search = (request.query_params.get('search') or '').strip()

        if form_id:
            qs = qs.filter(formID_id=form_id)
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)
        if search:
            qs = qs.filter(
                Q(employeeID__fullName__icontains=search)
                | Q(employeeID__employeeID__icontains=search)
                | Q(employeeID__email__icontains=search)
            )

        return Response(FeedbackSubmissionSerializer(qs, many=True).data)


class HRSubmissionInsightsView(APIView):
    """
    GET /api/feedback/hr/submissions/insights/?form_id=<id>
    Returns question-level response insights and follow-up priorities for HR.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        form_id = (request.query_params.get('form_id') or '').strip()
        forms_qs = FeedbackForm.objects.prefetch_related('questions').order_by('-createdAt')
        submissions_qs = FeedbackSubmission.objects.select_related(
            'employeeID', 'formID'
        ).prefetch_related('answers__questionID').order_by('-submittedAt')

        if form_id:
            forms_qs = forms_qs.filter(pk=form_id)
            submissions_qs = submissions_qs.filter(formID_id=form_id)

        forms = list(forms_qs)
        if form_id and not forms:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)

        submissions = list(submissions_qs)
        total_submissions = len(submissions)
        completed_submissions = sum(
            1 for submission in submissions if submission.status == FeedbackSubmission.STATUS_COMPLETED
        )
        pending_submissions = max(total_submissions - completed_submissions, 0)

        question_stats = {}
        for form in forms:
            for question in form.questions.all():
                question_stats[question.questionID] = {
                    'questionID': question.questionID,
                    'questionText': question.questionText,
                    'fieldType': question.fieldType,
                    'formTitle': form.title,
                    'responseCount': 0,
                    'scoreValues': [],
                    'decimalValues': [],
                    'yesCount': 0,
                    'noCount': 0,
                }

        score_values = []
        for submission in submissions:
            for answer in submission.answers.all():
                entry = question_stats.setdefault(
                    answer.questionID_id,
                    {
                        'questionID': answer.questionID_id,
                        'questionText': answer.questionID.questionText,
                        'fieldType': answer.questionID.fieldType,
                        'formTitle': submission.formID.title,
                        'responseCount': 0,
                        'scoreValues': [],
                        'decimalValues': [],
                        'yesCount': 0,
                        'noCount': 0,
                    },
                )
                entry['responseCount'] += 1
                if answer.scoreValue is not None:
                    entry['scoreValues'].append(answer.scoreValue)
                    score_values.append(answer.scoreValue)
                if answer.decimalValue is not None:
                    entry['decimalValues'].append(float(answer.decimalValue))
                if answer.booleanValue is True:
                    entry['yesCount'] += 1
                elif answer.booleanValue is False:
                    entry['noCount'] += 1

        question_insights = []
        follow_up_items = []
        for entry in question_stats.values():
            expected_responses = max(completed_submissions, 1)
            response_rate = round((entry['responseCount'] / expected_responses) * 100) if completed_submissions else 0
            insight = {
                'questionID': entry['questionID'],
                'questionText': entry['questionText'],
                'fieldType': entry['fieldType'],
                'formTitle': entry['formTitle'],
                'responseCount': entry['responseCount'],
                'responseRate': response_rate,
            }

            priority = None
            metric = ''
            issue = ''
            recommended_action = ''

            if entry['fieldType'] == 'score_1_4':
                average_score = round(sum(entry['scoreValues']) / len(entry['scoreValues']), 2) if entry['scoreValues'] else 0
                insight['averageScore'] = average_score
                if entry['scoreValues'] and average_score <= 2:
                    priority = 'High'
                    issue = 'Low score trend'
                    metric = f'Average score {average_score}/4'
                    recommended_action = 'Review the manager and team context behind this low-scoring feedback.'
                elif entry['scoreValues'] and average_score < 3:
                    priority = 'Medium'
                    issue = 'Score trend to monitor'
                    metric = f'Average score {average_score}/4'
                    recommended_action = 'Check for emerging sentiment risks before the next review cycle.'
            elif entry['fieldType'] == 'boolean':
                total_boolean = entry['yesCount'] + entry['noCount']
                yes_rate = round((entry['yesCount'] / max(total_boolean, 1)) * 100) if total_boolean else 0
                insight['yesRate'] = yes_rate
                if total_boolean and yes_rate < 60:
                    priority = 'High' if yes_rate < 50 else 'Medium'
                    issue = 'Negative yes/no sentiment'
                    metric = f'Yes rate {yes_rate}%'
                    recommended_action = 'Follow up on blockers raised by employees and confirm support needs.'
            else:
                average_value = round(sum(entry['decimalValues']) / len(entry['decimalValues']), 2) if entry['decimalValues'] else 0
                insight['averageValue'] = average_value
                if entry['decimalValues'] and average_value < 2:
                    priority = 'Medium'
                    issue = 'Low numeric feedback signal'
                    metric = f'Average value {average_value}'
                    recommended_action = 'Review the numeric trend and compare it with prior submissions.'

            if response_rate < 70 and not priority:
                priority = 'Medium'
                issue = 'Low response coverage'
                metric = f'Response rate {response_rate}%'
                recommended_action = 'Drive additional responses so HR can trust the reporting trend.'

            question_insights.append(insight)

            if priority:
                follow_up_items.append({
                    'questionID': entry['questionID'],
                    'questionText': entry['questionText'],
                    'formTitle': entry['formTitle'],
                    'priority': priority,
                    'issue': issue,
                    'metric': metric,
                    'recommendedAction': recommended_action,
                })

        priority_order = {'High': 2, 'Medium': 1, 'Watch': 0}
        follow_up_items.sort(key=lambda item: priority_order.get(item['priority'], 0), reverse=True)
        question_insights.sort(key=lambda item: (item.get('responseRate', 0), item.get('averageScore', 5)))

        return Response({
            'summary': {
                'totalSubmissions': total_submissions,
                'completedSubmissions': completed_submissions,
                'pendingSubmissions': pending_submissions,
                'completionRate': round((completed_submissions / max(total_submissions, 1)) * 100) if total_submissions else 0,
                'averageScore': round(sum(score_values) / len(score_values), 2) if score_values else 0,
                'highPriorityItems': sum(1 for item in follow_up_items if item['priority'] == 'High'),
            },
            'questionInsights': question_insights,
            'followUpItems': follow_up_items[:8],
        })


class HRFormResponseSnapshotView(APIView):
    """
    GET /api/feedback/hr/forms/response-snapshot/
    Returns response-health visibility for HR survey follow-up.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        forms = list(
            FeedbackForm.objects.prefetch_related('questions', 'submissions__employeeID').order_by('-createdAt')
        )

        follow_up_items = []
        completion_total = 0
        low_coverage_forms = 0
        zero_response_forms = 0
        pending_responses = 0

        for form in forms:
            submissions = list(form.submissions.all())
            total_submissions = len(submissions)
            completed_submissions = sum(
                1 for submission in submissions if submission.status == FeedbackSubmission.STATUS_COMPLETED
            )
            pending_submissions = max(total_submissions - completed_submissions, 0)
            pending_responses += pending_submissions

            completion_rate = round((completed_submissions / max(total_submissions, 1)) * 100) if total_submissions else 0
            completion_total += completion_rate

            if total_submissions == 0:
                zero_response_forms += 1
            if total_submissions == 0 or completion_rate < 80:
                low_coverage_forms += 1

            if total_submissions == 0:
                risk_level = 'High'
                recommended_action = 'Launch the survey and ask managers to drive first responses.'
            elif pending_submissions >= 2 or completion_rate < 50:
                risk_level = 'High'
                recommended_action = 'Send follow-up reminders and review blockers with the responsible team.'
            elif pending_submissions > 0 or completion_rate < 80:
                risk_level = 'Medium'
                recommended_action = 'Nudge remaining employees before the reporting deadline.'
            else:
                risk_level = 'On Track'
                recommended_action = 'No immediate action required.'

            if risk_level == 'On Track':
                continue

            latest_submission = max(
                (submission.submittedAt for submission in submissions if submission.submittedAt),
                default=None,
            )
            follow_up_items.append({
                'formID': form.formID,
                'title': form.title,
                'status': 'Live' if form.isActive else 'Inactive',
                'questionCount': form.questions.count(),
                'submissionCount': total_submissions,
                'completedSubmissions': completed_submissions,
                'pendingResponses': pending_submissions,
                'completionRate': completion_rate,
                'riskLevel': risk_level,
                'recommendedAction': recommended_action,
                'lastSubmittedAt': latest_submission,
            })

        risk_order = {'High': 2, 'Medium': 1, 'On Track': 0}
        follow_up_items.sort(
            key=lambda item: (risk_order.get(item['riskLevel'], 0), item['pendingResponses'], -item['completionRate']),
            reverse=True,
        )

        return Response({
            'summary': {
                'trackedForms': len(forms),
                'liveForms': sum(1 for form in forms if form.isActive),
                'pendingResponses': pending_responses,
                'lowCoverageForms': low_coverage_forms,
                'zeroResponseForms': zero_response_forms,
                'averageCompletionRate': round(completion_total / len(forms)) if forms else 0,
            },
            'followUpItems': follow_up_items[:8],
        })


# ---------------------------------------------------------------------------
# HR Manager -- Employee Directory
# ---------------------------------------------------------------------------

class HRWorkforceInsightsView(APIView):
    """
    GET /api/feedback/hr/insights/
    Returns a compact workforce analytics snapshot for the HR dashboard.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        employees = Employee.objects.filter(isDeleted=False)
        attendance_records = AttendanceRecord.objects.filter(employee__isDeleted=False)
        leave_requests = LeaveRequest.objects.filter(employee__isDeleted=False)
        payroll_records = PayrollRecord.objects.filter(employee__isDeleted=False)
        tasks = WorkTask.objects.filter(employee__isDeleted=False)
        goals = EmployeeGoal.objects.filter(employee__isDeleted=False)
        reviews = PerformanceReview.objects.filter(employee__isDeleted=False)
        succession_plans = SuccessionPlan.objects.filter(employee__isDeleted=False)
        expenses = ExpenseClaim.objects.filter(employee__isDeleted=False)
        documents = DocumentRequest.objects.filter(employee__isDeleted=False)
        tickets = SupportTicket.objects.filter(employee__isDeleted=False)
        courses = list(TrainingCourse.objects.all())

        total_assignments = sum(len(course.assignedEmployeeIDs or []) for course in courses)
        completed_assignments = sum(
            1
            for course in courses
            for item in (course.completionData or {}).values()
            if item.get('status') == 'Completed'
        )
        training_completion_rate = round((completed_assignments / total_assignments) * 100) if total_assignments else 0

        department_counts = {}
        for employee in employees:
            label = employee.department or 'Unassigned'
            department_counts[label] = department_counts.get(label, 0) + 1

        readiness_counts = {}
        for plan in succession_plans:
            readiness_counts[plan.readiness] = readiness_counts.get(plan.readiness, 0) + 1

        present_count = attendance_records.filter(status=AttendanceRecord.STATUS_PRESENT).count()
        partial_count = attendance_records.filter(status=AttendanceRecord.STATUS_PARTIAL).count()
        clocked_in_count = attendance_records.filter(status=AttendanceRecord.STATUS_CLOCKED_IN).count()
        employees_with_attendance = attendance_records.values('employee').distinct().count()
        attendance_completion_rate = round((employees_with_attendance / employees.count()) * 100) if employees.exists() else 0

        total_net_pay = sum((record.netPay for record in payroll_records), Decimal('0'))
        paid_net_pay = sum((record.netPay for record in payroll_records.filter(status=PayrollRecord.STATUS_PAID)), Decimal('0'))
        pending_net_pay = sum((record.netPay for record in payroll_records.exclude(status=PayrollRecord.STATUS_PAID)), Decimal('0'))
        payroll_count = payroll_records.count()

        average_rating = reviews.aggregate(avg=Avg('overallRating')).get('avg') or 0
        average_goal_progress = goals.aggregate(avg=Avg('progress')).get('avg') or 0
        submitted_expense_amount = sum((claim.amount for claim in expenses.filter(status='Submitted')), Decimal('0'))
        approved_expense_amount = sum((claim.amount for claim in expenses.filter(status='Approved')), Decimal('0'))
        reimbursed_expense_amount = sum((claim.amount for claim in expenses.filter(status='Reimbursed')), Decimal('0'))
        open_tickets = tickets.exclude(status__in=['Resolved', 'Closed'])

        return Response({
            'totals': {
                'totalEmployees': employees.count(),
                'activeEmployees': employees.filter(employmentStatus__iexact='Active').count(),
                'attendanceLogged': attendance_records.count(),
                'pendingLeaveRequests': leave_requests.filter(status=LeaveRequest.STATUS_PENDING).count(),
                'openTasks': tasks.exclude(status='Done').count(),
                'acknowledgedReviews': reviews.filter(status='Acknowledged').count(),
                'trainingCompletionRate': training_completion_rate,
                'readyNowSuccessors': succession_plans.filter(readiness='Ready Now').count(),
            },
            'departmentBreakdown': [
                {'department': department, 'count': count}
                for department, count in sorted(department_counts.items(), key=lambda item: (-item[1], item[0]))
            ],
            'attendanceSummary': {
                'presentCount': present_count,
                'partialCount': partial_count,
                'clockedInCount': clocked_in_count,
                'completionRate': attendance_completion_rate,
            },
            'leaveSummary': {
                'pendingCount': leave_requests.filter(status=LeaveRequest.STATUS_PENDING).count(),
                'approvedCount': leave_requests.filter(status=LeaveRequest.STATUS_APPROVED).count(),
                'rejectedCount': leave_requests.filter(status=LeaveRequest.STATUS_REJECTED).count(),
            },
            'payrollSummary': {
                'recordsProcessed': payroll_count,
                'paidRecords': payroll_records.filter(status=PayrollRecord.STATUS_PAID).count(),
                'draftRecords': payroll_records.filter(status=PayrollRecord.STATUS_DRAFT).count(),
                'totalNetPay': float(total_net_pay),
                'paidNetPay': float(paid_net_pay),
                'pendingNetPay': float(pending_net_pay),
                'averageNetPay': round(float(total_net_pay / payroll_count), 2) if payroll_count else 0,
            },
            'reviewSummary': {
                'averageRating': round(float(average_rating), 1) if average_rating else 0,
                'submittedReviews': reviews.filter(status='Submitted').count(),
                'acknowledgedReviews': reviews.filter(status='Acknowledged').count(),
            },
            'goalSummary': {
                'activeGoals': goals.count(),
                'completedGoals': goals.filter(status='Completed').count(),
                'averageProgress': round(float(average_goal_progress), 1) if average_goal_progress else 0,
            },
            'trainingSummary': {
                'assignedLearners': total_assignments,
                'completedLearners': completed_assignments,
            },
            'expenseSummary': {
                'submittedCount': expenses.filter(status='Submitted').count(),
                'approvedCount': expenses.filter(status='Approved').count(),
                'rejectedCount': expenses.filter(status='Rejected').count(),
                'reimbursedCount': expenses.filter(status='Reimbursed').count(),
                'submittedAmount': float(submitted_expense_amount),
                'approvedAmount': float(approved_expense_amount),
                'reimbursedAmount': float(reimbursed_expense_amount),
            },
            'documentSummary': {
                'pendingCount': documents.filter(status='Pending').count(),
                'inProgressCount': documents.filter(status='In Progress').count(),
                'issuedCount': documents.filter(status='Issued').count(),
                'declinedCount': documents.filter(status='Declined').count(),
            },
            'ticketSummary': {
                'openCount': open_tickets.count(),
                'criticalOpenCount': open_tickets.filter(priority='Critical').count(),
                'resolvedCount': tickets.filter(status='Resolved').count(),
                'closedCount': tickets.filter(status='Closed').count(),
            },
            'successionSummary': {
                'activePlans': succession_plans.count(),
                'highRiskPlans': succession_plans.filter(retentionRisk='High').count(),
                'readySoon': succession_plans.filter(readiness__in=['Ready Now', '6-12 Months']).count(),
                'readinessBreakdown': [
                    {'label': label, 'count': count}
                    for label, count in sorted(readiness_counts.items(), key=lambda item: (-item[1], item[0]))
                ],
            },
        })


class HRPeopleIntelligenceView(APIView):
    """
    GET /api/feedback/hr/intelligence/
    Returns an executive people-intelligence board with trends and priority queue.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        from attrition.models import AttritionPrediction
        from attrition.serializers import AttritionPredictionSerializer

        employees_qs = Employee.objects.filter(isDeleted=False)
        employees = list(employees_qs)
        employee_ids = [employee.employeeID for employee in employees]
        employee_map = {employee.employeeID: employee for employee in employees}

        now = timezone.now()
        current_start = now - timedelta(days=30)
        previous_start = now - timedelta(days=60)

        def pct_change(current_value, previous_value):
            if previous_value == 0:
                return 100 if current_value > 0 else 0
            return round(((current_value - previous_value) / previous_value) * 100, 1)

        predictions = AttritionPrediction.objects.filter(employeeID_id__in=employee_ids).order_by('employeeID_id', '-predictedAt')
        latest_predictions = {}
        for prediction in predictions:
            if prediction.employeeID_id not in latest_predictions:
                latest_predictions[prediction.employeeID_id] = prediction

        current_predictions = AttritionPrediction.objects.filter(predictedAt__gte=current_start)
        previous_predictions = AttritionPrediction.objects.filter(predictedAt__gte=previous_start, predictedAt__lt=current_start)

        def latest_counts(queryset):
            latest = {}
            for prediction in queryset.order_by('employeeID_id', '-predictedAt'):
                if prediction.employeeID_id not in latest:
                    latest[prediction.employeeID_id] = prediction.riskLevel
            high_count = sum(1 for level in latest.values() if level == 'High')
            medium_count = sum(1 for level in latest.values() if level == 'Medium')
            return high_count, medium_count

        current_high, current_medium = latest_counts(current_predictions)
        previous_high, previous_medium = latest_counts(previous_predictions)

        pending_leave_counts = {
            row['employee_id']: row['total']
            for row in LeaveRequest.objects.filter(
                employee_id__in=employee_ids,
                status=LeaveRequest.STATUS_PENDING,
            ).values('employee_id').annotate(total=Count('leaveRequestID'))
        }
        open_ticket_counts = {
            row['employee_id']: row['total']
            for row in SupportTicket.objects.filter(
                employee_id__in=employee_ids,
                status__in=['Open', 'In Progress'],
            ).values('employee_id').annotate(total=Count('ticketID'))
        }
        blocked_task_counts = {
            row['employee_id']: row['total']
            for row in WorkTask.objects.filter(
                employee_id__in=employee_ids,
                status__in=['To Do', 'In Progress'],
            ).values('employee_id').annotate(total=Count('taskID'))
        }
        pending_document_counts = {
            row['employee_id']: row['total']
            for row in DocumentRequest.objects.filter(
                employee_id__in=employee_ids,
                status__in=['Pending', 'In Progress'],
            ).values('employee_id').annotate(total=Count('requestID'))
        }

        current_open_tickets = SupportTicket.objects.filter(createdAt__gte=current_start, status__in=['Open', 'In Progress']).count()
        previous_open_tickets = SupportTicket.objects.filter(createdAt__gte=previous_start, createdAt__lt=current_start, status__in=['Open', 'In Progress']).count()
        current_pending_leave = LeaveRequest.objects.filter(requestedAt__gte=current_start, status=LeaveRequest.STATUS_PENDING).count()
        previous_pending_leave = LeaveRequest.objects.filter(requestedAt__gte=previous_start, requestedAt__lt=current_start, status=LeaveRequest.STATUS_PENDING).count()

        priority_queue = []
        high_count = 0
        medium_count = 0

        for employee_id, employee in employee_map.items():
            prediction = latest_predictions.get(employee_id)
            risk_score = float(prediction.riskScore) if prediction else 0
            risk_level = prediction.riskLevel if prediction else 'Low'
            if risk_level == 'High':
                high_count += 1
            elif risk_level == 'Medium':
                medium_count += 1

            leave_count = pending_leave_counts.get(employee_id, 0)
            ticket_count = open_ticket_counts.get(employee_id, 0)
            task_count = blocked_task_counts.get(employee_id, 0)
            doc_count = pending_document_counts.get(employee_id, 0)

            priority_score = (
                (3 if risk_level == 'High' else 2 if risk_level == 'Medium' else 1)
                + leave_count
                + ticket_count
                + (task_count * 0.5)
                + (doc_count * 0.5)
            )

            if priority_score < 3 and risk_level == 'Low':
                continue

            serialized_prediction = AttritionPredictionSerializer(prediction).data if prediction else None
            recommended_actions = (serialized_prediction or {}).get('recommendedActions') or []
            if not recommended_actions and ticket_count:
                recommended_actions.append('Review open support blockers with IT and manager this week.')
            if not recommended_actions and leave_count:
                recommended_actions.append('Confirm leave planning and workload backfill to reduce delivery stress.')
            if not recommended_actions:
                recommended_actions.append('Schedule a proactive 1:1 check-in and monitor next cycle signals.')

            priority_queue.append({
                'employeeID': employee_id,
                'fullName': employee.fullName,
                'jobTitle': employee.jobTitle,
                'department': employee.department,
                'team': employee.team,
                'riskLevel': risk_level,
                'riskScore': round(risk_score, 4),
                'openTickets': ticket_count,
                'pendingLeave': leave_count,
                'blockedTasks': task_count,
                'pendingDocuments': doc_count,
                'priorityScore': round(priority_score, 2),
                'recommendedActions': recommended_actions[:3],
            })

        priority_queue.sort(key=lambda item: (item['priorityScore'], item['riskScore']), reverse=True)
        follow_up_count = len([item for item in priority_queue if item['riskLevel'] in ('High', 'Medium')])

        return Response({
            'overview': {
                'totalEmployees': len(employee_ids),
                'predictedEmployees': len(latest_predictions),
                'highRisk': high_count,
                'mediumRisk': medium_count,
                'followUpCount': follow_up_count,
                'coveragePct': round((len(latest_predictions) / max(len(employee_ids), 1)) * 100, 1),
            },
            'trends': {
                'riskPressurePct': pct_change(current_high + current_medium, previous_high + previous_medium),
                'supportLoadPct': pct_change(current_open_tickets, previous_open_tickets),
                'leavePressurePct': pct_change(current_pending_leave, previous_pending_leave),
            },
            'priorityQueue': priority_queue[:12],
        })


class HREmployeeListCreateView(APIView):
    """
    GET  /api/feedback/hr/employees/        list/search/filter employees
    POST /api/feedback/hr/employees/        create an employee directory record
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), IsTeamLeader()]
        return [IsAuthenticated(), IsHRManager()]

    def get(self, request):
        qs = Employee.objects.filter(isDeleted=False).order_by('fullName', 'employeeID')

        search = (request.query_params.get('search') or '').strip()
        department = (request.query_params.get('department') or '').strip()
        role = (request.query_params.get('role') or '').strip()
        employee_type = (request.query_params.get('type') or '').strip()
        location = (request.query_params.get('location') or '').strip()
        status_filter = (request.query_params.get('status') or '').strip()

        if search:
            qs = qs.filter(
                Q(fullName__icontains=search)
                | Q(email__icontains=search)
                | Q(employeeID__icontains=search)
                | Q(jobTitle__icontains=search)
                | Q(department__icontains=search)
            )
        if department:
            qs = qs.filter(department__icontains=department)
        if role:
            qs = qs.filter(role__icontains=role)
        if employee_type:
            qs = qs.filter(employeeType__icontains=employee_type)
        if location:
            qs = qs.filter(location__icontains=location)
        if status_filter:
            qs = qs.filter(employmentStatus__icontains=status_filter)

        return Response(EmployeeSerializer(qs, many=True).data)

    def post(self, request):
        serializer = EmployeeCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = serializer.save()
        return Response(EmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)


class HREmployeeDetailView(APIView):
    """
    GET    /api/feedback/hr/employees/<employee_id>/   retrieve employee
    PUT    /api/feedback/hr/employees/<employee_id>/   update employee
    DELETE /api/feedback/hr/employees/<employee_id>/   soft-delete employee
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get_object(self, employee_id):
        try:
            return Employee.objects.get(pk=employee_id, isDeleted=False)
        except Employee.DoesNotExist:
            return None

    def get(self, request, employee_id):
        employee = self.get_object(employee_id)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(EmployeeSerializer(employee).data)

    def put(self, request, employee_id):
        employee = self.get_object(employee_id)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmployeeCreateUpdateSerializer(employee, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = serializer.save()
        return Response(EmployeeSerializer(employee).data)

    def delete(self, request, employee_id):
        employee = self.get_object(employee_id)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        employee.isDeleted = True
        employee.employmentStatus = 'Archived'
        employee.save(update_fields=['isDeleted', 'employmentStatus'])
        return Response({'message': 'Employee archived successfully.'}, status=status.HTTP_200_OK)


class HREmployeeHistoryView(APIView):
    """
    GET /api/feedback/hr/employees/<employee_id>/history/
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request, employee_id):
        try:
            employee = Employee.objects.get(pk=employee_id, isDeleted=False)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        history = employee.job_history.all()
        return Response(EmployeeJobHistorySerializer(history, many=True).data)


class HRRosterHealthView(APIView):
    """
    GET /api/feedback/hr/employees/roster-health/
    Returns directory health and workforce follow-up priorities for HR.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        employees = list(Employee.objects.filter(isDeleted=False).order_by('fullName', 'employeeID'))
        employee_ids = [employee.employeeID for employee in employees]
        recent_cutoff = timezone.now() - timedelta(days=90)

        recent_history = list(
            EmployeeJobHistory.objects.select_related('employee')
            .filter(employee__isDeleted=False, changedAt__gte=recent_cutoff)
            .order_by('-changedAt')
        )
        recent_history_by_employee = {}
        for item in recent_history:
            recent_history_by_employee.setdefault(item.employee_id, []).append(item)

        latest_predictions = {}
        try:
            from attrition.models import AttritionPrediction

            for prediction in AttritionPrediction.objects.filter(employeeID_id__in=employee_ids).order_by('employeeID_id', '-predictedAt'):
                latest_predictions.setdefault(prediction.employeeID_id, prediction)
        except Exception:
            latest_predictions = {}

        department_breakdown = {}
        follow_up_items = []
        incomplete_profiles = 0
        attrition_follow_up = 0

        for employee in employees:
            department_label = employee.department or 'Unassigned'
            department_breakdown.setdefault(
                department_label,
                {
                    'department': department_label,
                    'employees': 0,
                    'followUpCount': 0,
                    'highPriorityCount': 0,
                    'incompleteProfiles': 0,
                },
            )
            department_breakdown[department_label]['employees'] += 1

            missing_fields = []
            if not (employee.jobTitle or '').strip():
                missing_fields.append('Job title missing')
            if not (employee.department or '').strip():
                missing_fields.append('Department missing')
            if not (employee.location or '').strip():
                missing_fields.append('Location missing')
            if employee.monthlyIncome in (None, ''):
                missing_fields.append('Salary missing')

            if missing_fields:
                incomplete_profiles += 1
                department_breakdown[department_label]['incompleteProfiles'] += 1

            prediction = latest_predictions.get(employee.employeeID)
            if prediction and prediction.riskLevel in ('High', 'Medium'):
                attrition_follow_up += 1

            risk_flags = []
            recommended_actions = []

            if missing_fields:
                risk_flags.append('Incomplete directory profile')
                recommended_actions.append('Complete core directory, location, and payroll fields for this employee.')
            if prediction and prediction.riskLevel in ('High', 'Medium'):
                risk_flags.append(f'{prediction.riskLevel} attrition risk')
                recommended_actions.append(
                    'Schedule a retention check-in with the manager this week.'
                    if prediction.riskLevel == 'High'
                    else 'Monitor engagement and workload signals over the next 2 weeks.'
                )
            if employee.employmentStatus == 'Probation':
                risk_flags.append('Probation review due')
                recommended_actions.append('Confirm probation goals and manager feedback are documented.')
            if employee.employmentStatus == 'On Leave':
                risk_flags.append('Leave coverage planning')
                recommended_actions.append('Review handover and return-to-work planning.')
            if recent_history_by_employee.get(employee.employeeID):
                risk_flags.append('Recent role movement')

            if not risk_flags:
                continue

            if (prediction and prediction.riskLevel == 'High') or employee.employmentStatus == 'Probation' or len(missing_fields) >= 2:
                priority = 'High'
            elif (prediction and prediction.riskLevel == 'Medium') or missing_fields or employee.employmentStatus == 'On Leave':
                priority = 'Medium'
            else:
                priority = 'Watch'

            department_breakdown[department_label]['followUpCount'] += 1
            if priority == 'High':
                department_breakdown[department_label]['highPriorityCount'] += 1

            latest_change = recent_history_by_employee.get(employee.employeeID, [None])[0]
            follow_up_items.append({
                'employeeID': employee.employeeID,
                'employeeName': employee.fullName,
                'department': employee.department,
                'jobTitle': employee.jobTitle,
                'employmentStatus': employee.employmentStatus,
                'priority': priority,
                'riskLevel': prediction.riskLevel if prediction else 'Low',
                'riskScore': round(float(prediction.riskScore), 4) if prediction else 0,
                'flags': risk_flags,
                'recommendedAction': recommended_actions[0] if recommended_actions else 'Monitor this employee in the next review cycle.',
                'lastMovementAt': latest_change.changedAt if latest_change else None,
            })

        priority_order = {'High': 2, 'Medium': 1, 'Watch': 0}
        follow_up_items.sort(
            key=lambda item: (priority_order.get(item['priority'], 0), item['riskScore'], len(item['flags'])),
            reverse=True,
        )

        department_summary = sorted(
            department_breakdown.values(),
            key=lambda item: (item['highPriorityCount'], item['followUpCount'], item['employees']),
            reverse=True,
        )

        return Response({
            'summary': {
                'trackedEmployees': len(employees),
                'activeEmployees': sum(1 for employee in employees if employee.employmentStatus == 'Active'),
                'incompleteProfiles': incomplete_profiles,
                'attritionFollowUp': attrition_follow_up,
                'probationCases': sum(1 for employee in employees if employee.employmentStatus == 'Probation'),
                'recentMovements': len(recent_history),
                'followUpCount': len(follow_up_items),
            },
            'departmentBreakdown': department_summary,
            'followUpItems': follow_up_items[:8],
        })


class HREmployeeSnapshotView(APIView):
    """
    GET /api/feedback/hr/employees/<employee_id>/snapshot/
    Returns a unified Employee 360 snapshot for HR.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request, employee_id):
        try:
            employee = Employee.objects.get(pk=employee_id, isDeleted=False)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        attendance_records = AttendanceRecord.objects.select_related('employee').filter(employee=employee).order_by('-date', '-clockIn')
        leave_requests = LeaveRequest.objects.select_related('employee').filter(employee=employee).order_by('-requestedAt')
        payroll_records = PayrollRecord.objects.select_related('employee').filter(employee=employee).order_by('-payPeriod', '-createdAt')
        goals = EmployeeGoal.objects.select_related('employee').filter(employee=employee).order_by('-updatedAt', '-createdAt')
        tasks = WorkTask.objects.select_related('employee').filter(employee=employee).order_by('-updatedAt', '-createdAt')
        reviews = PerformanceReview.objects.select_related('employee').filter(employee=employee).order_by('-reviewDate', '-createdAt')
        benefits = BenefitEnrollment.objects.select_related('employee').filter(employee=employee).order_by('-createdAt')
        expenses = ExpenseClaim.objects.select_related('employee').filter(employee=employee).order_by('-expenseDate', '-createdAt')
        documents = DocumentRequest.objects.select_related('employee').filter(employee=employee).order_by('-createdAt')
        tickets = SupportTicket.objects.select_related('employee').filter(employee=employee).order_by('-updatedAt', '-createdAt')
        history = employee.job_history.all().order_by('-changedAt')
        recognition = RecognitionAward.objects.select_related('employee').filter(employee=employee).order_by('-recognitionDate', '-createdAt')

        training_courses = [
            course for course in TrainingCourse.objects.all().order_by('dueDate', '-createdAt')
            if employee.employeeID in (course.assignedEmployeeIDs or [])
        ]

        completed_training = sum(
            1
            for course in training_courses
            if (course.completionData or {}).get(employee.employeeID, {}).get('status') == 'Completed'
        )

        attendance_completed = attendance_records.filter(status__in=[AttendanceRecord.STATUS_PRESENT, AttendanceRecord.STATUS_PARTIAL]).count()
        attendance_rate = round((attendance_completed / max(attendance_records.count(), 1)) * 100, 1) if attendance_records.exists() else 0
        latest_payroll = payroll_records.first()
        avg_review = reviews.aggregate(avg=Avg('overallRating')).get('avg') or 0

        attrition_payload = None
        try:
            from attrition.models import AttritionPrediction
            from attrition.serializers import AttritionPredictionSerializer

            latest_prediction = AttritionPrediction.objects.filter(employeeID=employee).order_by('-predictedAt').first()
            if latest_prediction:
                attrition_payload = AttritionPredictionSerializer(latest_prediction).data
        except Exception:
            attrition_payload = None

        return Response({
            'employee': EmployeeSerializer(employee).data,
            'summary': {
                'activeGoals': goals.exclude(status='Completed').count(),
                'completedGoals': goals.filter(status='Completed').count(),
                'openTasks': tasks.exclude(status__in=['Done', 'Completed']).count(),
                'completedTasks': tasks.filter(status__in=['Done', 'Completed']).count(),
                'assignedTraining': len(training_courses),
                'completedTraining': completed_training,
                'pendingLeave': leave_requests.filter(status='Pending').count(),
                'openTickets': tickets.filter(status__in=['Open', 'In Progress']).count(),
                'pendingDocuments': documents.filter(status__in=['Pending', 'In Progress']).count(),
                'pendingExpenses': expenses.filter(status='Submitted').count(),
                'recognitionCount': recognition.count(),
                'attendanceRate': attendance_rate,
                'lastAttendanceStatus': attendance_records.first().status if attendance_records.exists() else 'No Records',
                'latestNetPay': float(latest_payroll.netPay) if latest_payroll else 0.0,
                'latestPayPeriod': latest_payroll.payPeriod if latest_payroll else '',
                'averageReviewRating': round(float(avg_review), 2) if avg_review else 0,
            },
            'attrition': attrition_payload,
            'history': EmployeeJobHistorySerializer(history[:6], many=True).data,
            'attendance': AttendanceRecordSerializer(attendance_records[:5], many=True).data,
            'leaveRequests': LeaveRequestSerializer(leave_requests[:5], many=True).data,
            'payroll': PayrollRecordSerializer(payroll_records[:3], many=True).data,
            'goals': EmployeeGoalSerializer(goals[:5], many=True).data,
            'tasks': WorkTaskSerializer(tasks[:5], many=True).data,
            'training': TrainingCourseSerializer(training_courses[:5], many=True, context={'employee_id': employee.employeeID}).data,
            'reviews': PerformanceReviewSerializer(reviews[:4], many=True).data,
            'benefits': BenefitEnrollmentSerializer(benefits[:4], many=True).data,
            'expenses': ExpenseClaimSerializer(expenses[:4], many=True).data,
            'documents': DocumentRequestSerializer(documents[:4], many=True).data,
            'tickets': SupportTicketSerializer(tickets[:4], many=True).data,
        })


class HREmployeeRoleChangeView(APIView):
    """
    POST /api/feedback/hr/employees/<employee_id>/change-role/
    Promote / demote an employee and automatically log the change.
    """
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, employee_id):
        try:
            employee = Employee.objects.get(pk=employee_id, isDeleted=False)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmployeeRoleChangeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        updates = {}

        previous_job_title = employee.jobTitle or ''
        previous_role = employee.role or ''
        previous_department = employee.department or ''
        previous_team = employee.team or ''
        previous_income = employee.monthlyIncome

        new_job_title = data.get('jobTitle', employee.jobTitle)
        new_role = data.get('role', employee.role)
        new_department = data.get('department', employee.department)
        new_team = data.get('team', employee.team)
        new_income = data.get('monthlyIncome', employee.monthlyIncome)

        if new_job_title != employee.jobTitle:
            employee.jobTitle = new_job_title
            updates['jobTitle'] = new_job_title
        if new_role != employee.role:
            employee.role = new_role
            updates['role'] = new_role
        if new_department != employee.department:
            employee.department = new_department
            updates['department'] = new_department
        if new_team != employee.team:
            employee.team = new_team
            updates['team'] = new_team
        if new_income != employee.monthlyIncome:
            employee.monthlyIncome = new_income
            updates['monthlyIncome'] = new_income

        if not updates:
            return Response({'error': 'No promotion/demotion changes were provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if data['action'] == 'Promotion':
            employee.numberOfPromotions = (employee.numberOfPromotions or 0) + 1
            updates['numberOfPromotions'] = employee.numberOfPromotions

        employee.save(update_fields=list(updates.keys()))

        history_entry = EmployeeJobHistory.objects.create(
            employee=employee,
            action=data['action'],
            previousJobTitle=previous_job_title,
            newJobTitle=employee.jobTitle or '',
            previousRole=previous_role,
            newRole=employee.role or '',
            previousDepartment=previous_department,
            newDepartment=employee.department or '',
            previousTeam=previous_team,
            newTeam=employee.team or '',
            previousMonthlyIncome=previous_income,
            newMonthlyIncome=employee.monthlyIncome,
            changedBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
            notes=data.get('notes', ''),
        )

        return Response({
            'message': f"{data['action']} saved and logged successfully.",
            'employee': EmployeeSerializer(employee).data,
            'history': EmployeeJobHistorySerializer(history_entry).data,
        })


# ---------------------------------------------------------------------------
# Attendance & Leave Management
# ---------------------------------------------------------------------------

def _resolve_employee(employee_id, request_user=None):
    employee = Employee.objects.filter(pk=employee_id, isDeleted=False).first()
    if employee:
        return employee

    if request_user and getattr(request_user, 'employee_id', None) == employee_id:
        return Employee.objects.create(
            employeeID=employee_id,
            fullName=getattr(request_user, 'full_name', request_user.email),
            email=request_user.email,
            role=getattr(request_user, 'role', 'TeamMember'),
            employmentStatus='Active',
        )
    return None


def _can_manage_employee(request_user, employee):
    if getattr(request_user, 'role', None) in ('HRManager', 'Admin'):
        return True

    if getattr(request_user, 'role', None) == 'TeamLeader':
        leader_employee = Employee.objects.filter(
            employeeID=getattr(request_user, 'employee_id', None),
            isDeleted=False,
        ).first()
        if leader_employee and leader_employee.team and employee.team:
            return leader_employee.team == employee.team
    return False


class EmployeeAttendanceListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        records = AttendanceRecord.objects.select_related('employee').filter(employee_id=employee_id).order_by('-date')
        return Response(AttendanceRecordSerializer(records, many=True).data)


class EmployeeAttendanceClockView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request):
        serializer = AttendanceClockSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = serializer.validated_data['action']
        notes = serializer.validated_data.get('notes', '')
        now = timezone.now()
        today = timezone.localdate()

        record, _ = AttendanceRecord.objects.get_or_create(
            employee=employee,
            date=today,
            defaults={'notes': notes},
        )

        if action == 'clock_in':
            if record.clockIn and not record.clockOut:
                return Response({'error': 'Employee is already clocked in for today.'}, status=status.HTTP_400_BAD_REQUEST)
            if record.clockOut:
                return Response({'error': 'Attendance has already been completed for today.'}, status=status.HTTP_400_BAD_REQUEST)
            record.clockIn = now
            record.status = AttendanceRecord.STATUS_CLOCKED_IN
            if notes:
                record.notes = notes
            record.save(update_fields=['clockIn', 'status', 'notes'])
        else:
            if not record.clockIn:
                return Response({'error': 'Cannot clock out before clocking in.'}, status=status.HTTP_400_BAD_REQUEST)
            if record.clockOut:
                return Response({'error': 'Employee has already clocked out for today.'}, status=status.HTTP_400_BAD_REQUEST)
            record.clockOut = now
            worked_hours = max(0, round((record.clockOut - record.clockIn).total_seconds() / 3600, 2))
            record.workedHours = worked_hours
            record.status = AttendanceRecord.STATUS_PRESENT if worked_hours >= 8 else AttendanceRecord.STATUS_PARTIAL
            if notes:
                record.notes = notes
            record.save(update_fields=['clockOut', 'workedHours', 'status', 'notes'])

        return Response(AttendanceRecordSerializer(record).data)


class EmployeeLeaveRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        leave_requests = LeaveRequest.objects.select_related('employee').filter(employee_id=employee_id)
        return Response(LeaveRequestSerializer(leave_requests, many=True).data)

    def post(self, request):
        serializer = LeaveRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        start_date = serializer.validated_data['startDate']
        end_date = serializer.validated_data['endDate']
        days_requested = (end_date - start_date).days + 1

        overlap_exists = LeaveRequest.objects.filter(
            employee=employee,
            status__in=[LeaveRequest.STATUS_PENDING, LeaveRequest.STATUS_APPROVED],
            startDate__lte=end_date,
            endDate__gte=start_date,
        ).exists()
        if overlap_exists:
            return Response({'error': 'This leave request overlaps with an existing request.'}, status=status.HTTP_400_BAD_REQUEST)

        leave_type = serializer.validated_data['leaveType']
        eligibility_message = 'Eligible for review.'
        if leave_type == LeaveRequest.TYPE_ANNUAL:
            approved_days = sum(
                item.daysRequested for item in LeaveRequest.objects.filter(
                    employee=employee,
                    leaveType=LeaveRequest.TYPE_ANNUAL,
                    status=LeaveRequest.STATUS_APPROVED,
                    startDate__year=start_date.year,
                )
            )
            if approved_days + days_requested > 21:
                return Response(
                    {'error': 'Annual leave eligibility exceeded the 21-day allowance.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            eligibility_message = f'Eligible. {21 - (approved_days + days_requested)} annual leave day(s) remaining after approval.'

        leave_request = LeaveRequest.objects.create(
            employee=employee,
            leaveType=leave_type,
            startDate=start_date,
            endDate=end_date,
            daysRequested=days_requested,
            reason=serializer.validated_data['reason'],
            eligibilityMessage=eligibility_message,
        )
        return Response(LeaveRequestSerializer(leave_request).data, status=status.HTTP_201_CREATED)


class HRAttendanceWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        today = timezone.localdate()
        attendance_records = list(
            AttendanceRecord.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-date', '-clockIn')
        )
        leave_requests = list(
            LeaveRequest.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-requestedAt')
        )

        department_map = {}
        follow_up_items = []

        for record in attendance_records:
            department = record.employee.department or 'Unassigned'
            entry = department_map.setdefault(department, {
                'department': department,
                'attendanceCount': 0,
                'clockedInCount': 0,
                'partialCount': 0,
                'pendingLeaveCount': 0,
            })
            entry['attendanceCount'] += 1
            if record.status == AttendanceRecord.STATUS_CLOCKED_IN:
                entry['clockedInCount'] += 1
                follow_up_items.append({
                    'type': 'attendance',
                    'attendanceID': record.attendanceID,
                    'employeeName': record.employee.fullName,
                    'employeeID': record.employee_id,
                    'department': department,
                    'status': record.status,
                    'followUpState': 'Open Shift',
                    'date': record.date.isoformat() if record.date else None,
                    'summary': record.notes or 'Employee is still clocked in and may need attendance closeout.',
                    'path': '/hr/attendance',
                })
            elif record.status == AttendanceRecord.STATUS_PARTIAL:
                entry['partialCount'] += 1
                follow_up_items.append({
                    'type': 'attendance',
                    'attendanceID': record.attendanceID,
                    'employeeName': record.employee.fullName,
                    'employeeID': record.employee_id,
                    'department': department,
                    'status': record.status,
                    'followUpState': 'Partial Day',
                    'date': record.date.isoformat() if record.date else None,
                    'summary': record.notes or 'Attendance record shows a partial day and may need manager follow-up.',
                    'path': '/hr/attendance',
                })

        for request_item in leave_requests:
            department = request_item.employee.department or 'Unassigned'
            entry = department_map.setdefault(department, {
                'department': department,
                'attendanceCount': 0,
                'clockedInCount': 0,
                'partialCount': 0,
                'pendingLeaveCount': 0,
            })
            if request_item.status == LeaveRequest.STATUS_PENDING:
                entry['pendingLeaveCount'] += 1
                follow_up_items.append({
                    'type': 'leave',
                    'leaveRequestID': request_item.leaveRequestID,
                    'employeeName': request_item.employee.fullName,
                    'employeeID': request_item.employee_id,
                    'department': department,
                    'status': request_item.status,
                    'followUpState': 'Leave Approval Pending',
                    'date': request_item.startDate.isoformat() if request_item.startDate else None,
                    'summary': request_item.reason or request_item.eligibilityMessage or 'Leave request is waiting for HR review.',
                    'path': '/hr/attendance',
                })

        state_rank = {
            'Open Shift': 0,
            'Leave Approval Pending': 1,
            'Partial Day': 2,
        }
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                state_rank.get(item['followUpState'], 9),
                item.get('date') or '',
                item['employeeName'],
            ),
        )[:10]

        department_breakdown = sorted(
            department_map.values(),
            key=lambda item: (-item['pendingLeaveCount'], -item['clockedInCount'], -item['partialCount'], item['department']),
        )

        return Response({
            'summary': {
                'attendanceToday': sum(1 for record in attendance_records if record.date == today),
                'clockedInCount': sum(1 for record in attendance_records if record.status == AttendanceRecord.STATUS_CLOCKED_IN),
                'partialCount': sum(1 for record in attendance_records if record.status == AttendanceRecord.STATUS_PARTIAL),
                'pendingLeaveCount': sum(1 for request_item in leave_requests if request_item.status == LeaveRequest.STATUS_PENDING),
                'approvedLeaveCount': sum(1 for request_item in leave_requests if request_item.status == LeaveRequest.STATUS_APPROVED),
                'followUpCount': len(follow_up_items),
            },
            'departmentBreakdown': department_breakdown,
            'followUpItems': follow_up_items,
        })


class HRAttendanceListView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        records = AttendanceRecord.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        department = request.query_params.get('department')
        date_value = request.query_params.get('date')

        if employee_id:
            records = records.filter(employee_id=employee_id)
        if department:
            records = records.filter(employee__department__icontains=department)
        if date_value:
            records = records.filter(date=date_value)

        return Response(AttendanceRecordSerializer(records.order_by('-date', '-clockIn'), many=True).data)


class HRLeaveRequestListView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        leave_requests = LeaveRequest.objects.select_related('employee').filter(employee__isDeleted=False)

        status_filter = request.query_params.get('status')
        department = request.query_params.get('department')
        if status_filter:
            leave_requests = leave_requests.filter(status=status_filter)
        if department:
            leave_requests = leave_requests.filter(employee__department__icontains=department)

        return Response(LeaveRequestSerializer(leave_requests, many=True).data)


class HRLeaveReviewView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, leave_request_id):
        try:
            leave_request = LeaveRequest.objects.select_related('employee').get(pk=leave_request_id)
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = LeaveReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if leave_request.status != LeaveRequest.STATUS_PENDING:
            return Response({'error': 'Only pending leave requests can be reviewed.'}, status=status.HTTP_400_BAD_REQUEST)

        leave_request.status = serializer.validated_data['status']
        leave_request.reviewNotes = serializer.validated_data.get('reviewNotes', '')
        leave_request.reviewedBy = getattr(request.user, 'full_name', '') or getattr(request.user, 'email', '')
        leave_request.reviewedAt = timezone.now()
        leave_request.save(update_fields=['status', 'reviewNotes', 'reviewedBy', 'reviewedAt'])

        return Response(LeaveRequestSerializer(leave_request).data)


# ---------------------------------------------------------------------------
# Payroll Management
# ---------------------------------------------------------------------------

def _calculate_net_pay(base_salary, allowances, deductions, bonus):
    return (Decimal(base_salary) + Decimal(allowances) + Decimal(bonus) - Decimal(deductions)).quantize(Decimal('0.01'))


class EmployeePayrollListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        records = PayrollRecord.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        if status_filter:
            records = records.filter(status=status_filter)

        return Response(PayrollRecordSerializer(records.order_by('-payPeriod', '-createdAt'), many=True).data)


class EmployeeGoalListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        goals = EmployeeGoal.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        if status_filter:
            goals = goals.filter(status=status_filter)

        return Response(EmployeeGoalSerializer(goals, many=True).data)


class EmployeeGoalProgressView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, goal_id):
        try:
            goal = EmployeeGoal.objects.select_related('employee').get(pk=goal_id)
        except EmployeeGoal.DoesNotExist:
            return Response({'error': 'Goal not found.'}, status=status.HTTP_404_NOT_FOUND)

        request_employee_id = getattr(request.user, 'employee_id', None)
        if goal.employee_id != request_employee_id and getattr(request.user, 'role', None) not in ('HRManager', 'Admin'):
            return Response({'error': 'You can only update your own goals.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = EmployeeGoalProgressSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        goal.status = data.get('status', goal.status)
        goal.progress = data.get('progress', goal.progress)
        if goal.progress >= 100:
            goal.progress = 100
            goal.status = 'Completed'
        goal.save(update_fields=['status', 'progress', 'updatedAt'])
        return Response(EmployeeGoalSerializer(goal).data)


class TeamGoalListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsTeamLeader]

    def get(self, request):
        goals = EmployeeGoal.objects.select_related('employee').filter(employee__isDeleted=False)

        if getattr(request.user, 'role', None) == 'TeamLeader':
            leader_employee = Employee.objects.filter(employeeID=getattr(request.user, 'employee_id', None), isDeleted=False).first()
            if leader_employee and leader_employee.team:
                goals = goals.filter(employee__team=leader_employee.team)
            else:
                goals = goals.none()

        employee_id = request.query_params.get('employee_id')
        team = request.query_params.get('team')
        status_filter = request.query_params.get('status')
        if employee_id:
            goals = goals.filter(employee_id=employee_id)
        if team:
            goals = goals.filter(employee__team__icontains=team)
        if status_filter:
            goals = goals.filter(status=status_filter)

        return Response(EmployeeGoalSerializer(goals, many=True).data)

    def post(self, request):
        serializer = EmployeeGoalCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage_employee(request.user, employee):
            return Response({'error': 'You do not have permission to manage this employee.'}, status=status.HTTP_403_FORBIDDEN)

        goal = EmployeeGoal.objects.create(
            employee=employee,
            title=serializer.validated_data['title'],
            description=serializer.validated_data.get('description', ''),
            category=serializer.validated_data.get('category', 'Performance'),
            priority=serializer.validated_data.get('priority', 'Medium'),
            status=serializer.validated_data.get('status', 'Not Started'),
            progress=serializer.validated_data.get('progress', 0),
            dueDate=serializer.validated_data.get('dueDate'),
            createdBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        return Response(EmployeeGoalSerializer(goal).data, status=status.HTTP_201_CREATED)


class TeamGoalDetailView(APIView):
    permission_classes = [IsAuthenticated, IsTeamLeader]

    def put(self, request, goal_id):
        try:
            goal = EmployeeGoal.objects.select_related('employee').get(pk=goal_id)
        except EmployeeGoal.DoesNotExist:
            return Response({'error': 'Goal not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not _can_manage_employee(request.user, goal.employee):
            return Response({'error': 'You do not have permission to manage this employee.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = EmployeeGoalCreateSerializer(data={
            'employeeID': goal.employee_id,
            **request.data,
        })
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        goal.title = data['title']
        goal.description = data.get('description', '')
        goal.category = data.get('category', goal.category)
        goal.priority = data.get('priority', goal.priority)
        goal.status = data.get('status', goal.status)
        goal.progress = data.get('progress', goal.progress)
        goal.dueDate = data.get('dueDate', goal.dueDate)
        if goal.progress >= 100:
            goal.progress = 100
            goal.status = 'Completed'
        goal.save()
        return Response(EmployeeGoalSerializer(goal).data)


class EmployeeTaskListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        tasks = WorkTask.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        if status_filter:
            tasks = tasks.filter(status=status_filter)

        return Response(WorkTaskSerializer(tasks, many=True).data)


class EmployeeTaskProgressView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, task_id):
        try:
            task = WorkTask.objects.select_related('employee').get(pk=task_id)
        except WorkTask.DoesNotExist:
            return Response({'error': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)

        request_employee_id = getattr(request.user, 'employee_id', None)
        if task.employee_id != request_employee_id and getattr(request.user, 'role', None) not in ('HRManager', 'Admin'):
            return Response({'error': 'You can only update your own tasks.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = WorkTaskProgressSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        task.status = data.get('status', task.status)
        task.progress = data.get('progress', task.progress)
        if task.progress >= 100:
            task.progress = 100
            task.status = 'Done'
        task.save(update_fields=['status', 'progress', 'updatedAt'])
        return Response(WorkTaskSerializer(task).data)


class TeamTaskListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsTeamLeader]

    def get(self, request):
        tasks = WorkTask.objects.select_related('employee').filter(employee__isDeleted=False)

        if getattr(request.user, 'role', None) == 'TeamLeader':
            leader_employee = Employee.objects.filter(employeeID=getattr(request.user, 'employee_id', None), isDeleted=False).first()
            if leader_employee and leader_employee.team:
                tasks = tasks.filter(employee__team=leader_employee.team)
            else:
                tasks = tasks.none()

        employee_id = request.query_params.get('employee_id')
        team = request.query_params.get('team')
        status_filter = request.query_params.get('status')
        if employee_id:
            tasks = tasks.filter(employee_id=employee_id)
        if team:
            tasks = tasks.filter(employee__team__icontains=team)
        if status_filter:
            tasks = tasks.filter(status=status_filter)

        return Response(WorkTaskSerializer(tasks, many=True).data)

    def post(self, request):
        serializer = WorkTaskCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage_employee(request.user, employee):
            return Response({'error': 'You do not have permission to manage this employee.'}, status=status.HTTP_403_FORBIDDEN)

        task = WorkTask.objects.create(
            employee=employee,
            title=serializer.validated_data['title'],
            description=serializer.validated_data.get('description', ''),
            priority=serializer.validated_data.get('priority', 'Medium'),
            status=serializer.validated_data.get('status', 'To Do'),
            progress=serializer.validated_data.get('progress', 0),
            estimatedHours=serializer.validated_data.get('estimatedHours'),
            dueDate=serializer.validated_data.get('dueDate'),
            assignedBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        if task.progress >= 100:
            task.progress = 100
            task.status = 'Done'
            task.save(update_fields=['progress', 'status'])
        return Response(WorkTaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TeamTaskDetailView(APIView):
    permission_classes = [IsAuthenticated, IsTeamLeader]

    def put(self, request, task_id):
        try:
            task = WorkTask.objects.select_related('employee').get(pk=task_id)
        except WorkTask.DoesNotExist:
            return Response({'error': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not _can_manage_employee(request.user, task.employee):
            return Response({'error': 'You do not have permission to manage this employee.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = WorkTaskCreateSerializer(data={
            'employeeID': task.employee_id,
            **request.data,
        })
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        task.title = data['title']
        task.description = data.get('description', '')
        task.priority = data.get('priority', task.priority)
        task.status = data.get('status', task.status)
        task.progress = data.get('progress', task.progress)
        task.estimatedHours = data.get('estimatedHours', task.estimatedHours)
        task.dueDate = data.get('dueDate', task.dueDate)
        if task.progress >= 100:
            task.progress = 100
            task.status = 'Done'
        task.save()
        return Response(WorkTaskSerializer(task).data)


class HRActionPlanListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        plans = WorkTask.objects.select_related('employee').filter(
            employee__isDeleted=False,
            assignedBy__startswith='ActionPlan:',
        )
        employee_id = (request.query_params.get('employee_id') or '').strip()
        status_filter = (request.query_params.get('status') or '').strip()
        priority_filter = (request.query_params.get('priority') or '').strip()
        search = (request.query_params.get('search') or '').strip()
        open_only = (request.query_params.get('open_only') or '').strip().lower()

        if employee_id:
            plans = plans.filter(employee_id=employee_id)
        if status_filter:
            plans = plans.filter(status__iexact=status_filter)
        if priority_filter:
            plans = plans.filter(priority__iexact=priority_filter)
        if search:
            plans = plans.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(employee__fullName__icontains=search)
                | Q(employee__employeeID__icontains=search)
            )
        if open_only in {'1', 'true', 'yes'}:
            plans = plans.exclude(status='Done')

        return Response(WorkTaskSerializer(plans.order_by('-createdAt', 'dueDate'), many=True).data)

    def post(self, request):
        serializer = WorkTaskCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        assigned_by = getattr(request.user, 'full_name', '') or getattr(request.user, 'email', '')
        plan = WorkTask.objects.create(
            employee=employee,
            title=serializer.validated_data['title'],
            description=serializer.validated_data.get('description', ''),
            priority=serializer.validated_data.get('priority', 'Medium'),
            status=serializer.validated_data.get('status', 'To Do'),
            progress=serializer.validated_data.get('progress', 0),
            estimatedHours=serializer.validated_data.get('estimatedHours'),
            dueDate=serializer.validated_data.get('dueDate'),
            assignedBy=f'ActionPlan:{assigned_by}',
        )
        if plan.progress >= 100:
            plan.progress = 100
            plan.status = 'Done'
            plan.save(update_fields=['progress', 'status'])
        return Response(WorkTaskSerializer(plan).data, status=status.HTTP_201_CREATED)


class HRActionPlanStatusView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, task_id):
        try:
            plan = WorkTask.objects.select_related('employee').get(
                pk=task_id,
                employee__isDeleted=False,
                assignedBy__startswith='ActionPlan:',
            )
        except WorkTask.DoesNotExist:
            return Response({'error': 'Action plan not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkTaskProgressSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        next_status = data.get('status', plan.status)
        next_progress = data.get('progress', plan.progress)

        allowed_transitions = {
            'To Do': {'To Do', 'In Progress', 'Blocked', 'Done'},
            'In Progress': {'In Progress', 'Blocked', 'Done'},
            'Blocked': {'Blocked', 'In Progress', 'Done'},
            'Done': {'Done'},
        }
        if next_status not in allowed_transitions.get(plan.status, {plan.status}):
            return Response({'error': f'Invalid status transition from {plan.status} to {next_status}.'}, status=status.HTTP_400_BAD_REQUEST)

        plan.status = next_status
        plan.progress = next_progress
        if plan.status == 'Done' or plan.progress >= 100:
            plan.status = 'Done'
            plan.progress = 100
        plan.save(update_fields=['status', 'progress', 'updatedAt'])
        return Response(WorkTaskSerializer(plan).data)


class EmployeeRecognitionListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        awards = RecognitionAward.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        category = request.query_params.get('category')
        if category:
            awards = awards.filter(category=category)

        return Response(RecognitionAwardSerializer(awards.order_by('-recognitionDate', '-createdAt'), many=True).data)


class TeamRecognitionListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsTeamLeader]

    def get(self, request):
        awards = RecognitionAward.objects.select_related('employee').filter(employee__isDeleted=False)

        if getattr(request.user, 'role', None) == 'TeamLeader':
            leader_employee = Employee.objects.filter(employeeID=getattr(request.user, 'employee_id', None), isDeleted=False).first()
            if leader_employee and leader_employee.team:
                awards = awards.filter(employee__team=leader_employee.team)
            else:
                awards = awards.none()

        employee_id = request.query_params.get('employee_id')
        team = request.query_params.get('team')
        category = request.query_params.get('category')
        if employee_id:
            awards = awards.filter(employee_id=employee_id)
        if team:
            awards = awards.filter(employee__team__icontains=team)
        if category:
            awards = awards.filter(category=category)

        return Response(RecognitionAwardSerializer(awards.order_by('-recognitionDate', '-createdAt'), many=True).data)

    def post(self, request):
        serializer = RecognitionAwardCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage_employee(request.user, employee):
            return Response({'error': 'You do not have permission to manage this employee.'}, status=status.HTTP_403_FORBIDDEN)

        award = RecognitionAward.objects.create(
            employee=employee,
            title=serializer.validated_data['title'],
            category=serializer.validated_data.get('category', 'Achievement'),
            message=serializer.validated_data.get('message', ''),
            points=serializer.validated_data.get('points', 0),
            recognitionDate=serializer.validated_data.get('recognitionDate') or timezone.localdate(),
            recognizedBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        return Response(RecognitionAwardSerializer(award).data, status=status.HTTP_201_CREATED)


class HRRecognitionWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        awards = list(
            RecognitionAward.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-recognitionDate', '-createdAt')
        )
        employees = list(
            Employee.objects.filter(isDeleted=False)
            .exclude(employmentStatus='Terminated')
            .order_by('fullName')
        )

        awards_by_employee = {}
        category_map = {}
        for award in awards:
            awards_by_employee.setdefault(award.employee_id, []).append(award)
            entry = category_map.setdefault(award.category, {
                'category': award.category,
                'count': 0,
                'points': 0,
                'recentCount': 0,
                'employeeIDs': set(),
            })
            entry['count'] += 1
            entry['points'] += int(award.points or 0)
            if award.recognitionDate and award.recognitionDate >= month_start:
                entry['recentCount'] += 1
            entry['employeeIDs'].add(award.employee_id)

        follow_up_items = []
        stale_count = 0
        for employee in employees:
            employee_awards = awards_by_employee.get(employee.employeeID, [])
            if not employee_awards:
                follow_up_items.append({
                    'employeeID': employee.employeeID,
                    'employeeName': employee.fullName,
                    'department': employee.department,
                    'jobTitle': employee.jobTitle,
                    'team': employee.team,
                    'recognitionCount': 0,
                    'totalPoints': 0,
                    'lastRecognizedAt': None,
                    'daysSinceRecognition': None,
                    'followUpState': 'Recognition Gap',
                    'summary': 'No recognition awards are recorded for this employee yet.',
                    'path': '/hr/dashboard',
                })
                continue

            latest_award = max(
                employee_awards,
                key=lambda item: ((item.recognitionDate or today), (item.createdAt or timezone.now())),
            )
            last_date = latest_award.recognitionDate or today
            days_since = max((today - last_date).days, 0)
            total_points = sum(int(item.points or 0) for item in employee_awards)

            if days_since >= 30:
                stale_count += 1
                follow_up_items.append({
                    'employeeID': employee.employeeID,
                    'employeeName': employee.fullName,
                    'department': employee.department,
                    'jobTitle': employee.jobTitle,
                    'team': employee.team,
                    'recognitionCount': len(employee_awards),
                    'totalPoints': total_points,
                    'lastRecognizedAt': last_date.isoformat() if last_date else None,
                    'daysSinceRecognition': days_since,
                    'followUpState': 'Reignite Recognition' if days_since >= 45 else 'Check-In Due',
                    'summary': latest_award.message or f'Last recognition was {days_since} day(s) ago and may need a fresh check-in.',
                    'path': '/hr/dashboard',
                })

        state_rank = {
            'Recognition Gap': 0,
            'Reignite Recognition': 1,
            'Check-In Due': 2,
        }
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                state_rank.get(item['followUpState'], 9),
                -(item['daysSinceRecognition'] or 0),
                item['employeeName'],
            ),
        )[:8]

        category_breakdown = sorted(
            [
                {
                    'category': key,
                    'count': value['count'],
                    'points': value['points'],
                    'recentCount': value['recentCount'],
                    'employeeCount': len(value['employeeIDs']),
                }
                for key, value in category_map.items()
            ],
            key=lambda item: (-item['count'], -item['points'], item['category']),
        )

        return Response({
            'summary': {
                'totalAwards': len(awards),
                'recognizedThisMonth': sum(1 for award in awards if award.recognitionDate and award.recognitionDate >= month_start),
                'recognizedEmployees': len(awards_by_employee),
                'employeesWithoutRecognition': sum(1 for employee in employees if employee.employeeID not in awards_by_employee),
                'staleRecognitionCount': stale_count,
                'totalPoints': sum(int(award.points or 0) for award in awards),
                'followUpCount': len(follow_up_items),
            },
            'categoryBreakdown': category_breakdown,
            'followUpItems': follow_up_items,
        })


class EmployeeBenefitListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        benefits = BenefitEnrollment.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        benefit_type = request.query_params.get('benefit_type')
        if status_filter:
            benefits = benefits.filter(status=status_filter)
        if benefit_type:
            benefits = benefits.filter(benefitType=benefit_type)

        return Response(BenefitEnrollmentSerializer(benefits.order_by('-effectiveDate', '-createdAt'), many=True).data)


class EmployeeBenefitStatusView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, enrollment_id):
        try:
            benefit = BenefitEnrollment.objects.select_related('employee').get(pk=enrollment_id)
        except BenefitEnrollment.DoesNotExist:
            return Response({'error': 'Benefit enrollment not found.'}, status=status.HTTP_404_NOT_FOUND)

        request_employee_id = getattr(request.user, 'employee_id', None)
        if benefit.employee_id != request_employee_id and getattr(request.user, 'role', None) not in ('HRManager', 'Admin'):
            return Response({'error': 'You can only update your own benefits.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = BenefitEnrollmentStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        benefit.status = data.get('status', benefit.status)
        benefit.employeeNote = data.get('note', benefit.employeeNote)
        benefit.acknowledgedAt = timezone.now()
        benefit.save(update_fields=['status', 'employeeNote', 'acknowledgedAt', 'updatedAt'])
        return Response(BenefitEnrollmentSerializer(benefit).data)


class HRBenefitWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        today = timezone.localdate()
        benefits = list(
            BenefitEnrollment.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-effectiveDate', '-createdAt')
        )

        def due_state(item):
            if item.status != 'Pending':
                return item.status
            if item.effectiveDate:
                if item.effectiveDate < today:
                    return 'Overdue'
                if item.effectiveDate <= today + timedelta(days=7):
                    return 'Due Soon'
            return 'Pending Review'

        follow_up_items = []
        type_map = {}
        total_monthly_cost = Decimal('0')
        total_employee_contribution = Decimal('0')

        for item in benefits:
            benefit_type_entry = type_map.setdefault(item.benefitType, {
                'benefitType': item.benefitType,
                'count': 0,
                'pendingCount': 0,
                'enrolledCount': 0,
                'waivedCount': 0,
                'monthlyCost': 0.0,
            })
            benefit_type_entry['count'] += 1
            benefit_type_entry['monthlyCost'] += float(item.monthlyCost or 0)

            if item.status == 'Pending':
                benefit_type_entry['pendingCount'] += 1
            elif item.status == 'Enrolled':
                benefit_type_entry['enrolledCount'] += 1
            elif item.status == 'Waived':
                benefit_type_entry['waivedCount'] += 1

            total_monthly_cost += item.monthlyCost or Decimal('0')
            total_employee_contribution += item.employeeContribution or Decimal('0')

            item_due_state = due_state(item)
            if item_due_state in {'Overdue', 'Due Soon', 'Pending Review'}:
                days_to_effective = (item.effectiveDate - today).days if item.effectiveDate else None
                contribution_rate = 0
                if item.monthlyCost:
                    contribution_rate = round((float(item.employeeContribution or 0) / float(item.monthlyCost)) * 100)
                follow_up_items.append({
                    'enrollmentID': item.enrollmentID,
                    'employeeName': item.employee.fullName,
                    'employeeID': item.employee_id,
                    'benefitName': item.benefitName,
                    'benefitType': item.benefitType,
                    'status': item.status,
                    'dueState': item_due_state,
                    'effectiveDate': item.effectiveDate.isoformat() if item.effectiveDate else None,
                    'daysToEffective': days_to_effective,
                    'contributionRate': contribution_rate,
                    'summary': item.notes or 'Benefit enrollment is still waiting for employee confirmation.',
                    'path': '/hr/benefits',
                })

        priority_order = {'Overdue': 0, 'Due Soon': 1, 'Pending Review': 2}
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                priority_order.get(item['dueState'], 9),
                item['daysToEffective'] if item['daysToEffective'] is not None else 999,
                item['employeeName'],
            ),
        )[:8]

        benefit_type_breakdown = sorted(
            type_map.values(),
            key=lambda item: (-item['pendingCount'], -item['count'], item['benefitType']),
        )

        return Response({
            'summary': {
                'totalEnrollments': len(benefits),
                'pendingCount': sum(1 for item in benefits if item.status == 'Pending'),
                'enrolledCount': sum(1 for item in benefits if item.status == 'Enrolled'),
                'waivedCount': sum(1 for item in benefits if item.status == 'Waived'),
                'overdueCount': sum(1 for item in benefits if due_state(item) == 'Overdue'),
                'dueSoonCount': sum(1 for item in benefits if due_state(item) == 'Due Soon'),
                'followUpCount': len(follow_up_items),
                'totalMonthlyCost': round(float(total_monthly_cost), 2),
                'employeeContributionTotal': round(float(total_employee_contribution), 2),
            },
            'benefitTypeBreakdown': benefit_type_breakdown,
            'followUpItems': follow_up_items,
        })


class HRBenefitListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        benefits = BenefitEnrollment.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        benefit_type = request.query_params.get('benefit_type')
        status_filter = request.query_params.get('status')
        if employee_id:
            benefits = benefits.filter(employee_id=employee_id)
        if benefit_type:
            benefits = benefits.filter(benefitType=benefit_type)
        if status_filter:
            benefits = benefits.filter(status=status_filter)

        return Response(BenefitEnrollmentSerializer(benefits.order_by('-effectiveDate', '-createdAt'), many=True).data)

    def post(self, request):
        serializer = BenefitEnrollmentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        benefit = BenefitEnrollment.objects.create(
            employee=employee,
            benefitName=serializer.validated_data['benefitName'],
            benefitType=serializer.validated_data.get('benefitType', 'Medical'),
            provider=serializer.validated_data.get('provider', ''),
            coverageLevel=serializer.validated_data.get('coverageLevel', ''),
            status=serializer.validated_data.get('status', 'Pending'),
            monthlyCost=serializer.validated_data.get('monthlyCost', 0),
            employeeContribution=serializer.validated_data.get('employeeContribution', 0),
            effectiveDate=serializer.validated_data.get('effectiveDate'),
            notes=serializer.validated_data.get('notes', ''),
            createdBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        return Response(BenefitEnrollmentSerializer(benefit).data, status=status.HTTP_201_CREATED)


class EmployeeExpenseListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        claims = ExpenseClaim.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        category = request.query_params.get('category')
        if status_filter:
            claims = claims.filter(status=status_filter)
        if category:
            claims = claims.filter(category=category)

        return Response(ExpenseClaimSerializer(claims.order_by('-expenseDate', '-createdAt'), many=True).data)

    def post(self, request):
        serializer = ExpenseClaimCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee_id = getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        employee = Employee.objects.filter(employeeID=employee_id, isDeleted=False).first()
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        claim = ExpenseClaim.objects.create(
            employee=employee,
            title=serializer.validated_data['title'],
            category=serializer.validated_data.get('category', 'Other'),
            amount=serializer.validated_data['amount'],
            expenseDate=serializer.validated_data['expenseDate'],
            description=serializer.validated_data.get('description', ''),
            status='Submitted',
        )
        return Response(ExpenseClaimSerializer(claim).data, status=status.HTTP_201_CREATED)


class HRExpenseWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        today = timezone.localdate()
        claims = list(
            ExpenseClaim.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-expenseDate', '-createdAt')
        )

        def follow_up_state(claim):
            age_days = max((timezone.now() - (claim.createdAt or timezone.now())).days, 0)
            if claim.status == 'Submitted':
                if age_days >= 4:
                    return 'Overdue Review'
                if age_days >= 2:
                    return 'Needs Review'
            if claim.status == 'Approved':
                return 'Awaiting Reimbursement'
            return claim.status

        follow_up_items = []
        category_map = {}
        total_amount = Decimal('0')
        for claim in claims:
            entry = category_map.setdefault(claim.category, {
                'category': claim.category,
                'count': 0,
                'submittedCount': 0,
                'approvedCount': 0,
                'reimbursedCount': 0,
                'amount': 0.0,
            })
            entry['count'] += 1
            entry['amount'] += float(claim.amount or 0)
            total_amount += claim.amount or Decimal('0')

            if claim.status == 'Submitted':
                entry['submittedCount'] += 1
            elif claim.status == 'Approved':
                entry['approvedCount'] += 1
            elif claim.status == 'Reimbursed':
                entry['reimbursedCount'] += 1

            state = follow_up_state(claim)
            if state in {'Overdue Review', 'Needs Review', 'Awaiting Reimbursement'}:
                age_days = max((timezone.now() - (claim.createdAt or timezone.now())).days, 0)
                follow_up_items.append({
                    'claimID': claim.claimID,
                    'employeeName': claim.employee.fullName,
                    'employeeID': claim.employee_id,
                    'title': claim.title,
                    'category': claim.category,
                    'amount': round(float(claim.amount or 0), 2),
                    'status': claim.status,
                    'followUpState': state,
                    'ageDays': age_days,
                    'expenseDate': claim.expenseDate.isoformat() if claim.expenseDate else None,
                    'summary': claim.reviewNote or claim.description or 'Expense claim requires finance follow-up.',
                    'path': '/hr/expenses',
                })

        state_rank = {'Overdue Review': 0, 'Needs Review': 1, 'Awaiting Reimbursement': 2}
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (state_rank.get(item['followUpState'], 9), -item['ageDays'], -item['amount']),
        )[:8]

        category_breakdown = sorted(
            category_map.values(),
            key=lambda item: (-item['submittedCount'], -item['amount'], item['category']),
        )

        return Response({
            'summary': {
                'totalClaims': len(claims),
                'submittedCount': sum(1 for claim in claims if claim.status == 'Submitted'),
                'approvedCount': sum(1 for claim in claims if claim.status == 'Approved'),
                'reimbursedCount': sum(1 for claim in claims if claim.status == 'Reimbursed'),
                'overdueCount': sum(1 for claim in claims if follow_up_state(claim) == 'Overdue Review'),
                'followUpCount': len(follow_up_items),
                'totalAmount': round(float(total_amount), 2),
            },
            'categoryBreakdown': category_breakdown,
            'followUpItems': follow_up_items,
        })


class HRExpenseListView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        claims = ExpenseClaim.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        status_filter = request.query_params.get('status')
        category = request.query_params.get('category')
        if employee_id:
            claims = claims.filter(employee_id=employee_id)
        if status_filter:
            claims = claims.filter(status=status_filter)
        if category:
            claims = claims.filter(category=category)

        return Response(ExpenseClaimSerializer(claims.order_by('-expenseDate', '-createdAt'), many=True).data)


class HRExpenseReviewView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, claim_id):
        try:
            claim = ExpenseClaim.objects.select_related('employee').get(pk=claim_id)
        except ExpenseClaim.DoesNotExist:
            return Response({'error': 'Expense claim not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ExpenseClaimReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        next_status = serializer.validated_data['status']
        allowed_transitions = {
            'Submitted': {'Approved', 'Rejected', 'Reimbursed'},
            'Approved': {'Approved', 'Reimbursed'},
            'Rejected': {'Rejected'},
            'Reimbursed': {'Reimbursed'},
        }
        if next_status not in allowed_transitions.get(claim.status, {claim.status}):
            return Response({'error': f'Invalid expense status transition from {claim.status} to {next_status}.'}, status=status.HTTP_400_BAD_REQUEST)

        claim.status = next_status
        claim.reviewNote = serializer.validated_data.get('note', '')
        claim.reviewedBy = getattr(request.user, 'full_name', '') or getattr(request.user, 'email', '')
        claim.reviewedAt = timezone.now()
        claim.save(update_fields=['status', 'reviewNote', 'reviewedBy', 'reviewedAt', 'updatedAt'])
        return Response(ExpenseClaimSerializer(claim).data)


class EmployeeDocumentListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        documents = DocumentRequest.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        if status_filter:
            documents = documents.filter(status=status_filter)

        return Response(DocumentRequestSerializer(documents.order_by('-createdAt'), many=True).data)

    def post(self, request):
        serializer = DocumentRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee_id = getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        employee = Employee.objects.filter(employeeID=employee_id, isDeleted=False).first()
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        document = DocumentRequest.objects.create(
            employee=employee,
            documentType=serializer.validated_data.get('documentType', 'Employment Letter'),
            purpose=serializer.validated_data['purpose'],
            notes=serializer.validated_data.get('notes', ''),
            status='Pending',
        )
        return Response(DocumentRequestSerializer(document).data, status=status.HTTP_201_CREATED)


class HRDocumentListView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        documents = DocumentRequest.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        status_filter = request.query_params.get('status')
        document_type = request.query_params.get('document_type')
        if employee_id:
            documents = documents.filter(employee_id=employee_id)
        if status_filter:
            documents = documents.filter(status=status_filter)
        if document_type:
            documents = documents.filter(documentType=document_type)

        return Response(DocumentRequestSerializer(documents.order_by('-createdAt'), many=True).data)


class HRDocumentWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        now = timezone.now()
        documents = list(
            DocumentRequest.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-updatedAt', '-createdAt')
        )

        def follow_up_state(document):
            age_days = max((now - (document.createdAt or now)).days, 0)
            if document.status == 'Pending':
                if age_days >= 3:
                    return 'Overdue'
                return 'Pending Intake'
            if document.status == 'In Progress':
                if age_days >= 2:
                    return 'Awaiting Finalization'
                return 'In Progress'
            return document.status

        type_map = {}
        follow_up_items = []

        for document in documents:
            entry = type_map.setdefault(document.documentType, {
                'documentType': document.documentType,
                'count': 0,
                'pendingCount': 0,
                'inProgressCount': 0,
                'issuedCount': 0,
                'declinedCount': 0,
            })
            entry['count'] += 1
            if document.status == 'Pending':
                entry['pendingCount'] += 1
            elif document.status == 'In Progress':
                entry['inProgressCount'] += 1
            elif document.status == 'Issued':
                entry['issuedCount'] += 1
            elif document.status == 'Declined':
                entry['declinedCount'] += 1

            state = follow_up_state(document)
            if state in {'Overdue', 'Pending Intake', 'Awaiting Finalization', 'In Progress'}:
                age_days = max((now - (document.createdAt or now)).days, 0)
                follow_up_items.append({
                    'requestID': document.requestID,
                    'employeeName': document.employee.fullName,
                    'employeeID': document.employee_id,
                    'documentType': document.documentType,
                    'purpose': document.purpose,
                    'status': document.status,
                    'followUpState': state,
                    'ageDays': age_days,
                    'requestedAt': document.createdAt.isoformat() if document.createdAt else None,
                    'summary': document.reviewNote or document.notes or 'Document request is waiting for HR issuance follow-up.',
                    'path': '/hr/documents',
                })

        state_rank = {
            'Overdue': 0,
            'Awaiting Finalization': 1,
            'Pending Intake': 2,
            'In Progress': 3,
        }
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                state_rank.get(item['followUpState'], 9),
                -item['ageDays'],
                item['employeeName'],
            ),
        )[:8]

        document_type_breakdown = sorted(
            type_map.values(),
            key=lambda item: (-item['pendingCount'], -item['inProgressCount'], -item['count'], item['documentType']),
        )

        return Response({
            'summary': {
                'totalRequests': len(documents),
                'pendingCount': sum(1 for document in documents if document.status == 'Pending'),
                'inProgressCount': sum(1 for document in documents if document.status == 'In Progress'),
                'issuedCount': sum(1 for document in documents if document.status == 'Issued'),
                'declinedCount': sum(1 for document in documents if document.status == 'Declined'),
                'overdueCount': sum(1 for document in documents if follow_up_state(document) == 'Overdue'),
                'followUpCount': len(follow_up_items),
            },
            'documentTypeBreakdown': document_type_breakdown,
            'followUpItems': follow_up_items,
        })


class HRDocumentIssueView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, request_id):
        try:
            document = DocumentRequest.objects.select_related('employee').get(pk=request_id)
        except DocumentRequest.DoesNotExist:
            return Response({'error': 'Document request not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DocumentRequestIssueSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        next_status = serializer.validated_data['status']
        allowed_transitions = {
            'Pending': {'In Progress', 'Issued', 'Declined'},
            'In Progress': {'In Progress', 'Issued', 'Declined'},
            'Issued': {'Issued'},
            'Declined': {'Declined'},
        }
        if next_status not in allowed_transitions.get(document.status, {document.status}):
            return Response({'error': f'Invalid document status transition from {document.status} to {next_status}.'}, status=status.HTTP_400_BAD_REQUEST)

        document.status = next_status
        document.reviewNote = serializer.validated_data.get('note', '')
        document.issuedBy = getattr(request.user, 'full_name', '') or getattr(request.user, 'email', '')
        if document.status == 'Issued':
            document.issuedAt = timezone.now()
        document.save(update_fields=['status', 'reviewNote', 'issuedBy', 'issuedAt', 'updatedAt'])
        return Response(DocumentRequestSerializer(document).data)


class EmployeeTicketListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        tickets = SupportTicket.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        category = request.query_params.get('category')
        if status_filter:
            tickets = tickets.filter(status=status_filter)
        if category:
            tickets = tickets.filter(category=category)

        return Response(SupportTicketSerializer(tickets.order_by('-updatedAt', '-createdAt'), many=True).data)

    def post(self, request):
        serializer = SupportTicketCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee_id = getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        employee = Employee.objects.filter(employeeID=employee_id, isDeleted=False).first()
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        ticket = SupportTicket.objects.create(
            employee=employee,
            subject=serializer.validated_data['subject'],
            category=serializer.validated_data.get('category', 'General'),
            priority=serializer.validated_data.get('priority', 'Medium'),
            description=serializer.validated_data.get('description', ''),
            status='Open',
        )
        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class HRTicketListView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        tickets = SupportTicket.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        status_filter = request.query_params.get('status')
        category = request.query_params.get('category')
        if employee_id:
            tickets = tickets.filter(employee_id=employee_id)
        if status_filter:
            tickets = tickets.filter(status=status_filter)
        if category:
            tickets = tickets.filter(category=category)

        return Response(SupportTicketSerializer(tickets.order_by('-updatedAt', '-createdAt'), many=True).data)


class HRTicketWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        now = timezone.now()
        tickets = list(
            SupportTicket.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-updatedAt', '-createdAt')
        )

        def follow_up_state(ticket):
            last_touch = ticket.updatedAt or ticket.createdAt or now
            age_days = max((now - last_touch).days, 0)
            if ticket.status == 'Open':
                if ticket.priority == 'Critical' or age_days >= 3:
                    return 'Escalate Now'
                if ticket.priority == 'High' or age_days >= 1:
                    return 'Needs Assignment'
            if ticket.status == 'In Progress':
                if ticket.priority in {'Critical', 'High'} or age_days >= 2:
                    return 'Stalled Resolution'
                return 'In Progress'
            if ticket.status == 'Resolved':
                return 'Pending Closure'
            return ticket.status

        follow_up_items = []
        category_map = {}

        for ticket in tickets:
            entry = category_map.setdefault(ticket.category, {
                'category': ticket.category,
                'count': 0,
                'openCount': 0,
                'inProgressCount': 0,
                'resolvedCount': 0,
                'criticalCount': 0,
            })
            entry['count'] += 1
            if ticket.status == 'Open':
                entry['openCount'] += 1
            elif ticket.status == 'In Progress':
                entry['inProgressCount'] += 1
            elif ticket.status == 'Resolved':
                entry['resolvedCount'] += 1
            if ticket.priority == 'Critical':
                entry['criticalCount'] += 1

            state = follow_up_state(ticket)
            if state in {'Escalate Now', 'Needs Assignment', 'Stalled Resolution', 'Pending Closure'}:
                last_touch = ticket.updatedAt or ticket.createdAt or now
                age_days = max((now - last_touch).days, 0)
                follow_up_items.append({
                    'ticketID': ticket.ticketID,
                    'employeeName': ticket.employee.fullName,
                    'employeeID': ticket.employee_id,
                    'subject': ticket.subject,
                    'category': ticket.category,
                    'priority': ticket.priority,
                    'status': ticket.status,
                    'followUpState': state,
                    'ageDays': age_days,
                    'lastTouchAt': last_touch.isoformat() if last_touch else None,
                    'summary': ticket.resolutionNote or ticket.description or 'Support ticket needs an HR follow-up update.',
                    'path': '/hr/tickets',
                })

        state_rank = {
            'Escalate Now': 0,
            'Stalled Resolution': 1,
            'Needs Assignment': 2,
            'Pending Closure': 3,
        }
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                state_rank.get(item['followUpState'], 9),
                -item['ageDays'],
                item['employeeName'],
            ),
        )[:8]

        category_breakdown = sorted(
            category_map.values(),
            key=lambda item: (-item['criticalCount'], -item['openCount'], -item['count'], item['category']),
        )

        return Response({
            'summary': {
                'totalTickets': len(tickets),
                'openCount': sum(1 for ticket in tickets if ticket.status == 'Open'),
                'inProgressCount': sum(1 for ticket in tickets if ticket.status == 'In Progress'),
                'resolvedCount': sum(1 for ticket in tickets if ticket.status == 'Resolved'),
                'closedCount': sum(1 for ticket in tickets if ticket.status == 'Closed'),
                'criticalCount': sum(1 for ticket in tickets if ticket.priority == 'Critical'),
                'followUpCount': len(follow_up_items),
            },
            'categoryBreakdown': category_breakdown,
            'followUpItems': follow_up_items,
        })


class HRTicketStatusView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, ticket_id):
        try:
            ticket = SupportTicket.objects.select_related('employee').get(pk=ticket_id)
        except SupportTicket.DoesNotExist:
            return Response({'error': 'Support ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SupportTicketStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        next_status = serializer.validated_data['status']
        allowed_transitions = {
            'Open': {'In Progress', 'Resolved', 'Closed'},
            'In Progress': {'In Progress', 'Resolved', 'Closed'},
            'Resolved': {'Resolved', 'Closed'},
            'Closed': {'Closed'},
        }
        if next_status not in allowed_transitions.get(ticket.status, {ticket.status}):
            return Response({'error': f'Invalid ticket status transition from {ticket.status} to {next_status}.'}, status=status.HTTP_400_BAD_REQUEST)

        ticket.status = next_status
        ticket.resolutionNote = serializer.validated_data.get('note', '')
        ticket.assignedTo = getattr(request.user, 'full_name', '') or getattr(request.user, 'email', '')
        if ticket.status in ('Resolved', 'Closed'):
            ticket.resolvedAt = timezone.now()
        ticket.save(update_fields=['status', 'resolutionNote', 'assignedTo', 'resolvedAt', 'updatedAt'])
        return Response(SupportTicketSerializer(ticket).data)


class EmployeeTrainingListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        courses = [
            course for course in TrainingCourse.objects.all().order_by('dueDate', '-createdAt')
            if employee_id in (course.assignedEmployeeIDs or [])
        ]
        return Response(TrainingCourseSerializer(courses, many=True, context={'employee_id': employee_id}).data)


class EmployeeTrainingProgressView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, course_id):
        try:
            course = TrainingCourse.objects.get(pk=course_id)
        except TrainingCourse.DoesNotExist:
            return Response({'error': 'Training course not found.'}, status=status.HTTP_404_NOT_FOUND)

        employee_id = getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if employee_id not in (course.assignedEmployeeIDs or []) and getattr(request.user, 'role', None) not in ('HRManager', 'Admin'):
            return Response({'error': 'This course is not assigned to you.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = TrainingProgressSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        completion_data = course.completionData or {}
        status_value = data.get('status', 'In Progress')
        progress_value = data.get('progress', 0)
        if status_value == 'Completed' or progress_value >= 100:
            status_value = 'Completed'
            progress_value = 100

        completion_data[employee_id] = {
            'status': status_value,
            'progress': progress_value,
            'updatedAt': timezone.now().isoformat(),
        }
        course.completionData = completion_data
        course.save(update_fields=['completionData'])
        return Response(TrainingCourseSerializer(course, context={'employee_id': employee_id}).data)


class HRTrainingListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        courses = TrainingCourse.objects.all().order_by('dueDate', '-createdAt')
        category = request.query_params.get('category')
        if category:
            courses = courses.filter(category=category)
        return Response(TrainingCourseSerializer(courses, many=True).data)

    def post(self, request):
        serializer = TrainingCourseCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        assigned_ids = serializer.validated_data.get('assignedEmployeeIDs', [])
        missing_ids = [
            employee_id for employee_id in assigned_ids
            if not Employee.objects.filter(employeeID=employee_id, isDeleted=False).exists()
        ]
        if missing_ids:
            return Response({'error': f'Employees not found: {", ".join(missing_ids)}'}, status=status.HTTP_400_BAD_REQUEST)

        course = TrainingCourse.objects.create(
            title=serializer.validated_data['title'],
            description=serializer.validated_data.get('description', ''),
            category=serializer.validated_data.get('category', 'Technical'),
            durationHours=serializer.validated_data.get('durationHours', 1),
            assignedEmployeeIDs=assigned_ids,
            completionData={employee_id: {'status': 'Not Started', 'progress': 0} for employee_id in assigned_ids},
            dueDate=serializer.validated_data.get('dueDate'),
            createdBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        return Response(TrainingCourseSerializer(course).data, status=status.HTTP_201_CREATED)


def _get_training_due_state(course, pending_count, today):
    if pending_count <= 0:
        return 'Completed'
    if course.dueDate and course.dueDate < today:
        return 'Overdue'
    if course.dueDate and course.dueDate <= today + timedelta(days=7):
        return 'Due Soon'
    if course.dueDate:
        return 'On Track'
    return 'No Due Date'


class HRTrainingComplianceView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        today = timezone.localdate()
        employees = {
            employee.employeeID: employee
            for employee in Employee.objects.filter(isDeleted=False)
        }
        courses = list(TrainingCourse.objects.all().order_by('dueDate', '-createdAt'))

        follow_up_items = []
        total_completion_rate = 0
        fully_completed = 0

        for course in courses:
            assigned_ids = list(dict.fromkeys(course.assignedEmployeeIDs or []))
            completion_data = course.completionData or {}

            completed_count = 0
            in_progress_count = 0
            not_started_count = 0
            outstanding_employee_ids = []

            for employee_id in assigned_ids:
                employee_progress = completion_data.get(employee_id, {}) or {}
                status_value = employee_progress.get('status', 'Not Started')
                if status_value == 'Completed':
                    completed_count += 1
                elif status_value == 'In Progress':
                    in_progress_count += 1
                    outstanding_employee_ids.append(employee_id)
                else:
                    not_started_count += 1
                    outstanding_employee_ids.append(employee_id)

            pending_count = len(outstanding_employee_ids)
            completion_rate = round((completed_count / max(len(assigned_ids), 1)) * 100) if assigned_ids else 100
            total_completion_rate += completion_rate
            due_state = _get_training_due_state(course, pending_count, today)

            if pending_count == 0:
                fully_completed += 1
                continue

            follow_up_items.append({
                'courseID': course.courseID,
                'title': course.title,
                'category': course.category,
                'dueDate': course.dueDate,
                'dueState': due_state,
                'assignedCount': len(assigned_ids),
                'completedCount': completed_count,
                'inProgressCount': in_progress_count,
                'notStartedCount': not_started_count,
                'pendingEmployees': pending_count,
                'completionRate': completion_rate,
                'recommendedAction': (
                    'Escalate completion reminders for overdue mandatory training.'
                    if due_state == 'Overdue'
                    else 'Nudge learners and managers before the deadline.'
                    if due_state == 'Due Soon'
                    else 'Keep completion progress under weekly review.'
                ),
                'employees': [
                    {
                        'employeeID': employee_id,
                        'employeeName': employees[employee_id].fullName if employee_id in employees else employee_id,
                        'department': employees[employee_id].department if employee_id in employees else '',
                        'team': employees[employee_id].team if employee_id in employees else '',
                        'status': (completion_data.get(employee_id, {}) or {}).get('status', 'Not Started'),
                        'progress': (completion_data.get(employee_id, {}) or {}).get('progress', 0),
                    }
                    for employee_id in outstanding_employee_ids[:5]
                ],
            })

        severity_order = {'Overdue': 3, 'Due Soon': 2, 'On Track': 1, 'No Due Date': 0}
        follow_up_items.sort(
            key=lambda item: (severity_order.get(item['dueState'], 0), item['pendingEmployees'], -item['completionRate']),
            reverse=True,
        )

        category_breakdown = [
            {
                'category': category,
                'courses': sum(1 for course in courses if course.category == category),
                'overdue': sum(1 for item in follow_up_items if item['category'] == category and item['dueState'] == 'Overdue'),
                'dueSoon': sum(1 for item in follow_up_items if item['category'] == category and item['dueState'] == 'Due Soon'),
            }
            for category in ['Compliance', 'Leadership', 'Technical', 'Soft Skills']
        ]

        return Response({
            'summary': {
                'trackedCourses': len(courses),
                'completedCourses': fully_completed,
                'overdueCourses': sum(1 for item in follow_up_items if item['dueState'] == 'Overdue'),
                'dueSoonCourses': sum(1 for item in follow_up_items if item['dueState'] == 'Due Soon'),
                'atRiskAssignments': sum(item['pendingEmployees'] for item in follow_up_items),
                'averageCompletionRate': round(total_completion_rate / len(courses)) if courses else 100,
            },
            'categoryBreakdown': category_breakdown,
            'followUpItems': follow_up_items[:8],
        })


class EmployeeReviewListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        reviews = PerformanceReview.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        if status_filter:
            reviews = reviews.filter(status=status_filter)

        return Response(PerformanceReviewSerializer(reviews.order_by('-reviewDate', '-createdAt'), many=True).data)


class EmployeeReviewAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, review_id):
        try:
            review = PerformanceReview.objects.select_related('employee').get(pk=review_id)
        except PerformanceReview.DoesNotExist:
            return Response({'error': 'Performance review not found.'}, status=status.HTTP_404_NOT_FOUND)

        request_employee_id = getattr(request.user, 'employee_id', None)
        if review.employee_id != request_employee_id and getattr(request.user, 'role', None) not in ('HRManager', 'Admin'):
            return Response({'error': 'You can only acknowledge your own reviews.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = PerformanceReviewAcknowledgeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        review.employeeNote = serializer.validated_data.get('note', review.employeeNote)
        review.status = 'Acknowledged'
        review.acknowledgedAt = timezone.now()
        review.save(update_fields=['employeeNote', 'status', 'acknowledgedAt', 'updatedAt'])
        return Response(PerformanceReviewSerializer(review).data)


class HRReviewCalibrationView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        reviews = list(
            PerformanceReview.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-reviewDate', '-createdAt')
        )
        plans = list(
            SuccessionPlan.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-updatedAt', '-createdAt')
        )

        latest_plan_by_employee = {}
        for plan in plans:
            latest_plan_by_employee.setdefault(plan.employee_id, plan)

        def get_priority(review, plan):
            if review.overallRating <= 2:
                return 'Critical'
            if review.status != 'Acknowledged' or (plan and plan.retentionRisk == 'High'):
                return 'High'
            if plan and plan.readiness == 'Ready Now' and review.overallRating >= 4:
                return 'Opportunity'
            return 'Watch'

        def get_reasons(review, plan):
            reasons = []
            if review.status != 'Acknowledged':
                reasons.append('Pending employee acknowledgement')
            if review.overallRating <= 2:
                reasons.append('Low performance rating')
            if plan and plan.retentionRisk == 'High':
                reasons.append('High retention risk for key talent')
            if plan and plan.readiness == 'Ready Now' and review.overallRating >= 4:
                reasons.append('Ready-now talent for succession planning')
            return reasons

        follow_up_items = []
        for review in reviews:
            plan = latest_plan_by_employee.get(review.employee_id)
            reasons = get_reasons(review, plan)
            if not reasons:
                continue

            priority = get_priority(review, plan)
            follow_up_items.append({
                'reviewID': review.reviewID,
                'employeeID': review.employee.employeeID,
                'employeeName': review.employee.fullName,
                'department': review.employee.department,
                'team': review.employee.team,
                'reviewPeriod': review.reviewPeriod,
                'reviewType': review.reviewType,
                'overallRating': review.overallRating,
                'status': review.status,
                'priority': priority,
                'retentionRisk': plan.retentionRisk if plan else 'Low',
                'readiness': plan.readiness if plan else 'Unassigned',
                'recommendedAction': reasons[0],
                'reasons': reasons,
            })

        priority_order = {'Critical': 3, 'High': 2, 'Opportunity': 1, 'Watch': 0}
        follow_up_items.sort(
            key=lambda item: (priority_order.get(item['priority'], 0), -item['overallRating'] if item['priority'] == 'Opportunity' else item['overallRating']),
            reverse=True,
        )

        rating_breakdown = [
            {'rating': rating, 'count': sum(1 for review in reviews if review.overallRating == rating)}
            for rating in range(1, 6)
        ]
        readiness_breakdown = [
            {
                'readiness': label,
                'count': sum(1 for plan in latest_plan_by_employee.values() if plan.readiness == label),
            }
            for label in ['Ready Now', '6-12 Months', '1-2 Years', 'Long Term']
        ]

        return Response({
            'summary': {
                'totalReviews': len(reviews),
                'pendingAcknowledgements': sum(1 for review in reviews if review.status != 'Acknowledged'),
                'acknowledgedCount': sum(1 for review in reviews if review.status == 'Acknowledged'),
                'lowRatingCount': sum(1 for review in reviews if review.overallRating <= 2),
                'highPerformerCount': sum(1 for review in reviews if review.overallRating >= 4),
                'readyNowCount': sum(1 for plan in latest_plan_by_employee.values() if plan.readiness == 'Ready Now'),
                'calibrationAlerts': sum(1 for item in follow_up_items if item['priority'] in ('Critical', 'High')),
            },
            'ratingBreakdown': rating_breakdown,
            'readinessBreakdown': readiness_breakdown,
            'followUpItems': follow_up_items[:8],
        })


class HRReviewListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        reviews = PerformanceReview.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        department = request.query_params.get('department')
        status_filter = request.query_params.get('status')
        review_type = request.query_params.get('review_type')

        if employee_id:
            reviews = reviews.filter(employee_id=employee_id)
        if department:
            reviews = reviews.filter(employee__department__icontains=department)
        if status_filter:
            reviews = reviews.filter(status=status_filter)
        if review_type:
            reviews = reviews.filter(reviewType=review_type)

        return Response(PerformanceReviewSerializer(reviews.order_by('-reviewDate', '-createdAt'), many=True).data)

    def post(self, request):
        serializer = PerformanceReviewCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        review = PerformanceReview.objects.create(
            employee=employee,
            reviewPeriod=serializer.validated_data['reviewPeriod'],
            reviewType=serializer.validated_data.get('reviewType', 'Quarterly'),
            overallRating=serializer.validated_data['overallRating'],
            status=serializer.validated_data.get('status', 'Draft'),
            strengths=serializer.validated_data.get('strengths', ''),
            improvementAreas=serializer.validated_data.get('improvementAreas', ''),
            goalsSummary=serializer.validated_data.get('goalsSummary', ''),
            reviewDate=serializer.validated_data.get('reviewDate') or timezone.localdate(),
            createdBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        return Response(PerformanceReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class EmployeeCareerPlanListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        plans = SuccessionPlan.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        if status_filter:
            plans = plans.filter(status=status_filter)

        return Response(SuccessionPlanSerializer(plans.order_by('-updatedAt', '-createdAt'), many=True).data)


class EmployeeCareerPlanAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, plan_id):
        try:
            plan = SuccessionPlan.objects.select_related('employee').get(pk=plan_id)
        except SuccessionPlan.DoesNotExist:
            return Response({'error': 'Succession plan not found.'}, status=status.HTTP_404_NOT_FOUND)

        request_employee_id = getattr(request.user, 'employee_id', None)
        if plan.employee_id != request_employee_id and getattr(request.user, 'role', None) not in ('HRManager', 'Admin'):
            return Response({'error': 'You can only acknowledge your own career path.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = SuccessionPlanAcknowledgeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        plan.employeeNote = serializer.validated_data.get('note', plan.employeeNote)
        plan.status = 'Acknowledged'
        plan.acknowledgedAt = timezone.now()
        plan.save(update_fields=['employeeNote', 'status', 'acknowledgedAt', 'updatedAt'])
        return Response(SuccessionPlanSerializer(plan).data)


class HRSuccessionWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        plans = list(
            SuccessionPlan.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-updatedAt', '-createdAt')
        )

        follow_up_items = []
        readiness_summary = {
            'Ready Now': {'count': 0, 'followUpCount': 0, 'highRiskCount': 0},
            '6-12 Months': {'count': 0, 'followUpCount': 0, 'highRiskCount': 0},
            '1-2 Years': {'count': 0, 'followUpCount': 0, 'highRiskCount': 0},
            'Long Term': {'count': 0, 'followUpCount': 0, 'highRiskCount': 0},
        }

        def needs_follow_up(plan):
            return (
                plan.retentionRisk == 'High'
                or plan.status in {'On Hold', 'Active'} and plan.readiness == 'Ready Now'
                or plan.status == 'On Hold'
            )

        for plan in plans:
            bucket = readiness_summary.setdefault(
                plan.readiness,
                {'count': 0, 'followUpCount': 0, 'highRiskCount': 0},
            )
            bucket['count'] += 1
            if plan.retentionRisk == 'High':
                bucket['highRiskCount'] += 1

            if needs_follow_up(plan):
                bucket['followUpCount'] += 1
                follow_up_items.append({
                    'planID': plan.planID,
                    'employeeName': plan.employee.fullName,
                    'employeeID': plan.employee_id,
                    'department': plan.employee.department,
                    'team': plan.employee.team,
                    'targetRole': plan.targetRole,
                    'readiness': plan.readiness,
                    'status': plan.status,
                    'retentionRisk': plan.retentionRisk,
                    'summary': plan.notes or plan.developmentActions or 'Review this succession plan during the next talent meeting.',
                    'path': '/hr/succession',
                })

        readiness_breakdown = [
            {
                'readiness': readiness,
                'count': data['count'],
                'followUpCount': data['followUpCount'],
                'highRiskCount': data['highRiskCount'],
            }
            for readiness, data in readiness_summary.items()
            if data['count']
        ]

        risk_rank = {'High': 0, 'Medium': 1, 'Low': 2}
        readiness_rank = {'Ready Now': 0, '6-12 Months': 1, '1-2 Years': 2, 'Long Term': 3}
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                risk_rank.get(item['retentionRisk'], 9),
                readiness_rank.get(item['readiness'], 9),
                item['employeeName'],
            ),
        )[:8]

        return Response({
            'summary': {
                'totalPlans': len(plans),
                'readyNowCount': sum(1 for plan in plans if plan.readiness == 'Ready Now'),
                'highRiskCount': sum(1 for plan in plans if plan.retentionRisk == 'High'),
                'acknowledgedCount': sum(1 for plan in plans if plan.status == 'Acknowledged'),
                'onHoldCount': sum(1 for plan in plans if plan.status == 'On Hold'),
                'followUpCount': len(follow_up_items),
            },
            'readinessBreakdown': readiness_breakdown,
            'followUpItems': follow_up_items,
        })


class HRSuccessionPlanListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        plans = SuccessionPlan.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        department = request.query_params.get('department')
        status_filter = request.query_params.get('status')
        readiness = request.query_params.get('readiness')

        if employee_id:
            plans = plans.filter(employee_id=employee_id)
        if department:
            plans = plans.filter(employee__department__icontains=department)
        if status_filter:
            plans = plans.filter(status=status_filter)
        if readiness:
            plans = plans.filter(readiness=readiness)

        return Response(SuccessionPlanSerializer(plans.order_by('-updatedAt', '-createdAt'), many=True).data)

    def post(self, request):
        serializer = SuccessionPlanCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        plan = SuccessionPlan.objects.create(
            employee=employee,
            targetRole=serializer.validated_data['targetRole'],
            readiness=serializer.validated_data.get('readiness', '1-2 Years'),
            status=serializer.validated_data.get('status', 'Active'),
            retentionRisk=serializer.validated_data.get('retentionRisk', 'Low'),
            developmentActions=serializer.validated_data.get('developmentActions', ''),
            notes=serializer.validated_data.get('notes', ''),
            createdBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        return Response(SuccessionPlanSerializer(plan).data, status=status.HTTP_201_CREATED)


class EmployeeOnboardingListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        plans = OnboardingPlan.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        type_filter = request.query_params.get('plan_type')
        if type_filter:
            plans = plans.filter(planType=type_filter)

        return Response(OnboardingPlanSerializer(plans.order_by('targetDate', '-createdAt'), many=True).data)


class EmployeeOnboardingProgressView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, plan_id):
        try:
            plan = OnboardingPlan.objects.select_related('employee').get(pk=plan_id)
        except OnboardingPlan.DoesNotExist:
            return Response({'error': 'Onboarding plan not found.'}, status=status.HTTP_404_NOT_FOUND)

        request_employee_id = getattr(request.user, 'employee_id', None)
        if plan.employee_id != request_employee_id and getattr(request.user, 'role', None) not in ('HRManager', 'Admin'):
            return Response({'error': 'You can only update your own onboarding plan.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = OnboardingPlanProgressSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        plan.status = data.get('status', plan.status)
        plan.progress = data.get('progress', plan.progress)
        if 'note' in data:
            plan.employeeNote = data.get('note', plan.employeeNote)
        if plan.progress >= 100:
            plan.progress = 100
            plan.status = 'Completed'
        plan.save(update_fields=['status', 'progress', 'employeeNote', 'updatedAt'])
        return Response(OnboardingPlanSerializer(plan).data)


class HROnboardingWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        today = timezone.localdate()
        plans = list(
            OnboardingPlan.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('targetDate', '-createdAt')
        )

        def get_due_state(plan):
            if plan.status == 'Completed':
                return 'Completed'
            if plan.status == 'Blocked':
                return 'Blocked'
            if plan.targetDate:
                if plan.targetDate < today:
                    return 'Overdue'
                if plan.targetDate <= today + timedelta(days=3):
                    return 'Due Soon'
            if plan.status == 'Not Started' and plan.startDate and plan.startDate <= today:
                return 'Needs Kickoff'
            return 'On Track'

        follow_up_items = []
        enriched_plans = []
        for plan in plans:
            due_state = get_due_state(plan)
            days_to_target = (plan.targetDate - today).days if plan.targetDate else None
            item = {
                'planID': plan.planID,
                'employeeName': plan.employee.fullName,
                'employeeID': plan.employee_id,
                'planType': plan.planType,
                'title': plan.title,
                'department': plan.employee.department,
                'team': plan.employee.team,
                'status': plan.status,
                'progress': plan.progress,
                'targetDate': plan.targetDate.isoformat() if plan.targetDate else None,
                'dueState': due_state,
                'daysToTarget': days_to_target,
                'checklistCount': len(plan.checklistItems or []),
                'notes': plan.notes,
            }
            enriched_plans.append(item)
            if due_state in {'Blocked', 'Overdue', 'Due Soon', 'Needs Kickoff'}:
                follow_up_items.append(item)

        summary = {
            'totalPlans': len(plans),
            'onboardingCount': sum(1 for plan in plans if plan.planType == 'Onboarding'),
            'transitionCount': sum(1 for plan in plans if plan.planType == 'Transition'),
            'offboardingCount': sum(1 for plan in plans if plan.planType == 'Offboarding'),
            'overduePlans': sum(1 for item in enriched_plans if item['dueState'] == 'Overdue'),
            'blockedPlans': sum(1 for plan in plans if plan.status == 'Blocked'),
            'dueSoonPlans': sum(1 for item in enriched_plans if item['dueState'] == 'Due Soon'),
            'kickoffNeeded': sum(1 for item in enriched_plans if item['dueState'] == 'Needs Kickoff'),
            'followUpCount': len(follow_up_items),
            'averageProgress': round(sum(plan.progress for plan in plans) / len(plans), 1) if plans else 0,
        }

        plan_type_breakdown = []
        for plan_type in ['Onboarding', 'Transition', 'Offboarding']:
            type_items = [item for item in enriched_plans if item['planType'] == plan_type]
            if not type_items:
                continue
            plan_type_breakdown.append({
                'planType': plan_type,
                'totalCount': len(type_items),
                'completedCount': sum(1 for item in type_items if item['status'] == 'Completed'),
                'followUpCount': sum(1 for item in type_items if item['dueState'] in {'Blocked', 'Overdue', 'Due Soon', 'Needs Kickoff'}),
                'averageProgress': round(sum(item['progress'] for item in type_items) / len(type_items), 1),
            })

        severity_rank = {'Blocked': 0, 'Overdue': 1, 'Due Soon': 2, 'Needs Kickoff': 3, 'On Track': 4, 'Completed': 5}
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                severity_rank.get(item['dueState'], 9),
                item['daysToTarget'] if item['daysToTarget'] is not None else 999,
                item['progress'],
            ),
        )[:8]

        return Response({
            'summary': summary,
            'planTypeBreakdown': plan_type_breakdown,
            'followUpItems': follow_up_items,
        })


class HROnboardingPlanListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        plans = OnboardingPlan.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        status_filter = request.query_params.get('status')
        plan_type = request.query_params.get('plan_type')
        if employee_id:
            plans = plans.filter(employee_id=employee_id)
        if status_filter:
            plans = plans.filter(status=status_filter)
        if plan_type:
            plans = plans.filter(planType=plan_type)

        return Response(OnboardingPlanSerializer(plans.order_by('targetDate', '-createdAt'), many=True).data)

    def post(self, request):
        serializer = OnboardingPlanCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        plan = OnboardingPlan.objects.create(
            employee=employee,
            planType=serializer.validated_data.get('planType', 'Onboarding'),
            title=serializer.validated_data['title'],
            status=serializer.validated_data.get('status', 'Not Started'),
            progress=serializer.validated_data.get('progress', 0),
            startDate=serializer.validated_data.get('startDate'),
            targetDate=serializer.validated_data.get('targetDate'),
            checklistItems=serializer.validated_data.get('checklistItems', []),
            notes=serializer.validated_data.get('notes', ''),
            createdBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        if plan.progress >= 100:
            plan.progress = 100
            plan.status = 'Completed'
            plan.save(update_fields=['progress', 'status'])
        return Response(OnboardingPlanSerializer(plan).data, status=status.HTTP_201_CREATED)


class EmployeeShiftListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id') or getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        schedules = ShiftSchedule.objects.select_related('employee').filter(employee_id=employee_id, employee__isDeleted=False)
        status_filter = request.query_params.get('status')
        if status_filter:
            schedules = schedules.filter(status=status_filter)

        return Response(ShiftScheduleSerializer(schedules.order_by('shiftDate', 'startTime'), many=True).data)


class EmployeeShiftAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, schedule_id):
        try:
            schedule = ShiftSchedule.objects.select_related('employee').get(pk=schedule_id)
        except ShiftSchedule.DoesNotExist:
            return Response({'error': 'Shift schedule not found.'}, status=status.HTTP_404_NOT_FOUND)

        request_employee_id = getattr(request.user, 'employee_id', None)
        if schedule.employee_id != request_employee_id and getattr(request.user, 'role', None) not in ('HRManager', 'Admin'):
            return Response({'error': 'You can only update your own schedule.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ShiftScheduleAcknowledgeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        schedule.status = data.get('status', schedule.status if schedule.status != 'Planned' else 'Confirmed')
        schedule.employeeNote = data.get('note', schedule.employeeNote)
        schedule.acknowledgedAt = timezone.now()
        schedule.save(update_fields=['status', 'employeeNote', 'acknowledgedAt', 'updatedAt'])
        return Response(ShiftScheduleSerializer(schedule).data)


class HRShiftWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        today = timezone.localdate()
        schedules = list(
            ShiftSchedule.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('shiftDate', 'startTime', '-createdAt')
        )

        def follow_up_state(schedule):
            if schedule.status == 'Swapped':
                return 'Swap Review'
            if schedule.status == 'Planned':
                if schedule.shiftDate <= today:
                    return 'Coverage Risk'
                if schedule.shiftDate <= today + timedelta(days=1):
                    return 'Needs Confirmation'
            if schedule.status == 'Confirmed' and schedule.shiftDate < today:
                return 'Pending Closeout'
            return schedule.status

        follow_up_items = []
        shift_type_map = {}

        for schedule in schedules:
            entry = shift_type_map.setdefault(schedule.shiftType, {
                'shiftType': schedule.shiftType,
                'count': 0,
                'plannedCount': 0,
                'confirmedCount': 0,
                'completedCount': 0,
                'swappedCount': 0,
                'followUpCount': 0,
            })
            entry['count'] += 1
            if schedule.status == 'Planned':
                entry['plannedCount'] += 1
            elif schedule.status == 'Confirmed':
                entry['confirmedCount'] += 1
            elif schedule.status == 'Completed':
                entry['completedCount'] += 1
            elif schedule.status == 'Swapped':
                entry['swappedCount'] += 1

            state = follow_up_state(schedule)
            if state in {'Coverage Risk', 'Needs Confirmation', 'Swap Review', 'Pending Closeout'}:
                days_to_shift = (schedule.shiftDate - today).days if schedule.shiftDate else None
                entry['followUpCount'] += 1
                follow_up_items.append({
                    'scheduleID': schedule.scheduleID,
                    'employeeName': schedule.employee.fullName,
                    'employeeID': schedule.employee_id,
                    'department': schedule.employee.department,
                    'team': schedule.employee.team,
                    'shiftDate': schedule.shiftDate.isoformat() if schedule.shiftDate else None,
                    'shiftType': schedule.shiftType,
                    'location': schedule.location,
                    'status': schedule.status,
                    'followUpState': state,
                    'daysToShift': days_to_shift,
                    'summary': schedule.employeeNote or schedule.notes or 'Shift schedule needs confirmation or coverage follow-up.',
                    'path': '/hr/shifts',
                })

        state_rank = {
            'Coverage Risk': 0,
            'Swap Review': 1,
            'Needs Confirmation': 2,
            'Pending Closeout': 3,
        }
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                state_rank.get(item['followUpState'], 9),
                item['daysToShift'] if item['daysToShift'] is not None else 999,
                item['employeeName'],
            ),
        )[:8]

        shift_type_breakdown = sorted(
            shift_type_map.values(),
            key=lambda item: (-item['followUpCount'], -item['plannedCount'], -item['count'], item['shiftType']),
        )

        return Response({
            'summary': {
                'totalShifts': len(schedules),
                'plannedCount': sum(1 for schedule in schedules if schedule.status == 'Planned'),
                'confirmedCount': sum(1 for schedule in schedules if schedule.status == 'Confirmed'),
                'completedCount': sum(1 for schedule in schedules if schedule.status == 'Completed'),
                'swappedCount': sum(1 for schedule in schedules if schedule.status == 'Swapped'),
                'todayCount': sum(1 for schedule in schedules if schedule.shiftDate == today),
                'coverageRiskCount': sum(1 for schedule in schedules if follow_up_state(schedule) in {'Coverage Risk', 'Swap Review'}),
                'followUpCount': len(follow_up_items),
            },
            'shiftTypeBreakdown': shift_type_breakdown,
            'followUpItems': follow_up_items,
        })


class HRShiftScheduleListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        schedules = ShiftSchedule.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        date_value = request.query_params.get('date')
        status_filter = request.query_params.get('status')
        if employee_id:
            schedules = schedules.filter(employee_id=employee_id)
        if date_value:
            schedules = schedules.filter(shiftDate=date_value)
        if status_filter:
            schedules = schedules.filter(status=status_filter)

        return Response(ShiftScheduleSerializer(schedules.order_by('shiftDate', 'startTime'), many=True).data)

    def post(self, request):
        serializer = ShiftScheduleCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        if ShiftSchedule.objects.filter(
            employee=employee,
            shiftDate=serializer.validated_data['shiftDate'],
            startTime=serializer.validated_data['startTime'],
        ).exists():
            return Response({'error': 'A shift for this employee at the same start time already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        location = (serializer.validated_data.get('location') or employee.location or '').strip()

        schedule = ShiftSchedule.objects.create(
            employee=employee,
            shiftDate=serializer.validated_data['shiftDate'],
            shiftType=serializer.validated_data.get('shiftType', 'Morning'),
            startTime=serializer.validated_data['startTime'],
            endTime=serializer.validated_data['endTime'],
            location=location,
            status=serializer.validated_data.get('status', 'Planned'),
            notes=serializer.validated_data.get('notes', ''),
            createdBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        return Response(ShiftScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


def _get_policy_audience_ids(employees, audience):
    all_employee_ids = [employee.employeeID for employee in employees]
    manager_ids = [employee.employeeID for employee in employees if employee.role in ('TeamLeader', 'HRManager', 'Admin')]
    team_leader_ids = [employee.employeeID for employee in employees if employee.role == 'TeamLeader']

    if audience == 'Managers':
        return manager_ids
    if audience == 'Team Leaders':
        return team_leader_ids
    return all_employee_ids


def _get_policy_due_state(policy, today):
    if policy.effectiveDate and policy.effectiveDate < today:
        return 'Overdue'
    if policy.effectiveDate and policy.effectiveDate <= today + timedelta(days=7):
        return 'Due This Week'
    return 'Open'


class HRPolicyComplianceView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        employees = list(Employee.objects.filter(isDeleted=False))
        today = timezone.localdate()

        tracked_policies = list(
            PolicyAnnouncement.objects.exclude(status='Draft').order_by('-effectiveDate', '-createdAt')
        )

        follow_up_items = []
        coverage_total = 0
        fully_acknowledged = 0

        for policy in tracked_policies:
            audience_ids = _get_policy_audience_ids(employees, policy.audience)
            audience_size = len(audience_ids)
            acknowledged_ids = set(policy.acknowledgedByIDs or [])
            acknowledged_count = len([item for item in audience_ids if item in acknowledged_ids])
            pending_count = max(audience_size - acknowledged_count, 0)
            coverage_rate = round((acknowledged_count / audience_size) * 100) if audience_size else 100
            coverage_total += coverage_rate

            if pending_count == 0:
                fully_acknowledged += 1
                continue

            follow_up_items.append({
                'policyID': policy.policyID,
                'title': policy.title,
                'audience': policy.audience,
                'pendingEmployees': pending_count,
                'acknowledgedEmployees': acknowledged_count,
                'audienceSize': audience_size,
                'coverageRate': coverage_rate,
                'effectiveDate': policy.effectiveDate,
                'dueState': _get_policy_due_state(policy, today),
                'reminderCount': policy.reminderCount or 0,
                'lastReminderAt': policy.lastReminderAt,
                'lastReminderNote': policy.lastReminderNote,
            })

        severity_order = {'Overdue': 2, 'Due This Week': 1, 'Open': 0}
        all_follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (severity_order.get(item['dueState'], 0), item['pendingEmployees']),
            reverse=True,
        )
        top_follow_up_items = all_follow_up_items[:6]

        audience_breakdown = []
        for audience in ['All Employees', 'Managers', 'Team Leaders']:
            audience_breakdown.append({
                'audience': audience,
                'targetEmployees': len(_get_policy_audience_ids(employees, audience)),
                'policies': sum(1 for policy in tracked_policies if policy.audience == audience),
                'outstandingEmployees': sum(item['pendingEmployees'] for item in all_follow_up_items if item['audience'] == audience),
            })

        return Response({
            'summary': {
                'publishedCount': len(tracked_policies),
                'fullyAcknowledgedCount': fully_acknowledged,
                'outstandingEmployees': sum(item['pendingEmployees'] for item in all_follow_up_items),
                'dueThisWeekCount': sum(1 for item in all_follow_up_items if item['dueState'] in ('Overdue', 'Due This Week')),
                'averageCoverageRate': round(coverage_total / len(tracked_policies)) if tracked_policies else 100,
                'recentReminderCount': sum(1 for policy in tracked_policies if policy.lastReminderAt and policy.lastReminderAt >= timezone.now() - timedelta(days=7)),
            },
            'audienceBreakdown': audience_breakdown,
            'followUpItems': top_follow_up_items,
        })


class HRPolicyReminderView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, policy_id):
        try:
            policy = PolicyAnnouncement.objects.get(pk=policy_id)
        except PolicyAnnouncement.DoesNotExist:
            return Response({'error': 'Policy announcement not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PolicyAnnouncementReminderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employees = list(Employee.objects.filter(isDeleted=False))
        audience_ids = _get_policy_audience_ids(employees, policy.audience)
        acknowledged_ids = set(policy.acknowledgedByIDs or [])
        outstanding_employee_ids = [employee_id for employee_id in audience_ids if employee_id not in acknowledged_ids]
        due_state = _get_policy_due_state(policy, timezone.localdate())
        reminder_note = serializer.validated_data.get('note', '').strip() or f'{policy.title} follow-up reminder sent from the HR compliance center.'
        reminder_history = list(policy.reminderHistory or [])
        reminded_at = timezone.now()

        reminder_history.append({
            'remindedAt': reminded_at.isoformat(),
            'remindedBy': getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
            'note': reminder_note,
            'outstandingEmployees': len(outstanding_employee_ids),
            'dueState': due_state,
        })

        policy.lastReminderAt = reminded_at
        policy.lastReminderNote = reminder_note
        policy.reminderCount = int(policy.reminderCount or 0) + 1
        policy.reminderHistory = reminder_history[-10:]
        policy.save(update_fields=['lastReminderAt', 'lastReminderNote', 'reminderCount', 'reminderHistory', 'updatedAt'])

        data = PolicyAnnouncementSerializer(policy).data
        data.update({
            'outstandingEmployees': len(outstanding_employee_ids),
            'dueState': due_state,
        })
        return Response(data)


class EmployeePolicyListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def get(self, request):
        policies = PolicyAnnouncement.objects.all()
        status_filter = request.query_params.get('status')
        if status_filter:
            policies = policies.filter(status=status_filter)

        return Response(PolicyAnnouncementSerializer(policies, many=True).data)


class EmployeePolicyAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated, IsInternalEmployee]

    def post(self, request, policy_id):
        try:
            policy = PolicyAnnouncement.objects.get(pk=policy_id)
        except PolicyAnnouncement.DoesNotExist:
            return Response({'error': 'Policy announcement not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PolicyAnnouncementAcknowledgeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee_id = getattr(request.user, 'employee_id', None)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        acknowledged_ids = list(policy.acknowledgedByIDs or [])
        if employee_id not in acknowledged_ids:
            acknowledged_ids.append(employee_id)

        notes = dict(policy.acknowledgementNotes or {})
        notes[employee_id] = serializer.validated_data.get('note', '')

        policy.acknowledgedByIDs = acknowledged_ids
        policy.acknowledgementNotes = notes
        policy.status = 'Acknowledged' if acknowledged_ids else policy.status
        policy.acknowledgedAt = timezone.now()
        policy.save(update_fields=['acknowledgedByIDs', 'acknowledgementNotes', 'status', 'acknowledgedAt', 'updatedAt'])
        return Response(PolicyAnnouncementSerializer(policy).data)


class HRPolicyListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        policies = PolicyAnnouncement.objects.all()

        category = request.query_params.get('category')
        audience = request.query_params.get('audience')
        status_filter = request.query_params.get('status')

        if category:
            policies = policies.filter(category=category)
        if audience:
            policies = policies.filter(audience=audience)
        if status_filter:
            policies = policies.filter(status=status_filter)

        return Response(PolicyAnnouncementSerializer(policies, many=True).data)

    def post(self, request):
        serializer = PolicyAnnouncementCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        policy = PolicyAnnouncement.objects.create(
            title=serializer.validated_data['title'],
            category=serializer.validated_data.get('category', 'Policy'),
            audience=serializer.validated_data.get('audience', 'All Employees'),
            content=serializer.validated_data['content'],
            status=serializer.validated_data.get('status', 'Draft'),
            effectiveDate=serializer.validated_data.get('effectiveDate'),
            createdBy=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', ''),
        )
        return Response(PolicyAnnouncementSerializer(policy).data, status=status.HTTP_201_CREATED)


class HRPayrollWatchView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        now = timezone.now()
        records = list(
            PayrollRecord.objects.select_related('employee')
            .filter(employee__isDeleted=False)
            .order_by('-payPeriod', '-createdAt')
        )

        def follow_up_state(record):
            age_days = max((now - (record.createdAt or now)).days, 0)
            if record.status != PayrollRecord.STATUS_PAID:
                if age_days >= 4:
                    return 'Overdue Release'
                return 'Ready to Release'
            if record.status == PayrollRecord.STATUS_PAID and not record.paymentDate:
                return 'Payment Date Missing'
            return record.status

        follow_up_items = []
        department_map = {}
        total_net_pay = Decimal('0')
        paid_amount = Decimal('0')
        pending_amount = Decimal('0')

        for record in records:
            department = record.employee.department or 'Unassigned'
            entry = department_map.setdefault(department, {
                'department': department,
                'count': 0,
                'draftCount': 0,
                'paidCount': 0,
                'netPayTotal': 0.0,
                'pendingAmount': 0.0,
            })
            entry['count'] += 1
            entry['netPayTotal'] += float(record.netPay or 0)
            total_net_pay += record.netPay or Decimal('0')

            if record.status == PayrollRecord.STATUS_PAID:
                entry['paidCount'] += 1
                paid_amount += record.netPay or Decimal('0')
            else:
                entry['draftCount'] += 1
                pending_amount += record.netPay or Decimal('0')
                entry['pendingAmount'] += float(record.netPay or 0)

            state = follow_up_state(record)
            if state in {'Overdue Release', 'Ready to Release', 'Payment Date Missing'}:
                age_days = max((now - (record.createdAt or now)).days, 0)
                follow_up_items.append({
                    'payrollID': record.payrollID,
                    'employeeName': record.employee.fullName,
                    'employeeID': record.employee_id,
                    'department': department,
                    'payPeriod': record.payPeriod,
                    'status': record.status,
                    'followUpState': state,
                    'ageDays': age_days,
                    'netPay': round(float(record.netPay or 0), 2),
                    'paymentDate': record.paymentDate.isoformat() if record.paymentDate else None,
                    'summary': record.notes or 'Payroll record is waiting for release or payment confirmation.',
                    'path': '/hr/payroll',
                })

        state_rank = {
            'Overdue Release': 0,
            'Payment Date Missing': 1,
            'Ready to Release': 2,
        }
        follow_up_items = sorted(
            follow_up_items,
            key=lambda item: (
                state_rank.get(item['followUpState'], 9),
                -item['ageDays'],
                item['employeeName'],
            ),
        )[:8]

        department_breakdown = sorted(
            department_map.values(),
            key=lambda item: (-item['draftCount'], -item['pendingAmount'], item['department']),
        )

        return Response({
            'summary': {
                'totalRecords': len(records),
                'draftCount': sum(1 for record in records if record.status != PayrollRecord.STATUS_PAID),
                'paidCount': sum(1 for record in records if record.status == PayrollRecord.STATUS_PAID),
                'overdueCount': sum(1 for record in records if follow_up_state(record) == 'Overdue Release'),
                'followUpCount': len(follow_up_items),
                'totalNetPay': round(float(total_net_pay), 2),
                'paidAmount': round(float(paid_amount), 2),
                'pendingAmount': round(float(pending_amount), 2),
            },
            'departmentBreakdown': department_breakdown,
            'followUpItems': follow_up_items,
        })


class HRPayrollListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def get(self, request):
        records = PayrollRecord.objects.select_related('employee').filter(employee__isDeleted=False)

        employee_id = request.query_params.get('employee_id')
        pay_period = request.query_params.get('pay_period')
        status_filter = request.query_params.get('status')

        if employee_id:
            records = records.filter(employee_id=employee_id)
        if pay_period:
            records = records.filter(payPeriod=pay_period)
        if status_filter:
            records = records.filter(status=status_filter)

        return Response(PayrollRecordSerializer(records.order_by('-payPeriod', '-createdAt'), many=True).data)

    def post(self, request):
        serializer = PayrollRecordCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee = _resolve_employee(serializer.validated_data['employeeID'], request.user)
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        pay_period = serializer.validated_data['payPeriod']
        if PayrollRecord.objects.filter(employee=employee, payPeriod=pay_period).exists():
            return Response({'error': 'Payroll record for this employee and pay period already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        base_salary = serializer.validated_data.get('baseSalary')
        if base_salary is None:
            if employee.monthlyIncome is None:
                return Response({'error': 'Base salary is required or missing from the employee profile.'}, status=status.HTTP_400_BAD_REQUEST)
            base_salary = Decimal(str(employee.monthlyIncome)).quantize(Decimal('0.01'))

        allowances = serializer.validated_data.get('allowances', Decimal('0.00'))
        deductions = serializer.validated_data.get('deductions', Decimal('0.00'))
        bonus = serializer.validated_data.get('bonus', Decimal('0.00'))

        payroll = PayrollRecord.objects.create(
            employee=employee,
            payPeriod=pay_period,
            baseSalary=base_salary,
            allowances=allowances,
            deductions=deductions,
            bonus=bonus,
            netPay=_calculate_net_pay(base_salary, allowances, deductions, bonus),
            notes=serializer.validated_data.get('notes', ''),
        )
        return Response(PayrollRecordSerializer(payroll).data, status=status.HTTP_201_CREATED)


class HRPayrollMarkPaidView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    def post(self, request, payroll_id):
        try:
            payroll = PayrollRecord.objects.select_related('employee').get(pk=payroll_id)
        except PayrollRecord.DoesNotExist:
            return Response({'error': 'Payroll record not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PayrollMarkPaidSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        payroll.status = PayrollRecord.STATUS_PAID
        payroll.paymentDate = serializer.validated_data.get('paymentDate') or timezone.localdate()
        payroll.save(update_fields=['status', 'paymentDate'])
        return Response(PayrollRecordSerializer(payroll).data)


# ---------------------------------------------------------------------------
# Employee -- Form Access
# ---------------------------------------------------------------------------

class FeedbackFormListView(APIView):
    """
    GET /api/feedback/forms/
    Employee sees only the active form.
    """

    def get(self, request):
        forms = FeedbackForm.objects.prefetch_related('questions').filter(isActive=True)
        employee_id = request.query_params.get('employee_id')
        result = []
        for form in forms:
            data = FeedbackFormDetailSerializer(form).data
            if employee_id:
                try:
                    sub = FeedbackSubmission.objects.prefetch_related(
                        'answers').get(formID=form, employeeID_id=employee_id)
                    data['submission'] = FeedbackSubmissionSerializer(sub).data
                except FeedbackSubmission.DoesNotExist:
                    data['submission'] = None
            result.append(data)
        return Response(result)


class FeedbackFormDetailView(APIView):
    """
    GET /api/feedback/forms/<form_id>/?employee_id=<id>
    """

    def get(self, request, form_id):
        try:
            form = FeedbackForm.objects.prefetch_related('questions').get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = FeedbackFormDetailSerializer(form).data
        employee_id = request.query_params.get('employee_id')
        if employee_id:
            try:
                sub = FeedbackSubmission.objects.prefetch_related(
                    'answers').get(formID=form, employeeID_id=employee_id)
                data['submission'] = FeedbackSubmissionSerializer(sub).data
            except FeedbackSubmission.DoesNotExist:
                data['submission'] = None
        return Response(data)


class FeedbackSubmitView(APIView):
    """
    POST /api/feedback/forms/<form_id>/submit/
    """

    def post(self, request, form_id):
        try:
            form = FeedbackForm.objects.prefetch_related('questions').get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubmitFeedbackSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee_id = serializer.validated_data['employeeID']
        answers     = serializer.validated_data['answers']

        if not Employee.objects.filter(pk=employee_id).exists():
            return Response({'error': f'Employee {employee_id} not found.'},
                            status=status.HTTP_404_NOT_FOUND)

        valid_question_ids = set(form.questions.values_list('questionID', flat=True))
        submitted_ids      = set(a['questionID'] for a in answers)
        invalid            = submitted_ids - valid_question_ids
        if invalid:
            return Response({'error': f'Invalid question IDs: {invalid}'},
                            status=status.HTTP_400_BAD_REQUEST)
        if submitted_ids != valid_question_ids:
            missing = valid_question_ids - submitted_ids
            return Response({'error': f'Missing answers for: {missing}'},
                            status=status.HTTP_400_BAD_REQUEST)

        submission, _ = FeedbackSubmission.objects.get_or_create(
            formID=form, employeeID_id=employee_id)

        for a in answers:
            FeedbackAnswer.objects.update_or_create(
                submissionID=submission,
                questionID_id=a['questionID'],
                defaults={
                    'scoreValue':   a.get('scoreValue'),
                    'booleanValue': a.get('booleanValue'),
                    'decimalValue': a.get('decimalValue'),
                }
            )

        submission.status      = FeedbackSubmission.STATUS_COMPLETED
        submission.submittedAt = timezone.now()
        submission.save(update_fields=['status', 'submittedAt'])

        return Response(FeedbackSubmissionSerializer(submission).data,
                        status=status.HTTP_201_CREATED)
