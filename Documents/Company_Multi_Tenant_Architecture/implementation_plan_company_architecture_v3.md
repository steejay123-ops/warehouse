<div dir="rtl" align="right">

# طرح جامع نهایی و مصوب: ارتقای شرکت‌ها، هیئت‌مدیره پویا، اصلاح تقویم و معماری اسناد (نسخه ۳.۰ نهایی)

## وضعیت: نهایی‌شده بر اساس مصاحبه تخصصی (/grill-me)
## تاریخ: ۱۴۰۵/۰۷/۰۵

---

## ۱. تصمیمات راهبردی مصوب

1. **کد کارگاه تأمین اجتماعی شرکت:**
   - **مصوبه:** فیلد `workshop_code` (کد کارگاه ۱۰ رقمی) در سطح شرکت **باقی می‌ماند**، زیرا برای هر شرکت همواره ثابت است.
2. **پالایش فیلدهای اختصاصی پروژه از سطح شرکت:**
   - **مصوبه:** فیلدهای «ردیف پیمان» (`contract_row`)، «نام و کد شعبه تأمین اجتماعی» (`social_security_branch_name` / `code`) و «نام کارفرما» (`employer_name`) از سطح شرکت **حذف** می‌شوند؛ زیرا مربوط به قراردادها و کارگاه‌های اختصاصی هر پروژه هستند.
3. **ارکان هیئت‌مدیره پویا (`CompanyBoardMember`):**
   - **مصوبه:** دقیقاً مشابه حساب‌های بانکی، یک مدل رابطه‌ای مستقل ایجاد شده و تمام امکانات (مشخصات هویتی، نوع عضو حقیقی/حقوقی، سمت سازمانی، حق امضا و حدود اختیارات، دوره تصدی حداکثر ۲ سال و پیوست مدارک هویتی و احکام) به طور کامل پیاده‌سازی می‌شود.
   - **استراتژی مهاجرت:** شروع از صفر و ثبت تمیز داده‌ها در ساختار جدید بدون انتقال داده‌های متنی ناقص گذشته.
4. **اصلاح ریشه‌ای تقویم شمسی جلالی:**
   - **مصوبه:** تگ `<input>` درون `<ng-persian-datepicker>` کپسوله شده و بایندینگ دوطرفه `[(uiIsVisible)]` به همراه جلوگیری از انتشار رویداد کلیک (`stopPropagation`) و تنظیم Z-Index پیاده‌سازی می‌شود تا پاپ‌اور تقویم تحت هیچ شرایطی مسدود یا بریده نشود.
5. **یکپارچه‌سازی اسناد و حذف افزونگی:**
   - **مصوبه:** فیلدهای مستقیم `articles_of_association` و `latest_gazette` از مدل `Company` حذف و کلیه اسناد در مدل `CompanyDocument` تجمیع می‌شوند. قابلیت مدیریت نسخه (`version`, `is_superseded`) نیز افزوده می‌گردد.
6. **بهینه‌سازی کارایی دیتابیس:**
   - **مصوبه:** رفع قطعی مشکل N+1 کوئری با افزودن `prefetch_related('documents', 'bank_accounts', 'board_members')` به کوئری‌ست شرکت‌ها.
7. **اعتبارسنجی چکسام شناسه ملی ۱۱ رقمی:**
   - **مصوبه:** اعتبارسنجی الگوریتمیک رقم کنترل شناسه ملی اشخاص حقوقی در بک‌اند و فرانت‌اند جهت ممانعت از ثبت شناسه‌های نامعتبر.

---

## ۲. مدل داده `CompanyBoardMember` در `personnel/models.py`

```python
class CompanyBoardMember(models.Model):
    """
    اعضای هیئت‌مدیره، مدیران عامل، بازرسان قانونی و صاحبان امضای مجاز شرکت
    """
    ROLE_CHOICES = (
        ('chairman', 'رئیس هیئت‌مدیره'),
        ('vice_chairman', 'نایب‌رئیس هیئت‌مدیره'),
        ('board_member', 'عضو هیئت‌مدیره'),
        ('managing_director', 'مدیرعامل'),
        ('managing_director_and_member', 'عضو هیئت‌مدیره و مدیرعامل'),
        ('main_inspector', 'بازرس اصلی'),
        ('alternate_inspector', 'بازرس علی‌البدل'),
        ('secretary', 'دبیر هیئت‌مدیره'),
        ('other', 'سایر ارکان قانونی')
    )

    MEMBER_TYPE_CHOICES = (
        ('real', 'شخص حقیقی'),
        ('legal_rep', 'نماینده شخص حقوقی')
    )

    company = models.ForeignKey(
        'personnel.Company',
        on_delete=models.CASCADE,
        related_name='board_members',
        verbose_name="شرکت متبوع"
    )
    first_name = models.CharField(max_length=100, verbose_name="نام")
    last_name = models.CharField(max_length=150, verbose_name="نام خانوادگی")
    national_code = models.CharField(max_length=10, verbose_name="کد ملی (۱۰ رقم)")
    member_type = models.CharField(max_length=20, choices=MEMBER_TYPE_CHOICES, default='real', verbose_name="نوع عضو")
    represented_legal_name = models.CharField(max_length=200, null=True, blank=True, verbose_name="نام شخصیت حقوقی متبوع")
    role = models.CharField(max_length=40, choices=ROLE_CHOICES, default='board_member', verbose_name="سمت")
    has_signature_right = models.BooleanField(default=False, verbose_name="دارای حق امضای تعهدآور")
    signature_scope = models.CharField(max_length=250, null=True, blank=True, verbose_name="حدود اختیارات امضا")
    term_start = models.DateField(null=True, blank=True, verbose_name="تاریخ شروع تصدی")
    term_expiry = models.DateField(null=True, blank=True, verbose_name="تاریخ پایان تصدی (حداکثر ۲ سال)")
    attached_id_doc = models.FileField(upload_to='company_board_docs/', null=True, blank=True, verbose_name="تصویر کارت ملی / شناسنامه")
    attached_appointment_doc = models.FileField(upload_to='company_board_docs/', null=True, blank=True, verbose_name="حکم انتصاب / صورتجلسه مجمع")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "عضو هیئت‌مدیره شرکت"
        verbose_name_plural = "اعضای هیئت‌مدیره شرکت‌ها"
        ordering = ['-has_signature_right', 'role', '-created_at']
```

---

## ۳. بازطراحی لایه وب‌سرویس و API

| متد | آدرس اندپوینت | شرح عملکرد | دسترسی |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/personnel/company-board-members/?company_id={id}` | دریافت اعضای هیئت‌مدیره شرکت جاری | کاربران مجاز شرکت |
| `POST` | `/api/personnel/company-board-members/` | ثبت عضو جدید + آپلود مدارک | مدیران ارشد / دسترسی ثبت |
| `PUT/PATCH` | `/api/personnel/company-board-members/{id}/` | ویرایش عضو یا تمدید دوره تصدی | مدیران ارشد / دسترسی ویرایش |
| `DELETE` | `/api/personnel/company-board-members/{id}/` | حذف عضو از هیئت‌مدیره | مدیران ارشد |

---

## ۴. فازهای اجرایی پنج‌گانه

1. **فاز ۱: اصلاح باگ تقویم در فرانت‌اند:** کپسوله‌سازی اینپوت، اتصال `[(uiIsVisible)]` و رفع بریدگی پاپ‌اور در CSS.
2. **فاز ۲: ساختار پایگاه‌داده و مدل هیئت‌مدیره:** پیاده‌سازی مدل `CompanyBoardMember` و فیلدهای نسخه در `CompanyDocument` همراه با مایگریشن پیش‌رونده.
3. **فاز ۳: لایه وب‌سرویس و بهینه‌سازی دیتابیس:** پیاده‌سازی ویوست هیئت‌مدیره، رفع مشکل N+1 با `prefetch_related` و اعتبارسنجی چکسام شناسه ملی.
4. **فاز ۴: توسعه واسط کاربری استودیو و پالایش فیلدها:** پیاده‌سازی تب پویای هیئت‌مدیره با جدول و دکمه افزودن، حفظ `workshop_code` و پاک‌سازی ردیف پیمان و شعبه بیمه از تب مودیان.
5. **فاز ۵: تست‌های جامع و اعتبارسنجی نهایی:** تست‌های سریع Vitest DOM و تست‌های وب‌سرویس جنگو.

</div>
