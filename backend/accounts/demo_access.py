from .models import User, generate_employee_id

DEMO_PASSWORD = 'TestPass123!'

DEMO_ACCOUNTS = [
    {
        'email': 'admin@test.com',
        'full_name': 'محمود السعيد',
        'role': 'Admin',
        'homePath': '/admin/dashboard',
        'jobTitle': 'مدير النظام',
        'department': 'الإدارة',
        'team': 'العمليات المركزية',
        'location': 'القاهرة',
        'accessSummary': [
            'إدارة كاملة للنظام',
            'إدارة المستخدمين والصلاحيات',
            'الوصول إلى جميع مساحات الموارد البشرية والقيادة',
        ],
    },
    {
        'email': 'hr@test.com',
        'full_name': 'نهى عبد الرحمن',
        'role': 'HRManager',
        'homePath': '/hr/dashboard',
        'jobTitle': 'مدير موارد بشرية',
        'department': 'الموارد البشرية',
        'team': 'عمليات الأفراد',
        'location': 'القاهرة',
        'accessSummary': [
            'لوحة الموارد البشرية والموافقات',
            'إدارة الموظفين والرواتب والمزايا والمستندات',
            'متابعة التوظيف والتدريب وخطط الإحلال',
        ],
    },
    {
        'email': 'leader@test.com',
        'full_name': 'محمد عبد الله',
        'role': 'TeamLeader',
        'homePath': '/leader/team',
        'jobTitle': 'قائد فريق التطوير',
        'department': 'التطوير التقني',
        'team': 'فريق المنصة',
        'location': 'الإسكندرية',
        'accessSummary': [
            'إدارة الفريق ولوحة التقدير',
            'توزيع الأهداف والمهام اليومية',
            'استخدام مساحة الموظف بصلاحيات القائد',
        ],
    },
    {
        'email': 'employee@test.com',
        'full_name': 'أحمد علي',
        'role': 'TeamMember',
        'homePath': '/employee/dashboard',
        'jobTitle': 'مهندس برمجيات',
        'department': 'التطوير التقني',
        'team': 'فريق المنصة',
        'location': 'القاهرة',
        'accessSummary': [
            'لوحة الموظف والملف الشخصي',
            'متابعة الحضور والرواتب والمهام والأهداف',
            'إدارة المزايا والطلبات والمستندات والنماذج',
        ],
    },
    {
        'email': 'candidate@test.com',
        'full_name': 'سارة محمد',
        'role': 'Candidate',
        'homePath': '/candidate/dashboard',
        'accessSummary': [
            'تصفح الوظائف المفتوحة',
            'التقديم ومتابعة حالة الطلبات',
            'استخدام بوابة المرشحين فقط',
        ],
    },
]


def ensure_demo_users():
    from feedback.models import Employee

    synced_users = []

    for spec in DEMO_ACCOUNTS:
        email = str(spec['email']).strip().lower()
        role = spec['role']
        expected_staff = role in {'HRManager', 'Admin'}

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User(
                email=email,
                full_name=spec['full_name'],
                role=role,
                is_staff=expected_staff,
                employee_id=generate_employee_id() if role != 'Candidate' else None,
            )
            user.set_password(DEMO_PASSWORD)
            user.save()
        else:
            changed = False
            if user.email != email:
                user.email = email
                changed = True
            if user.full_name != spec['full_name']:
                user.full_name = spec['full_name']
                changed = True
            if user.role != role:
                user.role = role
                changed = True
            if user.is_staff != expected_staff:
                user.is_staff = expected_staff
                changed = True
            if role != 'Candidate' and not user.employee_id:
                user.employee_id = generate_employee_id()
                changed = True
            if role == 'Candidate' and user.employee_id is not None:
                user.employee_id = None
                changed = True
            if not user.check_password(DEMO_PASSWORD):
                user.set_password(DEMO_PASSWORD)
                changed = True
            if changed:
                user.save()

        if role != 'Candidate':
            Employee.objects.update_or_create(
                employeeID=user.employee_id,
                defaults={
                    'fullName': spec['full_name'],
                    'email': email,
                    'jobTitle': spec.get('jobTitle', ''),
                    'department': spec.get('department', ''),
                    'team': spec.get('team', ''),
                    'role': role,
                    'employeeType': 'Full-time',
                    'location': spec.get('location', ''),
                    'employmentStatus': 'Active',
                    'yearsAtCompany': 2,
                    'monthlyIncome': 12000 if role == 'TeamMember' else 18000 if role == 'TeamLeader' else 22000,
                    'performanceRating': 4,
                    'numberOfPromotions': 1 if role in {'TeamLeader', 'HRManager', 'Admin'} else 0,
                },
            )

        synced_users.append(user)

    return synced_users


def build_demo_access_payload():
    return [
        {
            'email': spec['email'],
            'password': DEMO_PASSWORD,
            'role': spec['role'],
            'fullName': spec['full_name'],
            'homePath': spec['homePath'],
            'accessSummary': spec.get('accessSummary', []),
        }
        for spec in DEMO_ACCOUNTS
    ]
