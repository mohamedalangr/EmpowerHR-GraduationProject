from rest_framework import serializers
from .models import AttritionPrediction


class AttritionPredictionSerializer(serializers.ModelSerializer):
    employeeID   = serializers.CharField(source='employeeID_id')
    employeeName = serializers.CharField(source='employeeID.fullName',   read_only=True)
    jobTitle     = serializers.CharField(source='employeeID.jobTitle',   read_only=True)
    team         = serializers.CharField(source='employeeID.team',       read_only=True)
    department   = serializers.CharField(source='employeeID.department', read_only=True)

    class Meta:
        model  = AttritionPrediction
        fields = [
            'predictionID',
            'employeeID',
            'employeeName',
            'jobTitle',
            'team',
            'department',
            'riskScore',
            'riskLevel',
            'feedbackFormID',
            'predictedAt',
        ]
