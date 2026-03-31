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
        'name': 'John Smith',
        'email': 'john.smith@email.com',
        'cv_text': """
        John Smith - Software Engineer

        EXPERIENCE:
        - 5 years as Python Developer at Tech Corp
        - 3 years as Django Developer at Web Solutions
        - 2 years as JavaScript Developer at Startup Inc

        SKILLS:
        - Python, Django, JavaScript, React, SQL
        - Machine Learning, Data Analysis
        - Git, Docker, AWS

        EDUCATION:
        Bachelor of Computer Science
        """,
        'job_id': 1
    },
    {
        'name': 'Sarah Johnson',
        'email': 'sarah.j@email.com',
        'cv_text': """
        Sarah Johnson - Data Scientist

        EXPERIENCE:
        - 4 years as Data Analyst at Data Corp
        - 3 years as ML Engineer at AI Solutions
        - 2 years as Python Developer at Tech Inc

        SKILLS:
        - Python, Machine Learning, TensorFlow, SQL
        - Statistics, Data Visualization, R
        - Big Data, Hadoop, Spark

        EDUCATION:
        Master of Data Science
        """,
        'job_id': 2
    },
    {
        'name': 'Mike Davis',
        'email': 'mike.davis@email.com',
        'cv_text': """
        Mike Davis - HR Professional

        EXPERIENCE:
        - 6 years as HR Manager at Global Corp
        - 4 years as Talent Acquisition Specialist
        - 3 years as Employee Relations Manager

        SKILLS:
        - HR Management, Recruitment, Communication
        - Leadership, Conflict Resolution, Training
        - Performance Management, Employee Engagement

        EDUCATION:
        Master of Business Administration
        """,
        'job_id': 3
    },
    {
        'name': 'Emily Chen',
        'email': 'emily.chen@email.com',
        'cv_text': """
        Emily Chen - Full Stack Developer

        EXPERIENCE:
        - 4 years as Backend Developer at Web Corp
        - 3 years as Full Stack Engineer at Tech Solutions
        - 2 years as Python Developer at Startup Inc

        SKILLS:
        - Python, Django, JavaScript, React, Node.js
        - PostgreSQL, MongoDB, Redis
        - AWS, Docker, Kubernetes

        EDUCATION:
        Bachelor of Software Engineering
        """,
        'job_id': 1
    },
    {
        'name': 'Alex Rodriguez',
        'email': 'alex.r@email.com',
        'cv_text': """
        Alex Rodriguez - Data Analyst

        EXPERIENCE:
        - 3 years as Business Analyst at Finance Corp
        - 2 years as Data Analyst at Retail Inc
        - 2 years as SQL Developer at Tech Solutions

        SKILLS:
        - SQL, Python, Excel, Tableau
        - Data Analysis, Statistics, Reporting
        - Machine Learning basics, R

        EDUCATION:
        Bachelor of Statistics
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