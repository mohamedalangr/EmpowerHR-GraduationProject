from django.urls import path
from .views import (
    RunAttritionPredictionView,
    AttritionPredictionListView,
    AttritionPredictionLatestView,
)

urlpatterns = [
    # POST /api/attrition/run/                  HR Manager triggers bulk prediction
    path('run/', RunAttritionPredictionView.as_view(), name='attrition-run'),

    # GET  /api/attrition/predictions/          all predictions (filterable)
    path('predictions/', AttritionPredictionListView.as_view(), name='attrition-list'),

    # GET  /api/attrition/predictions/latest/   latest prediction per employee
    path('predictions/latest/', AttritionPredictionLatestView.as_view(), name='attrition-latest'),
]
