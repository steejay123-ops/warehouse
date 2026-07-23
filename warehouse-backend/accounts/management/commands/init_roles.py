from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group

class Command(BaseCommand):
    help = 'Initialize default roles (groups) for the warehouse system.'

    def handle(self, *args, **kwargs):
        roles = [
            'admin',
            'manager',
            'supervisor',
            'counter',
            'doc_worker',
            'doc_supervisor',
            'document_expert',
            'feeding_operator'
        ]

        for role in roles:
            group, created = Group.objects.get_or_create(name=role)
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created role: {role}'))
            else:
                self.stdout.write(self.style.WARNING(f'Role {role} already exists.'))
        
        self.stdout.write(self.style.SUCCESS('Successfully initialized all default roles.'))
