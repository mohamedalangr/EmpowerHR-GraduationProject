from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import User, generate_employee_id


class EmployeeCreationForm(UserCreationForm):
    class Meta:
        model  = User
        # employee_id intentionally excluded — auto-generated on save
        fields = ("email", "full_name", "role")


class EmployeeChangeForm(UserChangeForm):
    class Meta:
        model  = User
        fields = ("email", "full_name", "role", "employee_id", "is_active")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form     = EmployeeChangeForm
    add_form = EmployeeCreationForm

    list_display  = ["email", "full_name", "role", "employee_id", "is_active", "created_at"]
    list_filter   = ["role", "is_active"]
    search_fields = ["email", "full_name", "employee_id"]
    ordering      = ["-created_at"]

    fieldsets = (
        (None,            {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("full_name", "role", "employee_id")}),
        ("Permissions",   {"fields": ("is_active", "is_staff", "is_superuser")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            # employee_id is NOT here — auto-generated in save_model below
            "fields":  ("email", "full_name", "role", "password1", "password2"),
        }),
    )

    def save_model(self, request, obj, form, change):
        """
        Auto-generate employee_id for new internal employees.
        Candidates keep employee_id = null.
        """
        if not change and obj.role != User.Role.CANDIDATE and not obj.employee_id:
            obj.employee_id = generate_employee_id()
        super().save_model(request, obj, form, change)
