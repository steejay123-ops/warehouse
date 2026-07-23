from django.db import models
from warehouses.models import Warehouse
from django.conf import settings
from django.utils import timezone

from django.contrib.postgres.indexes import GinIndex

class Item(models.Model):
    # Tracking & IDs
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='items', verbose_name="انبار")
    fa_unic_code = models.CharField(max_length=100, verbose_name="کد یکتا (FA-UNIC)")
    plpkitem = models.CharField(max_length=100, null=True, blank=True, verbose_name="کد ترکیبی PL-PK-Item")
    pl = models.CharField(max_length=100, null=True, blank=True, verbose_name="پکینگ لیست (PL)")
    po = models.CharField(max_length=100, null=True, blank=True, verbose_name="سفارش خرید (PO)")
    pk_number = models.CharField(max_length=100, null=True, blank=True, verbose_name="پکیج (PK)")
    item_no = models.CharField(max_length=100, null=True, blank=True, verbose_name="ردیف (Item)")

    # Specs
    description = models.TextField(null=True, blank=True, verbose_name="شرح کالا")
    unit = models.CharField(max_length=50, null=True, blank=True, verbose_name="واحد سنجش")
    scope_discipline = models.CharField(max_length=100, null=True, blank=True, verbose_name="دیسیپلین کاری")
    
    # Quantities
    balance = models.DecimalField(max_digits=15, decimal_places=3, default=0.0, verbose_name="موجودی فیزیکی")
    bal4miv = models.DecimalField(max_digits=15, decimal_places=3, default=0.0, verbose_name="موجودی مجاز MIV")
    
    # Locations
    old_location = models.CharField(max_length=255, null=True, blank=True, verbose_name="لوکیشن قبلی")
    new_location = models.CharField(max_length=255, null=True, blank=True, verbose_name="لوکیشن جدید")
    
    # Procurement / Delivery Statuses
    hov_no = models.CharField(max_length=100, null=True, blank=True, verbose_name="شماره HOV")
    hov_date = models.DateField(null=True, blank=True, verbose_name="تاریخ HOV")
    msr_status = models.CharField(max_length=100, null=True, blank=True, verbose_name="وضعیت MSR")
    vendor = models.CharField(max_length=255, null=True, blank=True, verbose_name="سازنده (Vendor)")
    supplier = models.CharField(max_length=255, null=True, blank=True, verbose_name="تامین کننده (Supplier)")
    irn_no = models.CharField(max_length=100, null=True, blank=True, verbose_name="شماره IRN")
    item2 = models.CharField(max_length=100, null=True, blank=True, verbose_name="ردیف فرعی (ITEM2)")
    inventory_status = models.CharField(max_length=100, null=True, blank=True, verbose_name="طبقه‌بندی انبار")
    indent = models.CharField(max_length=100, null=True, blank=True, verbose_name="تقاضای خرید (INDENT)")
    remark = models.TextField(null=True, blank=True, verbose_name="ملاحظات")
    
    # Pricing / Customs
    price_amount = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True, verbose_name="مبلغ")
    currency = models.CharField(max_length=50, null=True, blank=True, verbose_name="ارز")
    invoice_file = models.CharField(max_length=500, null=True, blank=True, verbose_name="آدرس فایل فاکتور")
    invoice_page = models.CharField(max_length=100, null=True, blank=True, verbose_name="صفحه فاکتور")
    customs_field = models.CharField(max_length=255, null=True, blank=True, verbose_name="فیلد گمرکی")
    customs_file = models.CharField(max_length=500, null=True, blank=True, verbose_name="آدرس فایل گمرکی")
    customs_file_page = models.CharField(max_length=100, null=True, blank=True, verbose_name="صفحه گمرک")
    price_remark = models.TextField(null=True, blank=True, verbose_name="توضیحات قیمت")
    issue_remark = models.TextField(null=True, blank=True, verbose_name="ملاحظات صدور (Issue Remark)")
    
    # Old Record statuses for workflow
    tag_status = models.CharField(max_length=50, default='چاپ نشده', verbose_name="وضعیت لیبل")
    field_status = models.CharField(max_length=50, default='waiting', verbose_name="وضعیت میدانی")
    doc_status = models.CharField(max_length=50, default='waiting', verbose_name="وضعیت مستندات")
    
    # Quality / Checks
    has_conflict = models.BooleanField(default=False, verbose_name="مغایرت دارد")
    is_fragile = models.BooleanField(default=False, verbose_name="شکستنی")
    is_heavy = models.BooleanField(default=False, verbose_name="سنگین")
    needs_qc = models.BooleanField(default=False, verbose_name="نیاز به کنترل کیفی")
    
    # Custom Tags
    tag = models.CharField(max_length=500, null=True, blank=True, verbose_name="تگ‌ها")
    
    field_assignee = models.CharField(max_length=255, blank=True, null=True, verbose_name="محول شده به (میدانی)")
    doc_assignee = models.CharField(max_length=255, blank=True, null=True, verbose_name="محول شده به (مدارک و قیمت)")
    
    # Auditing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_items')
    modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='modified_items')

    class Meta:
        unique_together = ('warehouse', 'fa_unic_code')
        indexes = [
            GinIndex(
                name='item_desc_gin_idx',
                fields=['description'],
                opclasses=['gin_trgm_ops']
            ),
            GinIndex(
                name='item_code_gin_idx',
                fields=['fa_unic_code'],
                opclasses=['gin_trgm_ops']
            )
        ]

    def __str__(self):
        return f"{self.fa_unic_code} - {self.description[:30]}"

class ImportLog(models.Model):
    import_id = models.CharField(max_length=100, null=True, blank=True, unique=True, verbose_name="شناسه یکتای فرآیند")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='import_logs', null=True, blank=True)
    imported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)
    file_name = models.CharField(max_length=255)
    records_created = models.IntegerField(default=0)
    records_updated = models.IntegerField(default=0)
    records_skipped = models.IntegerField(default=0)
    records_failed = models.IntegerField(default=0)
    conflict_strategy = models.CharField(max_length=50, default='ignore')
    is_reverted = models.BooleanField(default=False, verbose_name="بازگردانی شده")
    
    # Store errors as JSON
    error_details = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ['-imported_at']

    def __str__(self):
        return f"Import {self.file_name} at {self.imported_at}"

class ImportHistory(models.Model):
    import_log = models.ForeignKey(ImportLog, on_delete=models.CASCADE, related_name='histories')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, null=True, blank=True)
    action = models.CharField(max_length=20) # 'create' or 'update'
    previous_state = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.action} on Item {self.item_id}"

class ItemPhoto(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='item_photos/')
    description = models.CharField(max_length=255, blank=True, null=True, verbose_name="توضیح عکس")
    
    # Auditing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_item_photos')
    modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='modified_item_photos')

    def __str__(self):
        return f"Photo for {self.item.fa_unic_code}"

class CountTask(models.Model):
    STATUS_CHOICES = [
        ('PENDING_COUNT', 'در انتظار شمارش'),
        ('COUNTED', 'شمارش شده (نزد سرپرست)'),
        ('SUPERVISOR_REJECTED', 'رد شده توسط سرپرست'),
        ('MANAGER_REVIEW', 'در انتظار تایید مدیر'),
        ('MANAGER_REJECTED', 'درخواست بازشماری (رد مدیر)'),
        ('FINAL_APPROVED', 'تایید نهایی'),
    ]

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='count_tasks', verbose_name="کالا")
    counter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='counter_tasks', verbose_name="شمارشگر", null=True, blank=True)
    supervisor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='supervisor_tasks', verbose_name="سرپرست", null=True, blank=True)
    assigned_manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_manager_tasks', verbose_name="مدیر اختصاصی", null=True, blank=True)
    
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='PENDING_COUNT', verbose_name="وضعیت")
    
    counted_balance = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True, verbose_name="مقدار شمرده شده")
    
    counter_note = models.TextField(null=True, blank=True, verbose_name="توضیحات شمارشگر")
    supervisor_note = models.TextField(null=True, blank=True, verbose_name="توضیحات سرپرست")
    manager_note = models.TextField(null=True, blank=True, verbose_name="توضیحات مدیر")
    skip_supervisor = models.BooleanField(default=False, verbose_name="بدون نیاز به سرپرست")
    
    # Auditing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_count_tasks')
    modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='modified_count_tasks')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Count Task for {self.item.fa_unic_code} - {self.get_status_display()}"

class CountTaskHistory(models.Model):
    task = models.ForeignKey(CountTask, on_delete=models.CASCADE, related_name='history', verbose_name="تسک شمارش")
    action_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='action_histories', verbose_name="اقدام کننده")
    action_type = models.CharField(max_length=50, verbose_name="نوع اقدام")
    counted_balance = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True, verbose_name="مقدار شمرده شده (Snapshot)")
    note = models.TextField(null=True, blank=True, verbose_name="توضیحات در لحظه ثبت")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.action_type} on {self.task_id} by {self.action_by_id}"

class DocTask(models.Model):
    STATUS_CHOICES = [
        ('PENDING_DOC', 'در انتظار اسناد'),
        ('DOC_PROCESSED', 'بررسی شده (توسط بررسی‌کننده)'),
        ('DOC_SUPERVISOR_REJECTED', 'رد شده توسط سرپرست اسناد'),
        ('DOC_MANAGER_REVIEW', 'در انتظار تایید مدیر'),
        ('DOC_MANAGER_REJECTED', 'مغایرت تاییدشده (رد مدیر)'),
        ('DOC_FINAL_APPROVED', 'تایید نهایی'),
    ]

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='doc_tasks', verbose_name="کالا")
    doc_worker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doc_worker_tasks', verbose_name="بررسی‌کننده", null=True, blank=True)
    doc_supervisor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doc_supervisor_tasks', verbose_name="سرپرست اسناد", null=True, blank=True)
    assigned_manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doc_assigned_manager_tasks', verbose_name="مدیر ارجاع‌دهنده", null=True, blank=True)
    
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='PENDING_DOC', verbose_name="وضعیت")
    skip_supervisor = models.BooleanField(default=False, verbose_name="بدون نیاز به سرپرست اسناد")
    
    worker_note = models.TextField(null=True, blank=True, verbose_name="توضیحات بررسی‌کننده")
    supervisor_note = models.TextField(null=True, blank=True, verbose_name="توضیحات سرپرست اسناد")
    manager_note = models.TextField(null=True, blank=True, verbose_name="توضیحات مدیر")
    
    # Auditing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_doc_tasks')
    modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='modified_doc_tasks')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"DocTask {self.id} for Item {self.item_id}"


class DocTaskHistory(models.Model):
    task = models.ForeignKey(DocTask, on_delete=models.CASCADE, related_name='history', verbose_name="تسک اسناد")
    action_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='doc_action_histories', verbose_name="انجام‌دهنده")
    action_type = models.CharField(max_length=50, verbose_name="نوع عملیات")
    note = models.TextField(null=True, blank=True, verbose_name="یادداشت در زمان ثبت")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.action_type} on {self.task_id} by {self.action_by_id}"
