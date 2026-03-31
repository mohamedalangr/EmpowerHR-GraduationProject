from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model

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
        token["role"]        = user.role
        token["full_name"]   = user.full_name
        token["employee_id"] = user.employee_id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Append user info to the login response body alongside the tokens
        data["role"]        = self.user.role
        data["full_name"]   = self.user.full_name
        data["employee_id"] = self.user.employee_id
        return data


class UserMeSerializer(serializers.ModelSerializer):
    """Read-only serializer for the /me endpoint."""

    class Meta:
        model  = User
        fields = ["id", "email", "full_name", "role", "employee_id", "created_at"]
        read_only_fields = fields


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
