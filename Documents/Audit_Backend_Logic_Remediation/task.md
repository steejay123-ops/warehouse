<div dir="rtl" align="right">

# 📋 چک‌لیست وظایف اجرایی: طرح جامع اصلاح، تقویت و رفع ایرادات تب «رهگیری تغییرات»

- [x] **فاز ۱: اصلاح باگ‌های حیاتی موتور بازگردانی داده (Rollback Engine)** <!-- id: phase1_rollback_engine -->
  - [x] استثنا کردن مقادیر ماسک‌شده (`********`) و کلیدهای حساس از بازنویسی در `revert_log_entry` و `get_revert_preview` <!-- id: p1_mask_protect -->
  - [x] افزودن قفل سطری بدبینانه `select_for_update` به تراکنش بازگردانی <!-- id: p1_select_for_update -->
  - [x] اصلاح تضاد تراکنش و بازگردانی در `execute_point_in_time_rollback` با استفاده از `savepoint` <!-- id: p1_pit_transaction -->
  - [x] یکنواخت‌سازی ثبت ماژول به `system` در لاگ‌های بازگردانی کلان <!-- id: p1_system_module -->

- [x] **فاز ۲: رفع باگ‌های کوئری، امنیت دسترسی (RBAC) و چندانبارگی** <!-- id: phase2_security_query -->
  - [x] رفع خطای دیتابیس در فیلتر با `warehouse=ALL` در `AuditLogViewSet.get_queryset` <!-- id: p2_warehouse_all -->
  - [x] بستن نشت امنیتی قلمرو انبار در اکشن `bulk_revert` <!-- id: p2_bulk_revert_scope -->
  - [x] اصلاح رشته ماژول `SYSTEM` به `system` در اکشن `purge` <!-- id: p2_purge_module_case -->
  - [x] پیاده‌سازی اکشن پاکسازی لاگ‌های ورود (`UserLoginLogViewSet.purge`) <!-- id: p2_login_purge -->

- [x] **فاز ۳: پوشش نقاط کور ممیزی در ماژول انبارداری و کالاها** <!-- id: phase3_inventory_audit -->
  - [x] ثبت لاگ ممیزی در ویرایش گروهی کالاها (`ItemViewSet.bulk_update`) <!-- id: p3_bulk_update_audit -->
  - [x] ثبت لاگ ممیزی در تخصیص و ارجاع گروهی (`ItemViewSet.bulk_assign`) <!-- id: p3_bulk_assign_audit -->
  - [x] ثبت لاگ ممیزی در پاکسازی انبار (`clear_warehouse_data`) <!-- id: p3_clear_wh_audit -->
  - [x] ثبت لاگ ممیزی در حذف گروهی کالاها از اکسل (`delete_from_excel`) <!-- id: p3_del_excel_audit -->
  - [x] ثبت لاگ ممیزی در ایمپورت اکسل کالاها و بازگردانی آن (`import_excel` و `revert_import`) <!-- id: p3_import_audit -->

- [x] **فاز ۴: پوشش نقاط کور ممیزی در کاربران، نقش‌ها و تنظیمات** <!-- id: phase4_users_roles_settings -->
  - [x] ثبت لاگ ممیزی در ایجاد، ویرایش و حذف نقش‌ها (`CustomRoleViewSet`) <!-- id: p4_roles_audit -->
  - [x] ثبت لاگ ممیزی در تغییر و بازنشانی رمز عبور پرسنل (`change_password` و `admin_reset_password`) <!-- id: p4_password_audit -->
  - [x] ثبت لاگ ممیزی در ایمپورت اکسل کاربران و نقش‌ها <!-- id: p4_users_excel_audit -->
  - [x] ثبت لاگ ممیزی در تنظیمات سراسری و انبار (`SettingsViewSet`) <!-- id: p4_settings_audit -->

- [x] **فاز ۵: بهینه‌سازی فرانت‌اند، وب‌سوکت و خروجی اکسل** <!-- id: phase5_frontend_websocket_export -->
  - [x] اعمال فیلتر محدوده تاریخ روی پیام‌های زنده وب‌سوکت در `audit.ts` <!-- id: p5_ws_date_filter -->
  - [x] افزودن دکمه و مدال پاکسازی لاگین‌ها به تب تاریخچه ورود (`audit.html` / `audit.ts`) <!-- id: p5_login_purge_modal -->
  - [x] اتصال سرویس فرانت‌اند به اندپوینت پاکسازی لاگین (`audit-api.service.ts`) <!-- id: p5_login_purge_api -->
  - [x] محدودسازی طول متن تفاضل در اکسل برای جلوگیری از سرریز سلول‌ها <!-- id: p5_excel_cell_limit -->

- [x] **فاز ۶: آزمون‌های یکپارچگی، نگهبان و بیلد نهایی** <!-- id: phase6_e2e_verification -->
  - [x] اجرای تست‌های اعتبارسنجی بک‌اند برای تمام فازها <!-- id: p6_backend_tests -->
  - [x] اجرای تست بیلد و کامپایل فرانت‌اند (`npm run build`) <!-- id: p6_frontend_build -->

</div>
