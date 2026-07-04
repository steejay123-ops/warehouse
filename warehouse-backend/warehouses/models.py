from django.db import models
from django.conf import settings

class Warehouse(models.Model):
    # Auto-number but user can change it: we use a string field 'code' which is unique.
    # The actual primary key 'id' will be a standard AutoField.
    code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    name = models.CharField(max_length=255)
    project_name = models.CharField(max_length=255, blank=True, null=True)
    
    type = models.CharField(max_length=100, blank=True, null=True)
    location = models.TextField(blank=True, null=True)
    gps_coordinates = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=50, blank=True, null=True)
    
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_warehouses')
    is_active = models.BooleanField(default=True)
    capacity = models.IntegerField(blank=True, null=True)
    parent_warehouse = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_warehouses')
    
    description = models.TextField(blank=True, null=True)
    operator_company = models.CharField(max_length=255, blank=True, null=True)
    color = models.CharField(max_length=20, default='#6366f1')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_warehouses')
    modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='modified_warehouses')

    def save(self, *args, **kwargs):
        if not self.code:
            # We need an ID to generate a code if we want it to be like "WH-ID",
            # but since ID is not generated until after save, we can assign a temporary one or wait.
            # A simpler approach is to generate a random code or set it to 'WH-<temp>' and update it.
            super().save(*args, **kwargs)
            self.code = str(self.id)
            # Using update to prevent infinite recursion
            Warehouse.objects.filter(id=self.id).update(code=self.code)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.name}"
