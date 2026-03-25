import sys
sys.setrecursionlimit(50)
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()
from django.urls import get_resolver
r = get_resolver()
print(r.url_patterns)
