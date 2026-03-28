from django.core.management.base import BaseCommand
from django.utils import timezone

from feedback.models import (
    Employee,
    FeedbackAnswer,
    FeedbackForm,
    FeedbackQuestion,
    FeedbackSubmission,
)
from resume_pipeline.models import Job


class Command(BaseCommand):
    help = "Seed demo data for the local development environment."

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data...")

        employees = [
            {
                "employeeID": "emp_001",
                "fullName": "Maya Hassan",
                "email": "maya.hassan@example.com",
                "jobTitle": "Frontend Developer",
                "team": "Employee Experience",
                "department": "Engineering",
                "age": 27,
                "gender": "Female",
                "yearsAtCompany": 2,
                "monthlyIncome": 14000,
                "performanceRating": 4,
                "numberOfPromotions": 1,
                "overtime": False,
                "educationLevel": 3,
                "numberOfDependents": 0,
                "jobLevel": 2,
                "companySize": 3,
                "companyTenure": 2,
                "remoteWork": True,
                "maritalStatus": "Single",
            },
            {
                "employeeID": "emp_002",
                "fullName": "Omar Adel",
                "email": "omar.adel@example.com",
                "jobTitle": "Data Analyst",
                "team": "People Analytics",
                "department": "HR",
                "age": 31,
                "gender": "Male",
                "yearsAtCompany": 4,
                "monthlyIncome": 18000,
                "performanceRating": 3,
                "numberOfPromotions": 1,
                "overtime": True,
                "educationLevel": 3,
                "numberOfDependents": 2,
                "jobLevel": 2,
                "companySize": 3,
                "companyTenure": 4,
                "remoteWork": False,
                "maritalStatus": "Married",
            },
            {
                "employeeID": "emp_003",
                "fullName": "Sara Nabil",
                "email": "sara.nabil@example.com",
                "jobTitle": "Backend Engineer",
                "team": "Platform",
                "department": "Engineering",
                "age": 29,
                "gender": "Female",
                "yearsAtCompany": 3,
                "monthlyIncome": 21000,
                "performanceRating": 4,
                "numberOfPromotions": 2,
                "overtime": False,
                "educationLevel": 4,
                "numberOfDependents": 1,
                "jobLevel": 3,
                "companySize": 3,
                "companyTenure": 5,
                "remoteWork": True,
                "maritalStatus": "Married",
            },
        ]

        for payload in employees:
            employee, created = Employee.objects.update_or_create(
                employeeID=payload["employeeID"],
                defaults=payload,
            )
            self.stdout.write(
                f"  {'Created' if created else 'Updated'} employee {employee.employeeID}"
            )

        form, created = FeedbackForm.objects.update_or_create(
            formID="frm_demo_2026",
            defaults={
                "title": "Q1 2026 Employee Satisfaction Survey",
                "description": "Demo survey for the local development environment.",
                "isActive": True,
            },
        )
        self.stdout.write(f"  {'Created' if created else 'Updated'} feedback form {form.formID}")

        questions = [
            ("q_work_life_balance", "How would you rate your work-life balance?", "score_1_4", 1),
            ("q_job_satisfaction", "How satisfied are you with your job satisfaction overall?", "score_1_4", 2),
            ("q_distance_from_home", "What is your average distance from home to office in km?", "decimal", 3),
            ("q_leadership", "How do you rate leadership opportunities in your team?", "score_1_4", 4),
            ("q_innovation", "How do you rate innovation opportunities at the company?", "score_1_4", 5),
            ("q_company_reputation", "How confident are you in the company reputation?", "score_1_4", 6),
            ("q_employee_recognition", "How satisfied are you with employee recognition?", "score_1_4", 7),
        ]

        question_map = {}
        for question_id, text, field_type, order in questions:
            question, created = FeedbackQuestion.objects.update_or_create(
                questionID=question_id,
                defaults={
                    "formID": form,
                    "questionText": text,
                    "fieldType": field_type,
                    "order": order,
                },
            )
            question_map[question_id] = question
            self.stdout.write(
                f"  {'Created' if created else 'Updated'} question {question.questionID}"
            )

        responses = {
            "emp_002": {
                "q_work_life_balance": {"scoreValue": 2},
                "q_job_satisfaction": {"scoreValue": 2},
                "q_distance_from_home": {"decimalValue": 24},
                "q_leadership": {"scoreValue": 2},
                "q_innovation": {"scoreValue": 3},
                "q_company_reputation": {"scoreValue": 3},
                "q_employee_recognition": {"scoreValue": 2},
            },
            "emp_003": {
                "q_work_life_balance": {"scoreValue": 4},
                "q_job_satisfaction": {"scoreValue": 4},
                "q_distance_from_home": {"decimalValue": 8},
                "q_leadership": {"scoreValue": 4},
                "q_innovation": {"scoreValue": 4},
                "q_company_reputation": {"scoreValue": 4},
                "q_employee_recognition": {"scoreValue": 4},
            },
        }

        for employee_id, answers in responses.items():
            submission, created = FeedbackSubmission.objects.update_or_create(
                submissionID=f"sub_{employee_id}_demo",
                defaults={
                    "formID": form,
                    "employeeID_id": employee_id,
                    "status": FeedbackSubmission.STATUS_COMPLETED,
                    "submittedAt": timezone.now(),
                },
            )
            self.stdout.write(
                f"  {'Created' if created else 'Updated'} submission {submission.submissionID}"
            )
            for question_id, answer_defaults in answers.items():
                FeedbackAnswer.objects.update_or_create(
                    submissionID=submission,
                    questionID=question_map[question_id],
                    defaults=answer_defaults,
                )

        jobs = [
            {
                "title": "Frontend React Developer",
                "description": (
                    "Build polished React interfaces, collaborate with designers, "
                    "and work with JavaScript, CSS, REST APIs, and frontend testing."
                ),
                "required_skills": ["react", "javascript", "css", "rest api", "testing"],
                "min_experience_years": 2,
                "required_degree": "Bachelor's",
            },
            {
                "title": "Data Analyst",
                "description": (
                    "Analyze HR metrics using Python, SQL, dashboards, and statistical reasoning "
                    "to support people analytics decisions."
                ),
                "required_skills": ["python", "sql", "dashboarding", "statistics", "excel"],
                "min_experience_years": 1,
                "required_degree": "Bachelor's",
            },
        ]

        for payload in jobs:
            job, created = Job.objects.update_or_create(
                title=payload["title"],
                defaults=payload,
            )
            self.stdout.write(f"  {'Created' if created else 'Updated'} job {job.id}: {job.title}")

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
