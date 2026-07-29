<div dir="rtl" align="right">

# چک‌لیست اجرا — ورود/خروج اکسل (Excel Import/Export)

## فاز ۱: ماژول‌های اکسل بک‌اند
- [x] ایجاد `accounts/excel_utils.py` (کاربران)
- [x] ایجاد `accounts/roles_excel_utils.py` (نقش‌ها)
- [x] ایجاد `warehouses/excel_utils.py` (انبارها)

## فاز ۲: اکشن‌های ViewSet بک‌اند
- [x] اضافه کردن ۳ اکشن به `UserViewSet` (export/import/template)
- [x] اضافه کردن ۳ اکشن به `CustomRoleViewSet` (export/import/template)
- [x] اضافه کردن ۳ اکشن به `WarehouseViewSet` (export/import/template)

## فاز ۳: سرویس‌های HTTP فرانت‌اند
- [x] اضافه کردن ۶ متد به `accounts-http.service.ts`
- [x] اضافه کردن ۳ متد به `warehouse-http.service.ts`

## فاز ۴: کامپوننت مشترک مودال آپلود
- [x] ایجاد `excel-import-modal` (ts + html + css)

## فاز ۵: رابط کاربری (UI)
- [x] اضافه کردن دکمه‌ها و مودال به `users` (تب کاربران)
- [x] اضافه کردن دکمه‌ها و مودال به `users` (تب نقش‌ها)
- [x] اضافه کردن دکمه‌ها و مودال به `projects` (انبارها)

## فاز ۶: تست و تأیید
- [/] بررسی بیلد (Angular Build Check)
- [ ] تست Export اکسل (کاربران، انبارها، نقش‌ها)
- [ ] تست Import اکسل (فایل معتبر)
- [ ] تست Import با داده‌های خطادار
- [ ] تست دانلود Template
- [ ] بررسی سطح دسترسی

## فاز ۷: مستندسازی
- [ ] بروزرسانی walkthrough.md

</div>
