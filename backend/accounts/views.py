from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    CustomTokenObtainPairSerializer,
    UserMeSerializer,
    ChangePasswordSerializer,
    CandidateRegisterSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .permissions import IsAdmin
from .models import generate_employee_id
from .demo_access import build_demo_access_payload, ensure_demo_users


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Works for all roles. Returns access token, refresh token, role, full_name, employee_id.
    Frontend uses the role to redirect to the correct portal.
    """
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the refresh token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data["refresh"])
            token.blacklist()
            return Response({"detail": "Logged out successfully."})
        except Exception:
            return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    """
    GET /api/auth/me/
    Returns the current authenticated user's profile.
    PATCH/PUT /api/auth/me/
    Saves account-level preferences such as language, layout theme, focus mode, and optional display settings.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user).data)

    def patch(self, request):
        serializer = UserMeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        if 'currency_preference' in serializer.validated_data and request.user.role not in ['HRManager', 'Admin']:
            return Response(
                {"detail": "Only HR managers and admins can update the account currency preference."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer.save()
        return Response(UserMeSerializer(request.user).data)

    put = patch


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated successfully."})


class CandidateRegisterView(generics.CreateAPIView):
    """
    POST /api/auth/candidate/register/
    Public — candidates self-register.
    """
    permission_classes = [AllowAny]
    serializer_class   = CandidateRegisterSerializer


class RequestPasswordResetOTPView(APIView):
    """
    POST /api/auth/password-reset/request/
    Public endpoint. Sends a one-time password reset code by email if the account exists.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'detail': 'If an account exists for that email, a reset code has been sent.'},
            status=status.HTTP_200_OK,
        )


class ConfirmPasswordResetOTPView(APIView):
    """
    POST /api/auth/password-reset/confirm/
    Public endpoint. Verifies the OTP and sets a new password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password reset successful. You can now sign in.'})


class DemoAccessView(APIView):
    """
    GET /api/auth/demo-access/
    Public demo endpoint. Ensures standard role-based demo accounts exist and
    returns the credentials plus a simple access summary for each role.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        ensure_demo_users()
        return Response({'accounts': build_demo_access_payload()})


class CreateEmployeeView(APIView):
    """
    POST /api/auth/employees/create/
    Admin-only. Creates an internal employee user.
    employee_id is auto-generated — admin does not supply it.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        required = ["email", "full_name", "role", "password"]
        for field in required:
            if not request.data.get(field):
                return Response(
                    {"detail": f"'{field}' is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        role = request.data["role"]
        valid_roles = ["TeamMember", "TeamLeader", "HRManager", "Admin"]
        if role not in valid_roles:
            return Response(
                {"detail": f"Role must be one of: {valid_roles}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=request.data["email"]).exists():
            return Response(
                {"detail": "Email already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Auto-generate employee_id — admin never supplies this
        employee_id = generate_employee_id()

        user = User.objects.create_user(
            email       = request.data["email"],
            full_name   = request.data["full_name"],
            password    = request.data["password"],
            role        = role,
            employee_id = employee_id,
        )

        try:
            from feedback.models import Employee
            Employee.objects.get_or_create(
                employeeID=employee_id,
                defaults={
                    'fullName': request.data['full_name'],
                    'email': request.data['email'],
                    'role': role,
                    'employmentStatus': 'Active',
                }
            )
        except Exception:
            pass

        return Response(
            {
                "detail":      "Employee account created.",
                "employee_id": employee_id,
                "user_id":     user.id,
            },
            status=status.HTTP_201_CREATED,
        )
