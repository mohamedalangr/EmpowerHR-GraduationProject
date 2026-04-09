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
        self.stdout.write('جارٍ تحميل البيانات التجريبية المحلية...')

        demo_users = ensure_demo_users()
        self.stdout.write(self.style.SUCCESS(f"Demo users ready: {', '.join(user.email for user in demo_users)}"))

        today = timezone.localdate()
        now = timezone.now()

        Job.objects.filter(title__in=['Software Engineer', 'Data Scientist', 'HR Manager']).delete()
        FeedbackForm.objects.filter(title='Employee Satisfaction Survey').delete()

        def at_local(day, hour, minute=0):
            return timezone.make_aware(datetime.combine(day, time(hour, minute)))

        jobs_data = [
            {
                'title': 'مهندس برمجيات',
                'description': 'تطوير خصائص لأنظمة الموارد البشرية، صيانة واجهات API، ودعم الإطلاقات الآمنة داخل السوق المصري.',
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
                'title': 'محلل بيانات موارد بشرية',
                'description': 'تحليل بيانات الموظفين، بناء نماذج تنبؤية، وتقديم تقارير تشغيلية تساعد فرق الموارد البشرية في مصر.',
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
                'title': 'مدير موارد بشرية',
                'description': 'قيادة عمليات الأفراد، تخطيط القوى العاملة، دعم الموظفين، وضمان الالتزام بالسياسات المحلية.',
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

        software_job = jobs.get('مهندس برمجيات')
        if software_job:
            Submission.objects.update_or_create(
                job=software_job,
                candidate_email='candidate@test.com',
                defaults={
                    'candidate_name': 'سارة محمد',
                    'resume_file': 'resumes/candidate_test_cv.txt',
                    'status': Submission.Status.DONE,
                    'review_stage': Submission.ReviewStage.SHORTLISTED,
                    'stage_notes': 'توافق قوي مع React وDjango وجاهزة للمقابلة النهائية.',
                    'stage_updated_at': now - timedelta(days=1),
                    'talent_pool': True,
                    'stage_history': [
                        {
                            'from_stage': 'Applied',
                            'to_stage': 'Shortlisted',
                            'note': 'تجاوزت فرز السيرة الذاتية بوضوح في الواجهة الأمامية وبناء الأنظمة الداخلية.',
                            'actor_name': 'نهى عبد الرحمن',
                            'actor_role': 'HRManager',
                            'occurred_at': (now - timedelta(days=1)).isoformat(),
                        }
                    ],
                    'raw_text': 'مهندسة React لديها خبرة في بناء واجهات داخلية وأنظمة موارد بشرية باستخدام Django.',
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
                    'candidate_name': 'آمنة حسن',
                    'resume_file': 'resumes/candidate_test_cv.txt',
                    'status': Submission.Status.DONE,
                    'review_stage': Submission.ReviewStage.INTERVIEW,
                    'stage_notes': 'لجنة التوظيف طلبت عرضًا عمليًا قصيرًا لشرح بنية الواجهة.',
                    'stage_updated_at': now - timedelta(days=2),
                    'talent_pool': True,
                    'stage_history': [
                        {
                            'from_stage': 'Shortlisted',
                            'to_stage': 'Interview',
                            'note': 'تم حجز المقابلة الفنية يوم الخميس الساعة 11 صباحًا.',
                            'actor_name': 'محمد عبد الله',
                            'actor_role': 'TeamLeader',
                            'occurred_at': (now - timedelta(days=2)).isoformat(),
                        }
                    ],
                    'raw_text': 'مهندسة واجهات تركز على تجربة المستخدم وتملك خبرة جيدة في الاختبارات والوصول السلس.',
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
            title='استبيان رضا الموظفين',
            defaults={
                'description': 'نموذج نبض ربع سنوي تجريبي لقياس رضا الموظفين داخل بيئة عمل مصرية محلية.',
                'isActive': True,
            },
        )

        questions_data = [
            {'questionText': 'ما مدى رضاك عن دورك الحالي؟', 'fieldType': 'score_1_4', 'order': 1},
            {'questionText': 'هل تشعر بالتقدير داخل الشركة؟', 'fieldType': 'boolean', 'order': 2},
            {'questionText': 'كيف تقيّم التوازن بين العمل والحياة؟', 'fieldType': 'score_1_4', 'order': 3},
            {'questionText': 'ما مدى احتمالية أن تنصح صديقًا بالعمل هنا؟', 'fieldType': 'score_1_4', 'order': 4},
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

        if team_member:
            EmployeeGoal.objects.filter(employee=team_member, title__in=[
                'Stabilize API launch checklist',
                'Finish advanced system design plan',
            ]).delete()
            WorkTask.objects.filter(employee=team_member, title__in=[
                'Resolve release blocker with QA',
                'Finalize sprint handover notes',
            ]).delete()
            TrainingCourse.objects.filter(title__in=['Secure Coding Refresher', 'Advanced React Performance']).delete()
            PerformanceReview.objects.filter(employee=team_member, reviewPeriod='Q1 2026').delete()
            SuccessionPlan.objects.filter(employee=team_member, targetRole='Senior Software Engineer').delete()
            OnboardingPlan.objects.filter(employee=team_member, title='Platform squad transition plan').delete()
            PolicyAnnouncement.objects.filter(title__in=[
                'Updated remote work and security policy',
                'Quarterly information security acknowledgement',
            ]).delete()
            RecognitionAward.objects.filter(employee=team_member, title='Sprint delivery recognition').delete()
            BenefitEnrollment.objects.filter(employee=team_member, benefitName__in=['Premium Medical Plan', 'Wellness Allowance']).delete()
            ExpenseClaim.objects.filter(employee=team_member, title__in=['Client workshop travel', 'Home office accessories']).delete()
            DocumentRequest.objects.filter(employee=team_member, documentType__in=['Employment Letter', 'Salary Certificate']).delete()
            SupportTicket.objects.filter(employee=team_member, subject__in=['VPN access still unstable', 'Benefit card address update']).delete()

        if team_leader:
            EmployeeGoal.objects.filter(employee=team_leader, title='Complete weekly coaching review').delete()
            WorkTask.objects.filter(employee=team_leader, title='Review squad blockers and approvals').delete()
            RecognitionAward.objects.filter(employee=team_leader, title='Mentorship spotlight').delete()

        if not team_member:
            self.stdout.write(self.style.WARNING('Demo employee record not found. Basic sample data loaded without employee workspace scenarios.'))
            self.stdout.write(self.style.SUCCESS('تم تحميل البيانات التجريبية بنجاح!'))
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
            'ما مدى رضاك عن دورك الحالي؟': '3',
            'هل تشعر بالتقدير داخل الشركة؟': 'true',
            'كيف تقيّم التوازن بين العمل والحياة؟': '2',
            'ما مدى احتمالية أن تنصح صديقًا بالعمل هنا؟': '4',
        }
        for question_text, answer in answers_data.items():
            question = question_map.get(question_text)
            if question:
                answer_defaults = {
                    'scoreValue': None,
                    'booleanValue': None,
                    'decimalValue': None,
                }
                if question.fieldType == 'boolean':
                    answer_defaults['booleanValue'] = str(answer).strip().lower() in {'true', '1', 'yes'}
                elif question.fieldType == 'decimal':
                    answer_defaults['decimalValue'] = Decimal(str(answer))
                else:
                    answer_defaults['scoreValue'] = int(answer)

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
                'notes': 'تم الانتهاء من اجتماع الصباح، وما زالت مراجعات إطلاق العميل مستمرة.',
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
                'notes': 'يوم عمل كامل بالمقر مع تخطيط السبرنت والاستعداد للإطلاق.',
            },
        )

        LeaveRequest.objects.update_or_create(
            employee=team_member,
            startDate=today + timedelta(days=9),
            endDate=today + timedelta(days=10),
            defaults={
                'leaveType': LeaveRequest.TYPE_ANNUAL,
                'daysRequested': 2,
                'reason': 'سفر عائلي تم ترتيبه مسبقًا مع نهاية الأسبوع.',
                'status': LeaveRequest.STATUS_PENDING,
                'eligibilityMessage': 'الرصيد متاح، والطلب بانتظار مراجعة المدير.',
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
                'reason': 'موعد شخصي ضروري.',
                'status': LeaveRequest.STATUS_APPROVED,
                'eligibilityMessage': 'تمت الموافقة من الرصيد المتاح.',
                'reviewNotes': 'تمت الموافقة من قائد الفريق.',
                'reviewedBy': 'محمد عبد الله',
                'reviewedAt': now - timedelta(days=20),
            },
        )

        current_period = today.strftime('%Y-%m')
        previous_period = (today.replace(day=1) - timedelta(days=1)).strftime('%Y-%m')
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
                'notes': 'راتب هذا الشهر في المراجعة النهائية قبل الاعتماد والصرف.',
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
                'notes': 'تم صرف دورة الرواتب السابقة بنجاح.',
            },
        )

        EmployeeGoal.objects.update_or_create(
            employee=team_member,
            title='إتمام قائمة إطلاق واجهة الموارد البشرية',
            defaults={
                'description': 'إغلاق العوائق المتبقية، مراجعة خطة التراجع، والحفاظ على جاهزية الإطلاق.',
                'category': 'Performance',
                'priority': 'High',
                'status': 'In Progress',
                'progress': 70,
                'dueDate': today + timedelta(days=3),
                'createdBy': (team_leader.fullName if team_leader else 'محمد عبد الله'),
            },
        )
        EmployeeGoal.objects.update_or_create(
            employee=team_member,
            title='استكمال خطة تعلم تصميم الأنظمة',
            defaults={
                'description': 'إنهاء وحدة التوسع في الخلفية ومشاركة الملخص في الاجتماع الفردي القادم.',
                'category': 'Development',
                'priority': 'Medium',
                'status': 'In Progress',
                'progress': 45,
                'dueDate': today + timedelta(days=14),
                'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )

        WorkTask.objects.update_or_create(
            employee=team_member,
            title='حل عائق الإصدار مع فريق الجودة',
            defaults={
                'description': 'فحص اختبار الرجوع غير المستقر وتثبيت قرار الإطلاق قبل الظهر.',
                'priority': 'High',
                'status': 'Blocked',
                'progress': 40,
                'estimatedHours': 4,
                'dueDate': today + timedelta(days=1),
                'assignedBy': (team_leader.fullName if team_leader else 'محمد عبد الله'),
            },
        )
        WorkTask.objects.update_or_create(
            employee=team_member,
            title='إنهاء ملاحظات تسليم السبرنت',
            defaults={
                'description': 'تلخيص ما تم إنجازه والمخاطر المفتوحة وخطة التغطية للسبرنت القادم.',
                'priority': 'Medium',
                'status': 'In Progress',
                'progress': 55,
                'estimatedHours': 2,
                'dueDate': today + timedelta(days=2),
                'assignedBy': (team_leader.fullName if team_leader else 'محمد عبد الله'),
            },
        )

        if team_leader:
            EmployeeGoal.objects.update_or_create(
                employee=team_leader,
                title='استكمال مراجعة المتابعة الأسبوعية للفريق',
                defaults={
                    'description': 'مراجعة سرعة الفريق والعوائق الحالية والاستعداد قبل اجتماع الجمعة.',
                    'category': 'Leadership',
                    'priority': 'High',
                    'status': 'In Progress',
                    'progress': 60,
                    'dueDate': today + timedelta(days=2),
                    'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
                },
            )
            WorkTask.objects.update_or_create(
                employee=team_leader,
                title='مراجعة عوائق الفريق والموافقات العاجلة',
                defaults={
                    'description': 'إنهاء الموافقات العاجلة ورفع العوائق من قائمة الإطلاق.',
                    'priority': 'High',
                    'status': 'In Progress',
                    'progress': 50,
                    'estimatedHours': 3,
                    'dueDate': today + timedelta(days=1),
                    'assignedBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
                },
            )

        TrainingCourse.objects.update_or_create(
            title='مراجعة الأمن البرمجي',
            defaults={
                'description': 'محتوى امتثال يركز على إدارة الأسرار، سجلات التدقيق، ونقاط المراجعة الآمنة.',
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
                'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )
        TrainingCourse.objects.update_or_create(
            title='تحسين أداء تطبيق React',
            defaults={
                'description': 'مسار تقني يركز على قياس الأداء وmemoization وتحسين سرعة لوحات المتابعة.',
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
                'createdBy': (team_leader.fullName if team_leader else 'محمد عبد الله'),
            },
        )

        PerformanceReview.objects.update_or_create(
            employee=team_member,
            reviewPeriod='الربع الأول 2026',
            defaults={
                'reviewType': 'Quarterly',
                'overallRating': 4,
                'status': 'Submitted',
                'strengths': 'تنفيذ قوي في التسليم، وتحمل مسؤولية المنتج، والتعاون الجيد في حل المشكلات.',
                'improvementAreas': 'تقليل مخاطر الإطلاق في اللحظات الأخيرة عبر تصعيد العوائق مبكرًا.',
                'goalsSummary': 'الحفاظ على جودة الـ API وإنهاء خطة التعلم الحالية.',
                'employeeNote': 'أرغب في تحمل مسؤولية أكبر في مراجعات البنية الفنية.',
                'reviewDate': today - timedelta(days=8),
                'createdBy': (team_leader.fullName if team_leader else 'محمد عبد الله'),
            },
        )

        SuccessionPlan.objects.update_or_create(
            employee=team_member,
            targetRole='مهندس برمجيات أول',
            defaults={
                'readiness': '6-12 Months',
                'status': 'On Track',
                'retentionRisk': 'Medium',
                'developmentActions': 'قيادة مراجعة الإطلاق القادمة وإنهاء خطة التدريب المعماري.',
                'notes': 'الأداء الحالي قوي مع حاجة للتوسع أكثر في التخطيط طويل المدى.',
                'employeeNote': 'أهتم بالمشاركة بصورة أكبر في أعمال الاعتمادية والاستقرار.',
                'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )

        OnboardingPlan.objects.update_or_create(
            employee=team_member,
            title='خطة الانتقال داخل فريق المنصة',
            defaults={
                'planType': 'Transition',
                'status': 'In Progress',
                'progress': 55,
                'startDate': today - timedelta(days=4),
                'targetDate': today + timedelta(days=5),
                'checklistItems': [
                    'تأكيد صلاحيات المستودع',
                    'متابعة تسليم الاعتمادية مع الزميل المسؤول',
                    'مراجعة خريطة تنبيهات المتابعة',
                ],
                'notes': 'الانتقال يسير بشكل جيد لكنه ما زال بانتظار آخر صلاحيات المراقبة.',
                'employeeNote': 'أحتاج إلى جولة إضافية على خدمة التقارير.',
                'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )

        ShiftSchedule.objects.update_or_create(
            employee=team_member,
            shiftDate=today + timedelta(days=1),
            startTime=time(9, 0),
            defaults={
                'shiftType': 'Morning',
                'endTime': time(17, 0),
                'location': 'القاهرة - المقر الرئيسي',
                'status': 'Confirmed',
                'notes': 'يوم تغطية من المكتب لدعم الإطلاق والمتابعة.',
                'employeeNote': 'تم التأكيد بعد مكالمة الصباح مع العميل.',
                'acknowledgedAt': now - timedelta(hours=8),
                'createdBy': (team_leader.fullName if team_leader else 'محمد عبد الله'),
            },
        )
        ShiftSchedule.objects.update_or_create(
            employee=team_member,
            shiftDate=today + timedelta(days=3),
            startTime=time(12, 0),
            defaults={
                'shiftType': 'Flexible',
                'endTime': time(20, 0),
                'location': 'عن بُعد',
                'status': 'Swapped',
                'notes': 'تم تبديل التغطية لدعم فترة التحضير لعرض العميل.',
                'employeeNote': 'يرجى مراجعة التسليم مع زميل فترة المساء.',
                'createdBy': (team_leader.fullName if team_leader else 'محمد عبد الله'),
            },
        )

        PolicyAnnouncement.objects.update_or_create(
            title='تحديث سياسة العمل الهجين وأمن الأجهزة',
            defaults={
                'category': 'Policy',
                'audience': 'All Employees',
                'content': 'يرجى مراجعة ضوابط العمل الهجين، وحماية الأجهزة، وخطوات الاعتماد الجديدة.',
                'status': 'Published',
                'effectiveDate': today + timedelta(days=2),
                'acknowledgedByIDs': [],
                'acknowledgementNotes': {},
                'lastReminderAt': now - timedelta(days=1),
                'lastReminderNote': 'تم إرسال تذكير قبل موعد تطبيق السياسة.',
                'reminderCount': 1,
                'reminderHistory': [
                    {
                        'sentAt': (now - timedelta(days=1)).isoformat(),
                        'note': 'تمت مشاركة التحديث في مساحة الموظف ورسالة البريد الدورية.',
                    }
                ],
                'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )
        PolicyAnnouncement.objects.update_or_create(
            title='إقرار ربع سنوي بأمن المعلومات',
            defaults={
                'category': 'Announcement',
                'audience': 'All Employees',
                'content': 'تم استكمال الإقرار الربع سنوي وحفظه ضمن سجل الامتثال الداخلي.',
                'status': 'Acknowledged',
                'effectiveDate': today - timedelta(days=6),
                'acknowledgedByIDs': [team_member.employeeID],
                'acknowledgementNotes': {
                    team_member.employeeID: 'تمت المراجعة والإقرار خلال متابعة الامتثال الشهرية.'
                },
                'acknowledgedAt': now - timedelta(days=5),
                'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )

        RecognitionAward.objects.update_or_create(
            employee=team_member,
            title='تقدير لإنهاء السبرنت بنجاح',
            recognitionDate=today - timedelta(days=5),
            defaults={
                'category': 'Achievement',
                'message': 'شكرًا على رفع العوائق عن الإطلاق والحفاظ على هدوء الفريق أثناء مراجعات الجودة النهائية.',
                'points': 80,
                'recognizedBy': (team_leader.fullName if team_leader else 'محمد عبد الله'),
            },
        )
        if team_leader:
            RecognitionAward.objects.update_or_create(
                employee=team_leader,
                title='إشادة بدور التوجيه والمتابعة',
                recognitionDate=today - timedelta(days=9),
                defaults={
                    'category': 'Leadership',
                    'message': 'تقديرًا للدعم السريع والتوجيه الواضح خلال أسبوع انتقال الفريق.',
                    'points': 60,
                    'recognizedBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
                },
            )

        BenefitEnrollment.objects.update_or_create(
            employee=team_member,
            benefitName='الخطة الطبية المميزة',
            defaults={
                'benefitType': 'Medical',
                'provider': 'رعاية النيل',
                'coverageLevel': 'الموظف + الأسرة',
                'status': 'Enrolled',
                'monthlyCost': Decimal('1200.00'),
                'employeeContribution': Decimal('250.00'),
                'effectiveDate': today - timedelta(days=40),
                'notes': 'الخطة الطبية الأساسية مفعّلة وموجودة داخل بوابة الخدمة الذاتية.',
                'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )
        BenefitEnrollment.objects.update_or_create(
            employee=team_member,
            benefitName='بدل العافية الشهرية',
            defaults={
                'benefitType': 'Wellness',
                'provider': 'EmpowerHR Flex',
                'coverageLevel': 'بدل شهري',
                'status': 'Pending',
                'monthlyCost': Decimal('300.00'),
                'employeeContribution': Decimal('0.00'),
                'effectiveDate': today + timedelta(days=7),
                'notes': 'بانتظار الإقرار النهائي من الموظف قبل التفعيل.',
                'createdBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )

        ExpenseClaim.objects.update_or_create(
            employee=team_member,
            title='مصاريف تنقل ورشة عميل بالقاهرة',
            expenseDate=today - timedelta(days=7),
            defaults={
                'category': 'Travel',
                'amount': Decimal('845.50'),
                'description': 'إيصالات تاكسي وقطار خاصة بزيارة ورشة العميل في القاهرة.',
                'status': 'Submitted',
                'reviewNote': 'بانتظار الاعتماد النهائي من الشؤون المالية.',
            },
        )
        ExpenseClaim.objects.update_or_create(
            employee=team_member,
            title='مستلزمات مكتب منزلي',
            expenseDate=today - timedelta(days=22),
            defaults={
                'category': 'Supplies',
                'amount': Decimal('260.00'),
                'description': 'مستلزمات مريحة للعمل عن بُعد تمت الموافقة عليها.',
                'status': 'Reimbursed',
                'reviewNote': 'تمت التسوية ضمن آخر دورة رواتب مكتملة.',
                'reviewedBy': 'فريق الشؤون المالية',
                'reviewedAt': now - timedelta(days=17),
            },
        )

        DocumentRequest.objects.update_or_create(
            employee=team_member,
            documentType='خطاب جهة عمل',
            purpose='موعد سفارة',
            defaults={
                'notes': 'يرجى تضمين آخر مسمى وظيفي وتاريخ بدء العمل.',
                'status': 'In Progress',
                'reviewNote': 'المسودة قيد مراجعة الموارد البشرية للتوقيع.',
                'issuedBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
            },
        )
        DocumentRequest.objects.update_or_create(
            employee=team_member,
            documentType='مفردات مرتب',
            purpose='تحديث بيانات البنك',
            defaults={
                'notes': 'تم إصدارها لدعم تحديث ملف البنك.',
                'status': 'Issued',
                'reviewNote': 'تم إرسالها للموظف عبر البريد الإلكتروني.',
                'issuedBy': (hr_manager.fullName if hr_manager else 'نهى عبد الرحمن'),
                'issuedAt': now - timedelta(days=3),
            },
        )

        SupportTicket.objects.update_or_create(
            employee=team_member,
            subject='اتصال الـ VPN غير مستقر',
            defaults={
                'category': 'IT',
                'priority': 'Critical',
                'description': 'الاتصال ينقطع أثناء النشر ويؤثر على قائمة مراجعة الإطلاق.',
                'status': 'Open',
                'assignedTo': 'فريق الدعم التقني',
            },
        )
        SupportTicket.objects.update_or_create(
            employee=team_member,
            subject='تحديث عنوان بطاقة التأمين',
            defaults={
                'category': 'Benefits',
                'priority': 'Medium',
                'description': 'طلب تعديل العنوان قبل شحنة البطاقة الطبية القادمة.',
                'status': 'In Progress',
                'assignedTo': 'فريق المزايا',
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

        self.stdout.write(self.style.SUCCESS('تم تحديث سيناريوهات العرض التجريبية بمحتوى عربي محلي مناسب للموظف والقائد والموارد البشرية والمرشح.'))
        self.stdout.write(self.style.SUCCESS('Sample data loaded successfully!'))