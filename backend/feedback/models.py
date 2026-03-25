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

    # Display fields for HR dashboard
    jobTitle           = models.CharField(max_length=100, null=True, blank=True)
    team               = models.CharField(max_length=100, null=True, blank=True)
    department         = models.CharField(max_length=100, null=True, blank=True)

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