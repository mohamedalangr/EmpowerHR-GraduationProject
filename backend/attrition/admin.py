from django.contrib import admin
from .models import AttritionPrediction


@admin.register(AttritionPrediction)
class AttritionPredictionAdmin(admin.ModelAdmin):
    list_display    = ['predictionID', 'employeeID', 'riskLevel',
                       'riskScore', 'confidenceScore', 'predictionSource', 'feedbackFormID', 'predictedAt']
    list_filter     = ['riskLevel', 'predictionSource', 'reviewRequired']
    search_fields   = ['employeeID__fullName', 'employeeID__employeeID']
    readonly_fields = ['predictionID', 'predictedAt']
    ordering        = ['-predictedAt']
