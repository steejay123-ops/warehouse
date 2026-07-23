<div dir="rtl" align="right">

# لیست وظایف: اعمال صحیح بررسی دسترسی برای عملیات‌های کلیدی (Role Permissions Fix)

- [x] **بک‌اند: اصلاح `inventory/views.py`**
  - [x] افزودن `perm_rec_import` به لیست مجوزهای الزامی متدهای: `import_excel`, `cancel_import`, `delete_from_excel`, `clear_warehouse_data`
  - [x] افزودن `perm_rec_recount` به لیست مجوزهای الزامی متدهای: `reject`, `manager_reject`

- [x] **بک‌اند: اصلاح `warehouses/views.py`**
  - [x] بررسی تغییر در فیلد `is_active` هنگام ذخیره‌سازی و اعمال مجوز `perm_wh_freeze` برای آن.

- [x] **فرانت‌اند: محافظت از رابط کاربری در `docs.html`**
  - [x] مخفی‌سازی دکمه «شروع فرآیند پردازش و تزریق» با `*appHasPermission="'perm_rec_import'"`
  - [x] مخفی‌سازی دکمه «لغو فرآیند»
  - [x] مخفی‌سازی دکمه «حذف رکوردهای این فایل»
  - [x] مخفی‌سازی دکمه «حذف اطلاعات انبار فعلی»

- [x] **فرانت‌اند: محافظت از رابط کاربری در کارتابل‌ها**
  - [x] افزودن `*appHasPermission="'perm_rec_recount'"` به دکمه رد در `supervisor.html`
  - [x] افزودن `*appHasPermission="'perm_rec_recount'"` به دکمه رد در `manager-review.html`

- [x] **فرانت‌اند: محافظت از دکمه فریز انبار**
  - [x] بررسی فایل `wh-settings.html` یا `projects.html` برای پیدا کردن سوییچ تغییر وضعیت انبار و محدود کردن آن با `*appHasPermission="'perm_wh_freeze'"`

- [ ] بررسی وضعیت سرورها پس از اتمام (عدم وجود خطای کامپایل)
- [ ] ذخیره و ساخت Walkthrough برای مشتری

</div>
