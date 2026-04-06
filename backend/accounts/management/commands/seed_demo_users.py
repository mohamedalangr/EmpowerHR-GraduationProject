from django.core.management.base import BaseCommand

from accounts.demo_access import DEMO_PASSWORD, ensure_demo_users


class Command(BaseCommand):
    help = 'Create or refresh the standard EmpowerHR demo accounts for each role.'

    def handle(self, *args, **options):
        users = ensure_demo_users()
        self.stdout.write(self.style.SUCCESS('Demo users are ready:'))
        for user in users:
            self.stdout.write(f' - {user.email} ({user.role}) / {DEMO_PASSWORD}')
