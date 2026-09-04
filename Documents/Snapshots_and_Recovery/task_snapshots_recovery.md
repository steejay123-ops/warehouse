# چک‌لیست وظایف: مرکز جامع اسنپ‌شات‌های سرور، بازگشت سریع و پشتیبان‌گیری محلی IndexedDB

<div dir="rtl" align="right">

- [x] **فاز ۱: سرویس‌های بک‌اند و اندپوینت‌های REST (Backend Services & APIs)**
  - [x] افزودن توابع `create_server_snapshot` و `quick_rollback_snapshot` و الگوریتم چرخش ۷ نسخه در `accounts/backup_service.py` <!-- id: 0 -->
  - [x] پیاده‌سازی ویوهای REST برای دریافت لیست اسنپ‌شات‌ها، ثبت دستی و بازگشت سریع در `config/views_backup.py` <!-- id: 1 -->
  - [x] ثبت روت‌های URL اندپوینت‌های جدید در `config/urls.py` <!-- id: 2 -->
  - [x] ثبت رخدادهای ایجاد و بازگردانی اسنپ‌شات در جدول `AuditLog` <!-- id: 3 -->

- [x] **فاز ۲: منطق و رابط کاربری فرانت‌اند (Angular & IndexedDB UI)**
  - [x] پیاده‌سازی متد خروجی کامل JSON از پایگاه‌داده محلی Dexie در `offline-db.ts` <!-- id: 4 -->
  - [x] افزودن متدهای فراخوانی سرویس بک‌آپ به `SettingsService` <!-- id: 5 -->
  - [x] طراحی کارت بصری اسنپ‌شات‌ها و جدول ۷ نسخه اخیر در `settings-backup-tab.html` <!-- id: 6 -->
  - [x] پیاده‌سازی منطق تعاملی، مودال تایید بازگشت سریع و دانلود اسنپ‌شات تبلت در `settings-backup-tab.ts` <!-- id: 7 -->
  - [x] افزودن ویجت خلاصه وضعیت اسنپ‌شات‌ها به داشبورد سلامت در `health-dashboard.ts` <!-- id: 8 -->

- [x] **فاز ۳: تست، ارزیابی و استقرار ایجنت نگهبان ۲۵ (Testing & Guardian 25)**
  - [x] پیاده‌سازی ایجنت نگهبان ۲۵ (`audit_guardian_25_snapshots_disaster_recovery_and_indexeddb`) در `phase_guardian_approval.py` <!-- id: 9 -->
  - [x] اجرای سوئیت کامل نگهبانان پایتون و اخذ تاییدیه ۱۰۰٪ از هر ۲۵ ایجنت <!-- id: 10 -->
  - [x] کامپایل و بیلد نهایی پروژه فرانت‌اند با دستور `npm run build` و احراز کد خروجی ۰ <!-- id: 11 -->

</div>
