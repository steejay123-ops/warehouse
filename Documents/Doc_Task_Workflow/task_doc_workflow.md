<div dir="rtl" align="right">

# وظایف: توسعه چرخه کاری ارجاع اسناد

- [x] ایجاد فایل‌های وظایف در مسیرهای مربوطه (`task.md` سیستم و `Documents`)
- [ ] **بخش مدل‌های بک‌اند:**
  - [x] افزودن مدل `DocTask` به `inventory/models.py`
  - [x] افزودن مدل `DocTaskHistory` به `inventory/models.py`
- [ ] **بخش نقش‌ها و تنظیمات:**
  - [x] افزودن نقش‌های `doc_worker` و `doc_supervisor` در `init_roles.py` (اسکریپت)
  - [x] افزودن کلید تنظیم `require_doc_supervisor_approval` به `warehouses/services.py`
- [ ] **ساخت و اعمال دیتابیس:**
  - [x] اجرای دستور `makemigrations`
  - [x] اجرای دستور `migrate`
  - [x] اجرای دستور `init_roles`
- [ ] **بخش API بک‌اند (Views):**
  - [x] ایجاد `DocTaskViewSet` (یا آپدیت view موجود) برای اکشن‌های دریافت لیست و تاییدات اسناد
  - [x] آپدیت اکشن `bulk_assign` برای ساخت رکوردهای `DocTask` در کنار `CountTask`
- [ ] **بخش فرانت‌اند:**
  - [x] آپدیت enumها و تایپ‌های Role برای `doc_worker` و `doc_supervisor`
  - [x] آپدیت `dispatch.ts` برای فراخوانی کاربران اسناد و ارسال دیتای اختصاص اسناد
  - [x] آپدیت `dispatch.html` برای نمایش فرم ارجاع اسناد و لیست کشویی‌ها مشابه ارجاع شمارش

</div>




