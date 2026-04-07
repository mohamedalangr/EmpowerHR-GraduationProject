from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include


def root_status(_request):
    return JsonResponse(
        {
            "status": "ok",
            "message": "EmpowerHR backend is running.",
            "available_routes": [
                "/admin/",
                "/api/auth/",
                "/api/recruitment/",
                "/api/feedback/",
                "/api/attrition/",
                "/health/",
            ],
        }
    )


urlpatterns = [
    path('', root_status),
    path('health/', root_status),
    path('admin/', admin.site.urls),
    path('api/recruitment/', include('resume_pipeline.urls')),
    path('api/feedback/',    include('feedback.urls')),
    path('api/attrition/',   include('attrition.urls')),
    path("api/auth/", include("accounts.urls"))
]
