from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/recruitment/', include('resume_pipeline.urls')),
    path('api/feedback/',    include('feedback.urls')),
    path('api/attrition/',   include('attrition.urls')),
]
