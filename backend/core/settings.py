from pathlib import Path
import os

BASE_DIR   = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-change-in-prod")
DEBUG      = os.getenv("DEBUG", "True") == "True"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "resume_pipeline",
    'feedback',
    'attrition'   
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [BASE_DIR / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

MEDIA_URL  = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
STATIC_URL = "/static/"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
}

CORS_ALLOW_ALL_ORIGINS = True

# Path to skills taxonomy CSV
SKILLS_TAXONOMY_CSV = os.getenv(
    "SKILLS_TAXONOMY_CSV",
    str(BASE_DIR / "it-job-roles-skills-analysis.csv"),
)

# Sentence transformer model
SENTENCE_TRANSFORMER_MODEL = os.getenv(
    "SENTENCE_TRANSFORMER_MODEL",
    "anass1209/resume-job-matcher-all-MiniLM-L6-v2",
)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE     = "UTC"
USE_TZ        = True
