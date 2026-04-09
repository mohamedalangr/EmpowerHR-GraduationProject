from pathlib import Path
import os

from django.core.exceptions import ImproperlyConfigured

try:
    import dj_database_url
except ImportError:
    dj_database_url = None


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=None):
    value = os.getenv(name, "")
    if not value:
        return list(default or [])
    return [item.strip() for item in value.split(",") if item.strip()]


BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("DJANGO_SECRET_KEY", "dev-secret-change-in-prod")
DEBUG = env_bool("DEBUG", os.getenv("DJANGO_DEBUG", "True"))
ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS",
    env_list("DJANGO_ALLOWED_HOSTS", ["127.0.0.1", "localhost"]),
)
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    env_list(
        "DJANGO_CSRF_TRUSTED_ORIGINS",
        ["http://127.0.0.1:3000", "http://localhost:3000"],
    ),
)

CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "").strip()
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "").strip()
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "").strip()
USE_CLOUDINARY = bool(
    CLOUDINARY_URL or (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "resume_pipeline",
    'feedback',
    'attrition',
    'accounts',
    'core',
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  
]

if USE_CLOUDINARY:
    INSTALLED_APPS += [
        "cloudinary_storage",
        "cloudinary",
    ]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"

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

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and dj_database_url:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=not DEBUG,
        )
    }
elif DEBUG:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    raise ImproperlyConfigured(
        "DATABASE_URL is required in production so EmpowerHR stores all system data in PostgreSQL instead of falling back to SQLite."
    )

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

if USE_CLOUDINARY:
    CLOUDINARY_STORAGE = {
        "SECURE": True,
    }
    if CLOUDINARY_CLOUD_NAME:
        CLOUDINARY_STORAGE["CLOUD_NAME"] = CLOUDINARY_CLOUD_NAME
    if CLOUDINARY_API_KEY:
        CLOUDINARY_STORAGE["API_KEY"] = CLOUDINARY_API_KEY
    if CLOUDINARY_API_SECRET:
        CLOUDINARY_STORAGE["API_SECRET"] = CLOUDINARY_API_SECRET

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {
        "BACKEND": (
            "cloudinary_storage.storage.RawMediaCloudinaryStorage"
            if USE_CLOUDINARY
            else "django.core.files.storage.FileSystemStorage"
        ),
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

EMAIL_BACKEND = os.getenv("DJANGO_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DJANGO_DEFAULT_FROM_EMAIL", "no-reply@empowerhr.local")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", os.getenv("DJANGO_SESSION_COOKIE_SECURE", str(not DEBUG)))
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", os.getenv("DJANGO_CSRF_COOKIE_SECURE", str(not DEBUG)))
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", os.getenv("DJANGO_SECURE_SSL_REDIRECT", str(not DEBUG)))
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", os.getenv("DJANGO_SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0")))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", os.getenv("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", str(not DEBUG)))
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", os.getenv("DJANGO_SECURE_HSTS_PRELOAD", str(not DEBUG)))
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "same-origin")
X_FRAME_OPTIONS = "DENY"

CORS_ALLOW_ALL_ORIGINS = False

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

# AI governance and production hardening
AI_DECISION_SUPPORT_ONLY = env_bool("AI_DECISION_SUPPORT_ONLY", True)
AI_PIPELINE_ASYNC = env_bool("AI_PIPELINE_ASYNC", not DEBUG)
AI_ALLOW_RUNTIME_NLTK_DOWNLOAD = env_bool("AI_ALLOW_RUNTIME_NLTK_DOWNLOAD", DEBUG)
AI_FALLBACK_ON_MODEL_ERROR = env_bool("AI_FALLBACK_ON_MODEL_ERROR", True)
ATTRITION_MODEL_VERSION = os.getenv("ATTRITION_MODEL_VERSION", "xgboost-attrition-v2-governed")
ATTRITION_PROTECTED_DEFAULT_AGE = float(os.getenv("ATTRITION_PROTECTED_DEFAULT_AGE", "35"))
AI_GOVERNANCE_NOTICE = os.getenv(
    "AI_GOVERNANCE_NOTICE",
    "AI outputs are advisory only and must be reviewed by HR before any hiring, retention, promotion, or termination decision.",
)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE     = "UTC"
USE_TZ        = True

from datetime import timedelta

# --- Custom user model ---
AUTH_USER_MODEL = "accounts.User"

# --- DRF default auth ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

# --- JWT configuration ---
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(minutes=30),   # short-lived
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),        # refreshed silently
    "ROTATE_REFRESH_TOKENS":  True,   # new refresh token on every refresh call
    "BLACKLIST_AFTER_ROTATION": True, # old refresh token blacklisted on rotate
    "AUTH_HEADER_TYPES": ("Bearer",),
    "TOKEN_OBTAIN_SERIALIZER": "accounts.serializers.CustomTokenObtainPairSerializer",
}

# --- CORS (React dev server) ---
# In production replace with your actual frontend domain
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    env_list(
        "DJANGO_CORS_ALLOWED_ORIGINS",
        [
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "http://localhost:5173",
        ],
    ),
)
CORS_ALLOW_CREDENTIALS = True