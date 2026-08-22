<div dir="rtl" align="right">

# چک‌لیست وظایف: پیاده‌سازی تنظیمات تاریخچه و یادداشت‌های انبارگردان

- [x] **فاز ۱: بک‌اند (Django Settings Service)** <!-- id: 0 -->
  - [x] افزودن `counter_can_view_history` و `counter_can_view_previous_notes` به `DEFAULT_SETTINGS` در `warehouses/services.py` <!-- id: 1 -->
  - [x] بررسی سلامت بک‌اند با `manage.py check` <!-- id: 2 -->

- [x] **فاز ۲: فرم‌های تنظیمات فرانت‌اند (Settings UI)** <!-- id: 3 -->
  - [x] افزودن سوئیچ‌های تنظیمات در تب عملیات صفحه تنظیمات سراسری (`settings.html`) <!-- id: 4 -->
  - [x] افزودن سوئیچ‌های تنظیمات با پرچم اختصاصی در تب عملیات تنظیمات انبار (`wh-settings.html`) <!-- id: 5 -->

- [x] **فاز ۳: اعمال محدودیت‌ها در کارتابل انبارگردان (Counter Dashboard)** <!-- id: 6 -->
  - [x] دریافت مقادیر تنظیمات در `counter-dashboard.ts` و تعریف منطق `canViewRecordNote` <!-- id: 7 -->
  - [x] اعمال شرط نمایش تاریخچه و یادداشت‌های قبلی در `counter-dashboard.html` <!-- id: 8 -->

- [x] **فاز ۴: راستی‌آزمایی، بیلد و ثبت مستندات (Verification & Build)** <!-- id: 9 -->
  - [x] اجرای بیلد نهایی پروژه `npm run build` <!-- id: 10 -->
  - [x] به‌روزرسانی مستندات DUAL-SAVE و Master Log <!-- id: 11 -->

</div>
