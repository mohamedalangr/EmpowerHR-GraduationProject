from django.urls import path
from .views import (
    JobListCreateView, JobDetailView, JobWeightsView, JobPipelineHealthView,
    SubmitResumeView, CandidateApplicationListView, JobSubmissionsView, SubmissionDetailView, SubmissionStageUpdateView, JobCVRankingView,
)

urlpatterns = [
    path("jobs/", JobListCreateView.as_view()),
    path("jobs/health/", JobPipelineHealthView.as_view(), name="recruitment-job-health"),
    path("jobs/<int:pk>/", JobDetailView.as_view()),
    path("jobs/<int:pk>/weights/", JobWeightsView.as_view()),
    path("jobs/<int:pk>/submissions/", JobSubmissionsView.as_view()),
    path("jobs/<int:pk>/ranking/", JobCVRankingView.as_view()),
    path("submit/", SubmitResumeView.as_view()),
    path("applications/", CandidateApplicationListView.as_view()),
    path("submissions/<int:pk>/", SubmissionDetailView.as_view()),
    path("submissions/<int:pk>/stage/", SubmissionStageUpdateView.as_view(), name="recruitment-submission-stage"),
]
