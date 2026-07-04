from django.db import models
from warehouses.models import Warehouse

class Record(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='records')
    part_no = models.CharField(max_length=100)
    mesc = models.CharField(max_length=100, blank=True, null=True)
    desc = models.TextField()
    category = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    
    # statuses
    tag_status = models.CharField(max_length=50, default='چاپ نشده')
    field_status = models.CharField(max_length=50, default='در انتظار شمارش')
    doc_status = models.CharField(max_length=50, default='عدم تطابق')
    
    # Tags
    has_conflict = models.BooleanField(default=False)
    is_fragile = models.BooleanField(default=False)
    is_heavy = models.BooleanField(default=False)
    needs_qc = models.BooleanField(default=False)
    
    assigned_to = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.id} - {self.part_no}"
