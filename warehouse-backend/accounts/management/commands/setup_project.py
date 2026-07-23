from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from warehouses.models import Warehouse

User = get_user_model()

class Command(BaseCommand):
    help = 'Setup the project with initial data for development/demo'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS('Starting project setup...'))

        # 1. Run migrations
        self.stdout.write('Running migrations...')
        call_command('migrate', interactive=False)

        # 2. Create Superuser
        self.stdout.write('Checking superuser...')
        if not User.objects.filter(is_superuser=True).exists():
            User.objects.create_superuser('admin', 'admin@example.com', 'admin')
            self.stdout.write(self.style.SUCCESS('Superuser admin/admin created.'))
        else:
            self.stdout.write('Superuser already exists.')

        # 3. Create Default Warehouse
        self.stdout.write('Checking default warehouse...')
        warehouse, created = Warehouse.objects.get_or_create(
            name='انبار مرکزی',
            defaults={
                'type': 'Main',
                'description': 'انبار مرکزی پیش‌فرض ایجاد شده توسط سیستم',
                'capacity': 10000,
                'color': '#6366f1'
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Default warehouse created (ID: {warehouse.id}).'))
        else:
            self.stdout.write('Default warehouse already exists.')

        # 4. Create Test Users for different roles
        self.stdout.write('Setting up test users for roles...')
        test_users = {
            'مدیر سیستم': 'sysadmin',
            'سرپرست انبار': 'whmanager',
            'انباردار': 'clerk',
            'سرپرست شمارش': 'supervisor',
            'شمارشگر': 'counter',
            'مدیر پروژه': 'manager',
            'اپراتور صدور': 'exporter'
        }

        for role_name, username in test_users.items():
            user, u_created = User.objects.get_or_create(
                username=username,
                defaults={
                    'is_staff': True,
                    'is_active': True,
                    'requires_password_change': False
                }
            )
            if u_created:
                user.set_password('123456')
                user.save()
                self.stdout.write(self.style.SUCCESS(f'User "{username}" created (password: 123456).'))
            
            # Assign to group
            try:
                group = Group.objects.get(name=role_name)
                user.groups.add(group)
                # Assign to warehouse if it's a warehouse-related role
                if role_name in ['سرپرست انبار', 'انباردار', 'سرپرست شمارش', 'شمارشگر']:
                    user.assigned_warehouses.add(warehouse)
            except Group.DoesNotExist:
                self.stdout.write(self.style.WARNING('A required Group was not found. Did migrations run?'))

        self.stdout.write(self.style.SUCCESS('Project setup complete!'))
