from django.urls import path
from .views import (
    JobListCreateView, JobDetailView, JobWeightsView,
    SubmitResumeView, JobSubmissionsView, SubmissionDetailView,
)

urlpatterns = [
    # Jobs
    path("jobs/",                         JobListCreateView.as_view(),   name="job-list"),
    path("jobs/<int:pk>/",                JobDetailView.as_view(),        name="job-detail"),
    path("jobs/<int:pk>/weights/",        JobWeightsView.as_view(),       name="job-weights"),
    path("jobs/<int:pk>/submissions/",    JobSubmissionsView.as_view(),   name="job-submissions"),

    # Submissions
    path("submit/",                       SubmitResumeView.as_view(),     name="submit"),
    path("submissions/<int:pk>/",         SubmissionDetailView.as_view(), name="submission-detail"),
]
