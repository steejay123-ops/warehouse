<div dir="rtl">

# پیاده‌سازی سیستم یکپارچه شمارش انبار (Inventory Count Workflow)

این طرح بر اساس گفتگوهای قبلی و تصمیمات گرفته‌شده مبنی بر اجرای فرآیند **شمارش کور (Blind Count)** با ساختار سه‌لایه (شمارشگر ➔ سرپرست ➔ مدیر) تنظیم شده است.

## نیازمند تایید شما (User Review Required)
> [!IMPORTANT]
> <div dir="rtl">طرح به صورت کامل تدوین شده است. جهت آغاز اجرای کدنویسی (ابتدا بک‌اند و دیتابیس، سپس رابط کاربری)، لطفاً روی گزینه **Proceed** کلیک کنید یا تاییدیه خود را اعلام نمایید.</div>

---

## تغییرات پیشنهادی

### Backend (بک‌اند - جنگو)

#### [MODIFY] `inventory/models.py`
اضافه شدن جدول (Model) جدید برای ثبت چرخه‌ی شمارش:
```python
class CountTask(models.Model):
    # ارتباطات
    item = models.ForeignKey(Item, ...)
    counter = models.ForeignKey(User, related_name='counter_tasks')
    supervisor = models.ForeignKey(User, related_name='supervisor_tasks')
    
    # وضعیت فرآیند
    STATUS_CHOICES = [
        ('PENDING_COUNT', 'در انتظار شمارش'),
        ('COUNTED', 'شمارش شده (نزد سرپرست)'),
        ('SUPERVISOR_REJECTED', 'رد شده توسط سرپرست'),
        ('MANAGER_REVIEW', 'در انتظار تایید مدیر'),
        ('MANAGER_REJECTED', 'درخواست بازشماری (رد مدیر)'),
        ('FINAL_APPROVED', 'تایید نهایی'),
    ]
    status = models.CharField(choices=STATUS_CHOICES, default='PENDING_COUNT')
    
    # داده‌های شمارش
    counted_balance = models.DecimalField(null=True, blank=True)
    
    # توضیحات و نظرات
    counter_note = models.TextField()
    supervisor_note = models.TextField()
    manager_note = models.TextField()
    
    # Auditing (ردگیری)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User)
    modified_by = models.ForeignKey(User)
```

#### [MODIFY] `inventory/serializers.py`
- ایجاد سریالایزر `CountTaskSerializer` جهت ارسال و دریافت اطلاعات چرخه‌ی شمارش به فرانت‌اند.

#### [MODIFY] `inventory/views.py`
- ایجاد `CountTaskViewSet` با محدودیت‌های دسترسی (Permissions):
  - شمارشگر فقط رکوردهای `PENDING_COUNT` و `SUPERVISOR_REJECTED` خودش را ببیند.
  - سرپرست فقط رکوردهای `COUNTED` و `MANAGER_REJECTED` تیم خودش را ببیند.
  - مدیر به همه چیز دسترسی داشته باشد.
- ویرایش تابع `bulk_dispatch` تا در زمان ارجاع، رکورد جدیدی در `CountTask` بسازد و دیگر مستقیماً فیلد متنی را در خود `Item` تغییر ندهد.

---

### Frontend (فرانت‌اند - انگولار)

#### [MODIFY] `dispatch.html` و `dispatch.ts`
- بروزرسانی بخش «۲. ارجاع میدانی (عملیات شمارش)».
- اضافه کردن منوی کشویی **دوم** برای انتخاب سرپرست (Supervisor) در کنار شمارشگر (Counter).
- آپدیت توابع درخواستی به بک‌اند جهت ارسال آیدی کاربران.

#### [NEW] کارتابل شمارشگر (Counter Dashboard - Mobile Friendly)
- کامپوننتی لیست‌وار جهت نمایش کالاهای ارجاع‌شده.
- فرم ساده و بهینه‌شده برای موبایل جهت وارد کردن «مقدار شمارش شده» و «توضیحات».
- **عدم نمایش** موجودیِ فعلیِ دیتابیس (رعایت اصول Blind Count).

#### [NEW] کارتابل سرپرست (Supervisor Dashboard)
- کامپوننتی برای مشاهده‌ی خروجی‌های شمارشگران.
- امکان مقایسه و رویت توضیحات (بدون دیدن موجودی دیتابیس).
- دکمه‌های «تایید و ارسال به مدیر» و «رد کردن و بازگشت به شمارشگر» به همراه فیلد توضیحات سرپرست.

#### [NEW] پنل بررسی نهایی مدیر (Manager Review Panel)
- صفحه‌ای قدرتمند برای نمایش موجودی سیستم در کنار عدد شمارش‌شده.
- هایلایت کردن مغایرت‌ها به صورت رنگی.
- دکمه‌های «تایید نهایی» و «درخواست بازشماری» با قابلیت درج دستورات برای سرپرست.

---

## برنامه راستی‌آزمایی (Verification Plan)
### تست دستی (Manual Verification)
پس از پیاده‌سازی این موارد، با سه نقش کاربری مختلف لاگین خواهیم کرد:
1. ابتدا با یک اکانت **مدیر** یک کالا را به فرد الف (شمارشگر) و فرد ب (سرپرست) ارجاع می‌دهیم.
2. با اکانت **شمارشگر** لاگین کرده و بدون دیدن موجودی سیستم، موجودی فیزیکی و یک نظر را ثبت می‌کنیم.
3. با اکانت **سرپرست** لاگین کرده و کار را ابتدا رد می‌کنیم (بررسی بازگشت به فلو)، سپس تایید می‌کنیم.
4. با اکانت **مدیر** دوباره لاگین کرده و نتیجه را مشاهده و تایید نهایی می‌کنیم.

</div>
