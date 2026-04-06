import uuid
from django.db import models


def gen_id():
    return uuid.uuid4().hex[:20]


class Employee(models.Model):
    """
    Employee model with all fields required by the attrition prediction model.
    """
    GENDER_CHOICES       = [('Male', 'Male'), ('Female', 'Female')]
    EDUCATION_CHOICES    = [(1, 'High School'), (2, 'Associate Degree'),
                             (3, "Bachelor's Degree"), (4, "Master's Degree"), (5, 'PhD')]
    JOB_LEVEL_CHOICES    = [(1, 'Entry'), (2, 'Mid'), (3, 'Senior')]
    COMPANY_SIZE_CHOICES = [(1, 'Small'), (2, 'Medium'), (3, 'Large')]
    MARITAL_CHOICES      = [('Single', 'Single'), ('Married', 'Married'),
                             ('Divorced', 'Divorced')]

    # Identity
    employeeID         = models.CharField(max_length=50, primary_key=True, default=gen_id)
    fullName           = models.CharField(max_length=150)
    email              = models.CharField(max_length=150, unique=True)

    # Display fields for HR dashboard / employee directory
    jobTitle           = models.CharField(max_length=100, null=True, blank=True)
    team               = models.CharField(max_length=100, null=True, blank=True)
    department         = models.CharField(max_length=100, null=True, blank=True)
    role               = models.CharField(max_length=50, null=True, blank=True)
    employeeType       = models.CharField(max_length=30, null=True, blank=True)
    location           = models.CharField(max_length=100, null=True, blank=True)
    employmentStatus   = models.CharField(max_length=30, default='Active')
    isDeleted          = models.BooleanField(default=False)

    # Profile fields used by attrition model
    age                = models.IntegerField(null=True, blank=True)
    gender             = models.CharField(max_length=10, choices=GENDER_CHOICES,
                                          null=True, blank=True)
    yearsAtCompany     = models.IntegerField(null=True, blank=True)
    monthlyIncome      = models.IntegerField(null=True, blank=True)
    performanceRating  = models.IntegerField(null=True, blank=True)
    numberOfPromotions = models.IntegerField(null=True, blank=True)
    overtime           = models.BooleanField(null=True, blank=True)
    educationLevel     = models.IntegerField(choices=EDUCATION_CHOICES,
                                             null=True, blank=True)
    numberOfDependents = models.IntegerField(null=True, blank=True)
    jobLevel           = models.IntegerField(choices=JOB_LEVEL_CHOICES,
                                             null=True, blank=True)
    companySize        = models.IntegerField(choices=COMPANY_SIZE_CHOICES,
                                             null=True, blank=True)
    companyTenure      = models.IntegerField(null=True, blank=True)
    remoteWork         = models.BooleanField(null=True, blank=True)
    maritalStatus      = models.CharField(max_length=20, choices=MARITAL_CHOICES,
                                          null=True, blank=True)

    class Meta:
        db_table = 'feedback_employee'

    def __str__(self):
        return f"{self.fullName} ({self.employeeID})"


class EmployeeJobHistory(models.Model):
    ACTION_CHOICES = [
        ('Promotion', 'Promotion'),
        ('Demotion', 'Demotion'),
        ('Role Change', 'Role Change'),
    ]

    historyID            = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee             = models.ForeignKey(
                               Employee, on_delete=models.CASCADE,
                               db_column='employeeID', related_name='job_history')
    action               = models.CharField(max_length=20, choices=ACTION_CHOICES)
    previousJobTitle     = models.CharField(max_length=100, blank=True)
    newJobTitle          = models.CharField(max_length=100, blank=True)
    previousRole         = models.CharField(max_length=50, blank=True)
    newRole              = models.CharField(max_length=50, blank=True)
    previousDepartment   = models.CharField(max_length=100, blank=True)
    newDepartment        = models.CharField(max_length=100, blank=True)
    previousTeam         = models.CharField(max_length=100, blank=True)
    newTeam              = models.CharField(max_length=100, blank=True)
    previousMonthlyIncome= models.IntegerField(null=True, blank=True)
    newMonthlyIncome     = models.IntegerField(null=True, blank=True)
    changedBy            = models.CharField(max_length=150, blank=True)
    notes                = models.TextField(blank=True)
    changedAt            = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'EmployeeJobHistory'
        ordering = ['-changedAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.action}"


class AttendanceRecord(models.Model):
    STATUS_CLOCKED_IN = 'Clocked In'
    STATUS_PRESENT = 'Present'
    STATUS_PARTIAL = 'Partial'
    STATUS_CHOICES = [
        (STATUS_CLOCKED_IN, 'Clocked In'),
        (STATUS_PRESENT, 'Present'),
        (STATUS_PARTIAL, 'Partial'),
    ]

    attendanceID = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee     = models.ForeignKey(
                       Employee, on_delete=models.CASCADE,
                       db_column='employeeID', related_name='attendance_records')
    date         = models.DateField()
    clockIn      = models.DateTimeField(null=True, blank=True)
    clockOut     = models.DateTimeField(null=True, blank=True)
    workedHours  = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_CLOCKED_IN)
    notes        = models.TextField(blank=True)
    createdAt    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'AttendanceRecord'
        ordering = ['-date', '-clockIn']
        unique_together = ('employee', 'date')

    def __str__(self):
        return f"{self.employee.fullName} — {self.date}"


class LeaveRequest(models.Model):
    TYPE_ANNUAL = 'Annual'
    TYPE_SICK = 'Sick'
    TYPE_UNPAID = 'Unpaid'
    TYPE_CASUAL = 'Casual'
    LEAVE_TYPES = [
        (TYPE_ANNUAL, 'Annual'),
        (TYPE_SICK, 'Sick'),
        (TYPE_UNPAID, 'Unpaid'),
        (TYPE_CASUAL, 'Casual'),
    ]

    STATUS_PENDING = 'Pending'
    STATUS_APPROVED = 'Approved'
    STATUS_REJECTED = 'Rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    leaveRequestID     = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee           = models.ForeignKey(
                             Employee, on_delete=models.CASCADE,
                             db_column='employeeID', related_name='leave_requests')
    leaveType          = models.CharField(max_length=20, choices=LEAVE_TYPES)
    startDate          = models.DateField()
    endDate            = models.DateField()
    daysRequested      = models.IntegerField(default=1)
    reason             = models.TextField()
    status             = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    eligibilityMessage = models.CharField(max_length=255, blank=True)
    reviewNotes        = models.TextField(blank=True)
    reviewedBy         = models.CharField(max_length=150, blank=True)
    reviewedAt         = models.DateTimeField(null=True, blank=True)
    requestedAt        = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'LeaveRequest'
        ordering = ['-requestedAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.leaveType} ({self.status})"


class PayrollRecord(models.Model):
    STATUS_DRAFT = 'Draft'
    STATUS_PAID = 'Paid'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_PAID, 'Paid'),
    ]

    payrollID   = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee    = models.ForeignKey(
                      Employee, on_delete=models.CASCADE,
                      db_column='employeeID', related_name='payroll_records')
    payPeriod   = models.CharField(max_length=20)
    baseSalary  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    allowances  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bonus       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    netPay      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    paymentDate = models.DateField(null=True, blank=True)
    notes       = models.TextField(blank=True)
    createdAt   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'PayrollRecord'
        ordering = ['-payPeriod', '-createdAt']
        unique_together = ('employee', 'payPeriod')

    def __str__(self):
        return f"{self.employee.fullName} — {self.payPeriod}"


class EmployeeGoal(models.Model):
    CATEGORY_CHOICES = [
        ('Performance', 'Performance'),
        ('Development', 'Development'),
        ('Leadership', 'Leadership'),
        ('Attendance', 'Attendance'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]
    STATUS_CHOICES = [
        ('Not Started', 'Not Started'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('On Hold', 'On Hold'),
    ]

    goalID       = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee     = models.ForeignKey(
                       Employee, on_delete=models.CASCADE,
                       db_column='employeeID', related_name='goals')
    title        = models.CharField(max_length=160)
    description  = models.TextField(blank=True)
    category     = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='Performance')
    priority     = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Not Started')
    progress     = models.PositiveIntegerField(default=0)
    dueDate      = models.DateField(null=True, blank=True)
    createdBy    = models.CharField(max_length=150, blank=True)
    createdAt    = models.DateTimeField(auto_now_add=True)
    updatedAt    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'EmployeeGoal'
        ordering = ['dueDate', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.title}"


class WorkTask(models.Model):
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]
    STATUS_CHOICES = [
        ('To Do', 'To Do'),
        ('In Progress', 'In Progress'),
        ('Done', 'Done'),
        ('Blocked', 'Blocked'),
    ]

    taskID          = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee        = models.ForeignKey(
                         Employee, on_delete=models.CASCADE,
                         db_column='employeeID', related_name='tasks')
    title           = models.CharField(max_length=160)
    description     = models.TextField(blank=True)
    priority        = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='To Do')
    progress        = models.PositiveIntegerField(default=0)
    estimatedHours  = models.PositiveIntegerField(null=True, blank=True)
    dueDate         = models.DateField(null=True, blank=True)
    assignedBy      = models.CharField(max_length=150, blank=True)
    createdAt       = models.DateTimeField(auto_now_add=True)
    updatedAt       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'WorkTask'
        ordering = ['dueDate', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.title}"


class TrainingCourse(models.Model):
    CATEGORY_CHOICES = [
        ('Technical', 'Technical'),
        ('Compliance', 'Compliance'),
        ('Leadership', 'Leadership'),
        ('Soft Skills', 'Soft Skills'),
    ]

    courseID             = models.CharField(max_length=50, primary_key=True, default=gen_id)
    title                = models.CharField(max_length=160)
    description          = models.TextField(blank=True)
    category             = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='Technical')
    durationHours        = models.PositiveIntegerField(default=1)
    assignedEmployeeIDs  = models.JSONField(default=list, blank=True)
    completionData       = models.JSONField(default=dict, blank=True)
    dueDate              = models.DateField(null=True, blank=True)
    createdBy            = models.CharField(max_length=150, blank=True)
    createdAt            = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'TrainingCourse'
        ordering = ['dueDate', '-createdAt']

    def __str__(self):
        return self.title


class PerformanceReview(models.Model):
    REVIEW_TYPES = [
        ('Quarterly', 'Quarterly'),
        ('Annual', 'Annual'),
        ('Probation', 'Probation'),
        ('Spot', 'Spot'),
    ]
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Acknowledged', 'Acknowledged'),
    ]

    reviewID          = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee          = models.ForeignKey(
                            Employee, on_delete=models.CASCADE,
                            db_column='employeeID', related_name='performance_reviews')
    reviewPeriod      = models.CharField(max_length=50)
    reviewType        = models.CharField(max_length=20, choices=REVIEW_TYPES, default='Quarterly')
    overallRating     = models.PositiveIntegerField(default=3)
    status            = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    strengths         = models.TextField(blank=True)
    improvementAreas  = models.TextField(blank=True)
    goalsSummary      = models.TextField(blank=True)
    employeeNote      = models.TextField(blank=True)
    reviewDate        = models.DateField(null=True, blank=True)
    acknowledgedAt    = models.DateTimeField(null=True, blank=True)
    createdBy         = models.CharField(max_length=150, blank=True)
    createdAt         = models.DateTimeField(auto_now_add=True)
    updatedAt         = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'PerformanceReview'
        ordering = ['-reviewDate', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.reviewPeriod}"


class SuccessionPlan(models.Model):
    READINESS_CHOICES = [
        ('Ready Now', 'Ready Now'),
        ('6-12 Months', '6-12 Months'),
        ('1-2 Years', '1-2 Years'),
        ('Long Term', 'Long Term'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('On Track', 'On Track'),
        ('Acknowledged', 'Acknowledged'),
        ('Completed', 'Completed'),
        ('On Hold', 'On Hold'),
    ]
    RISK_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]

    planID              = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee            = models.ForeignKey(
                              Employee, on_delete=models.CASCADE,
                              db_column='employeeID', related_name='succession_plans')
    targetRole          = models.CharField(max_length=120)
    readiness           = models.CharField(max_length=20, choices=READINESS_CHOICES, default='1-2 Years')
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    retentionRisk       = models.CharField(max_length=10, choices=RISK_CHOICES, default='Low')
    developmentActions  = models.TextField(blank=True)
    notes               = models.TextField(blank=True)
    employeeNote        = models.TextField(blank=True)
    acknowledgedAt      = models.DateTimeField(null=True, blank=True)
    createdBy           = models.CharField(max_length=150, blank=True)
    createdAt           = models.DateTimeField(auto_now_add=True)
    updatedAt           = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'SuccessionPlan'
        ordering = ['-updatedAt', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} → {self.targetRole}"


class OnboardingPlan(models.Model):
    PLAN_TYPE_CHOICES = [
        ('Onboarding', 'Onboarding'),
        ('Offboarding', 'Offboarding'),
        ('Transition', 'Transition'),
    ]
    STATUS_CHOICES = [
        ('Not Started', 'Not Started'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Blocked', 'Blocked'),
    ]

    planID          = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee        = models.ForeignKey(
                        Employee, on_delete=models.CASCADE,
                        db_column='employeeID', related_name='onboarding_plans')
    planType        = models.CharField(max_length=20, choices=PLAN_TYPE_CHOICES, default='Onboarding')
    title           = models.CharField(max_length=160)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Not Started')
    progress        = models.PositiveIntegerField(default=0)
    startDate       = models.DateField(null=True, blank=True)
    targetDate      = models.DateField(null=True, blank=True)
    checklistItems  = models.JSONField(default=list, blank=True)
    notes           = models.TextField(blank=True)
    employeeNote    = models.TextField(blank=True)
    createdBy       = models.CharField(max_length=150, blank=True)
    createdAt       = models.DateTimeField(auto_now_add=True)
    updatedAt       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'OnboardingPlan'
        ordering = ['targetDate', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.title}"


class ShiftSchedule(models.Model):
    SHIFT_TYPE_CHOICES = [
        ('Morning', 'Morning'),
        ('Evening', 'Evening'),
        ('Night', 'Night'),
        ('Remote', 'Remote'),
        ('Flexible', 'Flexible'),
    ]
    STATUS_CHOICES = [
        ('Planned', 'Planned'),
        ('Confirmed', 'Confirmed'),
        ('Completed', 'Completed'),
        ('Swapped', 'Swapped'),
    ]

    scheduleID      = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee        = models.ForeignKey(
                        Employee, on_delete=models.CASCADE,
                        db_column='employeeID', related_name='shift_schedules')
    shiftDate       = models.DateField()
    shiftType       = models.CharField(max_length=20, choices=SHIFT_TYPE_CHOICES, default='Morning')
    startTime       = models.TimeField()
    endTime         = models.TimeField()
    location        = models.CharField(max_length=120, blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Planned')
    notes           = models.TextField(blank=True)
    employeeNote    = models.TextField(blank=True)
    acknowledgedAt  = models.DateTimeField(null=True, blank=True)
    createdBy       = models.CharField(max_length=150, blank=True)
    createdAt       = models.DateTimeField(auto_now_add=True)
    updatedAt       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ShiftSchedule'
        ordering = ['shiftDate', 'startTime', '-createdAt']
        unique_together = ('employee', 'shiftDate', 'startTime')

    def __str__(self):
        return f"{self.employee.fullName} — {self.shiftDate} {self.shiftType}"


class PolicyAnnouncement(models.Model):
    CATEGORY_CHOICES = [
        ('Policy', 'Policy'),
        ('Announcement', 'Announcement'),
    ]
    AUDIENCE_CHOICES = [
        ('All Employees', 'All Employees'),
        ('Managers', 'Managers'),
        ('Team Leaders', 'Team Leaders'),
    ]
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Published', 'Published'),
        ('Acknowledged', 'Acknowledged'),
    ]

    policyID         = models.CharField(max_length=50, primary_key=True, default=gen_id)
    title            = models.CharField(max_length=180)
    category         = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='Policy')
    audience         = models.CharField(max_length=30, choices=AUDIENCE_CHOICES, default='All Employees')
    content          = models.TextField()
    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    effectiveDate    = models.DateField(null=True, blank=True)
    acknowledgedByIDs = models.JSONField(default=list, blank=True)
    acknowledgementNotes = models.JSONField(default=dict, blank=True)
    acknowledgedAt   = models.DateTimeField(null=True, blank=True)
    lastReminderAt   = models.DateTimeField(null=True, blank=True)
    lastReminderNote = models.TextField(blank=True)
    reminderCount    = models.PositiveIntegerField(default=0)
    reminderHistory  = models.JSONField(default=list, blank=True)
    createdBy        = models.CharField(max_length=150, blank=True)
    createdAt        = models.DateTimeField(auto_now_add=True)
    updatedAt        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'PolicyAnnouncement'
        ordering = ['-effectiveDate', '-createdAt']

    def __str__(self):
        return self.title


class RecognitionAward(models.Model):
    CATEGORY_CHOICES = [
        ('Achievement', 'Achievement'),
        ('Appreciation', 'Appreciation'),
        ('Innovation', 'Innovation'),
        ('Teamwork', 'Teamwork'),
        ('Leadership', 'Leadership'),
    ]

    awardID          = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee         = models.ForeignKey(
                         Employee, on_delete=models.CASCADE,
                         db_column='employeeID', related_name='recognition_awards')
    title            = models.CharField(max_length=160)
    category         = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='Achievement')
    message          = models.TextField(blank=True)
    points           = models.PositiveIntegerField(default=0)
    recognitionDate  = models.DateField()
    recognizedBy     = models.CharField(max_length=150, blank=True)
    createdAt        = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'RecognitionAward'
        ordering = ['-recognitionDate', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.title}"


class BenefitEnrollment(models.Model):
    BENEFIT_TYPE_CHOICES = [
        ('Medical', 'Medical'),
        ('Dental', 'Dental'),
        ('Retirement', 'Retirement'),
        ('Transportation', 'Transportation'),
        ('Wellness', 'Wellness'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Enrolled', 'Enrolled'),
        ('Waived', 'Waived'),
    ]

    enrollmentID         = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee             = models.ForeignKey(
                               Employee, on_delete=models.CASCADE,
                               db_column='employeeID', related_name='benefit_enrollments')
    benefitName          = models.CharField(max_length=160)
    benefitType          = models.CharField(max_length=30, choices=BENEFIT_TYPE_CHOICES, default='Medical')
    provider             = models.CharField(max_length=120, blank=True)
    coverageLevel        = models.CharField(max_length=50, blank=True)
    status               = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    monthlyCost          = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    employeeContribution = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    effectiveDate        = models.DateField(null=True, blank=True)
    notes                = models.TextField(blank=True)
    employeeNote         = models.TextField(blank=True)
    acknowledgedAt       = models.DateTimeField(null=True, blank=True)
    createdBy            = models.CharField(max_length=150, blank=True)
    createdAt            = models.DateTimeField(auto_now_add=True)
    updatedAt            = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'BenefitEnrollment'
        ordering = ['-effectiveDate', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.benefitName}"


class ExpenseClaim(models.Model):
    CATEGORY_CHOICES = [
        ('Travel', 'Travel'),
        ('Meals', 'Meals'),
        ('Supplies', 'Supplies'),
        ('Training', 'Training'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Submitted', 'Submitted'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Reimbursed', 'Reimbursed'),
    ]

    claimID      = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee     = models.ForeignKey(
                     Employee, on_delete=models.CASCADE,
                     db_column='employeeID', related_name='expense_claims')
    title        = models.CharField(max_length=160)
    category     = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='Other')
    amount       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expenseDate  = models.DateField()
    description  = models.TextField(blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Submitted')
    reviewNote   = models.TextField(blank=True)
    reviewedBy   = models.CharField(max_length=150, blank=True)
    reviewedAt   = models.DateTimeField(null=True, blank=True)
    createdAt    = models.DateTimeField(auto_now_add=True)
    updatedAt    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ExpenseClaim'
        ordering = ['-expenseDate', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.title}"


class DocumentRequest(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ('Salary Certificate', 'Salary Certificate'),
        ('Employment Letter', 'Employment Letter'),
        ('Experience Letter', 'Experience Letter'),
        ('ID Verification', 'ID Verification'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Issued', 'Issued'),
        ('Declined', 'Declined'),
    ]

    requestID    = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee     = models.ForeignKey(
                     Employee, on_delete=models.CASCADE,
                     db_column='employeeID', related_name='document_requests')
    documentType = models.CharField(max_length=30, choices=DOCUMENT_TYPE_CHOICES, default='Employment Letter')
    purpose      = models.CharField(max_length=180)
    notes        = models.TextField(blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    reviewNote   = models.TextField(blank=True)
    issuedBy     = models.CharField(max_length=150, blank=True)
    issuedAt     = models.DateTimeField(null=True, blank=True)
    createdAt    = models.DateTimeField(auto_now_add=True)
    updatedAt    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'DocumentRequest'
        ordering = ['-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.documentType}"


class SupportTicket(models.Model):
    CATEGORY_CHOICES = [
        ('IT', 'IT'),
        ('Payroll', 'Payroll'),
        ('Benefits', 'Benefits'),
        ('Policy', 'Policy'),
        ('General', 'General'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('In Progress', 'In Progress'),
        ('Resolved', 'Resolved'),
        ('Closed', 'Closed'),
    ]

    ticketID        = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employee        = models.ForeignKey(
                          Employee, on_delete=models.CASCADE,
                          db_column='employeeID', related_name='support_tickets')
    subject         = models.CharField(max_length=180)
    category        = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='General')
    priority        = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    description     = models.TextField(blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    resolutionNote  = models.TextField(blank=True)
    assignedTo      = models.CharField(max_length=150, blank=True)
    resolvedAt      = models.DateTimeField(null=True, blank=True)
    createdAt       = models.DateTimeField(auto_now_add=True)
    updatedAt       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'SupportTicket'
        ordering = ['-updatedAt', '-createdAt']

    def __str__(self):
        return f"{self.employee.fullName} — {self.subject}"


class AdminUser(models.Model):
    """
    Minimal Admin stub. Replace with full Admin model later.
    Named AdminUser to avoid conflict with Django's built-in Admin.
    """
    employeeID = models.CharField(max_length=50, primary_key=True, default=gen_id)
    fullName   = models.CharField(max_length=150)

    class Meta:
        db_table = 'feedback_admin'

    def __str__(self):
        return f"Admin: {self.fullName}"


class FeedbackForm(models.Model):
    """
    A feedback form created by an admin.
    Contains a set of questions employees will answer.
    """
    formID           = models.CharField(max_length=50, primary_key=True, default=gen_id)
    title            = models.CharField(max_length=200)
    description      = models.TextField(blank=True, null=True)
    createdByAdminID = models.ForeignKey(
                         AdminUser, on_delete=models.SET_NULL,
                         null=True, blank=True,
                         db_column='createdByAdminID',
                         related_name='created_forms')
    createdAt        = models.DateTimeField(auto_now_add=True)
    isActive         = models.BooleanField(default=True)

    class Meta:
        db_table = 'FeedbackForm'
        ordering = ['-createdAt']

    def save(self, *args, **kwargs):
        if self.isActive:
            # Deactivate all other forms when this one is set to active
            FeedbackForm.objects.exclude(pk=self.formID).update(isActive=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class FeedbackQuestion(models.Model):
    """
    A single question belonging to a FeedbackForm.
    fieldType determines which answer column is used in FeedbackAnswer.
    """
    FIELD_TYPES = [
        ('score_1_4', 'Score 1-4'),
        ('boolean',   'Yes / No'),
        ('decimal',   'Decimal Number'),
    ]

    questionID   = models.CharField(max_length=50, primary_key=True, default=gen_id)
    formID       = models.ForeignKey(
                     FeedbackForm, on_delete=models.CASCADE,
                     db_column='formID',
                     related_name='questions')
    questionText = models.CharField(max_length=300)
    fieldType    = models.CharField(max_length=20, choices=FIELD_TYPES)
    order        = models.IntegerField(default=0)

    class Meta:
        db_table = 'FeedbackQuestion'
        ordering = ['order']

    def __str__(self):
        return f"[{self.fieldType}] {self.questionText[:60]}"


class FeedbackSubmission(models.Model):
    """
    One submission per employee per form.
    Created when the form is assigned; status flips to Completed on submit.
    """
    STATUS_PENDING   = 'Pending'
    STATUS_COMPLETED = 'Completed'
    STATUS_CHOICES   = [
        (STATUS_PENDING,   'Pending'),
        (STATUS_COMPLETED, 'Completed'),
    ]

    submissionID = models.CharField(max_length=50, primary_key=True, default=gen_id)
    formID       = models.ForeignKey(
                     FeedbackForm, on_delete=models.CASCADE,
                     db_column='formID',
                     related_name='submissions')
    employeeID   = models.ForeignKey(
                     Employee, on_delete=models.CASCADE,
                     db_column='employeeID',
                     related_name='submissions')
    submittedAt  = models.DateTimeField(null=True, blank=True)
    status       = models.CharField(
                     max_length=20, choices=STATUS_CHOICES,
                     default=STATUS_PENDING)

    class Meta:
        db_table      = 'FeedbackSubmission'
        unique_together = ('formID', 'employeeID')

    def __str__(self):
        return f"Submission {self.submissionID} — {self.employeeID_id} — {self.status}"


class FeedbackAnswer(models.Model):
    """
    One answer row per question per submission.
    Only one of scoreValue / booleanValue / decimalValue
    will be populated depending on the question's fieldType.
    """
    answerID     = models.CharField(max_length=50, primary_key=True, default=gen_id)
    submissionID = models.ForeignKey(
                     FeedbackSubmission, on_delete=models.CASCADE,
                     db_column='submissionID',
                     related_name='answers')
    questionID   = models.ForeignKey(
                     FeedbackQuestion, on_delete=models.CASCADE,
                     db_column='questionID',
                     related_name='answers')
    scoreValue   = models.IntegerField(null=True, blank=True)
    booleanValue = models.BooleanField(null=True, blank=True)
    decimalValue = models.DecimalField(
                     max_digits=8, decimal_places=2,
                     null=True, blank=True)

    class Meta:
        db_table      = 'FeedbackAnswer'
        unique_together = ('submissionID', 'questionID')

    def __str__(self):
        return f"Answer {self.answerID} — Q:{self.questionID_id}"