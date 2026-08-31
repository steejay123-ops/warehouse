from django.db import models
from django.conf import settings
from django.utils import timezone


class PersonnelProfile(models.Model):
    """
    پرونده کارگزینی و اطلاعات استخدامی پرسنل (منطبق بر شیت Emp_info اکسل مرجع شرکت)
    """
    MARITAL_STATUS_CHOICES = (
        ('single', 'مجرد'),
        ('married', 'متاهل'),
    )
    
    CONTRACT_TYPE_CHOICES = (
        ('daily', 'روزمزد (مبنا ۱۰ ساعت)'),
        ('hourly', 'ساعتی'),
        ('monthly', 'ماهانه قراردادی'),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='personnel_profile',
        verbose_name="حساب کاربری سیستم (اختیاری)"
    )
    
    # ── ۱. اطلاعات هویتی و شناسنامه‌ای ─────────────────────────────────
    first_name = models.CharField(max_length=100, verbose_name="نام")
    last_name = models.CharField(max_length=100, verbose_name="نام خانوادگی")
    national_code = models.CharField(max_length=10, unique=True, db_index=True, verbose_name="کد ملی (۱۰ رقم)")
    father_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="نام پدر")
    id_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="شماره شناسنامه")
    id_series = models.CharField(max_length=50, blank=True, null=True, verbose_name="مسلسل شناسنامه")
    id_serial = models.CharField(max_length=50, blank=True, null=True, verbose_name="سریال شناسنامه")
    birth_date = models.CharField(max_length=10, blank=True, null=True, verbose_name="تاریخ تولد (شمسی)")
    birth_place = models.CharField(max_length=100, blank=True, null=True, verbose_name="محل تولد")
    issue_place = models.CharField(max_length=100, blank=True, null=True, verbose_name="محل صدور")
    issue_date = models.CharField(max_length=10, blank=True, null=True, verbose_name="تاریخ صدور شناسنامه")
    gender = models.CharField(max_length=10, default='مرد', verbose_name="جنسیت")
    nationality_code = models.CharField(max_length=10, default='1', verbose_name="کد ملیت (۱=ایران)")
    citizenship_country_code = models.CharField(max_length=10, default='103', verbose_name="کشور تابعیت (۱۰۳=ایران)")
    residence_country_code = models.CharField(max_length=10, default='103', verbose_name="کشور محل زندگی (۱۰۳=ایران)")
    education_level = models.CharField(max_length=50, default='5', verbose_name="مدرک تحصیلی")
    marital_status = models.CharField(max_length=20, choices=MARITAL_STATUS_CHOICES, default='single', verbose_name="وضعیت تاهل")
    children_count = models.PositiveIntegerField(default=0, verbose_name="تعداد فرزند")

    # ── ۲. اطلاعات بیمه و مالیات (سازگار با دیسکت DSK و مالیات WH/WP) ───
    insurance_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="شماره بیمه تامین اجتماعی")
    insurance_type = models.CharField(max_length=20, default='2', verbose_name="نوع بیمه")
    insurance_name = models.CharField(max_length=100, default='تامین اجتماعی', verbose_name="نام بیمه")
    exemption_type = models.CharField(max_length=20, default='1', verbose_name="نوع معافیت مالیاتی")
    job_category = models.CharField(max_length=20, default='15', verbose_name="رسته شغلی")
    job_code = models.CharField(max_length=20, blank=True, null=True, verbose_name="کد ۶ رقمی شغل بیمه")
    job_title = models.CharField(max_length=150, verbose_name="سمت شغل / عنوان شغلی")
    employment_type = models.CharField(max_length=20, default='2', verbose_name="نوع استخدام")
    status_category = models.CharField(max_length=50, default='نفرات شرکتی', verbose_name="وضعیت (شرکتی/پیمانکاری)")
    group_status = models.CharField(max_length=50, default='شاغل', verbose_name="گروه (شاغل/بازنشسته)")
    include_in_insurance = models.BooleanField(default=True, verbose_name="ارسال در لیست دیسکت بیمه")
    include_in_tax = models.BooleanField(default=True, verbose_name="ارسال در فایل مالیات حقوق")
    include_in_bank = models.BooleanField(default=True, verbose_name="ارسال در فایل واریز بانک")

    # فیلدهای تنظیمی جدول WHFildeTable و راهنمای رسمی مالیات دارایی (نسخه 1.7.0.4)
    tax_payment_type = models.CharField(max_length=10, default='1', verbose_name="نوع پرداختی مالیات (۱=ریالی / ۲=ارزی / ۳=ریالی ارزی)")
    tax_service_location = models.CharField(max_length=10, default='1', verbose_name="محل خدمت مالیات (۱=عادی / ۲=مناطق محروم / ۳=دانش‌بنیان / ۴=ماده ۱۲)")
    tax_exceptions = models.CharField(max_length=10, default='1', verbose_name="استثنائات مالیات (۱=عادی / ۲=هیئت علمی / ۳=قضات / ۴=نفت و سکوها / ۵=پزشکان)")
    tax_currency_type = models.CharField(max_length=10, default='84', verbose_name="نوع ارز مالیات (۸۴=ریال)")
    tax_currency_exchange_rate = models.DecimalField(max_digits=10, decimal_places=2, default=1.00, verbose_name="نرخ تسعیر ارز")
    tax_housing_benefit_type = models.CharField(max_length=10, default='1', verbose_name="مزایای مسکن مالیات (۱=عدم استفاده / ۲=با اثاثیه / ۳=بدون اثاثیه)")
    tax_vehicle_benefit_type = models.CharField(max_length=10, default='1', verbose_name="مزایای اتومبیل مالیات (۱=عدم استفاده / ۲=با راننده / ۳=بدون راننده)")

    # ── ۳. قرارداد، دستمزد پایه و سنوات (قانون کار) ───────────────────
    contract_type = models.CharField(max_length=10, choices=CONTRACT_TYPE_CHOICES, default='daily', verbose_name="نوع قرارداد")
    start_date = models.CharField(max_length=10, blank=True, null=True, verbose_name="تاریخ شروع به کار (شمسی)")
    end_date = models.CharField(max_length=10, blank=True, null=True, verbose_name="تاریخ پایان کار (شمسی)")
    retirement_date = models.CharField(max_length=10, blank=True, null=True, verbose_name="تاریخ بازنشستگی (شمسی)")
    contract_hours = models.DecimalField(max_digits=8, decimal_places=2, default=230, verbose_name="ساعت کار قرارداد شده ماهانه")
    contract_base_salary = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حقوق قرارداد شده ماهانه (ریال)")
    job_grade = models.CharField(max_length=20, default='19', verbose_name="گروه شغلی")
    daily_base_wage = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="دستمزد روزانه پایه (۱۰ ساعت)")
    daily_seniority_bonus = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="پایه سنواتی روزانه")
    base_daily_rate = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مزد مبنا روزانه (روزانه + سنوات)")
    base_years_experience = models.PositiveIntegerField(default=0, verbose_name="تعداد سال کارکرد")
    personnel_id_code = models.CharField(max_length=20, blank=True, null=True, verbose_name="کد/ردیف پرسنلی")

    # ── ۴. مزایای مستمر و فوق‌العاده‌ها (ماهانه - ریال) ───────────────
    housing_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حق مسکن")
    food_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="بن خواربار / اقلام مصرفی")
    spouse_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حق تاهل")
    weather_bonus = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق‌العاده بدی آب و هوا")
    asaluyeh_parsian_bonus = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق‌العاده مناطق پارسیان و عسلویه")
    remote_hardship_bonus = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق‌العاده جذب و دوری از خانواده")
    market_attraction_bonus = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق‌العاده جذب بازار کار")
    transport_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="ایاب و ذهاب و کمک رفاهی")

    # ── ۵. حساب بانکی، نشانی و اطلاعات تماس ─────────────────────────────
    bank_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="نام بانک")
    account_number = models.CharField(max_length=50, blank=True, null=True, verbose_name="شماره حساب")
    sheba_number = models.CharField(max_length=30, blank=True, null=True, verbose_name="شماره شبا")
    card_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="شماره کارت")
    phone_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="شماره همراه")
    postal_code = models.CharField(max_length=20, blank=True, null=True, verbose_name="کد پستی")
    address = models.TextField(blank=True, null=True, verbose_name="آدرس محل سکونت")
    
    assigned_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='personnel_members',
        verbose_name="انبار تخصیص‌یافته"
    )
    
    APPROVAL_STATUS_CHOICES = (
        ('draft', 'پیش‌نویس کارمند انبار'),
        ('pending_supervisor', 'در انتظار تایید سرپرست انبار'),
        ('supervisor_approved', 'تایید سرپرست / در انتظار حسابدار'),
        ('pending_accountant', 'در انتظار بررسی حسابدار'),
        ('accountant_approved', 'تایید حسابدار / در انتظار مدیر'),
        ('pending_manager', 'در انتظار تایید مدیر'),
        ('manager_approved', 'تایید مدیر / در انتظار حسابدار'),
        ('approved', 'تصویب و فعال شده'),
        ('ready_to_pay', 'تایید مدیر / آماده پرداخت خزانه‌داری'),
        ('paid', 'پرداخت و تسویه نهایی شده'),
        ('revision_required', 'نیازمند بازنگری و اصلاح'),
        ('rejected', 'رد شده / ابطال'),
    )
    approval_status = models.CharField(
        max_length=30,
        choices=APPROVAL_STATUS_CHOICES,
        default='approved',
        db_index=True,
        verbose_name="وضعیت تایید"
    )
    supervisor_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supervisor_approved_personnel',
        verbose_name="سرپرست تاییدکننده"
    )
    supervisor_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ و ساعت تایید سرپرست"
    )
    accountant_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accountant_approved_personnel',
        verbose_name="حسابدار تاییدکننده"
    )
    accountant_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ و ساعت تایید حسابدار"
    )
    manager_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manager_approved_personnel',
        verbose_name="مدیر تاییدکننده"
    )
    manager_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ و ساعت تایید مدیر"
    )
    treasury_paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='treasury_paid_personnel',
        verbose_name="خزانه‌دار پرداخت‌کننده"
    )
    treasury_paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ و ساعت پرداخت خزانه‌دار"
    )
    payment_tracking_code = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="شماره پیگیری / کد رهگیری بانکی"
    )
    payment_method = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        default='PAYA',
        verbose_name="روش پرداخت (پایا / ساتنا / کارت / چک / نقدی)"
    )
    is_auto_passed = models.BooleanField(
        default=False,
        verbose_name="تایید شده با اصل عبور هوشمند"
    )
    auto_passed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='autopassed_personnel',
        verbose_name="کاربر ثبت‌کننده عبور هوشمند"
    )
    auto_passed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان عبور هوشمند"
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        verbose_name="دلیل رد یا بازنگری"
    )
    revision_requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revision_req_personnel',
        verbose_name="درخواست‌دهنده بازنگری"
    )
    revision_requested_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان درخواست بازنگری"
    )
    has_pending_changes = models.BooleanField(
        default=False,
        verbose_name="دارای درخواست تغییرات معلق"
    )
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_personnel',
        verbose_name="ایجادکننده"
    )

    class Meta:
        verbose_name = "پرونده پرسنل"
        verbose_name_plural = "پرسنل و کارگزینی"
        ordering = ['last_name', 'first_name']

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def effective_daily_rate(self):
        """مزد مبنا روزانه (مزد روزانه + پایه سنوات)"""
        if self.base_daily_rate and self.base_daily_rate > 0:
            return float(self.base_daily_rate)
        return float(self.daily_base_wage + self.daily_seniority_bonus)

    @property
    def hourly_rate(self):
        """نرخ دستمزد هر ساعت کارکرد بر مبنای ۱۰ ساعت کارکرد روزانه"""
        daily = self.effective_daily_rate
        if daily > 0:
            return round(daily / 10.0, 2)
        return 0.0

    def save(self, *args, **kwargs):
        # پدینگ خودکار کد ملی به ۱۰ رقم
        if self.national_code:
            self.national_code = self.national_code.strip().zfill(10)
        # محاسبه خودکار مزد مبنا در صورت خالی بودن
        if not self.base_daily_rate or self.base_daily_rate == 0:
            self.base_daily_rate = (self.daily_base_wage or 0) + (self.daily_seniority_bonus or 0)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.national_code}) - {self.job_title}"


class VehicleDriverProfile(models.Model):
    """
    پرونده راننده و ناوگان خودرویی شرکت
    """
    VEHICLE_TYPE_CHOICES = (
        ('pickup', 'وانت'),
        ('nissan', 'نیسان'),
        ('khavar', 'خاور'),
        ('sedan', 'سواری'),
        ('truck', 'کامیون تک/جفت'),
        ('trailer', 'تریلی'),
        ('other', 'سایر'),
    )

    OWNERSHIP_CHOICES = (
        ('contract', 'استیجاری / پیمانکاری سرویسی'),
        ('company', 'خودرو شرکتی'),
        ('personal', 'خودرو ملکی راننده'),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vehicle_profile',
        verbose_name="حساب کاربری راننده (اختیاری)"
    )
    plate_number = models.CharField(max_length=30, unique=True, db_index=True, verbose_name="شماره پلاک")
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPE_CHOICES, default='nissan', verbose_name="نوع خودرو")
    ownership_type = models.CharField(max_length=20, choices=OWNERSHIP_CHOICES, default='contract', verbose_name="نوع مالکیت")
    driver_name = models.CharField(max_length=150, verbose_name="نام و نام خانوادگی راننده")
    driver_national_code = models.CharField(max_length=10, blank=True, null=True, verbose_name="کد ملی راننده")
    driver_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="شماره تماس راننده")
    
    default_service_rate = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="نرخ پایه پیش‌فرض به ازای هر سرویس (ریال)")
    
    bank_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="نام بانک")
    account_number = models.CharField(max_length=50, blank=True, null=True, verbose_name="شماره حساب")
    sheba_number = models.CharField(max_length=30, blank=True, null=True, verbose_name="شماره شبا")
    
    assigned_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_vehicles',
        verbose_name="انبار تخصیص‌یافته"
    )
    
    APPROVAL_STATUS_CHOICES = (
        ('draft', 'پیش‌نویس کارمند انبار'),
        ('pending_supervisor', 'در انتظار تایید سرپرست انبار'),
        ('supervisor_approved', 'تایید سرپرست / در انتظار حسابدار'),
        ('pending_accountant', 'در انتظار بررسی حسابدار'),
        ('accountant_approved', 'تایید حسابدار / در انتظار مدیر'),
        ('pending_manager', 'در انتظار تایید مدیر'),
        ('manager_approved', 'تایید مدیر / در انتظار حسابدار'),
        ('approved', 'تصویب و فعال شده'),
        ('ready_to_pay', 'تایید مدیر / آماده پرداخت خزانه‌داری'),
        ('paid', 'پرداخت و تسویه نهایی شده'),
        ('revision_required', 'نیازمند بازنگری و اصلاح'),
        ('rejected', 'رد شده / ابطال'),
    )
    approval_status = models.CharField(
        max_length=30,
        choices=APPROVAL_STATUS_CHOICES,
        default='approved',
        db_index=True,
        verbose_name="وضعیت تایید"
    )
    supervisor_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supervisor_approved_vehicles',
        verbose_name="سرپرست تاییدکننده"
    )
    supervisor_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ و ساعت تایید سرپرست"
    )
    accountant_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accountant_approved_vehicles',
        verbose_name="حسابدار تاییدکننده"
    )
    accountant_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ و ساعت تایید حسابدار"
    )
    manager_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manager_approved_vehicles',
        verbose_name="مدیر تاییدکننده"
    )
    manager_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ و ساعت تایید مدیر"
    )
    treasury_paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='treasury_paid_vehicles',
        verbose_name="خزانه‌دار پرداخت‌کننده"
    )
    treasury_paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ و ساعت پرداخت خزانه‌دار"
    )
    payment_tracking_code = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="شماره پیگیری / کد رهگیری بانکی"
    )
    payment_method = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        default='PAYA',
        verbose_name="روش پرداخت (پایا / ساتنا / کارت / چک / نقدی)"
    )
    is_auto_passed = models.BooleanField(
        default=False,
        verbose_name="تایید شده با اصل عبور هوشمند"
    )
    auto_passed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='autopassed_vehicles',
        verbose_name="کاربر ثبت‌کننده عبور هوشمند"
    )
    auto_passed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان عبور هوشمند"
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        verbose_name="دلیل رد یا بازنگری"
    )
    revision_requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revision_req_vehicles',
        verbose_name="درخواست‌دهنده بازنگری"
    )
    revision_requested_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان درخواست بازنگری"
    )
    has_pending_changes = models.BooleanField(
        default=False,
        verbose_name="دارای درخواست تغییرات معلق"
    )
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_vehicles',
        verbose_name="ایجادکننده"
    )

    class Meta:
        verbose_name = "خودرو و راننده"
        verbose_name_plural = "ناوگان و خودروها"
        ordering = ['driver_name']

    def __str__(self):
        return f"{self.driver_name} - {self.get_vehicle_type_display()} ({self.plate_number})"


class PersonnelChangeRequest(models.Model):
    """
    پیش‌نویس درخواست تغییرات اطلاعات پرسنل (Pending Edit Staging)
    """
    CHANGE_STATUS_CHOICES = (
        ('draft', 'پیش‌نویس کارمند انبار'),
        ('pending_supervisor', 'در انتظار بررسی سرپرست انبار'),
        ('supervisor_approved', 'تایید سرپرست / در انتظار حسابدار'),
        ('pending_accountant', 'در انتظار بررسی حسابدار'),
        ('accountant_approved', 'تایید حسابدار / در انتظار مدیر'),
        ('pending_manager', 'در انتظار بررسی مدیر'),
        ('manager_approved', 'تایید مدیر / در انتظار حسابدار'),
        ('approved', 'تایید نهایی و اعمال شده'),
        ('revision_required', 'نیازمند بازنگری و اصلاح'),
        ('rejected', 'رد شده'),
        ('cancelled', 'لغو شده'),
    )

    personnel = models.ForeignKey(
        PersonnelProfile,
        on_delete=models.CASCADE,
        related_name='change_requests',
        verbose_name="پرسنل هدف"
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='personnel_change_requests',
        verbose_name="درخواست‌دهنده"
    )
    proposed_changes = models.JSONField(
        default=dict,
        verbose_name="فیلدهای تغییریافته (داده‌های جدید)"
    )
    previous_values = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="مقادیر پیشین (جهت مقایسه)"
    )
    status = models.CharField(
        max_length=30,
        choices=CHANGE_STATUS_CHOICES,
        default='pending_manager',
        db_index=True,
        verbose_name="وضعیت درخواست"
    )
    supervisor_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_sup_personnel_changes',
        verbose_name="سرپرست بررسی‌کننده"
    )
    supervisor_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان بررسی سرپرست"
    )
    accountant_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_acc_personnel_changes',
        verbose_name="حسابدار بررسی‌کننده"
    )
    accountant_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان بررسی حسابدار"
    )
    manager_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_mgr_personnel_changes',
        verbose_name="مدیر بررسی‌کننده"
    )
    manager_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان بررسی مدیر"
    )
    is_auto_passed = models.BooleanField(
        default=False,
        verbose_name="اعمال شده با عبور هوشمند"
    )
    auto_passed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='autopassed_p_changes',
        verbose_name="کاربر عبور هوشمند"
    )
    auto_passed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان عبور هوشمند"
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        verbose_name="توضیحات و دلیل رد"
    )
    revision_requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revision_req_p_changes',
        verbose_name="درخواست‌دهنده بازنگری"
    )
    revision_requested_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان درخواست بازنگری"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت درخواست")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ آخرین بروزرسانی")

    class Meta:
        verbose_name = "درخواست تغییرات پرسنل"
        verbose_name_plural = "درخواست‌های تغییرات پرسنل"
        ordering = ['-created_at']

    def __str__(self):
        return f"درخواست تغییرات {self.personnel.full_name} ({self.get_status_display()})"


class VehicleChangeRequest(models.Model):
    """
    پیش‌نویس درخواست تغییرات اطلاعات خودرو و راننده (Pending Edit Staging)
    """
    CHANGE_STATUS_CHOICES = (
        ('draft', 'پیش‌نویس کارمند انبار'),
        ('pending_supervisor', 'در انتظار بررسی سرپرست انبار'),
        ('supervisor_approved', 'تایید سرپرست / در انتظار حسابدار'),
        ('pending_accountant', 'در انتظار بررسی حسابدار'),
        ('accountant_approved', 'تایید حسابدار / در انتظار مدیر'),
        ('pending_manager', 'در انتظار بررسی مدیر'),
        ('manager_approved', 'تایید مدیر / در انتظار حسابدار'),
        ('approved', 'تایید نهایی و اعمال شده'),
        ('revision_required', 'نیازمند بازنگری و اصلاح'),
        ('rejected', 'رد شده'),
        ('cancelled', 'لغو شده'),
    )

    vehicle = models.ForeignKey(
        VehicleDriverProfile,
        on_delete=models.CASCADE,
        related_name='change_requests',
        verbose_name="خودرو/راننده هدف"
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vehicle_change_requests',
        verbose_name="درخواست‌دهنده"
    )
    proposed_changes = models.JSONField(
        default=dict,
        verbose_name="فیلدهای تغییریافته (داده‌های جدید)"
    )
    previous_values = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="مقادیر پیشین (جهت مقایسه)"
    )
    status = models.CharField(
        max_length=30,
        choices=CHANGE_STATUS_CHOICES,
        default='pending_manager',
        db_index=True,
        verbose_name="وضعیت درخواست"
    )
    supervisor_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_sup_vehicle_changes',
        verbose_name="سرپرست بررسی‌کننده"
    )
    supervisor_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان بررسی سرپرست"
    )
    accountant_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_acc_vehicle_changes',
        verbose_name="حسابدار بررسی‌کننده"
    )
    accountant_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان بررسی حسابدار"
    )
    manager_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_mgr_vehicle_changes',
        verbose_name="مدیر بررسی‌کننده"
    )
    manager_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان بررسی مدیر"
    )
    is_auto_passed = models.BooleanField(
        default=False,
        verbose_name="اعمال شده با عبور هوشمند"
    )
    auto_passed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='autopassed_v_changes',
        verbose_name="کاربر عبور هوشمند"
    )
    auto_passed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان عبور هوشمند"
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        verbose_name="توضیحات و دلیل رد"
    )
    revision_requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revision_req_v_changes',
        verbose_name="درخواست‌دهنده بازنگری"
    )
    revision_requested_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان درخواست بازنگری"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت درخواست")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ آخرین بروزرسانی")

    class Meta:
        verbose_name = "درخواست تغییرات خودرو"
        verbose_name_plural = "درخواست‌های تغییرات خودروها"
        ordering = ['-created_at']

    def __str__(self):
        return f"درخواست تغییرات {self.vehicle.driver_name} - {self.vehicle.plate_number} ({self.get_status_display()})"


class MonthlyWorkPeriod(models.Model):
    """
    دوره ماهانه کارکرد (جهت قفل کردن سوابق پس از محاسبه حقوق و گزارش‌ها)
    """
    PERIOD_STATUS_CHOICES = (
        ('OPEN', 'باز (امکان ثبت و ویرایش)'),
        ('SUBMITTED_SUPERVISOR', 'تایید و ارسال سرپرست انبار'),
        ('SUBMITTED_ACCOUNTANT', 'تایید و ارسال حسابدار'),
        ('READY_TO_PAY', 'تایید مدیر / آماده پرداخت خزانه‌داری'),
        ('PAID', 'پرداخت و تسویه قطعی خزانه‌داری'),
        ('SUBMITTED', 'ارسال‌شده جهت بررسی مالی'),
        ('LOCKED', 'تایید نهایی و قفل‌شده'),
        ('FINALIZED', 'قطعی و تسویه‌شده'),
        ('REVISION_REQUIRED', 'نیازمند بازنگری و اصلاح'),
        ('REJECTED', 'رد شده و نیازمند بازبینی'),
    )

    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_periods',
        verbose_name="انبار مربوطه"
    )
    year_month = models.CharField(max_length=7, db_index=True, verbose_name="سال و ماه (مثال ۱۴۰۴/۰۵)")
    status = models.CharField(max_length=25, choices=PERIOD_STATUS_CHOICES, default='OPEN', verbose_name="وضعیت دوره")
    
    # چرخه بررسی ۵ سطحی
    submitted_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان ارسال جهت بررسی")
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_work_periods',
        verbose_name="ارسال‌کننده جهت بررسی"
    )
    submission_notes = models.TextField(blank=True, null=True, verbose_name="یادداشت سرپرست هنگام ارسال")
    rejection_reason = models.TextField(blank=True, null=True, verbose_name="علت رد توسط حسابداری")

    supervisor_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sup_approved_work_periods',
        verbose_name="سرپرست تاییدکننده"
    )
    supervisor_approved_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان تایید سرپرست")
    accountant_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acc_approved_work_periods',
        verbose_name="حسابدار تاییدکننده"
    )
    accountant_approved_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان تایید حسابدار")
    manager_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mgr_approved_work_periods',
        verbose_name="مدیر تاییدکننده"
    )
    manager_approved_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان تایید مدیر")
    treasury_paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='treasury_paid_work_periods',
        verbose_name="خزانه‌دار تسویه‌کننده"
    )
    treasury_paid_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان پرداخت خزانه‌دار")
    payment_tracking_code = models.CharField(max_length=100, blank=True, null=True, verbose_name="کد رهگیری بانکی تسویه")
    payment_batch_id = models.CharField(max_length=100, blank=True, null=True, verbose_name="شناسه دسته پرداخت پایا")

    revision_requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revision_req_work_periods',
        verbose_name="درخواست‌دهنده بازنگری"
    )
    revision_requested_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان بازنگری")

    locked_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان قفل")
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='locked_work_periods',
        verbose_name="قفل‌کننده"
    )
    notes = models.TextField(blank=True, null=True, verbose_name="توضیحات دوره")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "دوره کارکرد ماهانه"
        verbose_name_plural = "دوره‌های کارکرد ماهانه"
        constraints = [
            models.UniqueConstraint(fields=['warehouse', 'year_month'], name='unique_warehouse_year_month_period')
        ]
        ordering = ['-year_month']

    def __str__(self):
        return f"دوره {self.year_month} - انبار {self.warehouse.name} ({self.get_status_display()})"


class DailyAttendance(models.Model):
    """
    کارکرد روزانه پرسنل (ثبت ماتریسی و سریع)
    """
    STATUS_CHOICES = (
        ('PRESENT_10H', 'حاضر کامل (۱۰ ساعت)'),
        ('HALF_5H', 'نیمه‌وقت (۵ ساعت)'),
        ('ABSENT', 'غایب (۰ ساعت)'),
        ('LEAVE', 'مرخصی'),
        ('MISSION', 'مأموریت'),
        ('FRIDAY_WORK', 'جمعه‌کاری'),
        ('CUSTOM', 'ساعت سفارشی'),
    )

    personnel = models.ForeignKey(
        PersonnelProfile,
        on_delete=models.CASCADE,
        related_name='daily_attendances',
        verbose_name="پرسنل"
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='daily_attendances',
        verbose_name="انبار"
    )
    date_shamsi = models.CharField(max_length=10, db_index=True, verbose_name="تاریخ شمسی (مثال ۱۴۰۴/۰۵/۱۲)")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PRESENT_10H', verbose_name="وضعیت حضور")
    
    effective_hours = models.DecimalField(max_digits=5, decimal_places=2, default=10.00, verbose_name="ساعات کارکرد موثر")
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="ساعات اضافه‌کار")
    is_friday_work = models.BooleanField(default=False, verbose_name="جمعه‌کاری")
    is_mission = models.BooleanField(default=False, verbose_name="روز مأموریت")
    advance_payment = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="مساعده دریافتی روزانه (ریال)")
    
    notes = models.CharField(max_length=255, blank=True, null=True, verbose_name="توضیحات سرپرست")
    period = models.ForeignKey(
        MonthlyWorkPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attendances',
        verbose_name="دوره ماهانه"
    )
    
    is_deleted = models.BooleanField(default=False, verbose_name="حذف منطقی")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_attendances',
        verbose_name="ثبت‌کننده"
    )
    modified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_attendances',
        verbose_name="ویرایش‌کننده"
    )

    class Meta:
        verbose_name = "کارکرد روزانه پرسنل"
        verbose_name_plural = "کارکردهای روزانه پرسنل"
        indexes = [
            models.Index(fields=['warehouse', 'date_shamsi']),
            models.Index(fields=['personnel', 'date_shamsi']),
        ]
        ordering = ['-date_shamsi', 'personnel__last_name']

    def __str__(self):
        return f"{self.personnel.full_name} | {self.date_shamsi} | {self.get_status_display()} ({self.effective_hours}h)"


class AttendanceAuditLog(models.Model):
    """
    لاگ ممیزی و تاریخچه تغییرات کارکرد پرسنل (بدون حذف، جهت نظارت مدیر)
    """
    attendance = models.ForeignKey(
        DailyAttendance,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        verbose_name="رکورد کارکرد"
    )
    personnel_name = models.CharField(max_length=150, verbose_name="نام پرسنل")
    date_shamsi = models.CharField(max_length=10, verbose_name="تاریخ کارکرد")
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="کاربر ویرایش‌کننده"
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان تغییر")
    field_name = models.CharField(max_length=100, verbose_name="نام فیلد")
    old_value = models.TextField(blank=True, null=True, verbose_name="مقدار قبلی")
    new_value = models.TextField(blank=True, null=True, verbose_name="مقدار جدید")
    reason = models.CharField(max_length=255, blank=True, null=True, verbose_name="دلیل ویرایش")

    class Meta:
        verbose_name = "لاگ ممیزی کارکرد"
        verbose_name_plural = "لاگ‌های ممیزی کارکرد"
        ordering = ['-changed_at']

    def __str__(self):
        return f"تغییر {self.field_name} برای {self.personnel_name} در {self.date_shamsi}"


class VehicleTripLog(models.Model):
    """
    لاگ سرویس‌های انجام‌شده توسط خودروها
    """
    vehicle = models.ForeignKey(
        VehicleDriverProfile,
        on_delete=models.CASCADE,
        related_name='trip_logs',
        verbose_name="خودرو و راننده"
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vehicle_trip_logs',
        verbose_name="انبار"
    )
    date_shamsi = models.CharField(max_length=10, db_index=True, verbose_name="تاریخ شمسی")
    trip_count = models.PositiveIntegerField(default=1, verbose_name="تعداد سرویس")
    unit_rate = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مبلغ هر سرویس (ریال)")
    total_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مبلغ کل (ریال)")
    
    dispatch_reference = models.CharField(max_length=100, blank=True, null=True, verbose_name="شماره حواله خروج / بارنامه")
    origin_destination = models.CharField(max_length=255, blank=True, null=True, verbose_name="مبدأ و مقصد")
    notes = models.TextField(blank=True, null=True, verbose_name="توضیحات")
    
    period = models.ForeignKey(
        MonthlyWorkPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vehicle_trips',
        verbose_name="دوره ماهانه"
    )
    
    is_settled = models.BooleanField(default=False, verbose_name="تسویه شده")
    settled_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان تسویه")
    settled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settled_trips',
        verbose_name="کاربر تسویه‌کننده"
    )
    payment_tracking_code = models.CharField(max_length=100, blank=True, null=True, verbose_name="کد رهگیری پرداخت بانکی")
    
    is_deleted = models.BooleanField(default=False, verbose_name="حذف منطقی")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_trips',
        verbose_name="ثبت‌کننده"
    )

    class Meta:
        verbose_name = "سرویس خودرو"
        verbose_name_plural = "سرویس‌های خودروها"
        indexes = [
            models.Index(fields=['warehouse', 'date_shamsi']),
            models.Index(fields=['vehicle', 'date_shamsi']),
        ]
        ordering = ['-date_shamsi', '-created_at']

    def save(self, *args, **kwargs):
        if not self.total_amount:
            self.total_amount = (self.unit_rate or 0) * (self.trip_count or 1)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.vehicle.driver_name} | {self.date_shamsi} | {self.trip_count} سرویس ({self.total_amount:,} ریال)"


class VehicleTripAuditLog(models.Model):
    """
    لاگ ممیزی و تاریخچه تغییرات تردد و سرویس‌های ناوگان (بدون حذف، جهت نظارت مدیر)
    """
    trip = models.ForeignKey(
        VehicleTripLog,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        verbose_name="رکورد سرویس ناوگان"
    )
    driver_name = models.CharField(max_length=150, verbose_name="نام راننده")
    plate_number = models.CharField(max_length=30, blank=True, null=True, verbose_name="پلاک")
    date_shamsi = models.CharField(max_length=10, verbose_name="تاریخ کارکرد")
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="کاربر ویرایش‌کننده"
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان تغییر")
    field_name = models.CharField(max_length=100, verbose_name="نام فیلد")
    old_value = models.TextField(blank=True, null=True, verbose_name="مقدار قبلی")
    new_value = models.TextField(blank=True, null=True, verbose_name="مقدار جدید")
    reason = models.CharField(max_length=255, blank=True, null=True, verbose_name="دلیل ویرایش")

    class Meta:
        verbose_name = "لاگ ممیزی ناوگان"
        verbose_name_plural = "لاگ‌های ممیزی ناوگان"
        ordering = ['-changed_at']

    def __str__(self):
        return f"تغییر {self.field_name} برای {self.driver_name} در {self.date_shamsi}"


# ══════════════════════════════════════════════════════════════════════════════
# ── ۵. مدل‌های تنظیمات پایه، سالانه و سازمان‌ها (منطبق بر شیت Settings اکسل) ──
# ══════════════════════════════════════════════════════════════════════════════

class PayrollYearlySettings(models.Model):
    """
    تنظیمات پایه و مالی سالانه حقوق و دستمزد (قانون کار و بخشنامه‌های سالانه)
    """
    fiscal_year = models.CharField(max_length=4, unique=True, db_index=True, verbose_name="سال مالی (مثال ۱۴۰۵)")
    title = models.CharField(max_length=150, default="تنظیمات پایه و قانون کار", verbose_name="عنوان دوره تنظیمات")
    is_active = models.BooleanField(default=True, verbose_name="سال مالی پیش‌فرض فعال")
    
    # اقلام مصوب ماهانه قانون کار (ریال)
    monthly_food_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=22000000, verbose_name="بن خانوار / اقلام مصرفی ماهانه")
    monthly_housing_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=30000000, verbose_name="حق مسکن ماهانه")
    monthly_spouse_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=5000000, verbose_name="حق تاهل ماهانه")
    monthly_child_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=16625549, verbose_name="حق اولاد به ازای هر فرزند")
    
    # ضرایب و مبالغ فوق‌العاده‌ها
    shift_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="درصد نوبت کاری")
    transport_help_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="درصد فوق‌العاده ایاب و ذهاب")
    transport_fixed_amount = models.DecimalField(max_digits=14, decimal_places=0, default=2388728, verbose_name="ثابت فوق‌العاده ایاب و ذهاب (ریال)")
    specialist_attraction_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="درصد جذب تخصصی ماهانه")
    bad_weather_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="درصد بدی آب و هوا")
    remote_hardship_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="درصد جذب و دوری از خانواده")
    south_pars_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="درصد فوق‌العاده پارس جنوبی")
    travel_cost_per_day = models.DecimalField(max_digits=14, decimal_places=0, default=8736600, verbose_name="هزینه سفر یک روز (ریال)")
    
    # نرخ‌های بیمه تامین اجتماعی
    worker_insurance_rate = models.DecimalField(max_digits=5, decimal_places=2, default=7.00, verbose_name="نرخ بیمه سهم کارگر (درصد)")
    employer_insurance_rate = models.DecimalField(max_digits=5, decimal_places=2, default=20.00, verbose_name="نرخ بیمه سهم کارفرما (درصد)")
    unemployment_insurance_rate = models.DecimalField(max_digits=5, decimal_places=2, default=3.00, verbose_name="نرخ بیمه بیکاری (درصد)")
    
    # تسهیم مازاد ناخالص به اضافه‌کار و سفر/ماموریت
    surplus_overtime_percent = models.DecimalField(max_digits=5, decimal_places=2, default=50.00, verbose_name="درصد تخصیص مازاد به اضافه‌کار (پیش‌فرض ۵۰٪)")
    
    # محدودیت بازه زمانی ویرایش کارکرد روزانه توسط مدیر (-۱ به معنای نامحدود، ۰ به معنای فقط امروز)
    attendance_edit_past_days = models.IntegerField(default=3, verbose_name="حداکثر روزهای گذشته مجاز برای ویرایش کارکرد")
    attendance_edit_future_days = models.IntegerField(default=0, verbose_name="حداکثر روزهای آینده مجاز برای ثبت کارکرد")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تنظیمات سالانه حقوق و دستمزد"
        verbose_name_plural = "تنظیمات سالانه حقوق و دستمزد"
        ordering = ['-fiscal_year']

    def __str__(self):
        return f"تنظیمات سال {self.fiscal_year} ({'فعال' if self.is_active else 'غیرفعال'})"


class JobGradeTier(models.Model):
    """
    جدول ۲۰ گروه شغلی و نرخ مزد شغل و سنوات (منطبق بر جدول Table7 شیت Settings)
    """
    yearly_settings = models.ForeignKey(
        PayrollYearlySettings,
        on_delete=models.CASCADE,
        related_name='job_grades',
        verbose_name="تنظیمات سال مالی"
    )
    grade_number = models.PositiveIntegerField(verbose_name="گروه شغلی (۱ تا ۲۰)")
    daily_base_wage = models.DecimalField(max_digits=14, decimal_places=0, verbose_name="مزد شغل روزانه (ریال)")
    daily_seniority_bonus = models.DecimalField(max_digits=14, decimal_places=0, verbose_name="پایه سنوات روزانه (ریال)")

    class Meta:
        verbose_name = "پایه گروه شغلی"
        verbose_name_plural = "جدول ۲۰ گروه شغلی و سنوات"
        ordering = ['grade_number']
        constraints = [
            models.UniqueConstraint(fields=['yearly_settings', 'grade_number'], name='unique_grade_per_year')
        ]

    def __str__(self):
        return f"گروه {self.grade_number} (سال {self.yearly_settings.fiscal_year}) - مزد: {self.daily_base_wage:,} | سنوات: {self.daily_seniority_bonus:,}"


class WorkshopInsuranceSettings(models.Model):
    """
    تنظیمات کارگاه و کارفرما جهت صدور دیسکت‌های بیمه (منطبق بر DSKKARTable و list_info)
    """
    yearly_settings = models.OneToOneField(
        PayrollYearlySettings,
        on_delete=models.CASCADE,
        related_name='workshop_insurance',
        verbose_name="تنظیمات سال مالی"
    )
    workshop_code = models.CharField(max_length=20, default='4894290013', verbose_name="کد کارگاه ۱۰ رقمی")
    workshop_name = models.CharField(max_length=150, default='دفترشركت فارس عاليش', verbose_name="نام کارگاه")
    employer_name = models.CharField(max_length=150, default='شرکت نفت و گاز پارس', verbose_name="نام کارفرما")
    workshop_address = models.CharField(max_length=255, default='بوشهر شهرستان عسلویه', verbose_name="آدرس کارگاه")
    list_type = models.CharField(max_length=10, default='0', verbose_name="نوع لیست (۰=عادی)")
    list_number = models.CharField(max_length=10, default='01', verbose_name="شماره لیست")
    default_dsk_rate = models.DecimalField(max_digits=5, decimal_places=2, default=27.00, verbose_name="نرخ حق بیمه DSK_RATE")
    default_mon_pym = models.CharField(max_length=10, default='024', verbose_name="کد MON_PYM")

    class Meta:
        verbose_name = "تنظیمات کارگاه و بیمه تامین اجتماعی"
        verbose_name_plural = "تنظیمات کارگاه و بیمه تامین اجتماعی"

    def __str__(self):
        return f"کارگاه {self.workshop_name} ({self.workshop_code})"


class TaxRuleSettings(models.Model):
    """
    تنظیمات سازمان امور مالیاتی و فایل‌های WH/WP (منطبق بر WHFildeTable و WPFildeTable)
    """
    yearly_settings = models.OneToOneField(
        PayrollYearlySettings,
        on_delete=models.CASCADE,
        related_name='tax_settings',
        verbose_name="تنظیمات سال مالی"
    )
    payment_type = models.CharField(max_length=10, default='1', verbose_name="نوع پرداختی (۱=ریالی)")
    service_location = models.CharField(max_length=10, default='1', verbose_name="محل خدمت (۱=عادی)")
    exceptions = models.CharField(max_length=10, default='1', verbose_name="استثنائات (۱=عادی)")
    currency_type = models.CharField(max_length=10, default='84', verbose_name="نوع ارز (۸۴=ریال ایران)")
    currency_exchange_rate = models.DecimalField(max_digits=10, decimal_places=2, default=1.00, verbose_name="نرخ تسعیر ارز")
    housing_benefit_type = models.CharField(max_length=10, default='1', verbose_name="مسکن (۱=عدم استفاده)")
    vehicle_benefit_type = models.CharField(max_length=10, default='1', verbose_name="اتومبیل (۱=عدم استفاده)")
    wh_file_prefix = models.CharField(max_length=10, default='WH', verbose_name="پیشوند فایل WH")
    wp_file_prefix = models.CharField(max_length=10, default='WP', verbose_name="پیشوند فایل WP")

    class Meta:
        verbose_name = "تنظیمات مالیات حقوق"
        verbose_name_plural = "تنظیمات مالیات حقوق"

    def __str__(self):
        return f"تنظیمات مالیات سال {self.yearly_settings.fiscal_year}"


class BankExportSettings(models.Model):
    """
    تنظیمات خروجی فایل پرداخت گروهی بانک ملی (منطبق بر BankTable و ماکروی BankMeli)
    """
    yearly_settings = models.OneToOneField(
        PayrollYearlySettings,
        on_delete=models.CASCADE,
        related_name='bank_export_settings',
        verbose_name="تنظیمات سال مالی"
    )
    bank_name = models.CharField(max_length=100, default='بانک ملی', verbose_name="نام بانک پرداخت‌کننده")
    source_account_number = models.CharField(max_length=50, blank=True, null=True, verbose_name="شماره حساب مبدا")
    default_deposit_id = models.CharField(max_length=50, blank=True, null=True, verbose_name="شناسه واریز پیش‌فرض")
    deposit_description_template = models.CharField(
        max_length=200,
        default='انبارداری حقوق {month_name} {fiscal_year}',
        verbose_name="الگوی شرح واریز"
    )

    class Meta:
        verbose_name = "تنظیمات واریز بانکی"
        verbose_name_plural = "تنظیمات واریز بانکی"

    def __str__(self):
        return f"تنظیمات بانک {self.bank_name} (سال {self.yearly_settings.fiscal_year})"


# ══════════════════════════════════════════════════════════════════════════════
# ── ۶. مدل محاسبه جامع ماهانه حقوق و دستمزد (منطبق بر شیت تیر اکسل شرکت) ────
# ══════════════════════════════════════════════════════════════════════════════

class MonthlyPayrollRecord(models.Model):
    """
    رکورد ۵۸ ستونی محاسبه ماهانه حقوق پرسنل (منطبق بر ساختار دقیق شیت تیر ماه اکسل شرکت)
    """
    period = models.ForeignKey(
        MonthlyWorkPeriod,
        on_delete=models.CASCADE,
        related_name='payroll_records',
        verbose_name="دوره ماهانه"
    )
    personnel = models.ForeignKey(
        PersonnelProfile,
        on_delete=models.CASCADE,
        related_name='monthly_payrolls',
        verbose_name="پرسنل"
    )
    
    # ── ۱. اطلاعات هویتی و قراردادی (ستون‌های ۱ تا ۱۶) ────────────────
    row_number = models.PositiveIntegerField(default=1, verbose_name="ردیف")
    status_category = models.CharField(max_length=50, default='نفرات شرکتی', verbose_name="گروه (ستون ۱)")
    include_in_tax = models.BooleanField(default=True, verbose_name="maliat (ستون ۳)")
    include_in_insurance = models.BooleanField(default=True, verbose_name="بیمه (ستون ۴)")
    include_in_bank = models.BooleanField(default=True, verbose_name="bank (ستون ۵)")
    national_code = models.CharField(max_length=10, db_index=True, verbose_name="کد ملی (ستون ۶)")
    full_name = models.CharField(max_length=200, verbose_name="نام و نام خانوادگی (ستون ۷)")
    marital_status = models.CharField(max_length=20, default='مجرد', verbose_name="وضعیت تاهل (ستون ۸)")
    children_count = models.PositiveIntegerField(default=0, verbose_name="تعداد فرزند (ستون ۹)")
    contract_hours = models.DecimalField(max_digits=8, decimal_places=2, default=230, verbose_name="کارکرد قرارداد شده (ستون ۱۰)")
    contract_salary = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حقوق قرارداد شده (ستون ۱۱)")
    job_grade = models.CharField(max_length=10, default='19', verbose_name="گروه شغلی (ستون ۱۲)")
    daily_wage = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مزد روزانه (ستون ۱۳)")
    daily_seniority = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="پایه سنواتی (ستون ۱۴)")
    years_of_service = models.PositiveIntegerField(default=0, verbose_name="تعداد سال کارکرد (ستون ۱۵)")
    base_daily_rate = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مزد مبنا (ستون ۱۶)")

    # ── ۲. کارکرد، تردد و کسورات ورودی (ستون‌های ۱۷ تا ۲۴) ───────────
    worked_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0, verbose_name="ساعت کارکرد (ستون ۱۷)")
    insurance_days = models.PositiveIntegerField(default=31, verbose_name="روز بیمه (ستون ۱۸)")
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0, verbose_name="ساعت اضافه کار (ستون ۱۹)")
    friday_work_days = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name="روز جمعه کاری (ستون ۲۰)")
    mission_days = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name="ماموریت (ستون ۲۱)")
    income_tax = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مالیات (ستون ۲۲)")
    advance_payment_deduction = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="کسر مساعده (ستون ۲۳)")
    other_allowances = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="سایر مزایا (ستون ۲۴)")

    # ── ۳. مزایای ناخالص و اقلام قانونی (ستون‌های ۲۵ تا ۴۰) ─────────────
    friday_work_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="جمعه کاری (ستون ۲۵)")
    overtime_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="اضافه کار (ستون ۲۶)")
    travel_cost_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="هزینه سفر (ستون ۲۷)")
    mission_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حق ماموریت (ستون ۲۸)")
    bonus_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="عیدی و پاداش (ستون ۲۹)")
    leave_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مرخصی (ستون ۳۰)")
    food_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="بن خانوار (ستون ۳۱)")
    housing_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حق مسکن (ستون ۳۲)")
    marital_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حق تاهل (ستون ۳۳)")
    transport_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق العاده ایاب و ذهاب (ستون ۳۴)")
    market_attraction_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق العاده جذب بازار (ستون ۳۵)")
    bad_weather_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق العاده بدی آب و هوا (ستون ۳۶)")
    remote_hardship_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق العاده دوری از خانواده (ستون ۳۷)")
    south_pars_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="فوق العاده مناطق پارسیان و عسلویه (ستون ۳۸)")
    child_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حق اولاد (ستون ۳۹)")
    seniority_allowance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حق سنوات (ستون ۴۰)")

    # ── ۴. سرجمع‌های مشمول و غیرمشمول بیمه و مالیات (ستون‌های ۴۱ تا ۴۹) ──
    total_taxable_allowances = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مزایا مشمول (ستون ۴۱)")
    total_non_continuous_taxable_allowances = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="جمع مزایا مشمول غیر مستمر (ستون ۴۲)")
    continuous_taxable_allowances = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="مزایا مستمر مشمول مالیات (ستون ۴۳)")
    total_non_taxable_allowances = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="جمع مزایا غیر مشمول (ستون ۴۴)")
    total_seniority_accumulated = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="جمع پایه سنواتی (ستون ۴۵)")
    worker_insurance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="بیمه سهم کارگر ۷٪ (ستون ۴۶)")
    employer_insurance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="بیمه سهم کارفرما ۲۰٪ (ستون ۴۷)")
    unemployment_insurance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="بیمه بیکاری ۳٪ (ستون ۴۸)")
    total_insurance = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="جمع بیمه ۳۰٪ (ستون ۴۹)")

    # ── ۵. حقوق پایه، ناخالص، خالص و پرداخت نهایی (ستون‌های ۵۰ تا ۵۸) ───
    base_salary = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حقوق پایه (ستون ۵۰)")
    continuous_taxable_salary_allowances = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حقوق و مزایای مستمر مالیات (ستون ۵۱)")
    total_insurable_salary_allowances = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="جمع حقوق و مزایا مشمول بیمه (ستون ۵۲)")
    gross_salary = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حقوق ناخالص (ستون ۵۳)")
    total_deductions = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="کسورات (ستون ۵۴)")
    net_salary = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="حقوق خالص (ستون ۵۵)")
    bank_account_number = models.CharField(max_length=50, blank=True, null=True, verbose_name="شماره حساب (ستون ۵۶)")
    payable_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="قابل پرداخت (ستون ۵۷)")
    tax_check_discrepancy = models.DecimalField(max_digits=14, decimal_places=0, default=0, verbose_name="چک مالیات (ستون ۵۸)")

    # ── ۶. متادیتای پرداخت و خزانه‌داری ───────────────────────────
    PAYMENT_STATUS_CHOICES = (
        ('PENDING', 'در انتظار تایید'),
        ('READY_TO_PAY', 'تایید مدیر / آماده پرداخت'),
        ('PAID', 'پرداخت و تسویه شده'),
        ('FAILED_SHEBA', 'خطای شماره شبا / حساب بانکی'),
        ('REJECTED', 'رد شده'),
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='PENDING',
        db_index=True,
        verbose_name="وضعیت پرداخت خزانه‌داری"
    )
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان پرداخت خزانه‌داری")
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='paid_payrolls',
        verbose_name="خزانه‌دار پرداخت‌کننده"
    )
    payment_tracking_code = models.CharField(max_length=100, blank=True, null=True, verbose_name="کد رهگیری بانکی واریز")
    payment_batch_id = models.CharField(max_length=100, blank=True, null=True, verbose_name="شناسه دسته واریز پایا")
    payment_failure_reason = models.TextField(blank=True, null=True, verbose_name="علت عدم واریز یا خطای شبا")

    # ── ۷. متادیتای ممیزی و فایل مالیات دارایی ───────────────────────
    tax_source_type = models.CharField(
        max_length=50,
        default='MANUAL',
        choices=[
            ('MANUAL', 'دستی / پیش‌فرض سیستم'),
            ('IMPORTED_EXCEL', 'فایل اکسل دارایی'),
            ('CALCULATED_BRACKET', 'جدول مالیاتی ماده ۸۴'),
        ],
        verbose_name="منبع مالیات"
    )
    tax_exemption_months = models.PositiveIntegerField(default=1, verbose_name="تعداد ماه اعمال شده در معافیت مالیاتی")
    has_multiple_employers = models.BooleanField(default=False, verbose_name="بیش از یک کارفرما در ماه")
    is_tax_imported = models.BooleanField(default=False, verbose_name="مالیات از اکسل دارایی بارگذاری شده")

    is_manually_overridden = models.BooleanField(default=False, verbose_name="ویرایش دستی شده توسط حسابدار")
    override_notes = models.TextField(blank=True, null=True, verbose_name="توضیحات بازنویسی دستی")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "محاسبه ماهانه حقوق پرسنل"
        verbose_name_plural = "محاسبات ماهانه حقوق پرسنل"
        constraints = [
            models.UniqueConstraint(fields=['period', 'personnel'], name='unique_period_personnel_payroll')
        ]
        ordering = ['row_number']

    def __str__(self):
        return f"{self.full_name} | دوره {self.period.year_month} | خالص: {self.payable_amount:,} ریال"

