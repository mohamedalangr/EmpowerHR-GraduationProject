from rest_framework import serializers

from feedback.models import FeedbackSubmission

from .models import AttritionPrediction
from .predictor import build_feature_vector, build_prediction_insights, build_prediction_metadata


class AttritionPredictionSerializer(serializers.ModelSerializer):
    employeeID = serializers.CharField(source='employeeID_id')
    employeeName = serializers.CharField(source='employeeID.fullName', read_only=True)
    fullName = serializers.CharField(source='employeeID.fullName', read_only=True)
    jobTitle = serializers.CharField(source='employeeID.jobTitle', read_only=True)
    team = serializers.CharField(source='employeeID.team', read_only=True)
    department = serializers.CharField(source='employeeID.department', read_only=True)
    explanationSummary = serializers.SerializerMethodField()
    riskDrivers = serializers.SerializerMethodField()
    recommendedActions = serializers.SerializerMethodField()
    confidenceLabel = serializers.SerializerMethodField()
    decisionSupportOnly = serializers.SerializerMethodField()
    neutralizedProtectedFields = serializers.SerializerMethodField()
    fairnessNotice = serializers.SerializerMethodField()
    governanceNotice = serializers.SerializerMethodField()

    class Meta:
        model = AttritionPrediction
        fields = [
            'predictionID',
            'employeeID',
            'employeeName',
            'fullName',
            'jobTitle',
            'team',
            'department',
            'riskScore',
            'riskLevel',
            'confidenceScore',
            'confidenceLabel',
            'predictionSource',
            'modelVersion',
            'reviewRequired',
            'decisionSupportOnly',
            'neutralizedProtectedFields',
            'fairnessNotice',
            'governanceNotice',
            'feedbackFormID',
            'predictedAt',
            'explanationSummary',
            'riskDrivers',
            'recommendedActions',
        ]

    def _get_prediction_package(self, obj):
        cache = getattr(self, '_prediction_payload_cache', {})
        if obj.predictionID in cache:
            return cache[obj.predictionID]

        submissions = FeedbackSubmission.objects.filter(
            employeeID=obj.employeeID,
            status=FeedbackSubmission.STATUS_COMPLETED,
        )
        if obj.feedbackFormID:
            submissions = submissions.filter(formID_id=obj.feedbackFormID)

        submission = submissions.prefetch_related('answers__questionID').order_by('-submittedAt').first()
        answers = list(submission.answers.select_related('questionID').all()) if submission else []
        _, missing_fields = build_feature_vector(obj.employeeID, answers)
        payload = {
            **build_prediction_insights(
                employee=obj.employeeID,
                answers_qs=answers,
                risk_score=obj.riskScore,
                risk_level=obj.riskLevel,
                missing_fields=missing_fields,
            ),
            **build_prediction_metadata(
                risk_score=obj.riskScore,
                missing_fields=missing_fields,
                prediction_source=obj.predictionSource or 'xgboost',
            ),
        }
        cache[obj.predictionID] = payload
        self._prediction_payload_cache = cache
        return payload

    def get_explanationSummary(self, obj):
        return self._get_prediction_package(obj)['explanationSummary']

    def get_riskDrivers(self, obj):
        return self._get_prediction_package(obj)['riskDrivers']

    def get_recommendedActions(self, obj):
        return self._get_prediction_package(obj)['recommendedActions']

    def get_confidenceLabel(self, obj):
        return self._get_prediction_package(obj)['confidenceLabel']

    def get_decisionSupportOnly(self, obj):
        return self._get_prediction_package(obj)['decisionSupportOnly']

    def get_neutralizedProtectedFields(self, obj):
        return self._get_prediction_package(obj)['neutralizedProtectedFields']

    def get_fairnessNotice(self, obj):
        return self._get_prediction_package(obj)['fairnessNotice']

    def get_governanceNotice(self, obj):
        return self._get_prediction_package(obj)['governanceNotice']
