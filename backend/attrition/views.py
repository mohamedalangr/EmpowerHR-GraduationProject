from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsHRManager
from feedback.models import FeedbackForm, FeedbackSubmission
from .models import AttritionPrediction
from .serializers import AttritionPredictionSerializer


def _ai_policy_payload():
    return {
        'decisionSupportOnly': getattr(settings, 'AI_DECISION_SUPPORT_ONLY', True),
        'modelVersion': getattr(settings, 'ATTRITION_MODEL_VERSION', 'xgboost-attrition-v2-governed'),
        'governanceNotice': getattr(
            settings,
            'AI_GOVERNANCE_NOTICE',
            'AI outputs are advisory only and must be reviewed by HR before any employment decision.',
        ),
        'protectedFieldsNeutralized': ['Age', 'Gender', 'Marital Status'],
    }


class RunAttritionPredictionView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    """
    POST /api/attrition/run/

    Triggered manually by the HR Manager.
    Finds the latest active FeedbackForm, fetches all completed submissions,
    runs prediction for each employee, saves and returns results.

    Optional body:
    {
        "form_id": "abc123"   // if omitted, uses the latest active form
    }
    """

    def post(self, request):
        from .predictor import predict_risk

        # Find the form to use
        form_id = request.data.get('form_id')
        if form_id:
            try:
                form = FeedbackForm.objects.get(pk=form_id, isActive=True)
            except FeedbackForm.DoesNotExist:
                return Response({'error': 'Form not found or inactive.'},
                                status=status.HTTP_404_NOT_FOUND)
        else:
            form = FeedbackForm.objects.filter(isActive=True).order_by('-createdAt').first()
            if not form:
                return Response({'error': 'No active feedback forms found.'},
                                status=status.HTTP_404_NOT_FOUND)

        # Get all completed submissions for this form
        submissions = FeedbackSubmission.objects.filter(
            formID=form,
            status=FeedbackSubmission.STATUS_COMPLETED
        ).select_related('employeeID').prefetch_related(
            'answers__questionID'
        )

        if not submissions.exists():
            return Response(
                {'error': f'No completed submissions found for form: {form.title}'},
                status=status.HTTP_404_NOT_FOUND
            )

        results      = []
        errors       = []
        predictions  = []

        for submission in submissions:
            employee    = submission.employeeID
            answers_qs  = submission.answers.select_related('questionID').all()

            try:
                result = predict_risk(employee, answers_qs)

                # Save prediction to DB
                prediction = AttritionPrediction.objects.create(
                    employeeID_id   = employee.employeeID,
                    riskScore       = result['riskScore'],
                    riskLevel       = result['riskLevel'],
                    confidenceScore = result.get('confidenceScore', 0.0),
                    predictionSource = result.get('predictionSource', 'xgboost'),
                    modelVersion    = result.get('modelVersion', getattr(settings, 'ATTRITION_MODEL_VERSION', 'xgboost-attrition-v2-governed')),
                    reviewRequired  = result.get('reviewRequired', True),
                    feedbackFormID  = form.formID,
                )
                predictions.append(prediction)
                results.append({
                    **result,
                    'predictionID': prediction.predictionID,
                    'predictedAt':  prediction.predictedAt,
                })

            except Exception as e:
                errors.append({
                    'employeeID': employee.employeeID,
                    'fullName':   employee.fullName,
                    'error':      str(e),
                })

        return Response({
            'formID':          form.formID,
            'formTitle':       form.title,
            'totalProcessed':  len(results),
            'totalErrors':     len(errors),
            'predictions':     results,
            'errors':          errors,
            'aiPolicy':        _ai_policy_payload(),
        }, status=status.HTTP_200_OK)


class AttritionPredictionListView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    """
    GET /api/attrition/predictions/
    Returns all predictions, optionally filtered by employee.

    GET /api/attrition/predictions/?employee_id=<id>
    GET /api/attrition/predictions/?risk_level=High
    """

    def get(self, request):
        qs = AttritionPrediction.objects.select_related('employeeID').all()

        employee_id = request.query_params.get('employee_id')
        risk_level  = request.query_params.get('risk_level')

        if employee_id:
            qs = qs.filter(employeeID_id=employee_id)
        if risk_level:
            qs = qs.filter(riskLevel=risk_level)

        serializer = AttritionPredictionSerializer(qs, many=True)
        return Response(serializer.data)


class AttritionPredictionLatestView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    """
    GET /api/attrition/predictions/latest/
    Returns the most recent prediction for every employee.
    Useful for the HR dashboard overview.
    """

    def get(self, request):
        # Get the latest prediction per employee
        from django.db.models import Max
        latest_ids = (
            AttritionPrediction.objects
            .values('employeeID')
            .annotate(latest=Max('predictedAt'))
            .values('employeeID', 'latest')
        )

        results = []
        for entry in latest_ids:
            pred = AttritionPrediction.objects.select_related('employeeID').get(
                employeeID_id=entry['employeeID'],
                predictedAt=entry['latest']
            )
            results.append(pred)

        serializer = AttritionPredictionSerializer(results, many=True)
        return Response(serializer.data)


class AttritionGovernanceSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsHRManager]

    """GET /api/attrition/governance/ — production-readiness snapshot for AI predictions."""

    def get(self, request):
        from django.db.models import Max

        latest_ids = (
            AttritionPrediction.objects
            .values('employeeID')
            .annotate(latest=Max('predictedAt'))
            .values('employeeID', 'latest')
        )

        latest_predictions = []
        for entry in latest_ids:
            latest_predictions.append(
                AttritionPrediction.objects.select_related('employeeID').get(
                    employeeID_id=entry['employeeID'],
                    predictedAt=entry['latest'],
                )
            )

        serializer = AttritionPredictionSerializer(latest_predictions, many=True)
        serialized = serializer.data
        department_map = {}
        for item in serialized:
            department = item.get('department') or 'Unassigned'
            bucket = department_map.setdefault(department, {
                'department': department,
                'employees': 0,
                'highRisk': 0,
                'reviewRequired': 0,
                'lowConfidence': 0,
            })
            bucket['employees'] += 1
            if item.get('riskLevel') == 'High':
                bucket['highRisk'] += 1
            if item.get('reviewRequired'):
                bucket['reviewRequired'] += 1
            if item.get('confidenceLabel') == 'Low':
                bucket['lowConfidence'] += 1

        return Response({
            'policy': _ai_policy_payload(),
            'summary': {
                'totalEmployees': len(serialized),
                'highRisk': sum(1 for item in serialized if item.get('riskLevel') == 'High'),
                'reviewRequired': sum(1 for item in serialized if item.get('reviewRequired')),
                'lowConfidence': sum(1 for item in serialized if item.get('confidenceLabel') == 'Low'),
                'fallbackPredictions': sum(1 for item in serialized if item.get('predictionSource') != 'xgboost'),
            },
            'departmentBreakdown': sorted(department_map.values(), key=lambda item: item['department']),
        })
