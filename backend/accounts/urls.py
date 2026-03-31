from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    LogoutView,
    MeView,
    ChangePasswordView,
    CandidateRegisterView,
    CreateEmployeeView,
)

urlpatterns = [
    # --- Token endpoints ---
    path("login/",          LoginView.as_view(),         name="auth-login"),
    path("logout/",         LogoutView.as_view(),         name="auth-logout"),
    path("token/refresh/",  TokenRefreshView.as_view(),   name="token-refresh"),

    # --- User profile ---
    path("me/",             MeView.as_view(),              name="auth-me"),
    path("change-password/",ChangePasswordView.as_view(),  name="auth-change-password"),

    # --- Registration ---
    # Candidates self-register via public portal
    path("candidate/register/",  CandidateRegisterView.as_view(), name="candidate-register"),
    # Internal employees are created by Admin only
    path("employees/create/",    CreateEmployeeView.as_view(),    name="employee-create"),
]
