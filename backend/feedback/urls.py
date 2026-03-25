from django.urls import path
from .views import (
    # HR Manager
    HRFormListCreateView,
    HRFormDetailView,
    HRFormActivateView,
    HRQuestionListCreateView,
    HRQuestionDetailView,
    HRSubmissionsView,
    # Employee
    FeedbackFormListView,
    FeedbackFormDetailView,
    FeedbackSubmitView,
)

urlpatterns = [

    # ── HR Manager endpoints ──────────────────────────────────────────────
    # GET  /api/feedback/hr/forms/                  list all forms
    # POST /api/feedback/hr/forms/                  create form
    path('hr/forms/', HRFormListCreateView.as_view(), name='hr-form-list-create'),

    # GET    /api/feedback/hr/forms/<id>/           get form detail
    # PUT    /api/feedback/hr/forms/<id>/           update form
    # DELETE /api/feedback/hr/forms/<id>/           delete form
    path('hr/forms/<str:form_id>/', HRFormDetailView.as_view(), name='hr-form-detail'),

    # POST /api/feedback/hr/forms/<id>/activate/    activate form
    # POST /api/feedback/hr/forms/<id>/deactivate/  deactivate form
    path('hr/forms/<str:form_id>/<str:action>/',
         HRFormActivateView.as_view(), name='hr-form-activate'),

    # GET  /api/feedback/hr/forms/<id>/questions/   list questions
    # POST /api/feedback/hr/forms/<id>/questions/   add question
    path('hr/forms/<str:form_id>/questions/',
         HRQuestionListCreateView.as_view(), name='hr-question-list-create'),

    # PUT    /api/feedback/hr/questions/<id>/        update question
    # DELETE /api/feedback/hr/questions/<id>/        delete question
    path('hr/questions/<str:question_id>/',
         HRQuestionDetailView.as_view(), name='hr-question-detail'),

    # GET /api/feedback/hr/submissions/             all submissions
    # GET /api/feedback/hr/submissions/?form_id=    filter by form
    path('hr/submissions/', HRSubmissionsView.as_view(), name='hr-submissions'),

    # ── Employee endpoints ────────────────────────────────────────────────
    # GET /api/feedback/forms/                      active form list
    path('forms/', FeedbackFormListView.as_view(), name='feedback-form-list'),

    # GET /api/feedback/forms/<id>/                 form detail + submission
    path('forms/<str:form_id>/', FeedbackFormDetailView.as_view(), name='feedback-form-detail'),

    # POST /api/feedback/forms/<id>/submit/         submit answers
    path('forms/<str:form_id>/submit/', FeedbackSubmitView.as_view(), name='feedback-submit'),
]
