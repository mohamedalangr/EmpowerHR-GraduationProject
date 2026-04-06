from rest_framework import serializers

from feedback.models import FeedbackSubmission

from .models import AttritionPrediction
from .predictor import build_prediction_insights


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
            'feedbackFormID',
            'predictedAt',
            'explanationSummary',
            'riskDrivers',
            'recommendedActions',
        ]

    def _get_prediction_insights(self, obj):
        cache = getattr(self, '_prediction_insight_cache', {})
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
        insights = build_prediction_insights(
            employee=obj.employeeID,
            answers_qs=answers,
            risk_score=obj.riskScore,
            risk_level=obj.riskLevel,
            missing_fields=[],
        )
        cache[obj.predictionID] = insights
        self._prediction_insight_cache = cache
        return insights

    def get_explanationSummary(self, obj):
        return self._get_prediction_insights(obj)['explanationSummary']

    def get_riskDrivers(self, obj):
        return self._get_prediction_insights(obj)['riskDrivers']

    def get_recommendedActions(self, obj):
        return self._get_prediction_insights(obj)['recommendedActions']
