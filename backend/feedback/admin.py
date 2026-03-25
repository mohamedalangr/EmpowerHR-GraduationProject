from django.contrib import admin
from .models import (FeedbackForm, FeedbackQuestion,
                     FeedbackSubmission, FeedbackAnswer,
                     Employee, AdminUser)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display  = ['employeeID', 'fullName', 'email']
    search_fields = ['fullName', 'email', 'employeeID']


@admin.register(AdminUser)
class AdminUserAdmin(admin.ModelAdmin):
    list_display  = ['employeeID', 'fullName']
    search_fields = ['fullName', 'employeeID']


class FeedbackQuestionInline(admin.TabularInline):
    model   = FeedbackQuestion
    extra   = 3
    fields  = ['order', 'fieldType', 'questionText']
    ordering = ['order']


@admin.register(FeedbackForm)
class FeedbackFormAdmin(admin.ModelAdmin):
    list_display  = ['formID', 'title', 'isActive', 'createdAt', 'createdByAdminID']
    list_filter   = ['isActive']
    search_fields = ['title']
    readonly_fields = ['formID', 'createdAt']
    inlines       = [FeedbackQuestionInline]


@admin.register(FeedbackQuestion)
class FeedbackQuestionAdmin(admin.ModelAdmin):
    list_display  = ['questionID', 'formID', 'fieldType', 'order', 'questionText']
    list_filter   = ['fieldType', 'formID']
    search_fields = ['questionText']
    ordering      = ['formID', 'order']


class FeedbackAnswerInline(admin.TabularInline):
    model           = FeedbackAnswer
    extra           = 0
    readonly_fields = ['questionID', 'scoreValue', 'booleanValue', 'decimalValue']
    can_delete      = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(FeedbackSubmission)
class FeedbackSubmissionAdmin(admin.ModelAdmin):
    list_display    = ['submissionID', 'formID', 'employeeID', 'status', 'submittedAt']
    list_filter     = ['status', 'formID']
    search_fields   = ['employeeID__fullName', 'employeeID__employeeID']
    readonly_fields = ['submissionID', 'formID', 'employeeID', 'status', 'submittedAt']
    inlines         = [FeedbackAnswerInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(FeedbackAnswer)
class FeedbackAnswerAdmin(admin.ModelAdmin):
    list_display    = ['answerID', 'submissionID', 'questionID',
                       'scoreValue', 'booleanValue', 'decimalValue']
    search_fields   = ['submissionID__submissionID']
    readonly_fields = ['answerID', 'submissionID', 'questionID',
                       'scoreValue', 'booleanValue', 'decimalValue']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False