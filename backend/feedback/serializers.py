from rest_framework import serializers
from .models import FeedbackForm, FeedbackQuestion, FeedbackSubmission, FeedbackAnswer


# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------

class FeedbackQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeedbackQuestion
        fields = ['questionID', 'questionText', 'fieldType', 'order']


class FeedbackQuestionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeedbackQuestion
        fields = ['questionID', 'questionText', 'fieldType', 'order']
        read_only_fields = ['questionID']


# ---------------------------------------------------------------------------
# Forms
# ---------------------------------------------------------------------------

class FeedbackFormListSerializer(serializers.ModelSerializer):
    questionCount     = serializers.IntegerField(source='questions.count', read_only=True)
    submissionCount   = serializers.IntegerField(source='submissions.count', read_only=True)

    class Meta:
        model  = FeedbackForm
        fields = ['formID', 'title', 'description', 'isActive',
                  'createdAt', 'questionCount', 'submissionCount']


class FeedbackFormDetailSerializer(serializers.ModelSerializer):
    questions = FeedbackQuestionSerializer(many=True, read_only=True)

    class Meta:
        model  = FeedbackForm
        fields = ['formID', 'title', 'description', 'isActive',
                  'createdAt', 'questions']


class FeedbackFormCreateUpdateSerializer(serializers.ModelSerializer):
    """Used by HR Manager to create or update a form."""
    class Meta:
        model  = FeedbackForm
        fields = ['formID', 'title', 'description', 'isActive']
        read_only_fields = ['formID']


# ---------------------------------------------------------------------------
# Answers
# ---------------------------------------------------------------------------

class FeedbackAnswerSerializer(serializers.ModelSerializer):
    questionID = serializers.CharField(source='questionID_id')

    class Meta:
        model  = FeedbackAnswer
        fields = ['questionID', 'scoreValue', 'booleanValue', 'decimalValue']


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------

class FeedbackSubmissionSerializer(serializers.ModelSerializer):
    answers      = FeedbackAnswerSerializer(many=True, read_only=True)
    employeeID   = serializers.CharField(source='employeeID_id')
    employeeName = serializers.CharField(source='employeeID.fullName', read_only=True)
    formID       = serializers.CharField(source='formID_id')
    formTitle    = serializers.CharField(source='formID.title', read_only=True)

    class Meta:
        model  = FeedbackSubmission
        fields = ['submissionID', 'formID', 'formTitle', 'employeeID',
                  'employeeName', 'status', 'submittedAt', 'answers']


class SubmitFeedbackSerializer(serializers.Serializer):
    """Employee submits all answers at once."""
    employeeID = serializers.CharField(max_length=50)
    answers    = serializers.ListField(child=serializers.DictField())

    def validate_answers(self, value):
        for item in value:
            if 'questionID' not in item:
                raise serializers.ValidationError("Each answer must include 'questionID'.")
            filled = [
                item.get('scoreValue')   is not None,
                item.get('booleanValue') is not None,
                item.get('decimalValue') is not None,
            ]
            if sum(filled) == 0:
                raise serializers.ValidationError(
                    f"Answer for question {item['questionID']} has no value.")
            if sum(filled) > 1:
                raise serializers.ValidationError(
                    f"Answer for question {item['questionID']} has multiple values.")
            if item.get('scoreValue') is not None:
                if item['scoreValue'] not in [1, 2, 3, 4]:
                    raise serializers.ValidationError(
                        f"scoreValue for {item['questionID']} must be 1-4.")
        return value
