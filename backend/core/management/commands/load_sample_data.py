from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.demo_access import ensure_demo_users
from attrition.models import AttritionPrediction
from feedback.models import (
    AttendanceRecord,
    BenefitEnrollment,
    DocumentRequest,
    Employee,
    EmployeeGoal,
    ExpenseClaim,
    FeedbackAnswer,
    FeedbackForm,
    FeedbackQuestion,
    FeedbackSubmission,
    LeaveRequest,
    OnboardingPlan,
    PayrollRecord,
    PerformanceReview,
    PolicyAnnouncement,
    RecognitionAward,
    ShiftSchedule,
    SuccessionPlan,
    SupportTicket,
    TrainingCourse,
    WorkTask,
)
from resume_pipeline.models import Job, Submission


class Command(BaseCommand):
    help = 'Load realistic sample data into the database'

    def handle(self, *args, **options):
        self.stdout.write('Loading sample data...')

        demo_users = ensure_demo_users()
        self.stdout.write(self.style.SUCCESS(f"Demo users ready: {', '.join(user.email for user in demo_users)}"))

        today = timezone.localdate()
        now = timezone.now()

        def at_local(day, hour, minute=0):
            return timezone.make_aware(datetime.combine(day, time(hour, minute)))

        jobs_data = [
            {
                'title': 'Software Engineer',
                'description': 'Build customer-facing features, maintain APIs, and support secure release delivery.',
                'min_experience_years': 2,
                'required_degree': 'Bachelor',
                'required_skills': ['Python', 'Django', 'JavaScript', 'React'],
                'weight_skills': 0.4,
                'weight_experience': 0.3,
                'weight_education': 0.1,
                'weight_semantic': 0.2,
                'is_active': True,
            },
            {
                'title': 'Data Scientist',
                'description': 'Analyze workforce data, build predictive models, and deliver operational insights.',
                'min_experience_years': 3,
                'required_degree': 'Master',
                'required_skills': ['Python', 'Machine Learning', 'SQL', 'Statistics'],
                'weight_skills': 0.35,
                'weight_experience': 0.25,
                'weight_education': 0.15,
                'weight_semantic': 0.25,
                'is_active': True,
            },
            {
                'title': 'HR Manager',
                'description': 'Lead people operations, workforce planning, employee support, and policy compliance.',
                'min_experience_years': 5,
                'required_degree': 'Bachelor',
                'required_skills': ['HR Management', 'Communication', 'Leadership', 'Compliance'],
                'weight_skills': 0.3,
                'weight_experience': 0.4,
                'weight_education': 0.1,
                'weight_semantic': 0.2,
                'is_active': True,
            },
        ]

        jobs = {}
        for job_data in jobs_data:
            job, _ = Job.objects.update_or_create(title=job_data['title'], defaults=job_data)
            jobs[job.title] = job

        software_job = jobs.get('Software Engineer')
        if software_job:
            Submission.objects.update_or_create(
                job=software_job,
                candidate_email='candidate@test.com',
                defaults={
                    'candidate_name': 'Nour Candidate',
                    'resume_file': 'resumes/candidate_test_cv.txt',
                    'status': Submission.Status.DONE,
                    'review_stage': Submission.ReviewStage.SHORTLISTED,
                    'stage_notes': 'Strong frontend and Django fit. Ready for final culture interview.',
                    'stage_updated_at': now - timedelta(days=1),
                    'talent_pool': True,
                    'stage_history': [
                        {
                            'from_stage': 'Applied',
                            'to_stage': 'Shortlisted',
                            'note': 'Passed CV screening with a strong product and React background.',
                            'actor_name': 'Hana HR Manager',
                            'actor_role': 'HRManager',
                            'occurred_at': (now - timedelta(days=1)).isoformat(),
                        }
                    ],
                    'raw_text': 'React engineer with Django API delivery and workflow automation experience.',
                    'candidate_skills': ['React', 'Django', 'Python', 'REST APIs'],
                    'candidate_degree': 'Bachelor',
                    'candidate_years_exp': 3,
                    'exp_extraction_method': 'seeded-demo',
                    'skills_score': 88,
                    'experience_score': 84,
                    'education_score': 80,
                    'semantic_score': 86,
                    'ats_score': 86,
                    'scored_at': now - timedelta(days=1),
                },
            )

            Submission.objects.update_or_create(
                job=software_job,
                candidate_email='portfolio.candidate@test.com',
                defaults={
                    'candidate_name': 'Amina Frontend',
                    'resume_file': 'resumes/candidate_test_cv.txt',
                    'status': Submission.Status.DONE,
                    'review_stage': Submission.ReviewStage.INTERVIEW,
                    'stage_notes': 'Hiring panel requested a practical architecture walkthrough.',
                    'stage_updated_at': now - timedelta(days=2),
                    'talent_pool': True,
                    'stage_history': [
                        {
                            'from_stage': 'Shortlisted',
                            'to_stage': 'Interview',
                            'note': 'Panel interview booked for Thursday at 11:00 AM.',
                            'actor_name': 'Layla Team Lead',
                            'actor_role': 'TeamLeader',
                            'occurred_at': (now - timedelta(days=2)).isoformat(),
                        }
                    ],
                    'raw_text': 'Product-minded frontend engineer with testing and accessibility experience.',
                    'candidate_skills': ['React', 'Testing Library', 'JavaScript', 'Accessibility'],
                    'candidate_degree': 'Bachelor',
                    'candidate_years_exp': 4,
                    'exp_extraction_method': 'seeded-demo',
                    'skills_score': 91,
                    'experience_score': 87,
                    'education_score': 82,
                    'semantic_score': 89,
                    'ats_score': 89,
                    'scored_at': now - timedelta(days=2),
                },
            )

        form, _ = FeedbackForm.objects.update_or_create(
            title='Employee Satisfaction Survey',
            defaults={
                'description': 'A seeded quarterly pulse form used for the employee demo flow.',
                'isActive': True,
            },
        )

        questions_data = [
            {'questionText': 'How satisfied are you with your current role?', 'fieldType': 'score_1_4', 'order': 1},
            {'questionText': 'Do you feel valued by the company?', 'fieldType': 'boolean', 'order': 2},
            {'questionText': 'Rate your work-life balance.', 'fieldType': 'score_1_4', 'order': 3},
            {'questionText': 'How likely are you to recommend this company to a friend?', 'fieldType': 'score_1_4', 'order': 4},
        ]
        question_map = {}
        for q_data in questions_data:
            question, _ = FeedbackQuestion.objects.get_or_create(
                formID=form,
                questionText=q_data['questionText'],
                defaults=q_data,
            )
            question_map[q_data['questionText']] = question

        team_member = Employee.objects.filter(email__iexact='employee@test.com').first() or Employee.objects.filter(role='TeamMember').first()
        team_leader = Employee.objects.filter(email__iexact='leader@test.com').first() or Employee.objects.filter(role='TeamLeader').first()
        hr_manager = Employee.objects.filter(email__iexact='hr@test.com').first() or Employee.objects.filter(role='HRManager').first()

        if not team_member:
            self.stdout.write(self.style.WARNING('Demo employee record not found. Basic sample data loaded without employee workspace scenarios.'))
            self.stdout.write(self.style.SUCCESS('Sample data loaded successfully!'))
            return

        feedback_submission, _ = FeedbackSubmission.objects.get_or_create(
            formID=form,
            employeeID=team_member,
            defaults={
                'status': FeedbackSubmission.STATUS_COMPLETED,
                'submittedAt': now - timedelta(days=6),
            },
        )
        if feedback_submission.status != FeedbackSubmission.STATUS_COMPLETED:
            feedback_submission.status = FeedbackSubmission.STATUS_COMPLETED
            feedback_submission.submittedAt = now - timedelta(days=6)
            feedback_submission.save(update_fields=['status', 'submittedAt'])

        answers_data = {
            'How satisfied are you with your current role?': '3',
            'Do you feel valued by the company?': 'true',
            'Rate your work-life balance.': '2',
            'How likely are you to recommend this company to a friend?': '4',
        }
        for question_text, answer in answers_data.items():
            question = question_map.get(question_text)
            if question:
                answer_defaults = {
                    'scoreValue': None,
                    'booleanValue': None,
                    'decimalValue': None,
                }
                if question.fieldType == 'score_1_4':
                    answer_defaults['scoreValue'] = int(answer)
                elif question.fieldType == 'boolean':
                    answer_defaults['booleanValue'] = str(answer).strip().lower() in {'1', 'true', 'yes', 'on'}
                elif question.fieldType == 'decimal':
                    answer_defaults['decimalValue'] = Decimal(str(answer))

                FeedbackAnswer.objects.update_or_create(
                    submissionID=feedback_submission,
                    questionID=question,
                    defaults=answer_defaults,
                )

        AttendanceRecord.objects.update_or_create(
            employee=team_member,
            date=today,
            defaults={
                'clockIn': at_local(today, 8, 55),
                'clockOut': None,
                'workedHours': Decimal('7.50'),
                'status': AttendanceRecord.STATUS_PARTIAL,
                'notes': 'Morning standup completed. Client rollout checks still in progress.',
            },
        )
        AttendanceRecord.objects.update_or_create(
            employee=team_member,
            date=today - timedelta(days=1),
            defaults={
                'clockIn': at_local(today - timedelta(days=1), 9, 3),
                'clockOut': at_local(today - timedelta(days=1), 17, 22),
                'workedHours': Decimal('8.25'),
                'status': AttendanceRecord.STATUS_PRESENT,
                'notes': 'Full office day with sprint planning and release prep.',
            },
        )

        LeaveRequest.objects.update_or_create(
            employee=team_member,
            startDate=today + timedelta(days=9),
            endDate=today + timedelta(days=10),
            defaults={
                'leaveType': LeaveRequest.TYPE_ANNUAL,
                'daysRequested': 2,
                'reason': 'Family travel already booked for the weekend extension.',
                'status': LeaveRequest.STATUS_PENDING,
                'eligibilityMessage': 'Balance available. Awaiting manager review.',
                'reviewNotes': '',
            },
        )
        LeaveRequest.objects.update_or_create(
            employee=team_member,
            startDate=today - timedelta(days=18),
            endDate=today - timedelta(days=18),
            defaults={
                'leaveType': LeaveRequest.TYPE_CASUAL,
                'daysRequested': 1,
                'reason': 'Personal appointment.',
                'status': LeaveRequest.STATUS_APPROVED,
                'eligibilityMessage': 'Approved from available balance.',
                'reviewNotes': 'Approved by manager.',
                'reviewedBy': 'Layla Team Lead',
                'reviewedAt': now - timedelta(days=20),
            },
        )

        current_period = today.strftime('%b %Y')
        previous_period = (today.replace(day=1) - timedelta(days=1)).strftime('%b %Y')
        PayrollRecord.objects.update_or_create(
            employee=team_member,
            payPeriod=current_period,
            defaults={
                'baseSalary': Decimal('12000.00'),
                'allowances': Decimal('1350.00'),
                'deductions': Decimal('420.00'),
                'bonus': Decimal('500.00'),
                'netPay': Decimal('13430.00'),
                'status': PayrollRecord.STATUS_DRAFT,
                'notes': 'Current month payroll is in final review before release.',
            },
        )
        PayrollRecord.objects.update_or_create(
            employee=team_member,
            payPeriod=previous_period,
            defaults={
                'baseSalary': Decimal('12000.00'),
                'allowances': Decimal('1200.00'),
                'deductions': Decimal('350.00'),
                'bonus': Decimal('700.00'),
                'netPay': Decimal('13550.00'),
                'status': PayrollRecord.STATUS_PAID,
                'paymentDate': today - timedelta(days=12),
                'notes': 'Last payroll cycle cleared successfully.',
            },
        )

        EmployeeGoal.objects.update_or_create(
            employee=team_member,
            title='Stabilize API launch checklist',
            defaults={
                'description': 'Close launch blockers, verify rollback steps, and keep the release checklist green.',
                'category': 'Performance',
                'priority': 'High',
                'status': 'In Progress',
                'progress': 70,
                'dueDate': today + timedelta(days=3),
                'createdBy': 'Layla Team Lead',
            },
        )
        EmployeeGoal.objects.update_or_create(
            employee=team_member,
            title='Finish advanced system design plan',
            defaults={
                'description': 'Complete the backend scaling module and share the summary in the next 1:1.',
                'category': 'Development',
                'priority': 'Medium',
                'status': 'In Progress',
                'progress': 45,
                'dueDate': today + timedelta(days=14),
                'createdBy': 'Hana HR Manager',
            },
        )

        WorkTask.objects.update_or_create(
            employee=team_member,
            title='Resolve release blocker with QA',
            defaults={
                'description': 'Investigate the flaky regression test and align the release decision by noon.',
                'priority': 'High',
                'status': 'Blocked',
                'progress': 40,
                'estimatedHours': 4,
                'dueDate': today + timedelta(days=1),
                'assignedBy': 'Layla Team Lead',
            },
        )
        WorkTask.objects.update_or_create(
            employee=team_member,
            title='Finalize sprint handover notes',
            defaults={
                'description': 'Summarize shipped work, open risks, and support coverage for the next sprint.',
                'priority': 'Medium',
                'status': 'In Progress',
                'progress': 55,
                'estimatedHours': 2,
                'dueDate': today + timedelta(days=2),
                'assignedBy': 'Layla Team Lead',
            },
        )

        if team_leader:
            EmployeeGoal.objects.update_or_create(
                employee=team_leader,
                title='Complete weekly coaching review',
                defaults={
                    'description': 'Review squad momentum, blockers, and readiness before the Friday sync.',
                    'category': 'Leadership',
                    'priority': 'High',
                    'status': 'In Progress',
                    'progress': 60,
                    'dueDate': today + timedelta(days=2),
                    'createdBy': 'Hana HR Manager',
                },
            )
            WorkTask.objects.update_or_create(
                employee=team_leader,
                title='Review squad blockers and approvals',
                defaults={
                    'description': 'Clear urgent team approvals and unblock the release checklist.',
                    'priority': 'High',
                    'status': 'In Progress',
                    'progress': 50,
                    'estimatedHours': 3,
                    'dueDate': today + timedelta(days=1),
                    'assignedBy': 'Hana HR Manager',
                },
            )

        TrainingCourse.objects.update_or_create(
            title='Secure Coding Refresher',
            defaults={
                'description': 'Compliance refresher on secrets handling, audit logging, and secure review gates.',
                'category': 'Compliance',
                'durationHours': 3,
                'assignedEmployeeIDs': [emp.employeeID for emp in [team_member, team_leader] if emp],
                'completionData': {
                    team_member.employeeID: {
                        'status': 'In Progress',
                        'progress': 60,
                        'updatedAt': (now - timedelta(days=1)).isoformat(),
                    },
                    **({
                        team_leader.employeeID: {
                            'status': 'Completed',
                            'progress': 100,
                            'updatedAt': (now - timedelta(days=2)).isoformat(),
                        }
                    } if team_leader else {}),
                },
                'dueDate': today + timedelta(days=4),
                'createdBy': 'Hana HR Manager',
            },
        )
        TrainingCourse.objects.update_or_create(
            title='Advanced React Performance',
            defaults={
                'description': 'A technical learning path focused on profiling, memoization, and dashboard performance.',
                'category': 'Technical',
                'durationHours': 5,
                'assignedEmployeeIDs': [team_member.employeeID],
                'completionData': {
                    team_member.employeeID: {
                        'status': 'Not Started',
                        'progress': 15,
                        'updatedAt': now.isoformat(),
                    }
                },
                'dueDate': today + timedelta(days=11),
                'createdBy': 'Layla Team Lead',
            },
        )

        PerformanceReview.objects.update_or_create(
            employee=team_member,
            reviewPeriod='Q1 2026',
            defaults={
                'reviewType': 'Quarterly',
                'overallRating': 4,
                'status': 'Submitted',
                'strengths': 'Strong execution on delivery, product ownership, and collaborative debugging.',
                'improvementAreas': 'Reduce last-minute release risk by escalating blockers earlier.',
                'goalsSummary': 'Keep API quality high and complete the current learning plan.',
                'employeeNote': 'Looking for more ownership on architecture reviews.',
                'reviewDate': today - timedelta(days=8),
                'createdBy': 'Layla Team Lead',
            },
        )

        SuccessionPlan.objects.update_or_create(
            employee=team_member,
            targetRole='Senior Software Engineer',
            defaults={
                'readiness': '6-12 Months',
                'status': 'On Track',
                'retentionRisk': 'Medium',
                'developmentActions': 'Lead the next release retrospective and finish the architecture training plan.',
                'notes': 'Strong delivery momentum with room to grow in long-range planning.',
                'employeeNote': 'Interested in owning more platform reliability work.',
                'createdBy': 'Hana HR Manager',
            },
        )

        OnboardingPlan.objects.update_or_create(
            employee=team_member,
            title='Platform squad transition plan',
            defaults={
                'planType': 'Transition',
                'status': 'In Progress',
                'progress': 55,
                'startDate': today - timedelta(days=4),
                'targetDate': today + timedelta(days=5),
                'checklistItems': [
                    'Confirm repository access',
                    'Shadow the reliability handover',
                    'Review alert ownership map',
                ],
                'notes': 'Transition is on track but still waiting on final monitoring permissions.',
                'employeeNote': 'Need one more walkthrough for the reporting service.',
                'createdBy': 'Hana HR Manager',
            },
        )

        ShiftSchedule.objects.update_or_create(
            employee=team_member,
            shiftDate=today + timedelta(days=1),
            startTime=time(9, 0),
            defaults={
                'shiftType': 'Morning',
                'endTime': time(17, 0),
                'location': 'Cairo HQ',
                'status': 'Confirmed',
                'notes': 'Office coverage day for release support.',
                'employeeNote': 'Confirmed after the morning client check-in.',
                'acknowledgedAt': now - timedelta(hours=8),
                'createdBy': 'Layla Team Lead',
            },
        )
        ShiftSchedule.objects.update_or_create(
            employee=team_member,
            shiftDate=today + timedelta(days=3),
            startTime=time(12, 0),
            defaults={
                'shiftType': 'Flexible',
                'endTime': time(20, 0),
                'location': 'Remote',
                'status': 'Swapped',
                'notes': 'Coverage swap agreed to support the client demo prep window.',
                'employeeNote': 'Please double-check the handoff with the evening coverage buddy.',
                'createdBy': 'Layla Team Lead',
            },
        )

        PolicyAnnouncement.objects.update_or_create(
            title='Updated remote work and security policy',
            defaults={
                'category': 'Policy',
                'audience': 'All Employees',
                'content': 'Review the refreshed hybrid-work expectations, device hygiene rules, and sign-off steps.',
                'status': 'Published',
                'effectiveDate': today + timedelta(days=2),
                'acknowledgedByIDs': [],
                'acknowledgementNotes': {},
                'lastReminderAt': now - timedelta(days=1),
                'lastReminderNote': 'Reminder sent before the effective date.',
                'reminderCount': 1,
                'reminderHistory': [
                    {
                        'sentAt': (now - timedelta(days=1)).isoformat(),
                        'note': 'Shared in the employee workspace and email digest.',
                    }
                ],
                'createdBy': (hr_manager.fullName if hr_manager else 'Hana HR Manager'),
            },
        )
        PolicyAnnouncement.objects.update_or_create(
            title='Quarterly information security acknowledgement',
            defaults={
                'category': 'Announcement',
                'audience': 'All Employees',
                'content': 'Quarterly acknowledgement completed and stored for the compliance trail.',
                'status': 'Acknowledged',
                'effectiveDate': today - timedelta(days=6),
                'acknowledgedByIDs': [team_member.employeeID],
                'acknowledgementNotes': {
                    team_member.employeeID: 'Reviewed and acknowledged during the monthly compliance pulse.'
                },
                'acknowledgedAt': now - timedelta(days=5),
                'createdBy': (hr_manager.fullName if hr_manager else 'Hana HR Manager'),
            },
        )

        RecognitionAward.objects.update_or_create(
            employee=team_member,
            title='Sprint delivery recognition',
            recognitionDate=today - timedelta(days=5),
            defaults={
                'category': 'Achievement',
                'message': 'Thank you for unblocking the release and keeping the team calm during the final QA push.',
                'points': 80,
                'recognizedBy': 'Layla Team Lead',
            },
        )
        if team_leader:
            RecognitionAward.objects.update_or_create(
                employee=team_leader,
                title='Mentorship spotlight',
                recognitionDate=today - timedelta(days=9),
                defaults={
                    'category': 'Leadership',
                    'message': 'Appreciated for strong coaching and fast support during the squad transition week.',
                    'points': 60,
                    'recognizedBy': 'Hana HR Manager',
                },
            )

        BenefitEnrollment.objects.update_or_create(
            employee=team_member,
            benefitName='Premium Medical Plan',
            defaults={
                'benefitType': 'Medical',
                'provider': 'Nile Care',
                'coverageLevel': 'Employee + Family',
                'status': 'Enrolled',
                'monthlyCost': Decimal('1200.00'),
                'employeeContribution': Decimal('250.00'),
                'effectiveDate': today - timedelta(days=40),
                'notes': 'Primary medical plan is active and visible in the self-service portal.',
                'createdBy': 'Hana HR Manager',
            },
        )
        BenefitEnrollment.objects.update_or_create(
            employee=team_member,
            benefitName='Wellness Allowance',
            defaults={
                'benefitType': 'Wellness',
                'provider': 'EmpowerHR Flex',
                'coverageLevel': 'Monthly stipend',
                'status': 'Pending',
                'monthlyCost': Decimal('300.00'),
                'employeeContribution': Decimal('0.00'),
                'effectiveDate': today + timedelta(days=7),
                'notes': 'Awaiting final employee acknowledgement before activation.',
                'createdBy': 'Hana HR Manager',
            },
        )

        ExpenseClaim.objects.update_or_create(
            employee=team_member,
            title='Client workshop travel',
            expenseDate=today - timedelta(days=7),
            defaults={
                'category': 'Travel',
                'amount': Decimal('845.50'),
                'description': 'Taxi and train receipts for the Cairo workshop visit.',
                'status': 'Submitted',
                'reviewNote': 'Waiting for the final finance sign-off.',
            },
        )
        ExpenseClaim.objects.update_or_create(
            employee=team_member,
            title='Home office accessories',
            expenseDate=today - timedelta(days=22),
            defaults={
                'category': 'Supplies',
                'amount': Decimal('260.00'),
                'description': 'Ergonomic accessories approved for remote-work support.',
                'status': 'Reimbursed',
                'reviewNote': 'Reimbursed in the last completed payroll cycle.',
                'reviewedBy': 'Finance Desk',
                'reviewedAt': now - timedelta(days=17),
            },
        )

        DocumentRequest.objects.update_or_create(
            employee=team_member,
            documentType='Employment Letter',
            purpose='Embassy appointment',
            defaults={
                'notes': 'Please include the latest title and employment start date.',
                'status': 'In Progress',
                'reviewNote': 'Draft is being reviewed by HR for signature.',
                'issuedBy': 'Hana HR Manager',
            },
        )
        DocumentRequest.objects.update_or_create(
            employee=team_member,
            documentType='Salary Certificate',
            purpose='Bank records update',
            defaults={
                'notes': 'Issued to support the bank profile refresh.',
                'status': 'Issued',
                'reviewNote': 'Sent to employee by email.',
                'issuedBy': 'Hana HR Manager',
                'issuedAt': now - timedelta(days=3),
            },
        )

        SupportTicket.objects.update_or_create(
            employee=team_member,
            subject='VPN access still unstable',
            defaults={
                'category': 'IT',
                'priority': 'Critical',
                'description': 'VPN disconnects during deployments and blocks the release checklist.',
                'status': 'Open',
                'assignedTo': 'IT Helpdesk',
            },
        )
        SupportTicket.objects.update_or_create(
            employee=team_member,
            subject='Benefit card address update',
            defaults={
                'category': 'Benefits',
                'priority': 'Medium',
                'description': 'Requesting an address correction before the next medical shipment.',
                'status': 'In Progress',
                'assignedTo': 'Benefits Desk',
            },
        )

        AttritionPrediction.objects.update_or_create(
            employeeID=team_member,
            feedbackFormID=form.formID,
            predictionSource='sample-data',
            defaults={
                'riskScore': 0.42,
                'riskLevel': 'Medium',
                'confidenceScore': 0.81,
                'modelVersion': 'seeded-demo-v1',
                'reviewRequired': True,
            },
        )
        if team_leader:
            AttritionPrediction.objects.update_or_create(
                employeeID=team_leader,
                feedbackFormID=form.formID,
                predictionSource='sample-data',
                defaults={
                    'riskScore': 0.18,
                    'riskLevel': 'Low',
                    'confidenceScore': 0.79,
                    'modelVersion': 'seeded-demo-v1',
                    'reviewRequired': False,
                },
            )

        self.stdout.write(self.style.SUCCESS('Realistic workspace scenarios refreshed for employee, leader, HR, and candidate demos.'))
        self.stdout.write(self.style.SUCCESS('Sample data loaded successfully!'))
