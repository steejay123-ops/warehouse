from django.db import models
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    # New Fields
    requires_password_change = models.BooleanField(default=True)
    national_code = models.CharField(max_length=10, unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    operational_zone = models.CharField(max_length=100, null=True, blank=True)
    supervisor = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates')
    
    assigned_warehouses = models.ManyToManyField('warehouses.Warehouse', related_name='assigned_users', blank=True)
    ui_preferences = models.JSONField(default=dict, blank=True)
    
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')
    modified_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='modified_users')

    def __str__(self):
        return f"{self.username}"
