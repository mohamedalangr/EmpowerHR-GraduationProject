import uuid
from django.db import models
from feedback.models import Employee


def gen_id():
    return uuid.uuid4().hex[:20]


class AttritionPrediction(models.Model):
    """
    Stores the result of an attrition risk prediction for one employee.
    One record per prediction run — multiple records per employee over time.
    """
    RISK_HIGH   = 'High'
    RISK_MEDIUM = 'Medium'
    RISK_LOW    = 'Low'
    RISK_CHOICES = [
        (RISK_HIGH,   'High'),
        (RISK_MEDIUM, 'Medium'),
        (RISK_LOW,    'Low'),
    ]

    predictionID   = models.CharField(max_length=50, primary_key=True, default=gen_id)
    employeeID     = models.ForeignKey(
                       Employee, on_delete=models.CASCADE,
                       db_column='employeeID',
                       related_name='attrition_predictions')
    riskScore      = models.FloatField()           # raw probability 0.0 - 1.0
    riskLevel      = models.CharField(max_length=10, choices=RISK_CHOICES)
    confidenceScore = models.FloatField(default=0.0)
    predictionSource = models.CharField(max_length=40, default='xgboost', blank=True)
    modelVersion   = models.CharField(max_length=100, default='xgboost-attrition-v2-governed', blank=True)
    reviewRequired = models.BooleanField(default=True)
    feedbackFormID = models.CharField(max_length=50, null=True, blank=True)  # which form triggered this
    predictedAt    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'AttritionPrediction'
        ordering = ['-predictedAt']

    def __str__(self):
        return (f"Prediction {self.predictionID} — "
                f"emp {self.employeeID_id} — "
                f"{self.riskLevel} ({self.riskScore:.2f})")
