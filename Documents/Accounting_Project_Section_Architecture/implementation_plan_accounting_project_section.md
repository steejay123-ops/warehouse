# طرح جامع مهندسی: استقلال حسابداری، تعریف ساختار پروژه و بخش، پنل کارمند و ایجنت‌های نگهبان سخت‌گیر

<div dir="rtl" align="right">

## ۱. اهداف و چشم‌انداز معماری (Architecture Vision & Objectives)

این طرح، تحول ساختاری نرم‌افزار حسابداری و کارکرد پرسنل/ناوگان را به عنوان یک سیستم کاملاً مستقل از نرم‌افزار انبارگردانی هدف قرار می‌دهد. در این معماری:
1. **پروژه‌ها و بخش‌ها (Projects & Sections):** به عنوان مراکز هزینه و واحدهای عملیاتی مستقل در دیتابیس تعریف می‌شوند.
2. **انتساب نقشی پویا (Contextual Dynamic RBAC):** کارمندان، سرپرستان و مدیران به بخش‌ها متصل می‌شوند و این انتساب، خود معیار تام و پویای مجوزهای سیستمی است.
3. **پنل کارمند (Employee Portal) با ۵ تب:** ورود سریع و ایزوله داده‌ها توسط کارمند بدون دسترسی به عملیات تایید.
4. **اصل طلایی عدم بازنویسی (Zero-Rewrite & Code Preservation):** بخش‌های موجود در سیستم فعلی (جداول کارکرد، فرم‌های پرسنل و ناوگان) از نو نوشته نمی‌شوند، بلکه با تزریق غیرمخرب (Non-destructive Injection) فیلدهای `project` و `section` کپسوله‌سازی و بازاستفاده می‌شوند.
5. **سوئیت ایجنت‌های نگهبان بسیار سخت‌گیر (Strict Guardian Agents Suite):** مجموعه‌ای از ایجنت‌های خودکار برای تضمین عدم نشت داده، مصونیت تغییرات، تحمیل حالت پیش‌نویس، و سلامت تراکنش‌ها.

---

## ۲. قانون طلایی و الزامات راهبردی (Golden Invariants)

> [!IMPORTANT]
> **قانون ۱ (عدم بازنویسی کدهای موجود):**
> هیچ‌یک از کامپوننت‌ها و فرم‌های عملیاتی ثبت پرسنل، خودرو، تردد و کارکرد نباید از ابتدا نوشته شوند. تمام لاجیک‌های موجود، قالب‌های UI، پایپ‌های شمسی، محاسبات ساعات و متدهای ارتباطی به صورت ۱۰۰٪ حفظ شده و صرفاً از طریق یک کانتکست والد (Parent Context) فیلتر `project_id` و `section_id` به آن‌ها پاس داده می‌شود.

> [!IMPORTANT]
> **قانون ۲ (تحمیل مطلق وضعیت پیش‌نویس برای کارمند):**
> کارمند یک کاربر تولیدکننده داده (Data Producer) است، نه تاییدکننده (Approver). هیچ رکوردی توسط کارمند به وضعیت‌های `approved` یا `ready_to_pay` وارد نمی‌شود؛ سیستم در لایه مدل و لایه ویو به صورت خودکار وضعیت را به `draft` قفل می‌کند.

> [!IMPORTANT]
> **قانون ۳ (سازگاری رو به عقب دیتابیس - Backward Compatibility):**
> فیلدهای جدید در پایگاه داده الزاماً `null=True, blank=True` هستند. داده‌های تاریخی و تست‌های پیشین نباید کوچک‌ترین شکستی را تجربه کنند.

---

## ۳. ماتریس ۶ ایجنت نگهبان بسیار سخت‌گیر (Strict Guardian Suite)

برای تضمین سلامت ۱۰۰٪ سیستم و جلوگیری از هرگونه خطای انسانی یا امنیتی، یک سوئیت اعتبارسنجی خودکار شامل ۶ ایجنت نگهبان طراحی و مستقر می‌شود:

| شناسه نگهبان | نام ایجنت نگهبان | مسئولیت و آزمون‌های اعتبارسنجی سخت‌گیرانه (Strict Invariants) |
| :---: | :--- | :--- |
| **🛡️ G1** | **Scope & Isolation Guardian**<br>(نگهبان قلمرو و ایزولاسیون) | • جلوگیری از ثبت یا خواندن رکورد در بخشی غیر از بخش‌های منتسب به کارمند.<br>• بررسی خطای ۴۰۳ در صورت ارسال شناسه بخش نامعتبر توسط کارمند.<br>• تضمین اعمال خودکار فیلتر بخش در تمام خروجی‌های کوئریست. |
| **🛡️ G2** | **Draft State Enforcement Guardian**<br>(نگهبان تحمیل وضعیت پیش‌نویس) | • رد فوری هرگونه تلاش کارمند برای تغییر فیلدهای وضعیتی (`approval_status`, `is_settled`).<br>• بازنشانی اجباری وضعیت ورودی‌ها به `draft` در لایه سیگنال و ذخیره دیتابیس.<br>• منع کامل فراخوانی اکشن‌های تایید توسط کاربر کارمند. |
| **🛡️ G3** | **Zero-Rewrite & Reuse Guardian**<br>(نگهبان عدم بازنویسی و بازاستفاده) | • تست تطابق ساختاری و اعتبارسنجی استفاده از فرم‌ها و جداول موجود.<br>• تضمین اختیاری بودن فیلدهای جدید `project` و `section` (`null=True`).<br>• تست سبز بودن تمام ۴۵ تست موجود سیستم پرسنل و کارکرد بدون رگرسیون. |
| **🛡️ G4** | **Immutability & Tamper-Proof Guardian**<br>(نگهبان مصونیت و قفل رکوردها) | • قفل کامل رکوردهایی که به تایید سرپرست رسیده‌اند در برابر ویرایش یا حذف توسط کارمند.<br>• صادر کردن خطای `423 Locked / 403 Forbidden` در صورت تلاش کارمند برای تغییر رکورد تاییدشده.<br>• الزام ثبت لاگ ممیزی کامل در صورت لغو یا درخواست بازنگری. |
| **🛡️ G5** | **Counterparty & Invoice Fiscal Guardian**<br>(نگهبان طرف‌حساب و محاسبات فاکتور) | • اعتبارسنجی اتصال هر فاکتور به یک طرف‌حساب معتبر.<br>• جلوگیری از ثبت مبالغ منفی یا فاقد شرح هزینه.<br>• بررسی یکتایی شماره فاکتور طرف‌حساب در سطح بخش جهت جلوگیری از ثبت دوبل. |
| **🛡️ G6** | **Build & Database Integrity Guardian**<br>(نگهبان سلامت بیلد و مهاجرت‌ها) | • اعتبارسنجی بدون خطای کامپایل تایپ‌اسکریپت فرانت‌اند (`npx tsc --noEmit`).<br>• اعتبارسنجی موفق مایگریشن‌های پیش‌رونده دیتابیس بدون دستکاری فایل‌های قبلی.<br>• عدم وجود خطای Lint یا Circular Dependency. |

---

## ۴. معماری پایگاه‌داده و مدل‌ها (Database & Model Architecture)

### ۱. مدل‌های جدید ساختار سازمانی و طرف‌حساب‌ها

```python
# 1. پروژه مالی / عملیاتی
class FinancialProject(models.Model):
    code = models.CharField(max_length=50, unique=True, verbose_name="کد پروژه")
    name = models.CharField(max_length=200, verbose_name="نام پروژه")
    description = models.TextField(blank=True, null=True, verbose_name="توضیحات")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

# 2. بخش / دپارتمان پروژه
class ProjectSection(models.Model):
    project = models.ForeignKey(FinancialProject, on_delete=models.CASCADE, related_name='sections', verbose_name="پروژه")
    code = models.CharField(max_length=50, verbose_name="کد بخش")
    name = models.CharField(max_length=200, verbose_name="نام بخش")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    
    class Meta:
        unique_together = ('project', 'code')

# 3. جدول انتساب پویا و ماتریس دسترسی نقش‌ها
class UserSectionAssignment(models.Model):
    ROLE_CHOICES = (
        ('employee', 'کارمند / اپراتور ثبت'),
        ('supervisor', 'سرپرست بخش'),
        ('accountant', 'حسابدار پروژه'),
        ('manager', 'مدیر پروژه'),
        ('treasury', 'خزانه‌دار کل'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='section_assignments')
    section = models.ForeignKey(ProjectSection, on_delete=models.CASCADE, related_name='user_assignments')
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='employee')
    is_active = models.BooleanField(default=True)

# 4. طرف‌حساب (تأمین‌کننده، راننده، تعمیرگاه، پمپ بنزین و...)
class Counterparty(models.Model):
    TYPE_CHOICES = (
        ('driver', 'راننده / مالک خودرو'),
        ('repair_shop', 'تعمیرگاه و قطعات'),
        ('fuel_station', 'جایگاه سوخت'),
        ('contractor', 'پیمانکار خدماتی'),
        ('other', 'سایر اشخاص حقیقی/حقوقی'),
    )
    name = models.CharField(max_length=200, verbose_name="نام شخص یا شرکت")
    counterparty_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='other')
    national_id = models.CharField(max_length=20, blank=True, null=True, verbose_name="کد ملی / شناسه اقتصادی")
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="تلفن تماس")
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    sheba_number = models.CharField(max_length=30, blank=True, null=True)
    section = models.ForeignKey(ProjectSection, on_delete=models.SET_NULL, null=True, blank=True)

# 5. فاکتور هزینه‌ای / عملیاتی بخش
class ExpenseInvoice(models.Model):
    INVOICE_STATUS_CHOICES = (
        ('draft', 'پیش‌نویس کارمند'),
        ('pending_supervisor', 'در انتظار تایید سرپرست'),
        ('pending_accountant', 'در انتظار بررسی حسابدار'),
        ('ready_to_pay', 'تایید مدیر / آماده پرداخت'),
        ('paid', 'پرداخت‌شده توسط خزانه‌دار'),
        ('rejected', 'رد شده'),
    )
    section = models.ForeignKey(ProjectSection, on_delete=models.CASCADE, related_name='invoices')
    counterparty = models.ForeignKey(Counterparty, on_delete=models.CASCADE, related_name='invoices')
    invoice_number = models.CharField(max_length=100, verbose_name="شماره فاکتور / رسید")
    invoice_date_shamsi = models.CharField(max_length=10, verbose_name="تاریخ فاکتور (شمسی)")
    amount = models.DecimalField(max_digits=15, decimal_places=0, verbose_name="مبلغ فاکتور (ریال)")
    category = models.CharField(max_length=100, verbose_name="سرفصل هزینه")
    description = models.TextField(verbose_name="شرح هزینه")
    attachment = models.FileField(upload_to='invoices/', blank=True, null=True, verbose_name="تصویر یا فایل فاکتور")
    status = models.CharField(max_length=30, choices=INVOICE_STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### ۲. تزریق افزایشی به مدل‌های موجود (Non-Breaking Injection)
مدل‌های موجود بدون هیچ‌گونه تخریب ساختار قبلی، مجهز به دو فیلد کلیدی می‌شوند:
* `PersonnelProfile`: افزودن `project` و `section` (به صورت `ForeignKey(..., null=True, blank=True)`).
* `VehicleDriverProfile`: افزودن `project` و `section`.
* `DailyAttendance`: افزودن `project` و `section`.
* `VehicleTripLog`: افزودن `project` و `section`.

---

## ۵. طراحی پنل کارمند (Employee Portal Architecture)

پنل کارمند به صورت یک کامپوننت چتر (Container Component) طراحی می‌شود که:
1. **سربرگ هوشمند (Context Header):** در بالای صفحه، دراپ‌داون انتخاب «پروژه و بخش فعال» قرار دارد. اگر کارمند فقط به یک بخش منتسب باشد، بخش قفل است. اگر در چند بخش باشد، با یک کلیک جابجا می‌شود.
2. **۵ تب شفاف و استاندارد (هم‌راستا با خواسته کاربر):**

```
┌────────────────────────────────────────────────────────────────────────┐
│  👤 پنل کارمند انبار  |  پروژه: [ انبار شیراز ⮟ ]  |  بخش: [ ترابری ⮟ ]  │
├────────────────────────────────────────────────────────────────────────┤
│ [🚗 تعریف خودرو] [👤 تعریف پرسنل] [🧾 ثبت فاکتور] [📅 کارکرد پرسنل] [🚛 کارکرد ماشین] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                      محتوای تب انتخابی فعال                            │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### نحوه اتصال تب‌ها بدون بازنویسی کد:
* **الف) تب تعریف خودرو:** بارگذاری کامپوننت فرم موجود در سیستم (`vehicle-profile-form`) با این تفاوت که فیلد بخش به طور خودکار با بخش انتخابی ست شده و فیلد وضعیت روی `draft` پنهان/قفل است.
* **ب) تب تعریف پرسنل:** بارگذاری فرم موجود پرونده پرسنلی (`personnel-profile-form`) با قفل بودن بخش روی بخش جاری.
* **ج) تب ثبت فاکتور با تعریف طرف‌حساب:** فرم ساده و شکیل ورود مشخصات فاکتور با یک مودال سریع برای تعریف طرف‌حساب جدید (راننده، تعمیرگاه، سوخت) بدون خروج از صفحه.
* **د) تب کارکرد پرسنل:** بارگذاری جدول ثبت سریع ماتریسی موجود در `warehouse-attendance` با فیلتر خودکار بر اساس `section_id` جاری.
* **ه) تب کارکرد ماشین‌آلات:** بارگذاری جدول ثبت سرویس ناوگان موجود در `warehouse-attendance` با فیلتر خودکار خودروهای بخش جاری.

---

## ۶. فازبندی اجرایی و نقشه راه (Phased Implementation Roadmap)

### فاز ۱: تعریف مدل‌ها، مایگریشن و ایجنت نگهبان فونداسیون
* ایجاد مدل‌های `FinancialProject`, `ProjectSection`, `UserSectionAssignment`, `Counterparty`, `ExpenseInvoice`.
* اعمال فیلدهای اختیاری `project` و `section` روی مدل‌های پرسنل، خودرو، تردد و کارکرد.
* اجرای `makemigrations` و اعمال سالم آن بدون لمس فایل‌های قدیمی.
* پیاده‌سازی اسکریپت ایجنت نگهبان فونداسیون (`section_guardian.py`).

### فاز ۲: پنل مدیریت پروژه و بخش برای مدیر سیستم (Admin Management UI)
* ساخت کامپوننت مدیریت ساختار سازمانی در تنظیمات پایه:
  * تعریف پروژه جدید.
  * افزودن بخش‌ها ذیل هر پروژه.
  * جدول ماتریس انتساب کاربران به بخش‌ها و تعیین نقش (کارمند، سرپرست و...).
* فعال‌سازی APIهای CRUD مربوطه با دسترسی انحصاری مدیر.

### فاز ۳: پیاده‌سازی پنل کارمند (Employee Portal Component)
* ساخت کامپوننت `EmployeePortalComponent` در مسیر `/employee-portal` (یا نام دلخواه).
* پیاده‌سازی ۵ تب استاندارد با استفاده مجدد و کپسوله‌سازی فرم‌ها و جداول فعلی.
* مجهزسازی تمام ارسالی‌ها به برچسب بخش جاری و وضعیت اجباری `draft`.

### فاز ۴: ممیزی و تست با ایجنت‌های نگهبان بسیار سخت‌گیر
* اجرای خودکار تمام ۶ ایجنت نگهبان و چاپ گزارش رسمی پاس شدن ۱۰۰٪ چک‌ها.
* بررسی ایزولاسیون داده‌ها و جلوگیری از دسترسی‌های غیرمجاز.

</div>
