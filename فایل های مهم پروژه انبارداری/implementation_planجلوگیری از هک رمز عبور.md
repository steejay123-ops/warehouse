# طرح پیاده‌سازی: جلوگیری از حملات Brute Force (جلوگیری از هک رمز عبور)

این طرح بر اساس استفاده از افزونه قدرتمند **Django-Axes** تنظیم شده است که به صورت خودکار تلاش‌های ورود را مانیتور کرده و کاربران/IPهای مشکوک را مسدود می‌کند.

## Open Questions
تعداد دفعات مجاز خطا فعلاً **۵ بار** و زمان قفل شدن اکانت **۱۵ دقیقه** در نظر گرفته شده است. اگر می‌خواهید این اعداد متفاوت باشند لطفاً اطلاع دهید.

---

## Proposed Changes

---

### Backend Dependencies
اضافه کردن پکیج axes به محیط پایتون.

#### [MODIFY] requirements.txt
- اضافه کردن `django-axes==6.4.0` به نیازمندی‌ها.

---

### Django Configuration
پیکربندی افزونه در هسته جنگو.

#### [MODIFY] config/settings.py
- اضافه کردن `'axes'` به لیست `INSTALLED_APPS`.
- اضافه کردن `AUTHENTICATION_BACKENDS` شامل `axes.backends.AxesStandaloneBackend` و بک‌اند دیفالت جنگو.
- اضافه کردن `axes.middleware.AxesMiddleware` به لیست `MIDDLEWARE`.
- تعریف تنظیمات مخصوص (Limits, Cool-off time).
- تعیین یک تابع سفارشی (`AXES_LOCKOUT_CALLABLE`) برای پاسخ‌دهی به درخواست‌های API هنگام مسدود شدن (به جای باز کردن صفحه HTML ارور).

#### [MODIFY] accounts/views.py
- ساخت تابع سفارشی `axes_lockout_response` که یک `JsonResponse` با کد 429 (Too Many Requests) و پیغام فارسی برمی‌گرداند.

---

### Frontend UI Updates
تطبیق فرانت‌اند برای نمایش دقیق ارورها.

#### [MODIFY] login.ts
- اصلاح نحوه استخراج پیغام خطا (خواندن `err.error.detail`) تا پیغام مسدود شدنِ 15 دقیقه‌ای به صورت دقیق به کاربر نشان داده شود (در قالب یک Toast).

---

## Verification Plan

### Automated/Shell Execution
- نصب پکیج با دستور `pip install django-axes`.
- اجرای مایگریشن‌های دیتابیس با `python manage.py migrate` (برای ساخت جداول مربوط به مانیتورینگ IPها و تلاش‌های ناموفق).

### Manual Verification
1. به صورت دستی ۵ بار رمز عبور یک حساب (یا حساب غیرواقعی) را اشتباه وارد می‌کنم.
2. در تلاش ششم، سیستم باید به جای ارور "رمز اشتباه است"، ارور "تعداد تلاش‌ها بیش از حد مجاز است، ۱۵ دقیقه صبر کنید" را نمایش دهد.
