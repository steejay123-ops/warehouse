<div dir="rtl" align="right">

# چک‌لیست فازبندی سیستم جامع دسترسی‌های حساس، بازگردانی و پشتیبان‌گیری
## (Enhanced Sensitive RBAC, Rollback & Backup Task List)

---

### فاز ۱: زیرساخت امنیتی دسترسی‌های ۶‌گانه در بک‌اند (Backend 6-Sensitive Permissions & RBAC Guard)
- [x] تعریف ۳ پرمیشن تکمیلی (`perm_sys_hard_delete`, `perm_sys_emergency_freeze`, `perm_sys_factory_reset`) در `CustomUser.Meta.permissions` و به‌روزرسانی `SENSITIVE_PERMISSION_CODENAMES` <!-- id: 0 -->
- [x] ایجاد و اجرای مایگریشن `0022_add_extended_sensitive_permissions.py` <!-- id: 1 -->
- [x] به‌روزرسانی `PermissionSerializer` با علامت‌گذاری `is_sensitive=True` برای هر ۶ دسترسی <!-- id: 2 -->
- [x] تست گارد سمت سرور در `CustomRoleViewSet` و `UserViewSet` برای مسدودسازی کاربر غیر Superuser با خطای ۴۰۳ <!-- id: 3 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۱ توسط ایجنت ناظر (Gate 1 Verification)** <!-- id: 4 -->

---

### فاز ۲: بازطراحی رابط کاربری ماتریس دسترسی‌ها در فرانت‌اند (Frontend Sensitive Permissions Matrix UI)
- [x] اصلاح تابع `loadData()` در `users.ts` جهت درج دائمی گروه `SENSITIVE` با تمامی دسترسی‌های حساس دریافتی <!-- id: 5 -->
- [x] پیاده‌سازی حالت Disabled / Read-Only همراه با برچسب راهنمای امنیتی برای کاربران غیر Superuser در `users.html` <!-- id: 6 -->
- [x] اتصال مدال هشدار امنیتی ۲ مرحله‌ای هنگام تلاش Superuser برای اعطای هر یک از دسترسی‌های حساس <!-- id: 7 -->
- [x] اطمینان از مستثنی بودن قطعی دسترسی‌های حساس از کلیدهای انتخاب دسته‌جمعی <!-- id: 8 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۲ توسط ایجنت ناظر (Gate 2 Verification)** <!-- id: 9 -->

---

### فاز ۳: انطباق موتور بازگردانی داده با دسترسی‌های حساس (Rollback Engine Integration)
- [x] تست اکشن‌های `preview_revert`، `revert` و `bulk_revert` با مجوز `perm_rollback_data` <!-- id: 10 -->
- [x] تست بازگردانی اتمیک رکوردها و صدور لاگ ممیزی `ROLLBACK` بنفش رنگ <!-- id: 11 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۳ توسط ایجنت ناظر (Gate 3 Verification)** <!-- id: 12 -->

---

### فاز ۴: انطباق سیستم پشتیبان‌گیری و دستور چرخش خودکار (Backup & Rotation Subsystem)
- [x] تست دسترسی `perm_sys_backup_restore` در `DatabaseBackupViewSet` <!-- id: 13 -->
- [x] تست رابط کاربری پشتیبان‌گیری در `wh-settings` و دستور مدیریتی `run_auto_backup` <!-- id: 14 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۴ توسط ایجنت ناظر (Gate 4 Verification)** <!-- id: 15 -->

---

### فاز ۵: آزمون جامع End-to-End و مستندسازی نهایی (End-to-End Verification & DUAL-SAVE)
- [x] اجرای آزمون یکپارچه سراسری و بیلد کامل فرانت‌اند (`npm run build`) <!-- id: 16 -->
- [x] به‌روزرسانی مستندات `walkthrough_rollback.md`، `task_rollback.md` و `Master_Log.md` <!-- id: 17 -->
- [x] **گیت اعتبارسنجی مستقل فاز ۵ توسط ایجنت ناظر (Gate 5 Verification)** <!-- id: 18 -->

</div>
