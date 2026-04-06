from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import User
from accounts.demo_access import ensure_demo_users
from feedback.models import FeedbackForm, FeedbackQuestion, FeedbackSubmission, FeedbackAnswer
from resume_pipeline.models import Job, Submission
from attrition.models import AttritionPrediction
import json

class Command(BaseCommand):
    help = 'Load sample data into the database'

    def handle(self, *args, **options):
        self.stdout.write('Loading sample data...')

        demo_users = ensure_demo_users()
        self.stdout.write(self.style.SUCCESS(f'Demo users ready: {", ".join(user.email for user in demo_users)}'))

        # Create sample jobs
        jobs_data = [
            {
                'title': 'Software Engineer',
                'description': 'Develop and maintain software applications.',
                'min_experience_years': 2,
                'required_degree': 'Bachelor',
                'required_skills': ['Python', 'Django', 'JavaScript'],
                'weight_skills': 0.4,
                'weight_experience': 0.3,
                'weight_education': 0.1,
                'weight_semantic': 0.2,
            },
            {
                'title': 'Data Scientist',
                'description': 'Analyze data and build predictive models.',
                'min_experience_years': 3,
                'required_degree': 'Master',
                'required_skills': ['Python', 'Machine Learning', 'SQL'],
                'weight_skills': 0.35,
                'weight_experience': 0.25,
                'weight_education': 0.15,
                'weight_semantic': 0.25,
            },
            {
                'title': 'HR Manager',
                'description': 'Manage human resources operations.',
                'min_experience_years': 5,
                'required_degree': 'Bachelor',
                'required_skills': ['HR Management', 'Communication', 'Leadership'],
                'weight_skills': 0.3,
                'weight_experience': 0.4,
                'weight_education': 0.1,
                'weight_semantic': 0.2,
            },
        ]

        for job_data in jobs_data:
            Job.objects.get_or_create(
                title=job_data['title'],
                defaults=job_data
            )

        # Create sample feedback form if not exists
        form, created = FeedbackForm.objects.get_or_create(
            title='Employee Satisfaction Survey',
            defaults={
                'isActive': True,
            }
        )

        if created:
            # Create questions
            questions_data = [
                {'text': 'How satisfied are you with your current role?', 'fieldType': 'score_1_4'},
                {'text': 'Do you feel valued by the company?', 'fieldType': 'boolean'},
                {'text': 'Rate your work-life balance.', 'fieldType': 'score_1_4'},
                {'text': 'How likely are you to recommend this company to a friend?', 'fieldType': 'score_1_4'},
            ]

            for q_data in questions_data:
                FeedbackQuestion.objects.get_or_create(
                    formID=form,
                    text=q_data['text'],
                    defaults=q_data
                )

        # Create sample submissions for the employee
        employee = User.objects.filter(role='TeamMember').first()
        if employee and form:
            submission, created = FeedbackSubmission.objects.get_or_create(
                formID=form,
                employeeID=employee,
                defaults={
                    'status': FeedbackSubmission.STATUS_COMPLETED,
                    'submittedAt': timezone.now(),
                }
            )

            if created:
                questions = FeedbackQuestion.objects.filter(formID=form)
                answers_data = [
                    {'questionID': questions[0], 'answer': '3'},  # score
                    {'questionID': questions[1], 'answer': 'true'},  # boolean
                    {'questionID': questions[2], 'answer': '2'},  # score
                    {'questionID': questions[3], 'answer': '4'},  # score
                ]

                for ans_data in answers_data:
                    FeedbackAnswer.objects.get_or_create(
                        submissionID=submission,
                        questionID=ans_data['questionID'],
                        defaults={'answer': ans_data['answer']}
                    )

        # Create sample attrition prediction
        if employee:
            AttritionPrediction.objects.get_or_create(
                employee=employee,
                defaults={
                    'jobTitle': 'Team Member',
                    'department': 'Engineering',
                    'team': 'Development',
                    'riskLevel': 'Low',
                    'riskScore': 0.15,
                    'createdAt': timezone.now(),
                }
            )

        self.stdout.write(self.style.SUCCESS('Sample data loaded successfully!'))