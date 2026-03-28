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

    class Meta:
        model  = Submission
        fields = [
            "id", "job", "job_title",
            "candidate_name", "candidate_email",
            "status", "error_message",
            "candidate_skills", "candidate_degree", "candidate_years_exp",
            "skills_score", "experience_score", "education_score",
            "semantic_score", "ats_score",
            "submitted_at", "scored_at",
        ]
        read_only_fields = [
            "status", "error_message",
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
        if not (value.name.lower().endswith(".pdf") or value.name.lower().endswith(".txt")):
            raise serializers.ValidationError("Only PDF and TXT files are accepted.")
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("File too large (max 10 MB).")
        return value
