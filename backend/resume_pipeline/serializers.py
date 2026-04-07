from django.conf import settings
from rest_framework import serializers
from .models import Job, Submission


class JobSerializer(serializers.ModelSerializer):
    submission_count = serializers.IntegerField(source="submissions.count", read_only=True)

    class Meta:
        model  = Job
        fields = [
            "id", "title", "description", "required_skills",
            "min_experience_years", "required_degree",
            "weight_skills", "weight_experience", "weight_education", "weight_semantic",
            "is_active", "created_at", "submission_count",
        ]
        read_only_fields = ["created_at", "required_skills"]

    def validate(self, data):
        ws = data.get("weight_skills",     self.instance.weight_skills     if self.instance else 0.40)
        we = data.get("weight_experience", self.instance.weight_experience if self.instance else 0.30)
        wu = data.get("weight_education",  self.instance.weight_education  if self.instance else 0.10)
        wm = data.get("weight_semantic",   self.instance.weight_semantic   if self.instance else 0.20)
        total = round(ws + we + wu + wm, 10)
        if abs(total - 1.0) > 0.001:
            raise serializers.ValidationError(f"Weights must sum to 1.0. Got: {total:.3f}")
        return data


class SubmissionSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source="job.title", read_only=True)
    resume_file = serializers.FileField(read_only=True)
    resume_filename = serializers.SerializerMethodField()
    decisionSupportOnly = serializers.SerializerMethodField()
    recommendationNotice = serializers.SerializerMethodField()
    processingMode = serializers.SerializerMethodField()

    def get_resume_filename(self, obj):
        if not obj.resume_file:
            return ""
        return obj.resume_file.name.split("/")[-1]

    def get_decisionSupportOnly(self, obj):
        return getattr(settings, 'AI_DECISION_SUPPORT_ONLY', True)

    def get_recommendationNotice(self, obj):
        return getattr(
            settings,
            'AI_GOVERNANCE_NOTICE',
            'AI outputs are advisory only and must be reviewed by HR before any employment decision.',
        )

    def get_processingMode(self, obj):
        return 'async' if obj.status in {Submission.Status.PENDING, Submission.Status.PROCESSING} and getattr(settings, 'AI_PIPELINE_ASYNC', False) else 'sync'

    class Meta:
        model  = Submission
        fields = [
            "id", "job", "job_title",
            "candidate_name", "candidate_email", "tracking_code",
            "resume_file", "resume_filename",
            "status", "review_stage", "stage_notes", "stage_updated_at", "talent_pool", "stage_history", "error_message",
            "candidate_skills", "candidate_degree", "candidate_years_exp",
            "skills_score", "experience_score", "education_score",
            "semantic_score", "ats_score",
            "submitted_at", "scored_at",
            "decisionSupportOnly", "recommendationNotice", "processingMode",
        ]
        read_only_fields = [
            "tracking_code", "status", "review_stage", "stage_notes", "stage_updated_at", "talent_pool", "stage_history", "error_message",
            "candidate_skills", "candidate_degree", "candidate_years_exp",
            "skills_score", "experience_score", "education_score",
            "semantic_score", "ats_score",
            "submitted_at", "scored_at",
        ]


class SubmissionUploadSerializer(serializers.ModelSerializer):
    """Used only for the upload endpoint — accepts the file."""
    class Meta:
        model  = Submission
        fields = ["job", "candidate_name", "candidate_email", "resume_file"]

    def validate_resume_file(self, value):
        allowed_extensions = (".pdf", ".txt")
        if not value.name.lower().endswith(allowed_extensions):
            raise serializers.ValidationError("Only PDF or TXT files are accepted.")
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("File too large (max 10 MB).")
        return value


class SubmissionStageUpdateSerializer(serializers.Serializer):
    review_stage = serializers.ChoiceField(choices=Submission.ReviewStage.choices)
    stage_notes = serializers.CharField(required=False, allow_blank=True)
    talent_pool = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if attrs.get('review_stage') in {Submission.ReviewStage.REJECTED, Submission.ReviewStage.HIRED} and not (attrs.get('stage_notes') or '').strip():
            raise serializers.ValidationError({'stage_notes': 'Please add a short hiring note before finalizing this stage.'})
        return attrs
