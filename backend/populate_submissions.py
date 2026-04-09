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
        'name': 'Ahmed Hassan',
        'email': 'ahmed.hassan@email.com',
        'cv_text': """
        Ahmed Hassan - Software Engineer

        Experience:
        - 5 years as a Python developer at a digital solutions company in Cairo
        - 3 years as a Django developer at an Egyptian web services company
        - 2 years as a JavaScript developer at a local startup

        Skills:
        - Python, Django, JavaScript, React, SQL
        - REST APIs, Git, Docker
        - Built internal dashboards and HR systems

        Education:
        B.Sc. in Computer Science - Cairo University
        """,
        'job_id': 1
    },
    {
        'name': 'Sara Abdullah',
        'email': 'sara.abdullah@email.com',
        'cv_text': """
        Sara Abdullah - HR Data Analyst

        Experience:
        - 4 years as a data analyst at a business services company
        - 3 years as a machine learning engineer at an Egyptian analytics company
        - 2 years preparing Python and SQL reports for HR teams

        Skills:
        - Python, Machine Learning, SQL, Power BI
        - Statistics, Data Visualization, Pandas
        - Employee attrition analytics and operational reporting

        Education:
        M.Sc. in Data Science - Ain Shams University
        """,
        'job_id': 2
    },
    {
        'name': 'Mahmoud Fawzy',
        'email': 'mahmoud.fawzy@email.com',
        'cv_text': """
        Mahmoud Fawzy - HR Manager

        Experience:
        - 6 years as an HR manager at a mid-sized Egyptian company
        - 4 years in recruitment and talent acquisition
        - 3 years in employee relations and performance management

        Skills:
        - HR Management, Recruitment, Communication
        - Leadership, Training, Conflict Resolution
        - Performance Management, Employee Engagement

        Education:
        MBA - Arab Academy
        """,
        'job_id': 3
    },
    {
        'name': 'Aya Sameer',
        'email': 'aya.sameer@email.com',
        'cv_text': """
        Aya Sameer - Full Stack Developer

        Experience:
        - 4 years as a backend developer at a web solutions company in Cairo
        - 3 years as a full stack engineer at an Egyptian tech company
        - 2 years developing internal systems for operations teams

        Skills:
        - Python, Django, JavaScript, React, Node.js
        - PostgreSQL, Redis, Docker
        - Designed fast and practical user interfaces

        Education:
        B.Sc. in Software Engineering - Mansoura University
        """,
        'job_id': 1
    },
    {
        'name': 'Youssef Khaled',
        'email': 'youssef.khaled@email.com',
        'cv_text': """
        Youssef Khaled - Data Analyst

        Experience:
        - 3 years as a business analyst at an Egyptian financial services company
        - 2 years as a data analyst in the retail sector
        - 2 years developing SQL reports and management dashboards

        Skills:
        - SQL, Python, Excel, Tableau
        - Data Analysis, Statistics, Reporting
        - KPI tracking and trend analysis

        Education:
        B.Sc. in Statistics - Alexandria University
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