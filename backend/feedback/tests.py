from datetime import timedelta

from django.urls import reverse
from django.test import TestCase
from django.utils import timezone
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import User
from attrition.models import AttritionPrediction
from feedback.models import Employee, FeedbackForm, FeedbackQuestion, FeedbackSubmission, FeedbackAnswer, EmployeeJobHistory, AttendanceRecord, LeaveRequest, PayrollRecord, EmployeeGoal, WorkTask, TrainingCourse, PerformanceReview, SuccessionPlan, OnboardingPlan, ShiftSchedule, PolicyAnnouncement, RecognitionAward, BenefitEnrollment, ExpenseClaim, DocumentRequest, SupportTicket
from resume_pipeline.models import Job, Submission


class PasswordResetFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='reset.user@test.com',
            password='OldPass123!',
            full_name='Reset User',
            role='TeamMember',
            employee_id='EMP44001',
        )

    def test_request_otp_sends_email_and_stores_reset_code(self):
        response = self.client.post(
            reverse('auth-password-reset-request'),
            {'email': self.user.email},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('OTP', mail.outbox[0].subject)
        self.assertTrue(self.user.reset_otps.filter(is_used=False).exists())

    def test_request_otp_is_rate_limited_for_immediate_repeat_requests(self):
        first = self.client.post(
            reverse('auth-password-reset-request'),
            {'email': self.user.email},
            format='json',
        )
        second = self.client.post(
            reverse('auth-password-reset-request'),
            {'email': self.user.email},
            format='json',
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertIn('wait', str(second.data).lower())
        self.assertEqual(len(mail.outbox), 1)

    def test_confirm_reset_updates_password_with_valid_otp(self):
        self.client.post(
            reverse('auth-password-reset-request'),
            {'email': self.user.email},
            format='json',
        )
        otp_record = self.user.reset_otps.filter(is_used=False).latest('created_at')

        response = self.client.post(
            reverse('auth-password-reset-confirm'),
            {
                'email': self.user.email,
                'otp': otp_record.code,
                'new_password': 'NewSecure123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        otp_record.refresh_from_db()
        self.assertTrue(self.user.check_password('NewSecure123!'))
        self.assertTrue(otp_record.is_used)

    def test_confirm_reset_rejects_invalid_otp(self):
        self.client.post(
            reverse('auth-password-reset-request'),
            {'email': self.user.email},
            format='json',
        )

        response = self.client.post(
            reverse('auth-password-reset-confirm'),
            {
                'email': self.user.email,
                'otp': '000000',
                'new_password': 'NewSecure123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OldPass123!'))


class DemoAccessFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_demo_access_endpoint_returns_seeded_role_accounts(self):
        response = self.client.get(reverse('auth-demo-access'))

        self.assertEqual(response.status_code, 200)
        accounts = response.data.get('accounts', [])
        roles_by_email = {item['email']: item['role'] for item in accounts}

        self.assertEqual(roles_by_email.get('hr@test.com'), 'HRManager')
        self.assertEqual(roles_by_email.get('leader@test.com'), 'TeamLeader')
        self.assertEqual(roles_by_email.get('employee@test.com'), 'TeamMember')
        self.assertEqual(roles_by_email.get('candidate@test.com'), 'Candidate')
        self.assertEqual(roles_by_email.get('admin@test.com'), 'Admin')

        self.assertTrue(User.objects.filter(email='hr@test.com', role='HRManager').exists())
        self.assertTrue(User.objects.filter(email='leader@test.com', role='TeamLeader').exists())
        self.assertTrue(User.objects.filter(email='employee@test.com', role='TeamMember').exists())
        self.assertTrue(User.objects.filter(email='candidate@test.com', role='Candidate').exists())
        self.assertTrue(User.objects.filter(email='admin@test.com', role='Admin').exists())


class RecruitmentPublicFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hr_user = User.objects.create_user(
            email='recruitment.hr@test.com',
            password='TestPass123!',
            full_name='Recruitment HR',
            role='HRManager',
            employee_id='EMP55001',
        )
        self.job = Job.objects.create(
            title='Frontend Engineer',
            description='React JavaScript CSS testing teamwork and UI development.',
            required_skills=['react', 'javascript', 'css'],
            min_experience_years=2,
            required_degree='Bachelor',
        )

    def test_public_can_list_active_jobs_without_login(self):
        response = self.client.get('/api/recruitment/jobs/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Frontend Engineer')

    def test_public_can_submit_application_without_login(self):
        response = self.client.post(
            '/api/recruitment/submit/',
            {
                'job': self.job.id,
                'candidate_name': 'Jane Candidate',
                'candidate_email': 'jane.candidate@test.com',
                'resume_file': SimpleUploadedFile(
                    'candidate.txt',
                    b'Jane Candidate\nReact JavaScript CSS and UI testing experience for 4 years.',
                    content_type='text/plain',
                ),
            },
        )

        self.assertEqual(response.status_code, 201)
        submission = Submission.objects.get(candidate_email='jane.candidate@test.com')
        self.assertEqual(submission.review_stage, 'Applied')
        self.assertTrue(submission.talent_pool)

    def test_hr_can_update_candidate_pipeline_stage(self):
        submission = Submission.objects.create(
            job=self.job,
            candidate_name='Nour Ali',
            candidate_email='nour.ali@test.com',
            resume_file=SimpleUploadedFile('nour.txt', b'React and testing profile', content_type='text/plain'),
            review_stage='Applied',
            talent_pool=True,
            status=Submission.Status.DONE,
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post(
            reverse('recruitment-submission-stage', kwargs={'pk': submission.pk}),
            {
                'review_stage': 'Interview',
                'stage_notes': 'Strong shortlist for technical interview.',
                'talent_pool': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        submission.refresh_from_db()
        self.assertEqual(submission.review_stage, 'Interview')
        self.assertEqual(submission.stage_notes, 'Strong shortlist for technical interview.')
        self.assertTrue(submission.talent_pool)

    def test_hr_stage_update_records_audit_history(self):
        submission = Submission.objects.create(
            job=self.job,
            candidate_name='Audit Trail',
            candidate_email='audit.trail@test.com',
            resume_file=SimpleUploadedFile('audit.txt', b'React and testing profile', content_type='text/plain'),
            review_stage='Applied',
            talent_pool=True,
            status=Submission.Status.DONE,
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post(
            reverse('recruitment-submission-stage', kwargs={'pk': submission.pk}),
            {
                'review_stage': 'Shortlisted',
                'stage_notes': 'Strong match for the hiring panel.',
                'talent_pool': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        submission.refresh_from_db()
        self.assertTrue(isinstance(submission.stage_history, list))
        self.assertEqual(len(submission.stage_history), 1)
        last_event = submission.stage_history[-1]
        self.assertEqual(last_event['from_stage'], 'Applied')
        self.assertEqual(last_event['to_stage'], 'Shortlisted')
        self.assertEqual(last_event['note'], 'Strong match for the hiring panel.')
        self.assertEqual(last_event['updated_by'], 'Recruitment HR')
        self.assertEqual(response.data['stage_history'][-1]['to_stage'], 'Shortlisted')

    def test_hr_cannot_skip_hiring_stages_or_reject_without_reason(self):
        submission = Submission.objects.create(
            job=self.job,
            candidate_name='Salma Gate',
            candidate_email='salma.gate@test.com',
            resume_file=SimpleUploadedFile('salma.txt', b'React CSS and UI testing profile', content_type='text/plain'),
            review_stage='Applied',
            talent_pool=True,
            status=Submission.Status.DONE,
        )

        self.client.force_authenticate(user=self.hr_user)

        skip_response = self.client.post(
            reverse('recruitment-submission-stage', kwargs={'pk': submission.pk}),
            {
                'review_stage': 'Hired',
                'stage_notes': 'Attempt to skip straight to hired.',
            },
            format='json',
        )
        self.assertEqual(skip_response.status_code, 400)

        reject_response = self.client.post(
            reverse('recruitment-submission-stage', kwargs={'pk': submission.pk}),
            {
                'review_stage': 'Rejected',
                'stage_notes': '',
            },
            format='json',
        )
        self.assertEqual(reject_response.status_code, 400)
        self.assertIn('stage_notes', reject_response.data)

    def test_public_application_lookup_requires_tracking_code(self):
        submission = Submission.objects.create(
            job=self.job,
            candidate_name='Mariam Hassan',
            candidate_email='mariam.hassan@test.com',
            resume_file=SimpleUploadedFile('mariam.txt', b'React CSS JavaScript', content_type='text/plain'),
            review_stage='Shortlisted',
            stage_notes='Profile moved to shortlist review.',
            talent_pool=True,
            status=Submission.Status.DONE,
        )

        missing_code_response = self.client.get('/api/recruitment/applications/?email=mariam.hassan@test.com')
        valid_response = self.client.get(
            f'/api/recruitment/applications/?email=mariam.hassan@test.com&tracking_code={submission.tracking_code}'
        )

        self.assertEqual(missing_code_response.status_code, 400)
        self.assertIn('tracking code', str(missing_code_response.data).lower())
        self.assertEqual(valid_response.status_code, 200)
        self.assertEqual(len(valid_response.data), 1)
        self.assertEqual(valid_response.data[0]['job_title'], 'Frontend Engineer')
        self.assertEqual(valid_response.data[0]['review_stage'], 'Shortlisted')

    def test_authenticated_candidate_can_lookup_own_applications_without_tracking_code(self):
        candidate_user = User.objects.create_user(
            email='candidate.lookup@test.com',
            password='TestPass123!',
            full_name='Lookup Candidate',
            role='Candidate',
        )
        Submission.objects.create(
            job=self.job,
            candidate_name='Lookup Candidate',
            candidate_email='candidate.lookup@test.com',
            resume_file=SimpleUploadedFile('lookup.txt', b'React CSS JavaScript', content_type='text/plain'),
            review_stage='Interview',
            stage_notes='Interview scheduled.',
            talent_pool=True,
            status=Submission.Status.DONE,
        )

        self.client.force_authenticate(user=candidate_user)
        response = self.client.get('/api/recruitment/applications/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['review_stage'], 'Interview')

    def test_hr_job_pipeline_health_snapshot_returns_follow_up_summary(self):
        stale_stage_time = timezone.now() - timedelta(days=8)
        quiet_job = Job.objects.create(
            title='Data Analyst',
            description='SQL dashboards reporting stakeholder communication and analytics.',
            required_skills=['sql', 'excel', 'analytics'],
            min_experience_years=1,
            required_degree='Bachelor',
        )
        Submission.objects.create(
            job=self.job,
            candidate_name='Delayed Candidate',
            candidate_email='delayed.candidate@test.com',
            resume_file=SimpleUploadedFile('delayed.txt', b'React testing and stakeholder communication profile', content_type='text/plain'),
            review_stage='Interview',
            stage_notes='Waiting for final panel feedback.',
            talent_pool=True,
            status=Submission.Status.DONE,
            ats_score=88,
            stage_updated_at=stale_stage_time,
        )
        Submission.objects.create(
            job=self.job,
            candidate_name='Fresh Applicant',
            candidate_email='fresh.candidate@test.com',
            resume_file=SimpleUploadedFile('fresh.txt', b'React CSS testing profile', content_type='text/plain'),
            review_stage='Shortlisted',
            stage_notes='Fresh shortlist review.',
            talent_pool=False,
            status=Submission.Status.DONE,
            ats_score=79,
            stage_updated_at=timezone.now() - timedelta(days=1),
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('recruitment-job-health'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['totals']['activeJobs'], 2)
        self.assertGreaterEqual(response.data['totals']['staleCandidates'], 1)
        self.assertEqual(response.data['funnelSummary']['interviewCount'], 1)
        self.assertTrue(any(item['candidateName'] == 'Delayed Candidate' for item in response.data['followUpItems']))
        self.assertTrue(any(item['jobTitle'] == quiet_job.title for item in response.data['jobBreakdown']))


class FeedbackHRViewsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hr_user = User.objects.create_user(
            email='hr.local@test.com',
            password='TestPass123!',
            full_name='HR Local',
            role='HRManager',
            employee_id='EMP99888',
        )
        self.member_user = User.objects.create_user(
            email='member.local@test.com',
            password='TestPass123!',
            full_name='Member Local',
            role='TeamMember',
            employee_id='EMP99889',
        )
        self.client.force_authenticate(user=self.hr_user)
        self.member_client = APIClient()
        self.member_client.force_authenticate(user=self.member_user)

        self.employee = Employee.objects.create(
            fullName='Mona Ali',
            email='mona.ali@test.com',
            department='Operations',
            jobTitle='Coordinator',
            role='TeamMember',
            team='Ops A',
            employmentStatus='Active',
        )
        self.form = FeedbackForm.objects.create(title='Pulse Survey', isActive=True)
        self.submission = FeedbackSubmission.objects.create(
            formID=self.form,
            employeeID=self.employee,
            status=FeedbackSubmission.STATUS_PENDING,
        )

    def test_hr_submissions_endpoint_returns_200(self):
        response = self.client.get(reverse('hr-submissions'), {'form_id': self.form.formID})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['employeeName'], 'Mona Ali')

    def test_non_hr_user_cannot_manage_hr_forms_or_questions(self):
        create_form_response = self.member_client.post(
            reverse('hr-form-list-create'),
            {'title': 'Unauthorized form', 'description': 'Should be blocked.'},
            format='json',
        )
        add_question_response = self.member_client.post(
            reverse('hr-question-list-create', kwargs={'form_id': self.form.formID}),
            {'text': 'Unauthorized question?', 'questionType': 'text'},
            format='json',
        )
        activate_response = self.member_client.post(
            reverse('hr-form-activate', kwargs={'form_id': self.form.formID, 'action': 'activate'}),
            format='json',
        )

        self.assertEqual(create_form_response.status_code, 403)
        self.assertEqual(add_question_response.status_code, 403)
        self.assertEqual(activate_response.status_code, 403)

    def test_hr_can_add_question_to_form(self):
        response = self.client.post(
            reverse('hr-question-list-create', kwargs={'form_id': self.form.formID}),
            {
                'questionText': 'How supported do you feel at work?',
                'fieldType': 'score_1_4',
                'order': 1,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['questionText'], 'How supported do you feel at work?')
        self.assertTrue(
            FeedbackQuestion.objects.filter(
                formID=self.form,
                questionText='How supported do you feel at work?',
                fieldType='score_1_4',
            ).exists()
        )

    def test_hr_submissions_endpoint_supports_search_and_status_filters(self):
        second_employee = Employee.objects.create(
            fullName='Sara Hassan',
            email='sara.filters@test.com',
            department='Engineering',
            jobTitle='Analyst',
            role='TeamMember',
            team='Platform',
            employmentStatus='Active',
        )
        FeedbackSubmission.objects.create(
            formID=self.form,
            employeeID=second_employee,
            status=FeedbackSubmission.STATUS_COMPLETED,
        )

        response = self.client.get(
            reverse('hr-submissions'),
            {
                'form_id': self.form.formID,
                'status': FeedbackSubmission.STATUS_COMPLETED,
                'search': 'sara',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['employeeName'], 'Sara Hassan')
        self.assertEqual(response.data[0]['status'], FeedbackSubmission.STATUS_COMPLETED)

    def test_hr_form_response_snapshot_returns_follow_up_summary(self):
        second_form = FeedbackForm.objects.create(title='Engagement Survey', isActive=True)
        second_employee = Employee.objects.create(
            fullName='Sara Hassan',
            email='sara.snapshot@test.com',
            department='Engineering',
            jobTitle='Analyst',
            role='TeamMember',
            team='Platform',
            employmentStatus='Active',
        )
        FeedbackSubmission.objects.create(
            formID=self.form,
            employeeID=second_employee,
            status=FeedbackSubmission.STATUS_COMPLETED,
            submittedAt=timezone.now(),
        )
        FeedbackSubmission.objects.create(
            formID=second_form,
            employeeID=second_employee,
            status=FeedbackSubmission.STATUS_PENDING,
        )

        response = self.client.get(reverse('hr-form-response-snapshot'))
        blocked_response = self.member_client.get(reverse('hr-form-response-snapshot'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertEqual(response.data['summary']['trackedForms'], 2)
        self.assertGreaterEqual(response.data['summary']['pendingResponses'], 2)
        self.assertGreaterEqual(response.data['summary']['lowCoverageForms'], 1)
        self.assertTrue(any(item['title'] == 'Pulse Survey' for item in response.data['followUpItems']))
        self.assertTrue(any(item['riskLevel'] == 'High' for item in response.data['followUpItems']))

    def test_hr_submission_insights_returns_question_risk_summary(self):
        score_question = FeedbackQuestion.objects.create(
            formID=self.form,
            questionText='How supported do you feel by your manager?',
            fieldType='score_1_4',
            order=1,
        )
        boolean_question = FeedbackQuestion.objects.create(
            formID=self.form,
            questionText='Do you have the tools needed to do your job well?',
            fieldType='boolean',
            order=2,
        )
        self.submission.status = FeedbackSubmission.STATUS_COMPLETED
        self.submission.submittedAt = timezone.now()
        self.submission.save(update_fields=['status', 'submittedAt'])
        FeedbackAnswer.objects.create(submissionID=self.submission, questionID=score_question, scoreValue=1)
        FeedbackAnswer.objects.create(submissionID=self.submission, questionID=boolean_question, booleanValue=False)

        second_employee = Employee.objects.create(
            fullName='Omar Salah',
            email='omar.insights@test.com',
            department='Finance',
            jobTitle='Specialist',
            role='TeamMember',
            team='Finance Ops',
            employmentStatus='Active',
        )
        FeedbackSubmission.objects.create(
            formID=self.form,
            employeeID=second_employee,
            status=FeedbackSubmission.STATUS_PENDING,
        )

        response = self.client.get(reverse('hr-submission-insights'), {'form_id': self.form.formID})
        blocked_response = self.member_client.get(reverse('hr-submission-insights'), {'form_id': self.form.formID})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertEqual(response.data['summary']['totalSubmissions'], 2)
        self.assertEqual(response.data['summary']['completedSubmissions'], 1)
        self.assertGreaterEqual(response.data['summary']['pendingSubmissions'], 1)
        self.assertTrue(any(item['questionText'] == 'How supported do you feel by your manager?' for item in response.data['questionInsights']))
        self.assertTrue(any(item['priority'] == 'High' for item in response.data['followUpItems']))

    def test_hr_roster_health_snapshot_returns_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Laila Fathy',
            email='laila.roster@test.com',
            department='Finance',
            jobTitle='',
            role='TeamMember',
            team='Finance Ops',
            employmentStatus='Probation',
            location='',
            monthlyIncome=None,
        )
        AttritionPrediction.objects.create(
            employeeID=second_employee,
            riskLevel='High',
            riskScore=0.88,
        )
        EmployeeJobHistory.objects.create(
            employee=self.employee,
            action='Promotion',
            previousJobTitle='Coordinator',
            newJobTitle='Senior Coordinator',
            previousRole='TeamMember',
            newRole='TeamLeader',
            notes='Recent change for succession planning.',
        )

        response = self.client.get(reverse('hr-roster-health'))
        blocked_response = self.member_client.get(reverse('hr-roster-health'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertEqual(response.data['summary']['trackedEmployees'], 2)
        self.assertGreaterEqual(response.data['summary']['incompleteProfiles'], 1)
        self.assertGreaterEqual(response.data['summary']['attritionFollowUp'], 1)
        self.assertGreaterEqual(response.data['summary']['recentMovements'], 1)
        self.assertTrue(any(item['employeeName'] == 'Laila Fathy' for item in response.data['followUpItems']))
        self.assertTrue(any(item['priority'] == 'High' for item in response.data['followUpItems']))

    def test_change_role_creates_job_history_entry(self):
        response = self.client.post(
            reverse('hr-employee-change-role', kwargs={'employee_id': self.employee.employeeID}),
            {
                'action': 'Promotion',
                'jobTitle': 'Senior Coordinator',
                'role': 'TeamLeader',
                'department': 'Operations',
                'team': 'Ops A',
                'monthlyIncome': 16000,
                'notes': 'Promoted after strong performance',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.jobTitle, 'Senior Coordinator')
        self.assertEqual(self.employee.role, 'TeamLeader')
        self.assertEqual(EmployeeJobHistory.objects.filter(employee=self.employee).count(), 1)

    def test_employee_history_endpoint_lists_history(self):
        EmployeeJobHistory.objects.create(
            employee=self.employee,
            action='Promotion',
            previousJobTitle='Coordinator',
            newJobTitle='Senior Coordinator',
            previousRole='TeamMember',
            newRole='TeamLeader',
            notes='Initial promotion',
        )

        response = self.client.get(
            reverse('hr-employee-history', kwargs={'employee_id': self.employee.employeeID})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['action'], 'Promotion')

    def test_hr_can_send_policy_reminder_and_log_follow_up(self):
        Employee.objects.create(
            fullName='Pending Employee',
            email='pending.employee@test.com',
            department='Operations',
            jobTitle='Coordinator',
            role='TeamMember',
            team='Ops',
            employmentStatus='Active',
        )
        policy = PolicyAnnouncement.objects.create(
            title='Information Security Policy',
            category='Policy',
            audience='All Employees',
            content='All employees must acknowledge the updated information security rules.',
            status='Published',
            effectiveDate=timezone.localdate() + timedelta(days=3),
            acknowledgedByIDs=[self.employee.employeeID],
            createdBy='HR Local',
        )

        response = self.client.post(
            reverse('hr-policy-remind', kwargs={'policy_id': policy.policyID}),
            {'note': 'Please acknowledge this policy before the deadline.'},
            format='json',
        )
        blocked_response = self.member_client.post(
            reverse('hr-policy-remind', kwargs={'policy_id': policy.policyID}),
            {'note': 'Unauthorized'},
            format='json',
        )

        policy.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertEqual(response.data['reminderCount'], 1)
        self.assertGreaterEqual(response.data['outstandingEmployees'], 1)
        self.assertEqual(policy.reminderCount, 1)
        self.assertEqual(policy.lastReminderNote, 'Please acknowledge this policy before the deadline.')
        self.assertIsNotNone(policy.lastReminderAt)
        self.assertEqual(len(policy.reminderHistory), 1)

    def test_hr_policy_compliance_snapshot_returns_follow_up_summary(self):
        team_leader = Employee.objects.create(
            fullName='Lead Sara',
            email='lead.sara@test.com',
            department='Operations',
            jobTitle='Team Lead',
            role='TeamLeader',
            team='Ops Lead',
            employmentStatus='Active',
        )
        PolicyAnnouncement.objects.create(
            title='Remote Work Policy',
            category='Policy',
            audience='All Employees',
            content='Employees must review the updated hybrid work rules.',
            status='Published',
            effectiveDate=timezone.localdate() + timedelta(days=2),
            acknowledgedByIDs=[self.employee.employeeID],
            createdBy='HR Local',
        )
        PolicyAnnouncement.objects.create(
            title='Manager Conduct Reminder',
            category='Announcement',
            audience='Team Leaders',
            content='Team leaders must acknowledge the latest escalation guidance.',
            status='Published',
            effectiveDate=timezone.localdate() - timedelta(days=1),
            createdBy='HR Local',
        )

        response = self.client.get(reverse('hr-policy-compliance'))
        blocked_response = self.member_client.get(reverse('hr-policy-compliance'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertEqual(response.data['summary']['publishedCount'], 2)
        self.assertGreaterEqual(response.data['summary']['outstandingEmployees'], 2)
        self.assertGreaterEqual(response.data['summary']['dueThisWeekCount'], 2)
        self.assertTrue(any(item['dueState'] == 'Overdue' for item in response.data['followUpItems']))
        self.assertTrue(any(item['title'] == 'Remote Work Policy' for item in response.data['followUpItems']))

    def test_hr_review_calibration_snapshot_returns_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Youssef Adel',
            email='youssef.adel@test.com',
            department='Operations',
            jobTitle='Senior Coordinator',
            role='TeamLeader',
            team='Ops B',
            employmentStatus='Active',
        )
        PerformanceReview.objects.create(
            employee=self.employee,
            reviewPeriod='Q1 2026',
            reviewType='Quarterly',
            overallRating=2,
            status='Submitted',
            strengths='Reliable execution',
            improvementAreas='Needs coaching on cross-team communication.',
            createdBy='HR Local',
        )
        PerformanceReview.objects.create(
            employee=second_employee,
            reviewPeriod='Q1 2026',
            reviewType='Quarterly',
            overallRating=5,
            status='Acknowledged',
            strengths='Strong leadership',
            improvementAreas='None noted.',
            createdBy='HR Local',
        )
        SuccessionPlan.objects.create(
            employee=second_employee,
            targetRole='Operations Manager',
            readiness='Ready Now',
            status='Active',
            retentionRisk='High',
            developmentActions='Prepare for promotion panel',
            createdBy='HR Local',
        )

        response = self.client.get(reverse('hr-review-calibration'))
        blocked_response = self.member_client.get(reverse('hr-review-calibration'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertEqual(response.data['summary']['totalReviews'], 2)
        self.assertGreaterEqual(response.data['summary']['pendingAcknowledgements'], 1)
        self.assertGreaterEqual(response.data['summary']['calibrationAlerts'], 1)
        self.assertTrue(any(item['employeeName'] == 'Mona Ali' for item in response.data['followUpItems']))
        self.assertTrue(any(item['priority'] == 'Critical' for item in response.data['followUpItems']))

    def test_hr_training_compliance_snapshot_returns_due_state_summary(self):
        second_employee = Employee.objects.create(
            fullName='Nadine Samir',
            email='nadine.samir@test.com',
            department='Operations',
            jobTitle='Analyst',
            role='TeamMember',
            team='Ops B',
            employmentStatus='Active',
        )
        TrainingCourse.objects.create(
            title='Code of Conduct Refresh',
            description='Mandatory compliance refresher.',
            category='Compliance',
            durationHours=2,
            assignedEmployeeIDs=[self.employee.employeeID, second_employee.employeeID],
            completionData={
                self.employee.employeeID: {'status': 'Completed', 'progress': 100},
                second_employee.employeeID: {'status': 'Not Started', 'progress': 0},
            },
            dueDate=timezone.localdate() - timedelta(days=1),
            createdBy='HR Local',
        )
        TrainingCourse.objects.create(
            title='Leadership Essentials',
            description='Development course for the next quarter.',
            category='Leadership',
            durationHours=3,
            assignedEmployeeIDs=[self.employee.employeeID],
            completionData={
                self.employee.employeeID: {'status': 'In Progress', 'progress': 40},
            },
            dueDate=timezone.localdate() + timedelta(days=4),
            createdBy='HR Local',
        )

        response = self.client.get(reverse('hr-training-compliance'))
        blocked_response = self.member_client.get(reverse('hr-training-compliance'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertEqual(response.data['summary']['trackedCourses'], 2)
        self.assertGreaterEqual(response.data['summary']['overdueCourses'], 1)
        self.assertGreaterEqual(response.data['summary']['dueSoonCourses'], 1)
        self.assertTrue(any(item['title'] == 'Code of Conduct Refresh' for item in response.data['followUpItems']))
        self.assertTrue(any(item['dueState'] == 'Overdue' for item in response.data['followUpItems']))

    def test_hr_approval_snapshot_returns_escalation_summary(self):
        leave_request = LeaveRequest.objects.create(
            employee=self.employee,
            leaveType='Annual',
            startDate=timezone.localdate(),
            endDate=timezone.localdate() + timedelta(days=2),
            daysRequested=2,
            reason='Family travel',
            status='Pending',
        )
        expense = ExpenseClaim.objects.create(
            employee=self.employee,
            title='Client visit taxi',
            category='Travel',
            amount=120,
            expenseDate=timezone.localdate() - timedelta(days=3),
            status='Submitted',
        )
        document = DocumentRequest.objects.create(
            employee=self.employee,
            documentType='Employment Letter',
            purpose='Visa renewal',
            status='Pending',
        )
        ticket = SupportTicket.objects.create(
            employee=self.employee,
            subject='Laptop access issue',
            category='IT',
            priority='Critical',
            status='Open',
        )

        LeaveRequest.objects.filter(pk=leave_request.pk).update(requestedAt=timezone.now() - timedelta(days=3))
        ExpenseClaim.objects.filter(pk=expense.pk).update(createdAt=timezone.now() - timedelta(days=4))
        DocumentRequest.objects.filter(pk=document.pk).update(createdAt=timezone.now() - timedelta(days=2))
        SupportTicket.objects.filter(pk=ticket.pk).update(createdAt=timezone.now() - timedelta(days=2), updatedAt=timezone.now() - timedelta(days=1))

        response = self.client.get(reverse('hr-approval-snapshot'))
        blocked_response = self.member_client.get(reverse('hr-approval-snapshot'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertEqual(response.data['totals']['totalPending'], 4)
        self.assertGreaterEqual(response.data['slaSummary']['overdueCount'], 1)
        self.assertGreaterEqual(response.data['slaSummary']['atRiskCount'], 1)
        self.assertTrue(any(item['slaState'] == 'Overdue' for item in response.data['followUpItems']))
        self.assertTrue(any(item['type'] == 'Support Ticket' for item in response.data['followUpItems']))

    def test_hr_workforce_insights_endpoint_returns_summary(self):
        second_employee = Employee.objects.create(
            fullName='Sara Hassan',
            email='sara.hassan@test.com',
            department='Engineering',
            jobTitle='Analyst',
            role='TeamMember',
            team='Platform',
            employmentStatus='Active',
        )
        AttendanceRecord.objects.create(
            employee=self.employee,
            date='2026-04-02',
            status='Present',
        )
        LeaveRequest.objects.create(
            employee=self.employee,
            leaveType='Annual',
            startDate='2026-04-10',
            endDate='2026-04-11',
            daysRequested=2,
            reason='Travel',
            status='Pending',
        )
        EmployeeGoal.objects.create(
            employee=self.employee,
            title='Ship analytics dashboard',
            status='In Progress',
            progress=60,
        )
        WorkTask.objects.create(
            employee=self.employee,
            title='Prepare metrics summary',
            status='To Do',
            progress=20,
        )
        TrainingCourse.objects.create(
            title='Leadership Basics',
            assignedEmployeeIDs=[self.employee.employeeID, second_employee.employeeID],
            completionData={
                self.employee.employeeID: {'status': 'Completed', 'progress': 100},
                second_employee.employeeID: {'status': 'In Progress', 'progress': 40},
            },
        )
        PerformanceReview.objects.create(
            employee=self.employee,
            reviewPeriod='Q2 2026',
            overallRating=4,
            status='Acknowledged',
        )
        SuccessionPlan.objects.create(
            employee=self.employee,
            targetRole='Senior Coordinator',
            readiness='6-12 Months',
            status='Active',
            retentionRisk='Medium',
        )

        response = self.client.get(reverse('hr-workforce-insights'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['totals']['totalEmployees'], 2)
        self.assertEqual(response.data['totals']['pendingLeaveRequests'], 1)
        self.assertEqual(response.data['totals']['openTasks'], 1)
        self.assertEqual(response.data['totals']['acknowledgedReviews'], 1)
        self.assertEqual(response.data['totals']['trainingCompletionRate'], 50)

    def test_hr_workforce_insights_include_attendance_and_payroll_analytics(self):
        second_employee = Employee.objects.create(
            fullName='Omar Fathy',
            email='omar.fathy@test.com',
            department='Finance',
            jobTitle='Payroll Analyst',
            role='TeamMember',
            team='Finance Ops',
            employmentStatus='Active',
        )
        AttendanceRecord.objects.create(
            employee=self.employee,
            date='2026-04-01',
            status=AttendanceRecord.STATUS_PRESENT,
        )
        AttendanceRecord.objects.create(
            employee=second_employee,
            date='2026-04-01',
            status=AttendanceRecord.STATUS_PARTIAL,
        )
        PayrollRecord.objects.create(
            employee=self.employee,
            payPeriod='2026-04',
            baseSalary=12000,
            allowances=1000,
            deductions=500,
            bonus=500,
            netPay=13000,
            status=PayrollRecord.STATUS_PAID,
        )
        PayrollRecord.objects.create(
            employee=second_employee,
            payPeriod='2026-04',
            baseSalary=10000,
            allowances=500,
            deductions=250,
            bonus=250,
            netPay=10500,
            status=PayrollRecord.STATUS_DRAFT,
        )

        response = self.client.get(reverse('hr-workforce-insights'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['attendanceSummary']['presentCount'], 1)
        self.assertEqual(response.data['attendanceSummary']['partialCount'], 1)
        self.assertEqual(response.data['attendanceSummary']['completionRate'], 100)
        self.assertEqual(response.data['payrollSummary']['paidRecords'], 1)
        self.assertEqual(response.data['payrollSummary']['draftRecords'], 1)
        self.assertEqual(response.data['payrollSummary']['totalNetPay'], 23500.0)
        self.assertEqual(response.data['payrollSummary']['pendingNetPay'], 10500.0)

    def test_hr_workforce_insights_include_operations_service_analytics(self):
        second_employee = Employee.objects.create(
            fullName='Lina Adel',
            email='lina.adel@test.com',
            department='Operations',
            jobTitle='Operations Specialist',
            role='TeamMember',
            team='Ops A',
            employmentStatus='Active',
        )
        EmployeeGoal.objects.create(
            employee=self.employee,
            title='Improve onboarding workflow',
            status='In Progress',
            progress=80,
        )
        EmployeeGoal.objects.create(
            employee=second_employee,
            title='Launch self-service forms',
            status='Completed',
            progress=100,
        )
        ExpenseClaim.objects.create(
            employee=self.employee,
            title='Client travel',
            category='Travel',
            amount=200,
            expenseDate='2026-04-02',
            status='Submitted',
        )
        ExpenseClaim.objects.create(
            employee=second_employee,
            title='Taxi reimbursement',
            category='Travel',
            amount=150,
            expenseDate='2026-04-02',
            status='Reimbursed',
        )
        DocumentRequest.objects.create(
            employee=self.employee,
            documentType='Employment Letter',
            purpose='Visa processing',
            status='Pending',
        )
        DocumentRequest.objects.create(
            employee=second_employee,
            documentType='Salary Certificate',
            purpose='Bank request',
            status='Issued',
        )
        SupportTicket.objects.create(
            employee=self.employee,
            subject='Laptop replacement',
            category='IT',
            priority='Critical',
            status='Open',
        )
        SupportTicket.objects.create(
            employee=second_employee,
            subject='Payroll clarification',
            category='Payroll',
            priority='Medium',
            status='Resolved',
        )

        response = self.client.get(reverse('hr-workforce-insights'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['goalSummary']['activeGoals'], 2)
        self.assertEqual(response.data['goalSummary']['completedGoals'], 1)
        self.assertEqual(response.data['goalSummary']['averageProgress'], 90)
        self.assertEqual(response.data['expenseSummary']['submittedCount'], 1)
        self.assertEqual(response.data['expenseSummary']['reimbursedCount'], 1)
        self.assertEqual(response.data['expenseSummary']['submittedAmount'], 200.0)
        self.assertEqual(response.data['documentSummary']['pendingCount'], 1)
        self.assertEqual(response.data['documentSummary']['issuedCount'], 1)
        self.assertEqual(response.data['ticketSummary']['openCount'], 1)
        self.assertEqual(response.data['ticketSummary']['criticalOpenCount'], 1)
        self.assertEqual(response.data['ticketSummary']['resolvedCount'], 1)

    def test_hr_people_intelligence_endpoint_returns_priority_queue(self):
        second_employee = Employee.objects.create(
            fullName='Nour Salah',
            email='nour.salah@test.com',
            department='Engineering',
            jobTitle='Backend Engineer',
            role='TeamMember',
            team='Platform',
            employmentStatus='Active',
        )
        LeaveRequest.objects.create(
            employee=self.employee,
            leaveType='Annual',
            startDate='2026-04-20',
            endDate='2026-04-22',
            daysRequested=3,
            reason='Personal leave',
            status='Pending',
        )
        SupportTicket.objects.create(
            employee=self.employee,
            subject='Access issue',
            category='IT',
            priority='High',
            status='Open',
        )
        WorkTask.objects.create(
            employee=self.employee,
            title='Complete incident report',
            status='To Do',
            progress=0,
        )
        AttritionPrediction.objects.create(
            employeeID=self.employee,
            riskScore=0.82,
            riskLevel='High',
            feedbackFormID=self.form.formID,
        )
        AttritionPrediction.objects.create(
            employeeID=second_employee,
            riskScore=0.47,
            riskLevel='Medium',
            feedbackFormID=self.form.formID,
        )

        response = self.client.get(reverse('hr-people-intelligence'))

        self.assertEqual(response.status_code, 200)
        self.assertIn('overview', response.data)
        self.assertIn('trends', response.data)
        self.assertIn('priorityQueue', response.data)
        self.assertGreaterEqual(response.data['overview']['followUpCount'], 2)
        self.assertGreaterEqual(len(response.data['priorityQueue']), 1)
        self.assertEqual(response.data['priorityQueue'][0]['employeeID'], self.employee.employeeID)
        self.assertIn('recommendedActions', response.data['priorityQueue'][0])

    def test_hr_action_plan_tracker_create_and_update(self):
        create_response = self.client.post(
            reverse('hr-action-plan-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'title': 'Retention follow-up call',
                'description': 'Schedule and complete a retention-focused 1:1.',
                'priority': 'High',
                'status': 'To Do',
                'progress': 0,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data['title'], 'Retention follow-up call')
        self.assertTrue(create_response.data['assignedBy'].startswith('ActionPlan:'))

        list_response = self.client.get(reverse('hr-action-plan-list-create'))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)

        update_response = self.client.post(
            reverse('hr-action-plan-status', kwargs={'task_id': create_response.data['taskID']}),
            {
                'status': 'Done',
                'progress': 100,
            },
            format='json',
        )

        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.data['status'], 'Done')
        self.assertEqual(update_response.data['progress'], 100)

    def test_hr_action_plan_tracker_supports_search_and_priority_filters(self):
        WorkTask.objects.create(
            employee=self.employee,
            title='Retention follow-up call',
            description='Keep this employee engaged.',
            priority='High',
            status='To Do',
            progress=15,
            assignedBy='ActionPlan:HR Local',
        )
        WorkTask.objects.create(
            employee=self.employee,
            title='Retention documentation cleanup',
            description='Administrative close-out item.',
            priority='Low',
            status='To Do',
            progress=10,
            assignedBy='ActionPlan:HR Local',
        )

        response = self.client.get(
            reverse('hr-action-plan-list-create'),
            {
                'priority': 'High',
                'status': 'To Do',
                'search': 'retention',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Retention follow-up call')
        self.assertEqual(response.data[0]['priority'], 'High')

    def test_hr_employee_snapshot_returns_unified_360_view(self):
        AttendanceRecord.objects.create(
            employee=self.employee,
            date='2026-04-03',
            status='Present',
            workedHours='8.00',
        )
        LeaveRequest.objects.create(
            employee=self.employee,
            leaveType='Annual',
            startDate='2026-04-15',
            endDate='2026-04-16',
            daysRequested=2,
            reason='Family trip',
            status='Pending',
        )
        PayrollRecord.objects.create(
            employee=self.employee,
            payPeriod='2026-04',
            baseSalary='15000.00',
            allowances='500.00',
            deductions='0.00',
            bonus='0.00',
            netPay='15500.00',
            status='Paid',
        )
        EmployeeGoal.objects.create(
            employee=self.employee,
            title='Improve retention reporting',
            status='In Progress',
            progress=70,
        )
        WorkTask.objects.create(
            employee=self.employee,
            title='Close the weekly HR scorecard',
            status='In Progress',
            progress=55,
        )
        TrainingCourse.objects.create(
            title='Advanced People Analytics',
            assignedEmployeeIDs=[self.employee.employeeID],
            completionData={self.employee.employeeID: {'status': 'Completed', 'progress': 100}},
        )
        PerformanceReview.objects.create(
            employee=self.employee,
            reviewPeriod='Q1 2026',
            overallRating=4,
            status='Acknowledged',
        )
        SupportTicket.objects.create(
            employee=self.employee,
            subject='Laptop support',
            category='IT',
            priority='Medium',
            status='Open',
        )
        EmployeeJobHistory.objects.create(
            employee=self.employee,
            action='Promotion',
            previousJobTitle='Coordinator',
            newJobTitle='Senior Coordinator',
            previousRole='TeamMember',
            newRole='TeamLeader',
            notes='Promoted after strong delivery',
        )
        AttritionPrediction.objects.create(
            employeeID=self.employee,
            riskScore=0.78,
            riskLevel='High',
            feedbackFormID=self.form.formID,
        )

        response = self.client.get(reverse('hr-employee-snapshot', kwargs={'employee_id': self.employee.employeeID}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['employee']['fullName'], 'Mona Ali')
        self.assertEqual(response.data['summary']['activeGoals'], 1)
        self.assertEqual(response.data['summary']['openTasks'], 1)
        self.assertEqual(response.data['summary']['assignedTraining'], 1)
        self.assertEqual(response.data['summary']['pendingLeave'], 1)
        self.assertEqual(response.data['summary']['openTickets'], 1)
        self.assertEqual(response.data['summary']['latestNetPay'], 15500.0)
        self.assertEqual(response.data['attrition']['riskLevel'], 'High')
        self.assertIn('recommendedActions', response.data['attrition'])
        self.assertEqual(len(response.data['history']), 1)


class AttritionExplainabilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hr_user = User.objects.create_user(
            email='attrition.hr@test.com',
            password='TestPass123!',
            full_name='Attrition HR',
            role='HRManager',
            employee_id='EMP77000',
        )
        self.client.force_authenticate(user=self.hr_user)
        self.employee = Employee.objects.create(
            employeeID='EMP77001',
            fullName='Retention Risk Example',
            email='risk.example@test.com',
            department='Operations',
            jobTitle='Operations Specialist',
            role='TeamMember',
            team='Ops Alpha',
            employmentStatus='Active',
            age=29,
            gender='Male',
            yearsAtCompany=6,
            monthlyIncome=8500,
            performanceRating=2,
            numberOfPromotions=0,
            overtime=True,
            educationLevel=3,
            numberOfDependents=1,
            jobLevel=2,
            companySize=2,
            companyTenure=8,
            remoteWork=False,
            maritalStatus='Single',
        )
        self.form = FeedbackForm.objects.create(title='Retention Pulse', isActive=True)
        questions = [
            ('How is your work-life balance?', 'score_1_4', {'scoreValue': 1}),
            ('Rate your job satisfaction level', 'score_1_4', {'scoreValue': 1}),
            ('Distance from home to office', 'decimal', {'decimalValue': '28.0'}),
            ('How do you feel about leadership opportunities?', 'score_1_4', {'scoreValue': 1}),
            ('How do you feel about innovation opportunities?', 'score_1_4', {'scoreValue': 2}),
            ('How do you rate the company reputation?', 'score_1_4', {'scoreValue': 2}),
            ('How do you rate employee recognition?', 'score_1_4', {'scoreValue': 1}),
        ]
        submission = FeedbackSubmission.objects.create(
            formID=self.form,
            employeeID=self.employee,
            status=FeedbackSubmission.STATUS_COMPLETED,
        )
        for order, (text, field_type, values) in enumerate(questions, start=1):
            question = FeedbackQuestion.objects.create(
                formID=self.form,
                questionText=text,
                fieldType=field_type,
                order=order,
            )
            FeedbackAnswer.objects.create(submissionID=submission, questionID=question, **values)

    def test_attrition_run_returns_explainable_risk_insights(self):
        response = self.client.post(reverse('attrition-run'), {}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['totalProcessed'], 1)
        prediction = response.data['predictions'][0]
        self.assertIn('explanationSummary', prediction)
        self.assertIn('riskDrivers', prediction)
        self.assertIn('recommendedActions', prediction)
        self.assertTrue(len(prediction['riskDrivers']) >= 1)
        self.assertTrue(len(prediction['recommendedActions']) >= 1)

        latest_response = self.client.get(reverse('attrition-latest'))
        self.assertEqual(latest_response.status_code, 200)
        self.assertIn('explanationSummary', latest_response.data[0])
        self.assertIn('recommendedActions', latest_response.data[0])


class AttendanceLeaveTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hr_user = User.objects.create_user(
            email='attendance.hr@test.com',
            password='TestPass123!',
            full_name='Attendance HR',
            role='HRManager',
            employee_id='EMP99777',
        )
        self.team_leader_user = User.objects.create_user(
            email='leader.platform@test.com',
            password='TestPass123!',
            full_name='Platform Lead',
            role='TeamLeader',
            employee_id='EMP12000',
        )
        self.employee_user = User.objects.create_user(
            email='youssef.nabil@test.com',
            password='TestPass123!',
            full_name='Youssef Nabil',
            role='TeamMember',
            employee_id='EMP12345',
        )
        self.team_leader_employee = Employee.objects.create(
            employeeID='EMP12000',
            fullName='Platform Lead',
            email='leader.platform@test.com',
            department='Engineering',
            jobTitle='Team Lead',
            role='TeamLeader',
            team='Platform',
            employmentStatus='Active',
        )
        self.employee = Employee.objects.create(
            employeeID='EMP12345',
            fullName='Youssef Nabil',
            email='youssef.nabil@test.com',
            department='Engineering',
            jobTitle='Developer',
            role='TeamMember',
            team='Platform',
            employmentStatus='Active',
        )

    def test_employee_can_clock_in_and_out(self):
        self.client.force_authenticate(user=self.hr_user)

        clock_in = self.client.post(
            reverse('employee-attendance-clock'),
            {'employeeID': self.employee.employeeID, 'action': 'clock_in'},
            format='json',
        )
        self.assertEqual(clock_in.status_code, 200)

        clock_out = self.client.post(
            reverse('employee-attendance-clock'),
            {'employeeID': self.employee.employeeID, 'action': 'clock_out'},
            format='json',
        )
        self.assertEqual(clock_out.status_code, 200)

    def test_employee_cannot_repeat_clock_actions_in_same_day(self):
        self.client.force_authenticate(user=self.hr_user)

        first_clock_in = self.client.post(
            reverse('employee-attendance-clock'),
            {'employeeID': self.employee.employeeID, 'action': 'clock_in'},
            format='json',
        )
        self.assertEqual(first_clock_in.status_code, 200)

        second_clock_in = self.client.post(
            reverse('employee-attendance-clock'),
            {'employeeID': self.employee.employeeID, 'action': 'clock_in'},
            format='json',
        )
        self.assertEqual(second_clock_in.status_code, 400)

        first_clock_out = self.client.post(
            reverse('employee-attendance-clock'),
            {'employeeID': self.employee.employeeID, 'action': 'clock_out'},
            format='json',
        )
        self.assertEqual(first_clock_out.status_code, 200)

        second_clock_out = self.client.post(
            reverse('employee-attendance-clock'),
            {'employeeID': self.employee.employeeID, 'action': 'clock_out'},
            format='json',
        )
        self.assertEqual(second_clock_out.status_code, 400)

    def test_leave_request_submit_and_review_flow(self):
        self.client.force_authenticate(user=self.hr_user)

        request_response = self.client.post(
            reverse('employee-leave-request-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'leaveType': 'Annual',
                'startDate': '2026-04-10',
                'endDate': '2026-04-12',
                'reason': 'Family trip',
            },
            format='json',
        )
        self.assertEqual(request_response.status_code, 201)

        leave_id = request_response.data['leaveRequestID']
        review_response = self.client.post(
            reverse('hr-leave-review', kwargs={'leave_request_id': leave_id}),
            {'status': 'Approved', 'reviewNotes': 'Approved by HR'},
            format='json',
        )
        self.assertEqual(review_response.status_code, 200)

    def test_hr_attendance_watch_snapshot_returns_presence_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Maya Attendance',
            email='maya.attendance@test.com',
            department='Operations',
            jobTitle='Coordinator',
            role='TeamMember',
            team='Ops Support',
            employmentStatus='Active',
        )
        AttendanceRecord.objects.create(
            employee=self.employee,
            date=timezone.localdate(),
            clockIn=timezone.now() - timedelta(hours=2),
            status='Clocked In',
            notes='Still clocked in without a completed shift.',
        )
        LeaveRequest.objects.create(
            employee=second_employee,
            leaveType='Sick',
            startDate=timezone.localdate() + timedelta(days=1),
            endDate=timezone.localdate() + timedelta(days=2),
            daysRequested=2,
            reason='Medical follow-up visit.',
            status='Pending',
            eligibilityMessage='Eligible for review.',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-attendance-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['clockedInCount'], 1)
        self.assertGreaterEqual(response.data['summary']['pendingLeaveCount'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['department'] == 'Operations' for item in response.data['departmentBreakdown']))

    def test_rejection_and_resolution_actions_require_notes(self):
        self.client.force_authenticate(user=self.hr_user)

        leave_request = LeaveRequest.objects.create(
            employee=self.employee,
            leaveType='Annual',
            startDate='2026-04-14',
            endDate='2026-04-15',
            daysRequested=2,
            reason='Need personal leave',
            status='Pending',
        )
        expense = ExpenseClaim.objects.create(
            employee=self.employee,
            title='Taxi to client office',
            category='Travel',
            amount=120,
            expenseDate='2026-04-05',
            status='Submitted',
        )
        document = DocumentRequest.objects.create(
            employee=self.employee,
            documentType='Salary Certificate',
            purpose='Bank paperwork',
            status='Pending',
        )
        ticket = SupportTicket.objects.create(
            employee=self.employee,
            subject='Reset VPN access',
            category='IT',
            priority='High',
            status='Open',
        )

        leave_response = self.client.post(
            reverse('hr-leave-review', kwargs={'leave_request_id': leave_request.leaveRequestID}),
            {'status': 'Rejected', 'reviewNotes': ''},
            format='json',
        )
        self.assertEqual(leave_response.status_code, 400)

        expense_response = self.client.post(
            f'/api/feedback/hr/expenses/{expense.claimID}/review/',
            {'status': 'Rejected', 'note': ''},
            format='json',
        )
        self.assertEqual(expense_response.status_code, 400)

        document_response = self.client.post(
            f'/api/feedback/hr/documents/{document.requestID}/issue/',
            {'status': 'Declined', 'note': ''},
            format='json',
        )
        self.assertEqual(document_response.status_code, 400)

        ticket_response = self.client.post(
            f'/api/feedback/hr/tickets/{ticket.ticketID}/status/',
            {'status': 'Resolved', 'note': ''},
            format='json',
        )
        self.assertEqual(ticket_response.status_code, 400)

    def test_hr_can_create_and_mark_payroll_paid(self):
        self.client.force_authenticate(user=self.hr_user)

        create_response = self.client.post(
            reverse('hr-payroll-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'payPeriod': '2026-04',
                'baseSalary': '15000.00',
                'allowances': '1200.00',
                'deductions': '350.00',
                'bonus': '500.00',
                'notes': 'April payroll',
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(str(create_response.data['netPay']), '16350.00')

        payroll_id = create_response.data['payrollID']
        paid_response = self.client.post(
            reverse('hr-payroll-mark-paid', kwargs={'payroll_id': payroll_id}),
            {'paymentDate': '2026-04-30'},
            format='json',
        )
        self.assertEqual(paid_response.status_code, 200)
        self.assertEqual(paid_response.data['status'], 'Paid')

    def test_hr_payroll_watch_snapshot_returns_processing_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Lina Payroll',
            email='lina.payroll@test.com',
            department='Finance',
            jobTitle='Payroll Specialist',
            role='TeamMember',
            team='Finance Ops',
            employmentStatus='Active',
        )
        stale_draft = PayrollRecord.objects.create(
            employee=self.employee,
            payPeriod='2026-05',
            baseSalary='15000.00',
            allowances='400.00',
            deductions='250.00',
            bonus='0.00',
            netPay='15150.00',
            status='Draft',
            notes='Awaiting final approval for release.',
        )
        PayrollRecord.objects.filter(pk=stale_draft.pk).update(createdAt=timezone.now() - timedelta(days=5))
        PayrollRecord.objects.create(
            employee=second_employee,
            payPeriod='2026-05',
            baseSalary='12000.00',
            allowances='300.00',
            deductions='100.00',
            bonus='200.00',
            netPay='12400.00',
            status='Draft',
            notes='Finance review is in progress.',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-payroll-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['draftCount'], 2)
        self.assertGreaterEqual(response.data['summary']['overdueCount'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['department'] == 'Finance' for item in response.data['departmentBreakdown']))

    def test_employee_can_list_own_payroll_records(self):
        PayrollRecord.objects.create(
            employee=self.employee,
            payPeriod='2026-04',
            baseSalary='15000.00',
            allowances='500.00',
            deductions='250.00',
            bonus='300.00',
            netPay='15550.00',
            status='Draft',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(reverse('employee-payroll-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['employeeID'], self.employee.employeeID)

    def test_team_leader_can_create_goal_for_team_member(self):
        self.client.force_authenticate(user=self.team_leader_user)

        response = self.client.post(
            reverse('team-goal-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'title': 'Complete API optimization',
                'description': 'Improve response time for HR dashboards.',
                'category': 'Performance',
                'priority': 'High',
                'status': 'Not Started',
                'progress': 0,
                'dueDate': '2026-04-30',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(EmployeeGoal.objects.filter(employee=self.employee).count(), 1)

    def test_employee_can_update_own_goal_progress(self):
        goal = EmployeeGoal.objects.create(
            employee=self.employee,
            title='Finish onboarding plan',
            description='Complete the assigned onboarding milestones.',
            category='Development',
            priority='Medium',
            status='In Progress',
            progress=25,
            dueDate='2026-04-25',
            createdBy='Platform Lead',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-goal-progress', kwargs={'goal_id': goal.goalID}),
            {'status': 'Completed', 'progress': 100},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Completed')
        self.assertEqual(response.data['progress'], 100)

    def test_team_leader_can_create_task_for_team_member(self):
        self.client.force_authenticate(user=self.team_leader_user)

        response = self.client.post(
            reverse('team-task-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'title': 'Prepare release checklist',
                'description': 'Finalize the sprint release checklist and blockers.',
                'priority': 'High',
                'status': 'To Do',
                'progress': 0,
                'estimatedHours': 6,
                'dueDate': '2026-05-05',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(WorkTask.objects.filter(employee=self.employee).count(), 1)

    def test_employee_can_update_own_task_progress(self):
        task = WorkTask.objects.create(
            employee=self.employee,
            title='Complete API review',
            description='Review and close the open API TODOs.',
            priority='Medium',
            status='In Progress',
            progress=40,
            estimatedHours=4,
            dueDate='2026-05-02',
            assignedBy='Platform Lead',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-task-progress', kwargs={'task_id': task.taskID}),
            {'status': 'Done', 'progress': 100},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Done')
        self.assertEqual(response.data['progress'], 100)

    def test_hr_can_create_training_course(self):
        self.client.force_authenticate(user=self.hr_user)

        response = self.client.post(
            reverse('hr-training-list-create'),
            {
                'title': 'Advanced React Workshop',
                'description': 'Frontend performance and reusable component patterns.',
                'category': 'Technical',
                'durationHours': 8,
                'assignedEmployeeIDs': [self.employee.employeeID],
                'dueDate': '2026-05-15',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(TrainingCourse.objects.count(), 1)

    def test_employee_can_mark_training_completed(self):
        course = TrainingCourse.objects.create(
            title='Security Awareness',
            description='Mandatory company security essentials.',
            category='Compliance',
            durationHours=2,
            assignedEmployeeIDs=[self.employee.employeeID],
            dueDate='2026-05-10',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-training-progress', kwargs={'course_id': course.courseID}),
            {'status': 'Completed', 'progress': 100},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Completed')
        self.assertEqual(response.data['progress'], 100)

    def test_hr_can_create_performance_review(self):
        self.client.force_authenticate(user=self.hr_user)

        response = self.client.post(
            reverse('hr-review-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'reviewPeriod': 'Q2 2026',
                'reviewType': 'Quarterly',
                'overallRating': 4,
                'status': 'Submitted',
                'strengths': 'Consistently improves delivery quality.',
                'improvementAreas': 'Can delegate more across the team.',
                'goalsSummary': 'Lead the API modernization milestone.',
                'reviewDate': '2026-06-15',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(PerformanceReview.objects.filter(employee=self.employee).count(), 1)

    def test_employee_can_acknowledge_review(self):
        review = PerformanceReview.objects.create(
            employee=self.employee,
            reviewPeriod='Q2 2026',
            reviewType='Quarterly',
            overallRating=4,
            status='Submitted',
            strengths='Strong collaboration and execution.',
            improvementAreas='Keep improving sprint planning estimates.',
            goalsSummary='Own the next release checklist.',
            reviewDate='2026-06-15',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-review-acknowledge', kwargs={'review_id': review.reviewID}),
            {'note': 'Reviewed and acknowledged.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Acknowledged')

    def test_hr_can_create_succession_plan(self):
        self.client.force_authenticate(user=self.hr_user)

        response = self.client.post(
            reverse('hr-succession-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'targetRole': 'Senior Developer',
                'readiness': '6-12 Months',
                'status': 'Active',
                'retentionRisk': 'Medium',
                'developmentActions': 'Lead one platform initiative and mentor a junior developer.',
                'notes': 'Strong candidate for the next internal promotion cycle.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(SuccessionPlan.objects.filter(employee=self.employee).count(), 1)

    def test_employee_can_acknowledge_career_plan(self):
        plan = SuccessionPlan.objects.create(
            employee=self.employee,
            targetRole='Senior Developer',
            readiness='6-12 Months',
            status='Active',
            retentionRisk='Low',
            developmentActions='Own a release and mentor one intern.',
            notes='Career path shared during review cycle.',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-career-plan-acknowledge', kwargs={'plan_id': plan.planID}),
            {'note': 'Thanks, I reviewed the career path.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Acknowledged')

    def test_hr_succession_watch_snapshot_returns_readiness_follow_up_summary(self):
        ready_employee = Employee.objects.create(
            fullName='Salma Successor',
            email='salma.successor@test.com',
            department='Engineering',
            jobTitle='Senior QA Engineer',
            role='TeamMember',
            team='Platform',
            employmentStatus='Active',
        )
        SuccessionPlan.objects.create(
            employee=self.employee,
            targetRole='Engineering Lead',
            readiness='Ready Now',
            status='Active',
            retentionRisk='High',
            developmentActions='Lead a major release and mentor the platform squad.',
            notes='Needs promotion panel review this month.',
            createdBy='Attendance HR',
        )
        SuccessionPlan.objects.create(
            employee=ready_employee,
            targetRole='QA Manager',
            readiness='6-12 Months',
            status='On Hold',
            retentionRisk='Medium',
            developmentActions='Own automation roadmap and coach the QA chapter.',
            notes='Follow-up needed with department head.',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-succession-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['readyNowCount'], 1)
        self.assertGreaterEqual(response.data['summary']['highRiskCount'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['readiness'] == 'Ready Now' for item in response.data['readinessBreakdown']))

    def test_hr_can_create_onboarding_plan(self):
        self.client.force_authenticate(user=self.hr_user)

        response = self.client.post(
            reverse('hr-onboarding-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'planType': 'Onboarding',
                'title': 'Engineering onboarding',
                'status': 'Not Started',
                'progress': 0,
                'startDate': '2026-04-05',
                'targetDate': '2026-04-20',
                'checklistItems': ['Account setup', 'Team intro', 'Tool access'],
                'notes': 'Start with platform orientation.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(OnboardingPlan.objects.filter(employee=self.employee).count(), 1)

    def test_employee_can_update_onboarding_progress(self):
        plan = OnboardingPlan.objects.create(
            employee=self.employee,
            planType='Onboarding',
            title='Platform onboarding',
            status='In Progress',
            progress=35,
            startDate='2026-04-05',
            targetDate='2026-04-20',
            checklistItems=['Intro', 'Laptop setup'],
            notes='Working through the first week checklist.',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-onboarding-progress', kwargs={'plan_id': plan.planID}),
            {'status': 'Completed', 'progress': 100},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Completed')
        self.assertEqual(response.data['progress'], 100)

    def test_hr_onboarding_watch_snapshot_returns_transition_follow_up_summary(self):
        other_employee = Employee.objects.create(
            fullName='Youssef Start',
            email='youssef.start@test.com',
            department='Engineering',
            jobTitle='QA Engineer',
            role='TeamMember',
            team='Platform',
            employmentStatus='Active',
        )
        OnboardingPlan.objects.create(
            employee=self.employee,
            planType='Onboarding',
            title='Support onboarding',
            status='In Progress',
            progress=25,
            startDate=timezone.localdate() - timedelta(days=10),
            targetDate=timezone.localdate() - timedelta(days=2),
            checklistItems=['Laptop', 'Orientation'],
            notes='Still waiting for access approvals.',
            createdBy='Attendance HR',
        )
        OnboardingPlan.objects.create(
            employee=other_employee,
            planType='Transition',
            title='Team transfer transition',
            status='Blocked',
            progress=55,
            startDate=timezone.localdate() - timedelta(days=4),
            targetDate=timezone.localdate() + timedelta(days=1),
            checklistItems=['Knowledge handover', 'Tool permissions'],
            notes='Manager sign-off still pending.',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-onboarding-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['overduePlans'], 1)
        self.assertGreaterEqual(response.data['summary']['blockedPlans'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['planType'] == 'Transition' for item in response.data['planTypeBreakdown']))

    def test_hr_can_create_shift_schedule(self):
        self.client.force_authenticate(user=self.hr_user)

        response = self.client.post(
            reverse('hr-shift-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'shiftDate': '2026-04-08',
                'shiftType': 'Morning',
                'startTime': '09:00',
                'endTime': '17:00',
                'location': 'Cairo HQ',
                'status': 'Planned',
                'notes': 'Main office support shift.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ShiftSchedule.objects.filter(employee=self.employee).count(), 1)

    def test_employee_can_acknowledge_shift_schedule(self):
        shift = ShiftSchedule.objects.create(
            employee=self.employee,
            shiftDate='2026-04-08',
            shiftType='Morning',
            startTime='09:00',
            endTime='17:00',
            location='Cairo HQ',
            status='Planned',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-shift-acknowledge', kwargs={'schedule_id': shift.scheduleID}),
            {'status': 'Confirmed', 'note': 'Confirmed and ready.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Confirmed')

    def test_hr_shift_watch_snapshot_returns_coverage_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Nour Shifts',
            email='nour.shifts@test.com',
            department='Operations',
            jobTitle='Support Associate',
            role='TeamMember',
            team='Ops Night',
            employmentStatus='Active',
        )
        pending_shift = ShiftSchedule.objects.create(
            employee=self.employee,
            shiftDate=timezone.localdate() + timedelta(days=1),
            shiftType='Morning',
            startTime='09:00',
            endTime='17:00',
            location='Cairo HQ',
            status='Planned',
            notes='Needs employee confirmation before the roster is finalized.',
            createdBy='Attendance HR',
        )
        ShiftSchedule.objects.filter(pk=pending_shift.pk).update(createdAt=timezone.now() - timedelta(days=3), updatedAt=timezone.now() - timedelta(days=2))
        ShiftSchedule.objects.create(
            employee=second_employee,
            shiftDate=timezone.localdate(),
            shiftType='Night',
            startTime='22:00',
            endTime='06:00',
            location='Remote',
            status='Swapped',
            notes='Swap request still needs final HR review.',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-shift-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['plannedCount'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertGreaterEqual(response.data['summary']['coverageRiskCount'], 1)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['shiftType'] == 'Night' for item in response.data['shiftTypeBreakdown']))

    def test_hr_can_create_policy_announcement(self):
        self.client.force_authenticate(user=self.hr_user)

        response = self.client.post(
            reverse('hr-policy-list-create'),
            {
                'title': 'Updated Remote Work Policy',
                'category': 'Policy',
                'audience': 'All Employees',
                'content': 'Employees can work remotely up to two days per week.',
                'status': 'Published',
                'effectiveDate': '2026-04-15',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(PolicyAnnouncement.objects.count(), 1)

    def test_employee_can_acknowledge_policy_announcement(self):
        policy = PolicyAnnouncement.objects.create(
            title='Code of Conduct Reminder',
            category='Announcement',
            audience='All Employees',
            content='Please review and follow the latest code of conduct.',
            status='Published',
            effectiveDate='2026-04-10',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-policy-acknowledge', kwargs={'policy_id': policy.policyID}),
            {'note': 'Read and acknowledged.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Acknowledged')

    def test_team_leader_can_create_recognition_award(self):
        self.client.force_authenticate(user=self.team_leader_user)

        response = self.client.post(
            reverse('team-recognition-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'title': 'Sprint Hero',
                'category': 'Achievement',
                'message': 'Outstanding work on the release and bug fixes.',
                'points': 25,
                'recognitionDate': '2026-04-20',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(RecognitionAward.objects.filter(employee=self.employee).count(), 1)

    def test_employee_can_list_own_recognition_awards(self):
        RecognitionAward.objects.create(
            employee=self.employee,
            title='Customer Champion',
            category='Appreciation',
            message='Recognized for excellent stakeholder support.',
            points=15,
            recognitionDate='2026-04-19',
            recognizedBy='Platform Lead',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(reverse('employee-recognition-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Customer Champion')

    def test_hr_recognition_watch_snapshot_returns_engagement_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Mona Recognition',
            email='mona.recognition@test.com',
            department='People Ops',
            jobTitle='Coordinator',
            role='TeamMember',
            team='Ops D',
            employmentStatus='Active',
        )
        third_employee = Employee.objects.create(
            fullName='Omar Quiet',
            email='omar.quiet@test.com',
            department='Finance',
            jobTitle='Analyst',
            role='TeamMember',
            team='Fin A',
            employmentStatus='Active',
        )
        RecognitionAward.objects.create(
            employee=self.employee,
            title='Quarterly Thanks',
            category='Achievement',
            message='Recognition cadence has slowed down and needs a refresh.',
            points=10,
            recognitionDate=timezone.localdate() - timedelta(days=45),
            recognizedBy='Operations Lead',
        )
        RecognitionAward.objects.create(
            employee=second_employee,
            title='Team Collaboration',
            category='Teamwork',
            message='Recognized for helping the onboarding squad.',
            points=20,
            recognitionDate=timezone.localdate() - timedelta(days=5),
            recognizedBy='HR Partner',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-recognition-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['totalAwards'], 2)
        self.assertGreaterEqual(response.data['summary']['staleRecognitionCount'], 1)
        self.assertGreaterEqual(response.data['summary']['employeesWithoutRecognition'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['employeeName'] == 'Omar Quiet' for item in response.data['followUpItems']))
        self.assertTrue(any(item['category'] == 'Achievement' for item in response.data['categoryBreakdown']))

    def test_hr_can_create_benefit_enrollment(self):
        self.client.force_authenticate(user=self.hr_user)

        response = self.client.post(
            reverse('hr-benefit-list-create'),
            {
                'employeeID': self.employee.employeeID,
                'benefitName': 'Premium Medical Plan',
                'benefitType': 'Medical',
                'provider': 'Health Secure',
                'coverageLevel': 'Family',
                'status': 'Pending',
                'monthlyCost': '2400.00',
                'employeeContribution': '350.00',
                'effectiveDate': '2026-05-01',
                'notes': 'Annual open enrollment option.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(BenefitEnrollment.objects.filter(employee=self.employee).count(), 1)

    def test_employee_can_update_own_benefit_status(self):
        benefit = BenefitEnrollment.objects.create(
            employee=self.employee,
            benefitName='Retirement Savings Plan',
            benefitType='Retirement',
            provider='Future Fund',
            coverageLevel='Standard',
            status='Pending',
            monthlyCost='0.00',
            employeeContribution='500.00',
            effectiveDate='2026-05-01',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            reverse('employee-benefit-status', kwargs={'enrollment_id': benefit.enrollmentID}),
            {'status': 'Enrolled', 'note': 'Please activate this starting next month.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Enrolled')

    def test_hr_benefit_watch_snapshot_returns_enrollment_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Mariam Benefit',
            email='mariam.benefit@test.com',
            department='Operations',
            jobTitle='Specialist',
            role='TeamMember',
            team='Ops A',
            employmentStatus='Active',
        )
        BenefitEnrollment.objects.create(
            employee=self.employee,
            benefitName='Premium Medical Plan',
            benefitType='Medical',
            provider='Health Secure',
            coverageLevel='Family',
            status='Pending',
            monthlyCost='2400.00',
            employeeContribution='350.00',
            effectiveDate=timezone.localdate() - timedelta(days=2),
            notes='Missing final enrollment confirmation.',
            createdBy='Attendance HR',
        )
        BenefitEnrollment.objects.create(
            employee=second_employee,
            benefitName='Transit Pass',
            benefitType='Transportation',
            provider='City Move',
            coverageLevel='Employee Only',
            status='Pending',
            monthlyCost='180.00',
            employeeContribution='25.00',
            effectiveDate=timezone.localdate() + timedelta(days=3),
            notes='Awaiting employee choice before effective date.',
            createdBy='Attendance HR',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-benefit-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['pendingCount'], 2)
        self.assertGreaterEqual(response.data['summary']['overdueCount'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['benefitType'] == 'Medical' for item in response.data['benefitTypeBreakdown']))

    def test_employee_can_submit_expense_claim(self):
        self.client.force_authenticate(user=self.employee_user)

        response = self.client.post(
            reverse('employee-expense-list-create'),
            {
                'title': 'Client Meeting Travel',
                'category': 'Travel',
                'amount': '425.75',
                'expenseDate': '2026-05-10',
                'description': 'Taxi and fuel costs for the Alexandria client visit.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ExpenseClaim.objects.filter(employee=self.employee).count(), 1)

    def test_hr_can_review_expense_claim(self):
        claim = ExpenseClaim.objects.create(
            employee=self.employee,
            title='Laptop Accessories',
            category='Supplies',
            amount='180.00',
            expenseDate='2026-05-08',
            description='Keyboard and mouse replacement.',
            status='Submitted',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post(
            reverse('hr-expense-review', kwargs={'claim_id': claim.claimID}),
            {'status': 'Approved', 'note': 'Approved for May reimbursement batch.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Approved')

    def test_hr_expense_watch_snapshot_returns_reimbursement_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Nadia Expense',
            email='nadia.expense@test.com',
            department='Finance',
            jobTitle='Analyst',
            role='TeamMember',
            team='FinOps',
            employmentStatus='Active',
        )
        urgent_claim = ExpenseClaim.objects.create(
            employee=self.employee,
            title='Client Travel Advance',
            category='Travel',
            amount='520.00',
            expenseDate=timezone.localdate() - timedelta(days=6),
            description='Pending manager documentation review.',
            status='Submitted',
        )
        ExpenseClaim.objects.filter(pk=urgent_claim.pk).update(createdAt=timezone.now() - timedelta(days=5))
        ExpenseClaim.objects.create(
            employee=second_employee,
            title='Wellness Reimbursement',
            category='Other',
            amount='180.00',
            expenseDate=timezone.localdate() - timedelta(days=2),
            description='Approved and awaiting finance payout.',
            status='Approved',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-expense-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['submittedCount'], 1)
        self.assertGreaterEqual(response.data['summary']['overdueCount'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['category'] == 'Travel' for item in response.data['categoryBreakdown']))

    def test_employee_can_submit_document_request(self):
        self.client.force_authenticate(user=self.employee_user)

        response = self.client.post(
            reverse('employee-document-list-create'),
            {
                'documentType': 'Salary Certificate',
                'purpose': 'Bank loan application',
                'notes': 'Please include current net salary.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(DocumentRequest.objects.filter(employee=self.employee).count(), 1)

    def test_hr_can_issue_document_request(self):
        request_item = DocumentRequest.objects.create(
            employee=self.employee,
            documentType='Employment Letter',
            purpose='Visa processing',
            notes='Urgent turnaround requested.',
            status='Pending',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post(
            reverse('hr-document-issue', kwargs={'request_id': request_item.requestID}),
            {'status': 'Issued', 'note': 'Document prepared and ready for pickup.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Issued')

    def test_hr_document_watch_snapshot_returns_issuance_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Hana Documents',
            email='hana.documents@test.com',
            department='People Ops',
            jobTitle='Coordinator',
            role='TeamMember',
            team='Ops B',
            employmentStatus='Active',
        )
        pending_request = DocumentRequest.objects.create(
            employee=self.employee,
            documentType='Salary Certificate',
            purpose='Mortgage pre-approval',
            notes='Need the stamped document this week.',
            status='Pending',
        )
        DocumentRequest.objects.filter(pk=pending_request.pk).update(createdAt=timezone.now() - timedelta(days=4), updatedAt=timezone.now() - timedelta(days=3))
        DocumentRequest.objects.create(
            employee=second_employee,
            documentType='Experience Letter',
            purpose='Professional licensing file',
            notes='Draft prepared and awaiting final signature.',
            status='In Progress',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-document-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['pendingCount'], 1)
        self.assertGreaterEqual(response.data['summary']['overdueCount'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['documentType'] == 'Salary Certificate' for item in response.data['documentTypeBreakdown']))

    def test_employee_can_create_support_ticket(self):
        self.client.force_authenticate(user=self.employee_user)

        response = self.client.post(
            reverse('employee-ticket-list-create'),
            {
                'subject': 'Laptop VPN issue',
                'category': 'IT',
                'priority': 'High',
                'description': 'Unable to connect to the company VPN since this morning.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(SupportTicket.objects.filter(employee=self.employee).count(), 1)

    def test_hr_can_resolve_support_ticket(self):
        ticket = SupportTicket.objects.create(
            employee=self.employee,
            subject='Payroll clarification',
            category='Payroll',
            priority='Medium',
            description='Need clarification on this month allowance adjustment.',
            status='Open',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post(
            reverse('hr-ticket-status', kwargs={'ticket_id': ticket.ticketID}),
            {'status': 'Resolved', 'note': 'HR shared the payroll breakdown by email.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Resolved')

    def test_hr_ticket_watch_snapshot_returns_support_follow_up_summary(self):
        second_employee = Employee.objects.create(
            fullName='Karim Support',
            email='karim.support@test.com',
            department='Operations',
            jobTitle='Coordinator',
            role='TeamMember',
            team='Ops C',
            employmentStatus='Active',
        )
        stale_ticket = SupportTicket.objects.create(
            employee=self.employee,
            subject='VPN access still blocked',
            category='IT',
            priority='Critical',
            description='Unable to connect to secure systems for the last two days.',
            status='Open',
        )
        SupportTicket.objects.filter(pk=stale_ticket.pk).update(createdAt=timezone.now() - timedelta(days=5), updatedAt=timezone.now() - timedelta(days=4))
        SupportTicket.objects.create(
            employee=second_employee,
            subject='Benefits portal access',
            category='Benefits',
            priority='High',
            description='Portal access issue is still being investigated by the vendor.',
            status='In Progress',
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(reverse('hr-ticket-watch'))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['openCount'], 1)
        self.assertGreaterEqual(response.data['summary']['criticalCount'], 1)
        self.assertGreaterEqual(response.data['summary']['followUpCount'], 2)
        self.assertTrue(any(item['employeeName'] == 'Youssef Nabil' for item in response.data['followUpItems']))
        self.assertTrue(any(item['category'] == 'IT' for item in response.data['categoryBreakdown']))
