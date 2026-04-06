from datetime import date
from rest_framework import serializers
from .models import Employee, EmployeeJobHistory, AttendanceRecord, LeaveRequest, PayrollRecord, EmployeeGoal, WorkTask, TrainingCourse, PerformanceReview, SuccessionPlan, OnboardingPlan, ShiftSchedule, PolicyAnnouncement, RecognitionAward, BenefitEnrollment, ExpenseClaim, DocumentRequest, SupportTicket, FeedbackForm, FeedbackQuestion, FeedbackSubmission, FeedbackAnswer


# ---------------------------------------------------------------------------
# Employee Directory
# ---------------------------------------------------------------------------

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = [
            'employeeID', 'fullName', 'email', 'jobTitle', 'team', 'department',
            'role', 'employeeType', 'location', 'employmentStatus', 'isDeleted',
            'age', 'yearsAtCompany', 'monthlyIncome', 'performanceRating',
            'numberOfPromotions', 'jobLevel', 'remoteWork'
        ]


class EmployeeCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = [
            'employeeID', 'fullName', 'email', 'jobTitle', 'team', 'department',
            'role', 'employeeType', 'location', 'employmentStatus', 'age',
            'yearsAtCompany', 'monthlyIncome', 'performanceRating',
            'numberOfPromotions', 'jobLevel', 'remoteWork'
        ]
        read_only_fields = ['employeeID']

    def validate_email(self, value):
        value = value.strip().lower()
        qs = Employee.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('An employee with this email already exists.')
        return value


class EmployeeJobHistorySerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)

    class Meta:
        model = EmployeeJobHistory
        fields = [
            'historyID', 'employeeID', 'employeeName', 'action',
            'previousJobTitle', 'newJobTitle', 'previousRole', 'newRole',
            'previousDepartment', 'newDepartment', 'previousTeam', 'newTeam',
            'previousMonthlyIncome', 'newMonthlyIncome', 'changedBy', 'notes', 'changedAt'
        ]


class EmployeeRoleChangeSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['Promotion', 'Demotion', 'Role Change'])
    jobTitle = serializers.CharField(max_length=100, required=False, allow_blank=True)
    role = serializers.CharField(max_length=50, required=False, allow_blank=True)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True)
    team = serializers.CharField(max_length=100, required=False, allow_blank=True)
    monthlyIncome = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    role = serializers.CharField(source='employee.role', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            'attendanceID', 'employeeID', 'employeeName', 'department', 'role',
            'date', 'clockIn', 'clockOut', 'workedHours', 'status', 'notes'
        ]


class AttendanceClockSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    action = serializers.ChoiceField(choices=['clock_in', 'clock_out'])
    notes = serializers.CharField(required=False, allow_blank=True)


class LeaveRequestSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'leaveRequestID', 'employeeID', 'employeeName', 'department', 'leaveType',
            'startDate', 'endDate', 'daysRequested', 'reason', 'status',
            'eligibilityMessage', 'reviewNotes', 'reviewedBy', 'reviewedAt', 'requestedAt'
        ]


class LeaveRequestCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    leaveType = serializers.ChoiceField(choices=[choice[0] for choice in LeaveRequest.LEAVE_TYPES])
    startDate = serializers.DateField()
    endDate = serializers.DateField()
    reason = serializers.CharField()

    def validate(self, attrs):
        if attrs['endDate'] < attrs['startDate']:
            raise serializers.ValidationError('End date must be after or equal to start date.')
        if attrs['startDate'] < date.today():
            raise serializers.ValidationError('Leave start date cannot be in the past.')
        return attrs


class LeaveReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['Approved', 'Rejected'])
    reviewNotes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('status') == 'Rejected' and not (attrs.get('reviewNotes') or '').strip():
            raise serializers.ValidationError({'reviewNotes': 'Please provide a short reason before rejecting this leave request.'})
        return attrs


class PayrollRecordSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    jobTitle = serializers.CharField(source='employee.jobTitle', read_only=True)

    class Meta:
        model = PayrollRecord
        fields = [
            'payrollID', 'employeeID', 'employeeName', 'department', 'jobTitle',
            'payPeriod', 'baseSalary', 'allowances', 'deductions', 'bonus',
            'netPay', 'status', 'paymentDate', 'notes', 'createdAt'
        ]


class PayrollRecordCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    payPeriod = serializers.RegexField(regex=r'^\d{4}-\d{2}$', max_length=20)
    baseSalary = serializers.DecimalField(max_digits=10, decimal_places=2)
    allowances = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    deductions = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    bonus = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True)


class PayrollMarkPaidSerializer(serializers.Serializer):
    paymentDate = serializers.DateField(required=False)


class EmployeeGoalSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = EmployeeGoal
        fields = [
            'goalID', 'employeeID', 'employeeName', 'department', 'team',
            'title', 'description', 'category', 'priority', 'status',
            'progress', 'dueDate', 'createdBy', 'createdAt', 'updatedAt'
        ]


class EmployeeGoalCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    title = serializers.CharField(max_length=160)
    description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.ChoiceField(choices=[choice[0] for choice in EmployeeGoal.CATEGORY_CHOICES], required=False)
    priority = serializers.ChoiceField(choices=[choice[0] for choice in EmployeeGoal.PRIORITY_CHOICES], required=False)
    status = serializers.ChoiceField(choices=[choice[0] for choice in EmployeeGoal.STATUS_CHOICES], required=False)
    progress = serializers.IntegerField(required=False, min_value=0, max_value=100)
    dueDate = serializers.DateField(required=False, allow_null=True)


class EmployeeGoalProgressSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[choice[0] for choice in EmployeeGoal.STATUS_CHOICES], required=False)
    progress = serializers.IntegerField(required=False, min_value=0, max_value=100)


class WorkTaskSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = WorkTask
        fields = [
            'taskID', 'employeeID', 'employeeName', 'department', 'team',
            'title', 'description', 'priority', 'status', 'progress',
            'estimatedHours', 'dueDate', 'assignedBy', 'createdAt', 'updatedAt'
        ]


class WorkTaskCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    title = serializers.CharField(max_length=160)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=[choice[0] for choice in WorkTask.PRIORITY_CHOICES], required=False)
    status = serializers.ChoiceField(choices=[choice[0] for choice in WorkTask.STATUS_CHOICES], required=False)
    progress = serializers.IntegerField(required=False, min_value=0, max_value=100)
    estimatedHours = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    dueDate = serializers.DateField(required=False, allow_null=True)


class WorkTaskProgressSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[choice[0] for choice in WorkTask.STATUS_CHOICES], required=False)
    progress = serializers.IntegerField(required=False, min_value=0, max_value=100)


class TrainingCourseSerializer(serializers.ModelSerializer):
    assignedCount = serializers.SerializerMethodField()
    completedCount = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = TrainingCourse
        fields = [
            'courseID', 'title', 'description', 'category', 'durationHours',
            'assignedEmployeeIDs', 'assignedCount', 'completedCount', 'status',
            'progress', 'dueDate', 'createdBy', 'createdAt'
        ]

    def get_assignedCount(self, obj):
        return len(obj.assignedEmployeeIDs or [])

    def get_completedCount(self, obj):
        completion = obj.completionData or {}
        return sum(1 for item in completion.values() if item.get('status') == 'Completed')

    def get_status(self, obj):
        employee_id = self.context.get('employee_id')
        if employee_id:
            completion = (obj.completionData or {}).get(employee_id, {})
            return completion.get('status', 'Not Started')
        completion = obj.completionData or {}
        if completion and all(item.get('status') == 'Completed' for item in completion.values()):
            return 'Completed'
        return 'In Progress' if completion else 'Not Started'

    def get_progress(self, obj):
        employee_id = self.context.get('employee_id')
        if employee_id:
            completion = (obj.completionData or {}).get(employee_id, {})
            return completion.get('progress', 0)
        completion = obj.completionData or {}
        if not completion:
            return 0
        return round(sum(item.get('progress', 0) for item in completion.values()) / max(len(completion), 1))


class TrainingCourseCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=160)
    description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.ChoiceField(choices=[choice[0] for choice in TrainingCourse.CATEGORY_CHOICES], required=False)
    durationHours = serializers.IntegerField(required=False, min_value=1)
    assignedEmployeeIDs = serializers.ListField(child=serializers.CharField(max_length=50), required=False)
    dueDate = serializers.DateField(required=False, allow_null=True)


class TrainingProgressSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['Not Started', 'In Progress', 'Completed'], required=False)
    progress = serializers.IntegerField(required=False, min_value=0, max_value=100)


class PerformanceReviewSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = PerformanceReview
        fields = [
            'reviewID', 'employeeID', 'employeeName', 'department', 'team',
            'reviewPeriod', 'reviewType', 'overallRating', 'status',
            'strengths', 'improvementAreas', 'goalsSummary', 'employeeNote',
            'reviewDate', 'acknowledgedAt', 'createdBy', 'createdAt', 'updatedAt'
        ]


class PerformanceReviewCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    reviewPeriod = serializers.CharField(max_length=50)
    reviewType = serializers.ChoiceField(choices=[choice[0] for choice in PerformanceReview.REVIEW_TYPES], required=False)
    overallRating = serializers.IntegerField(min_value=1, max_value=5)
    status = serializers.ChoiceField(choices=[choice[0] for choice in PerformanceReview.STATUS_CHOICES], required=False)
    strengths = serializers.CharField(required=False, allow_blank=True)
    improvementAreas = serializers.CharField(required=False, allow_blank=True)
    goalsSummary = serializers.CharField(required=False, allow_blank=True)
    reviewDate = serializers.DateField(required=False, allow_null=True)


class PerformanceReviewAcknowledgeSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)


class SuccessionPlanSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = SuccessionPlan
        fields = [
            'planID', 'employeeID', 'employeeName', 'department', 'team',
            'targetRole', 'readiness', 'status', 'retentionRisk',
            'developmentActions', 'notes', 'employeeNote', 'acknowledgedAt',
            'createdBy', 'createdAt', 'updatedAt'
        ]


class SuccessionPlanCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    targetRole = serializers.CharField(max_length=120)
    readiness = serializers.ChoiceField(choices=[choice[0] for choice in SuccessionPlan.READINESS_CHOICES], required=False)
    status = serializers.ChoiceField(choices=[choice[0] for choice in SuccessionPlan.STATUS_CHOICES], required=False)
    retentionRisk = serializers.ChoiceField(choices=[choice[0] for choice in SuccessionPlan.RISK_CHOICES], required=False)
    developmentActions = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class SuccessionPlanAcknowledgeSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)


class OnboardingPlanSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = OnboardingPlan
        fields = [
            'planID', 'employeeID', 'employeeName', 'department', 'team',
            'planType', 'title', 'status', 'progress', 'startDate', 'targetDate',
            'checklistItems', 'notes', 'employeeNote', 'createdBy', 'createdAt', 'updatedAt'
        ]


class OnboardingPlanCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    planType = serializers.ChoiceField(choices=[choice[0] for choice in OnboardingPlan.PLAN_TYPE_CHOICES], required=False)
    title = serializers.CharField(max_length=160)
    status = serializers.ChoiceField(choices=[choice[0] for choice in OnboardingPlan.STATUS_CHOICES], required=False)
    progress = serializers.IntegerField(required=False, min_value=0, max_value=100)
    startDate = serializers.DateField(required=False, allow_null=True)
    targetDate = serializers.DateField(required=False, allow_null=True)
    checklistItems = serializers.ListField(child=serializers.CharField(), required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class OnboardingPlanProgressSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[choice[0] for choice in OnboardingPlan.STATUS_CHOICES], required=False)
    progress = serializers.IntegerField(required=False, min_value=0, max_value=100)
    note = serializers.CharField(required=False, allow_blank=True)


class ShiftScheduleSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = ShiftSchedule
        fields = [
            'scheduleID', 'employeeID', 'employeeName', 'department', 'team',
            'shiftDate', 'shiftType', 'startTime', 'endTime', 'location',
            'status', 'notes', 'employeeNote', 'acknowledgedAt', 'createdBy', 'createdAt', 'updatedAt'
        ]


class ShiftScheduleCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    shiftDate = serializers.DateField()
    shiftType = serializers.ChoiceField(choices=[choice[0] for choice in ShiftSchedule.SHIFT_TYPE_CHOICES], required=False)
    startTime = serializers.TimeField()
    endTime = serializers.TimeField()
    location = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=[choice[0] for choice in ShiftSchedule.STATUS_CHOICES], required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class ShiftScheduleAcknowledgeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['Confirmed', 'Completed', 'Swapped'], required=False)
    note = serializers.CharField(required=False, allow_blank=True)


class PolicyAnnouncementSerializer(serializers.ModelSerializer):
    acknowledgements = serializers.SerializerMethodField()

    class Meta:
        model = PolicyAnnouncement
        fields = [
            'policyID', 'title', 'category', 'audience', 'content',
            'status', 'effectiveDate', 'acknowledgements', 'acknowledgedAt',
            'lastReminderAt', 'lastReminderNote', 'reminderCount',
            'createdBy', 'createdAt', 'updatedAt'
        ]

    def get_acknowledgements(self, obj):
        return len(obj.acknowledgedByIDs or [])


class PolicyAnnouncementCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=180)
    category = serializers.ChoiceField(choices=[choice[0] for choice in PolicyAnnouncement.CATEGORY_CHOICES], required=False)
    audience = serializers.ChoiceField(choices=[choice[0] for choice in PolicyAnnouncement.AUDIENCE_CHOICES], required=False)
    content = serializers.CharField()
    status = serializers.ChoiceField(choices=[choice[0] for choice in PolicyAnnouncement.STATUS_CHOICES], required=False)
    effectiveDate = serializers.DateField(required=False, allow_null=True)


class PolicyAnnouncementAcknowledgeSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)


class PolicyAnnouncementReminderSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)


class RecognitionAwardSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = RecognitionAward
        fields = [
            'awardID', 'employeeID', 'employeeName', 'department', 'team',
            'title', 'category', 'message', 'points', 'recognitionDate',
            'recognizedBy', 'createdAt'
        ]


class RecognitionAwardCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    title = serializers.CharField(max_length=160)
    category = serializers.ChoiceField(choices=[choice[0] for choice in RecognitionAward.CATEGORY_CHOICES], required=False)
    message = serializers.CharField(required=False, allow_blank=True)
    points = serializers.IntegerField(required=False, min_value=0)
    recognitionDate = serializers.DateField(required=False, allow_null=True)


class BenefitEnrollmentSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = BenefitEnrollment
        fields = [
            'enrollmentID', 'employeeID', 'employeeName', 'department', 'team',
            'benefitName', 'benefitType', 'provider', 'coverageLevel', 'status',
            'monthlyCost', 'employeeContribution', 'effectiveDate', 'notes',
            'employeeNote', 'acknowledgedAt', 'createdBy', 'createdAt', 'updatedAt'
        ]


class BenefitEnrollmentCreateSerializer(serializers.Serializer):
    employeeID = serializers.CharField(max_length=50)
    benefitName = serializers.CharField(max_length=160)
    benefitType = serializers.ChoiceField(choices=[choice[0] for choice in BenefitEnrollment.BENEFIT_TYPE_CHOICES], required=False)
    provider = serializers.CharField(required=False, allow_blank=True)
    coverageLevel = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=[choice[0] for choice in BenefitEnrollment.STATUS_CHOICES], required=False)
    monthlyCost = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    employeeContribution = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    effectiveDate = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class BenefitEnrollmentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['Enrolled', 'Waived'], required=False)
    note = serializers.CharField(required=False, allow_blank=True)


class ExpenseClaimSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = ExpenseClaim
        fields = [
            'claimID', 'employeeID', 'employeeName', 'department', 'team',
            'title', 'category', 'amount', 'expenseDate', 'description',
            'status', 'reviewNote', 'reviewedBy', 'reviewedAt', 'createdAt', 'updatedAt'
        ]


class ExpenseClaimCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=160)
    category = serializers.ChoiceField(choices=[choice[0] for choice in ExpenseClaim.CATEGORY_CHOICES], required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    expenseDate = serializers.DateField()
    description = serializers.CharField(required=False, allow_blank=True)


class ExpenseClaimReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['Approved', 'Rejected', 'Reimbursed'])
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('status') == 'Rejected' and not (attrs.get('note') or '').strip():
            raise serializers.ValidationError({'note': 'Please provide a short reason before rejecting this expense claim.'})
        return attrs


class DocumentRequestSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = DocumentRequest
        fields = [
            'requestID', 'employeeID', 'employeeName', 'department', 'team',
            'documentType', 'purpose', 'notes', 'status', 'reviewNote',
            'issuedBy', 'issuedAt', 'createdAt', 'updatedAt'
        ]


class DocumentRequestCreateSerializer(serializers.Serializer):
    documentType = serializers.ChoiceField(choices=[choice[0] for choice in DocumentRequest.DOCUMENT_TYPE_CHOICES], required=False)
    purpose = serializers.CharField(max_length=180)
    notes = serializers.CharField(required=False, allow_blank=True)


class DocumentRequestIssueSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['In Progress', 'Issued', 'Declined'])
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('status') == 'Declined' and not (attrs.get('note') or '').strip():
            raise serializers.ValidationError({'note': 'Please provide a short reason before declining this document request.'})
        return attrs


class SupportTicketSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employee.employeeID', read_only=True)
    employeeName = serializers.CharField(source='employee.fullName', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)
    team = serializers.CharField(source='employee.team', read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'ticketID', 'employeeID', 'employeeName', 'department', 'team',
            'subject', 'category', 'priority', 'description', 'status',
            'resolutionNote', 'assignedTo', 'resolvedAt', 'createdAt', 'updatedAt'
        ]


class SupportTicketCreateSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=180)
    category = serializers.ChoiceField(choices=[choice[0] for choice in SupportTicket.CATEGORY_CHOICES], required=False)
    priority = serializers.ChoiceField(choices=[choice[0] for choice in SupportTicket.PRIORITY_CHOICES], required=False)
    description = serializers.CharField(required=False, allow_blank=True)


class SupportTicketStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['In Progress', 'Resolved', 'Closed'])
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('status') in {'Resolved', 'Closed'} and not (attrs.get('note') or '').strip():
            raise serializers.ValidationError({'note': 'Please provide a short resolution note before closing this support ticket.'})
        return attrs


# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------

class FeedbackQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeedbackQuestion
        fields = ['questionID', 'questionText', 'fieldType', 'order']


class FeedbackQuestionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeedbackQuestion
        fields = ['questionID', 'questionText', 'fieldType', 'order']
        read_only_fields = ['questionID']


# ---------------------------------------------------------------------------
# Forms
# ---------------------------------------------------------------------------

class FeedbackFormListSerializer(serializers.ModelSerializer):
    questionCount     = serializers.IntegerField(source='questions.count', read_only=True)
    submissionCount   = serializers.IntegerField(source='submissions.count', read_only=True)

    class Meta:
        model  = FeedbackForm
        fields = ['formID', 'title', 'description', 'isActive',
                  'createdAt', 'questionCount', 'submissionCount']


class FeedbackFormDetailSerializer(serializers.ModelSerializer):
    questions = FeedbackQuestionSerializer(many=True, read_only=True)
    questionCount = serializers.IntegerField(source='questions.count', read_only=True)
    submissionCount = serializers.IntegerField(source='submissions.count', read_only=True)

    class Meta:
        model  = FeedbackForm
        fields = ['formID', 'title', 'description', 'isActive',
                  'createdAt', 'questionCount', 'submissionCount', 'questions']


class FeedbackFormCreateUpdateSerializer(serializers.ModelSerializer):
    """Used by HR Manager to create or update a form."""
    class Meta:
        model  = FeedbackForm
        fields = ['formID', 'title', 'description', 'isActive']
        read_only_fields = ['formID']


# ---------------------------------------------------------------------------
# Answers
# ---------------------------------------------------------------------------

class FeedbackAnswerSerializer(serializers.ModelSerializer):
    questionID = serializers.CharField(source='questionID_id')
    questionText = serializers.CharField(source='questionID.questionText', read_only=True)
    fieldType = serializers.CharField(source='questionID.fieldType', read_only=True)

    class Meta:
        model  = FeedbackAnswer
        fields = ['questionID', 'questionText', 'fieldType', 'scoreValue', 'booleanValue', 'decimalValue']


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------

class FeedbackSubmissionSerializer(serializers.ModelSerializer):
    answers      = FeedbackAnswerSerializer(many=True, read_only=True)
    employeeID   = serializers.CharField(source='employeeID_id')
    employeeName = serializers.CharField(source='employeeID.fullName', read_only=True)
    formID       = serializers.CharField(source='formID_id')
    formTitle    = serializers.CharField(source='formID.title', read_only=True)

    class Meta:
        model  = FeedbackSubmission
        fields = ['submissionID', 'formID', 'formTitle', 'employeeID',
                  'employeeName', 'status', 'submittedAt', 'answers']


class SubmitFeedbackSerializer(serializers.Serializer):
    """Employee submits all answers at once."""
    employeeID = serializers.CharField(max_length=50)
    answers    = serializers.ListField(child=serializers.DictField())

    def validate_answers(self, value):
        for item in value:
            if 'questionID' not in item:
                raise serializers.ValidationError("Each answer must include 'questionID'.")
            filled = [
                item.get('scoreValue')   is not None,
                item.get('booleanValue') is not None,
                item.get('decimalValue') is not None,
            ]
            if sum(filled) == 0:
                raise serializers.ValidationError(
                    f"Answer for question {item['questionID']} has no value.")
            if sum(filled) > 1:
                raise serializers.ValidationError(
                    f"Answer for question {item['questionID']} has multiple values.")
            if item.get('scoreValue') is not None:
                if item['scoreValue'] not in [1, 2, 3, 4]:
                    raise serializers.ValidationError(
                        f"scoreValue for {item['questionID']} must be 1-4.")
        return value
