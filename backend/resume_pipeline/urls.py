from django.urls import path
from .views import (
    JobListCreateView, JobDetailView, JobWeightsView,
    SubmitResumeView, JobSubmissionsView, SubmissionDetailView,
)

urlpatterns = [
    path("jobs/", JobListCreateView.as_view()),
    path("jobs/<int:pk>/", JobDetailView.as_view()),
    path("jobs/<int:pk>/weights/", JobWeightsView.as_view()),
    path("jobs/<int:pk>/submissions/", JobSubmissionsView.as_view()),
    path("submit/", SubmitResumeView.as_view()),
    path("submissions/<int:pk>/", SubmissionDetailView.as_view()),
]
