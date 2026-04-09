from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import Throttled
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import PasswordResetOTP

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default JWT payload to include role, full_name, and employee_id.
    The frontend uses these claims to redirect to the correct portal immediately
    after login without making an extra /me request.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        token["employee_id"] = user.employee_id
        token["currency_preference"] = user.currency_preference
        token["employee_currency_preference"] = user.employee_currency_preference
        token["language_preference"] = user.language_preference
        token["theme_preference"] = user.theme_preference
        token["focus_mode_preference"] = user.focus_mode_preference
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Append user info to the login response body alongside the tokens
        data["role"] = self.user.role
        data["full_name"] = self.user.full_name
        data["employee_id"] = self.user.employee_id
        data["currency_preference"] = self.user.currency_preference
        data["employee_currency_preference"] = self.user.employee_currency_preference
        data["language_preference"] = self.user.language_preference
        data["theme_preference"] = self.user.theme_preference
        data["focus_mode_preference"] = self.user.focus_mode_preference
        return data


class UserMeSerializer(serializers.ModelSerializer):
    """Serializer for the /me endpoint, including account-level UI preferences."""

    employee_currency_preference = serializers.CharField(read_only=True)

    class Meta:
        model  = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "employee_id",
            "created_at",
            "currency_preference",
            "employee_currency_preference",
            "language_preference",
            "theme_preference",
            "focus_mode_preference",
        ]
        read_only_fields = ["id", "email", "full_name", "role", "employee_id", "created_at", "employee_currency_preference"]

    def validate_currency_preference(self, value):
        allowed = {choice for choice, _ in User.CurrencyPreference.choices}
        if value not in allowed:
            raise serializers.ValidationError("Currency preference must be either EGP or USD.")
        return value

    def validate_language_preference(self, value):
        allowed = {choice for choice, _ in User.LanguagePreference.choices}
        if value not in allowed:
            raise serializers.ValidationError("Language preference must be either en or ar.")
        return value

    def validate_theme_preference(self, value):
        allowed = {choice for choice, _ in User.ThemePreference.choices}
        if value not in allowed:
            raise serializers.ValidationError("Theme preference must be either comfort or compact.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()


class CandidateRegisterSerializer(serializers.ModelSerializer):
    """
    Self-registration for candidates via the public portal.
    Internal employees are created by Admin only — no self-registration.
    """
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = User
        fields = ["email", "full_name", "password"]

    def create(self, validated_data):
        return User.objects.create_user(
            email     = validated_data["email"],
            full_name = validated_data["full_name"],
            password  = validated_data["password"],
            role      = User.Role.CANDIDATE,
        )


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return email

        now = timezone.now()
        if user.reset_otps.filter(created_at__gte=now - timedelta(seconds=60)).exists():
            raise Throttled(wait=60, detail='Please wait before requesting another code.')

        if user.reset_otps.filter(created_at__gte=now - timedelta(hours=1)).count() >= 5:
            raise Throttled(wait=3600, detail='Too many reset attempts. Please try again later.')

        return email

    def save(self):
        email = self.validated_data['email']
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return None

        otp = PasswordResetOTP.issue_for_user(user)
        send_mail(
            subject='EmpowerHR Password Reset OTP',
            message=(
                f"Hello {user.full_name},\n\n"
                f"Your EmpowerHR one-time password reset code is: {otp.code}\n"
                f"This code expires in 10 minutes.\n\n"
                "If you did not request this change, you can ignore this email."
            ),
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@empowerhr.local'),
            recipient_list=[user.email],
            fail_silently=False,
        )
        return otp


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        user = User.objects.filter(email__iexact=attrs['email'].strip()).first()
        if not user:
            raise serializers.ValidationError({'email': 'No account found for this email.'})

        otp_record = user.reset_otps.filter(code=attrs['otp'], is_used=False).order_by('-created_at').first()
        if not otp_record:
            raise serializers.ValidationError({'otp': 'Invalid OTP code.'})

        if otp_record.is_expired:
            otp_record.is_used = True
            otp_record.save(update_fields=['is_used'])
            raise serializers.ValidationError({'otp': 'This OTP has expired. Request a new one.'})

        attrs['user'] = user
        attrs['otp_record'] = otp_record
        return attrs

    def save(self):
        user = self.validated_data['user']
        otp_record = self.validated_data['otp_record']
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        otp_record.is_used = True
        otp_record.save(update_fields=['is_used'])
        return user
