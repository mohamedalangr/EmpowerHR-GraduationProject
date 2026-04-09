import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from resume_pipeline.models import Job, Submission
from accounts.models import User
from django.core.files.base import ContentFile

# Sample CV texts
SAMPLE_CVS = [
    {
        'name': 'أحمد حسن',
        'email': 'ahmed.hassan@email.com',
        'cv_text': """
        أحمد حسن - مهندس برمجيات

        الخبرات:
        - 5 سنوات كمطور Python في شركة حلول رقمية بالقاهرة
        - 3 سنوات كمطور Django في شركة خدمات ويب مصرية
        - سنتان كمطور JavaScript في شركة ناشئة محلية

        المهارات:
        - Python, Django, JavaScript, React, SQL
        - REST APIs, Git, Docker
        - بناء لوحات تشغيل داخلية وأنظمة موارد بشرية

        التعليم:
        بكالوريوس حاسبات ومعلومات - جامعة القاهرة
        """,
        'job_id': 1
    },
    {
        'name': 'سارة عبد الله',
        'email': 'sara.abdullah@email.com',
        'cv_text': """
        سارة عبد الله - محللة بيانات موارد بشرية

        الخبرات:
        - 4 سنوات كمحللة بيانات في شركة خدمات أعمال
        - 3 سنوات كمهندسة تعلم آلي في شركة تحليلات مصرية
        - سنتان في إعداد تقارير Python وSQL لفرق الموارد البشرية

        المهارات:
        - Python, Machine Learning, SQL, Power BI
        - Statistics, Data Visualization, Pandas
        - تحليلات دوران الموظفين والتقارير التشغيلية

        التعليم:
        ماجستير علوم البيانات - جامعة عين شمس
        """,
        'job_id': 2
    },
    {
        'name': 'محمود فوزي',
        'email': 'mahmoud.fawzy@email.com',
        'cv_text': """
        محمود فوزي - مدير موارد بشرية

        الخبرات:
        - 6 سنوات كمدير موارد بشرية في شركة مصرية متوسطة
        - 4 سنوات في التوظيف واكتساب المواهب
        - 3 سنوات في علاقات الموظفين وإدارة الأداء

        المهارات:
        - HR Management, Recruitment, Communication
        - Leadership, Training, Conflict Resolution
        - Performance Management, Employee Engagement

        التعليم:
        ماجستير إدارة أعمال - الأكاديمية العربية
        """,
        'job_id': 3
    },
    {
        'name': 'آية سمير',
        'email': 'aya.sameer@email.com',
        'cv_text': """
        آية سمير - مطورة Full Stack

        الخبرات:
        - 4 سنوات كمطورة Backend في شركة حلول ويب بالقاهرة
        - 3 سنوات كمهندسة Full Stack في شركة تقنية مصرية
        - سنتان في تطوير أنظمة داخلية لخدمة فرق التشغيل

        المهارات:
        - Python, Django, JavaScript, React, Node.js
        - PostgreSQL, Redis, Docker
        - تصميم واجهات استخدام عملية وسريعة

        التعليم:
        بكالوريوس هندسة برمجيات - جامعة المنصورة
        """,
        'job_id': 1
    },
    {
        'name': 'يوسف خالد',
        'email': 'youssef.khaled@email.com',
        'cv_text': """
        يوسف خالد - محلل بيانات

        الخبرات:
        - 3 سنوات كمحلل أعمال في شركة خدمات مالية مصرية
        - سنتان كمحلل بيانات في قطاع التجزئة
        - سنتان في تطوير تقارير SQL ولوحات متابعة للإدارة

        المهارات:
        - SQL, Python, Excel, Tableau
        - Data Analysis, Statistics, Reporting
        - مؤشرات الأداء وتحليل الاتجاهات

        التعليم:
        بكالوريوس إحصاء - جامعة الإسكندرية
        """,
        'job_id': 2
    }
]

def populate_sample_data():
    print("Populating sample CV submissions...")

    for cv_data in SAMPLE_CVS:
        try:
            job = Job.objects.get(id=cv_data['job_id'])

            # Create submission
            submission = Submission.objects.create(
                job=job,
                candidate_name=cv_data['name'],
                candidate_email=cv_data['email'],
                status='done',
                raw_text=cv_data['cv_text'],
                candidate_degree='Bachelor',  # Default
                candidate_years_exp=4.0,  # Default
            )

            # Create a dummy file
            file_content = cv_data['cv_text'].encode('utf-8')
            file_name = f"{cv_data['name'].replace(' ', '_')}.txt"
            submission.resume_file.save(file_name, ContentFile(file_content))

            print(f"Created submission: {cv_data['name']} for {job.title}")

        except Job.DoesNotExist:
            print(f"Job {cv_data['job_id']} not found, skipping {cv_data['name']}")
        except Exception as e:
            print(f"Error creating submission for {cv_data['name']}: {e}")

    print(f"Total submissions created: {Submission.objects.count()}")

if __name__ == '__main__':
    populate_sample_data()