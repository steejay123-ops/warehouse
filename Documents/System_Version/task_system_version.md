<div dir="rtl" align="right">

- `[x]` تنظیمات بک‌اند (ایجاد مسیر عمومی و API)
  - `[x]` تعریف `system_version` در `DEFAULT_SETTINGS` در سرویس‌های بک‌اند (warehouses/services.py).
  - `[x]` ایجاد کلاس `PublicConfigViewSet` در (warehouses/views.py) برای برگرداندن نام سیستم و نسخه سیستم.
  - `[x]` افزودن آدرس `api/public/config/` به `config/urls.py`.
- `[x]` تنظیمات فرانت‌اند (خواندن اطلاعات از API)
  - `[x]` ایجاد یا به‌روزرسانی سرویس فرانت‌اند برای دریافت اطلاعات از `api/public/config`.
  - `[x]` تنظیم گرفتن اطلاعات نسخه در صفحه لاگین (`login.ts`).
  - `[x]` نمایش متغیر نسخه در صفحه ورود (`login.html`).
- `[x]` تست نهایی (بررسی درستی نمایش و عدم وجود ارور در کنسول مرورگر و ترمینال).

</div>
