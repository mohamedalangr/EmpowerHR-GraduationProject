from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import (FeedbackForm, FeedbackQuestion,
                     FeedbackSubmission, FeedbackAnswer, Employee)
from .serializers import (
    FeedbackFormListSerializer,
    FeedbackFormDetailSerializer,
    FeedbackFormCreateUpdateSerializer,
    FeedbackQuestionCreateSerializer,
    FeedbackSubmissionSerializer,
    SubmitFeedbackSerializer,
)


# ---------------------------------------------------------------------------
# HR Manager -- Form Management
# ---------------------------------------------------------------------------

class HRFormListCreateView(APIView):
    """
    GET  /api/feedback/hr/forms/        list ALL forms (active and inactive)
    POST /api/feedback/hr/forms/        create a new form
    """

    def get(self, request):
        forms = FeedbackForm.objects.prefetch_related(
            'questions', 'submissions').order_by('-createdAt')
        return Response(FeedbackFormListSerializer(forms, many=True).data)

    def post(self, request):
        serializer = FeedbackFormCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        form = serializer.save()
        return Response(
            FeedbackFormDetailSerializer(form).data,
            status=status.HTTP_201_CREATED
        )


class HRFormDetailView(APIView):
    """
    GET    /api/feedback/hr/forms/<form_id>/   get form with questions
    PUT    /api/feedback/hr/forms/<form_id>/   update form title/description
    DELETE /api/feedback/hr/forms/<form_id>/   delete form
    """

    def get_form(self, form_id):
        try:
            return FeedbackForm.objects.prefetch_related('questions').get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return None

    def get(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(FeedbackFormDetailSerializer(form).data)

    def put(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FeedbackFormCreateUpdateSerializer(form, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        form = serializer.save()
        return Response(FeedbackFormDetailSerializer(form).data)

    def delete(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        form.delete()
        return Response({'message': 'Form deleted.'}, status=status.HTTP_204_NO_CONTENT)


class HRFormActivateView(APIView):
    """
    POST /api/feedback/hr/forms/<form_id>/activate/
    Activates this form and deactivates all others.
    POST /api/feedback/hr/forms/<form_id>/deactivate/
    Deactivates this form.
    """

    def post(self, request, form_id, action):
        try:
            form = FeedbackForm.objects.get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'activate':
            form.isActive = True
            form.save()   # triggers save() which deactivates all others
            return Response({'message': f'Form "{form.title}" is now active.'})
        elif action == 'deactivate':
            form.isActive = False
            form.save(update_fields=['isActive'])
            return Response({'message': f'Form "{form.title}" has been deactivated.'})
        else:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# HR Manager -- Question Management
# ---------------------------------------------------------------------------

class HRQuestionListCreateView(APIView):
    """
    GET  /api/feedback/hr/forms/<form_id>/questions/    list questions
    POST /api/feedback/hr/forms/<form_id>/questions/    add a question
    """

    def get_form(self, form_id):
        try:
            return FeedbackForm.objects.get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return None

    def get(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        questions = form.questions.all()
        return Response(FeedbackQuestionCreateSerializer(questions, many=True).data)

    def post(self, request, form_id):
        form = self.get_form(form_id)
        if not form:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FeedbackQuestionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        question = serializer.save(formID=form)
        return Response(
            FeedbackQuestionCreateSerializer(question).data,
            status=status.HTTP_201_CREATED
        )


class HRQuestionDetailView(APIView):
    """
    PUT    /api/feedback/hr/questions/<question_id>/   update question
    DELETE /api/feedback/hr/questions/<question_id>/   delete question
    """

    def get_question(self, question_id):
        try:
            return FeedbackQuestion.objects.get(pk=question_id)
        except FeedbackQuestion.DoesNotExist:
            return None

    def put(self, request, question_id):
        question = self.get_question(question_id)
        if not question:
            return Response({'error': 'Question not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FeedbackQuestionCreateSerializer(
            question, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        question = serializer.save()
        return Response(FeedbackQuestionCreateSerializer(question).data)

    def delete(self, request, question_id):
        question = self.get_question(question_id)
        if not question:
            return Response({'error': 'Question not found.'}, status=status.HTTP_404_NOT_FOUND)
        question.delete()
        return Response({'message': 'Question deleted.'}, status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# HR Manager -- Submissions View
# ---------------------------------------------------------------------------

class HRSubmissionsView(APIView):
    """
    GET /api/feedback/hr/submissions/               all submissions across all forms
    GET /api/feedback/hr/submissions/?form_id=<id>  filter by form
    """

    def get(self, request):
        qs = FeedbackSubmission.objects.select_related(
            'employeeID', 'formID'
        ).prefetch_related('answers__questionID').order_by('-submittedAt')

        form_id = request.query_params.get('form_id')
        if form_id:
            qs = qs.filter(formID_id=form_id)

        return Response(FeedbackSubmissionSerializer(qs, many=True).data)


# ---------------------------------------------------------------------------
# Employee -- Form Access
# ---------------------------------------------------------------------------

class FeedbackFormListView(APIView):
    """
    GET /api/feedback/forms/
    Employee sees only the active form.
    """

    def get(self, request):
        forms = FeedbackForm.objects.prefetch_related('questions').filter(isActive=True)
        employee_id = request.query_params.get('employee_id')
        result = []
        for form in forms:
            data = FeedbackFormDetailSerializer(form).data
            if employee_id:
                try:
                    sub = FeedbackSubmission.objects.prefetch_related(
                        'answers').get(formID=form, employeeID_id=employee_id)
                    data['submission'] = FeedbackSubmissionSerializer(sub).data
                except FeedbackSubmission.DoesNotExist:
                    data['submission'] = None
            result.append(data)
        return Response(result)


class FeedbackFormDetailView(APIView):
    """
    GET /api/feedback/forms/<form_id>/?employee_id=<id>
    """

    def get(self, request, form_id):
        try:
            form = FeedbackForm.objects.prefetch_related('questions').get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = FeedbackFormDetailSerializer(form).data
        employee_id = request.query_params.get('employee_id')
        if employee_id:
            try:
                sub = FeedbackSubmission.objects.prefetch_related(
                    'answers').get(formID=form, employeeID_id=employee_id)
                data['submission'] = FeedbackSubmissionSerializer(sub).data
            except FeedbackSubmission.DoesNotExist:
                data['submission'] = None
        return Response(data)


class FeedbackSubmitView(APIView):
    """
    POST /api/feedback/forms/<form_id>/submit/
    """

    def post(self, request, form_id):
        try:
            form = FeedbackForm.objects.prefetch_related('questions').get(pk=form_id)
        except FeedbackForm.DoesNotExist:
            return Response({'error': 'Form not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubmitFeedbackSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee_id = serializer.validated_data['employeeID']
        answers     = serializer.validated_data['answers']

        if not Employee.objects.filter(pk=employee_id).exists():
            return Response({'error': f'Employee {employee_id} not found.'},
                            status=status.HTTP_404_NOT_FOUND)

        valid_question_ids = set(form.questions.values_list('questionID', flat=True))
        submitted_ids      = set(a['questionID'] for a in answers)
        invalid            = submitted_ids - valid_question_ids
        if invalid:
            return Response({'error': f'Invalid question IDs: {invalid}'},
                            status=status.HTTP_400_BAD_REQUEST)
        if submitted_ids != valid_question_ids:
            missing = valid_question_ids - submitted_ids
            return Response({'error': f'Missing answers for: {missing}'},
                            status=status.HTTP_400_BAD_REQUEST)

        submission, _ = FeedbackSubmission.objects.get_or_create(
            formID=form, employeeID_id=employee_id)

        for a in answers:
            FeedbackAnswer.objects.update_or_create(
                submissionID=submission,
                questionID_id=a['questionID'],
                defaults={
                    'scoreValue':   a.get('scoreValue'),
                    'booleanValue': a.get('booleanValue'),
                    'decimalValue': a.get('decimalValue'),
                }
            )

        submission.status      = FeedbackSubmission.STATUS_COMPLETED
        submission.submittedAt = timezone.now()
        submission.save(update_fields=['status', 'submittedAt'])

        return Response(FeedbackSubmissionSerializer(submission).data,
                        status=status.HTTP_201_CREATED)
