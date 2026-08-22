<div dir="rtl" align="right">

# چک‌لیست فازبندی سیستم جامع حجم داده‌ها، پاکسازی بازه‌ای، بازگردانی به تاریخ و هایلایت تفاوت‌ها
## (Comprehensive Audit Enhancement, Sizing, Range Purge, Point-in-Time Rollback & Visual Diff Task List)

---

### فاز ۱: اصلاح باگ‌های هسته بازگردانی داده و تشخیص تداخل در بک‌اند (Rollback Core Bug Fixes)
- [x] پیاده‌سازی متد `normalize_for_comparison` در `rollback_service.py` جهت استانداردسازی مقایسه انواع داده (Decimal, DateTime, Date, Boolean) و حذف تداخل‌های کاذب <!-- id: 0 -->
- [x] پیاده‌سازی تابع تبدیل و کستینگ ایمن فیلدها (`coerce_field_value`) در `rollback_service.py` بر اساس نوع فیلد مدل در جنگو (`_meta.get_field`) <!-- id: 1 -->
- [x] جلوگیری از صدور لاگ‌های تکراری و موازی در هنگام اجرای عملیات `save` یا `delete` در بازگردانی داده <!-- id: 2 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۱ توسط ایجنت ناظر (Gate 1 Verification)** <!-- id: 3 -->

---

### فاز ۲: زیرساخت محاسبه حجم فیزیکی دیتابیس و پاکسازی پیشرفته بازه‌ای لاگ‌ها (Storage Sizing & Range Purge Backend)
- [x] ارتقای متد `stats` در `AuditLogViewSet` و `UserLoginLogViewSet` جهت استعلام حجم واقعی جداول (`pg_total_relation_size`) و سایز لاگ‌ها به بایت، کیلوبایت و مگابایت با مکانیزم Fallback ایمن <!-- id: 4 -->
- [x] بازطراحی اکشن `purge` در `AuditLogViewSet` با پشتیبانی از بازه تاریخی `from_date` و `to_date`، فیلتر انبار و ماژول، و حالت `dry_run` پیش‌نمایش تعداد رکوردها <!-- id: 5 -->
- [x] ثبت خودکار لاگ ممیزی `critical` برای هر عملیات پاکسازی با ثبت تعداد رکوردهای حذف‌شده و نام کاربر مجری <!-- id: 6 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۲ توسط ایجنت ناظر (Gate 2 Verification)** <!-- id: 7 -->

---

### فاز ۳: موتور بازگردانی هوشمند به تاریخ مشخص در بک‌اند (Point-in-Time Rollback Engine Backend)
- [x] طراحی و پیاده‌سازی متد `preview_point_in_time_rollback` در `rollback_service.py` جهت شبیه‌سازی و استخراج تفاوت‌های تجمیعی کلیه لاگ‌ها از تاریخ هدف تا زمان حال به تفکیک انبار و ماژول <!-- id: 8 -->
- [x] طراحی و پیاده‌سازی متد `execute_point_in_time_rollback` در `rollback_service.py` با اجرای معکوس‌سازی زنجیره‌ای در تراکنش اتمیک دیتابیس (`transaction.atomic()`) <!-- id: 9 -->
- [x] ایجاد اکشن‌های API مربوط به Point-in-Time Rollback در `AuditLogViewSet` با گارد پرمیشن حساس (`perm_rollback_data` یا `perm_rollback_bulk`) <!-- id: 10 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۳ توسط ایجنت ناظر (Gate 3 Verification)** <!-- id: 11 -->

---

### فاز ۴: یکپارچه‌سازی مدل‌ها و متدهای API در فرانت‌اند (Frontend Models & API Integration)
- [x] به‌روزرسانی مدل‌های `audit-log.model.ts` با ساختارهای داده حجم دیتابیس (`AuditStorageStats`)، درخواست‌های پاکسازی (`PurgeRequest`, `PurgePreviewResponse`) و بازگردانی نقطه‌ای (`PointInTimeRollbackPreview`, `PointInTimeRollbackRequest`) <!-- id: 12 -->
- [x] پیاده‌سازی متدهای API در `audit-api.service.ts` (`purgeLogs`, `getPurgePreview`, `previewPointInTimeRollback`, `executePointInTimeRollback`) <!-- id: 13 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۴ توسط ایجنت ناظر (Gate 4 Verification)** <!-- id: 14 -->

---

### فاز ۵: پیاده‌سازی رابط کاربری مدرن، کارت شاخص حجم، مدال‌های پاکسازی و پیش‌نمایش کلمه‌ای (Frontend UI & Visual Word Diff)
- [x] پیاده‌سازی تابع محاسبه تفاضل کلمه به کلمه (`computeWordDiff`) در `audit.ts` جهت هایلایت واژگان حذف‌شده/جدید <!-- id: 15 -->
- [x] اضافه کردن کارت شاخص KPI حجم داده‌های ممیزی به مگابایت/کیلوبایت در بالای صفحه `audit.html` <!-- id: 16 -->
- [x] پیاده‌سازی مدال پیشرفته پاکسازی لاگ‌ها با انتخاب بازه زمانی، پیش‌نمایش تعداد رکوردها و تاییدیه امنیتی ۲ مرحله‌ای <!-- id: 17 -->
- [x] پیاده‌سازی مدال جامع بازگردانی به تاریخ مشخص (Point-in-Time Rollback) با تقویم، پیش‌نمایش تغییرات و تایید تراکنش <!-- id: 18 -->
- [x] بازطراحی کامل بخش بصری پیش‌نمایش بازگردانی (Revert Preview Modal) با تمرکز و کنتراست بالای چشمی روی کلمات تغییریافته (`line-through bg-rose-100 text-rose-800 font-bold px-1 rounded` و `bg-emerald-100 text-emerald-900 font-black px-1 rounded`) <!-- id: 19 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۵ توسط ایجنت ناظر (Gate 5 Verification)** <!-- id: 20 -->

---

### فاز ۶: آزمون جامع یکپارچه‌سازی، تست‌های اتوماسیون، مستندسازی نهایی و DUAL-SAVE
- [x] اجرای تست‌های جامع سرتاسری (E2E Integration Tests) برای سناریوهای بازگردانی تکی، بازگردانی گروهی به تاریخ، و محاسبه حجم فیزیکی دیتابیس <!-- id: 21 -->
- [x] بررسی لاگ‌های سرور جنگو و بیلد نهایی فرانت‌اند و اطمینان از صفر بودن باگ‌ها و ارورهای ترمینال <!-- id: 22 -->
- [x] به‌روزرسانی مستندات فنی و راهنمای کاربری در `Documents/Audit_Enhancement_And_Rollback/walkthrough_audit.md` <!-- id: 23 -->
- [x] همگام‌سازی و درج گزارش کامل عملیات در `Documents/Master_Log.md` طبق استاندارد مهارت DUAL-SAVE <!-- id: 24 -->
- [x] **گیت اعتبارسنجی نهایی و صدور گزارش جامع برای کاربر (Gate 6 Final Sign-off)** <!-- id: 25 -->

</div>
