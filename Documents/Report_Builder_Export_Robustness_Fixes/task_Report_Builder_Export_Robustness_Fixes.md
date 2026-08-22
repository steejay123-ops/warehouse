<div dir="rtl" align="right">

# چک‌لیست وظایف ارتقای پایداری و رفع آسیب‌پذیری‌های خروجی گزارش‌ساز (Report Builder Export Robustness)

- [x] **فاز ۱: اصلاح و یکپارچه‌سازی سطح دسترسی و کوئری بک‌اند** <!-- id: phase1_backend -->
  - [x] تغییر مجوز `ExportReportView` در `reports/views.py` از `view_sys_export` به `ReportsMenuAccess` (`view_sys_reports`) <!-- id: p1_perm_fix -->
  - [x] اصلاح باگ بالقوه `order_by('pk')` در کوئری‌های چندمقداری با `DISTINCT` در `reports/engine.py` <!-- id: p1_distinct_fix -->
  - [x] اجرای تست‌های بک‌اند `manage.py test reports` جهت اعتبارسنجی <!-- id: p1_test_backend -->
- [x] **فاز ۲: اعتبارسنجی فرانت‌اند پیش از خروجی و بهینه‌سازی مدیریت خطا** <!-- id: phase2_frontend -->
  - [x] افزودن پرچم `SKIP_GLOBAL_ERROR_TOAST` به متد `export` در `report-api.service.ts` <!-- id: p2_skip_toast -->
  - [x] پیاده‌سازی اعتبارسنجی کامل فیلترها، شروط HAVING و نام‌های مستعار پیش از صدور درخواست خروجی در `reports.ts` <!-- id: p2_validate_export -->
  - [x] اطمینان از استخراج و نمایش دقیق پیام خطای بازگشتی از سرور در فرمت باینری (Blob) <!-- id: p2_blob_error -->
- [x] **فاز ۳: مستندسازی و تست نهایی** <!-- id: phase3_docs_test -->
  - [x] ثبت فایل‌های مستندات در پوشه `Documents/Report_Builder_Export_Robustness_Fixes/` و به‌روزرسانی `Master_Log.md` <!-- id: p3_dual_save -->
  - [x] تست کامل خروجی‌های Excel و PDF در مرورگر و اطمینان از عملکرد پایدار <!-- id: p3_e2e_verification -->

</div>
