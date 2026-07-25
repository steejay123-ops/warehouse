<div dir="rtl" align="right">

# برنامه‌ی اجرایی فاز ۴: ارث‌بری دسترسی‌ها (Permission Inheritance)

## ۱. بک‌اند (تغییرات احراز هویت)
- [x] ۱.۱ — ایجاد فایل `accounts/backends.py` و پیاده‌سازی کلاس `RoleInheritanceBackend`.
- [x] ۱.۲ — افزودن لاجیک جستجوی بازگشتی (Recursive) فرزندان در متد `_get_group_permissions`.
- [x] ۱.۳ — جایگزینی `ModelBackend` با `RoleInheritanceBackend` در تنظیمات `config/settings.py`.

## ۲. تست و تأیید
- [x] ۲.۱ — بررسی صحت کامپایل و اجرای بک‌اند (`runserver`).
- [x] ۲.۲ — اجرای یک کوئری تست در شل جنگو (ایجاد نقش والد و فرزند و بررسی خروجی `has_perm`).

</div>
