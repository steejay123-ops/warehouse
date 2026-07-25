<div dir="rtl" align="right">

# وظایف — ارتقاء سیستم نقش‌ها (Role System Upgrade)

## فاز ۱ — ساخت مدل `CustomRole` (بک‌اند)
- [x] ۱.۱ — افزودن مدل `CustomRole` به `accounts/models.py`
- [x] ۱.۲ — ساخت Schema Migration (`makemigrations`)
- [x] ۱.۳ — نوشتن Data Migration (تبدیل Groupهای فعلی به CustomRole)
- [x] ۱.۴ — اجرای `migrate` و تأیید صحت
- [x] ۱.۵ — ساخت `CustomRoleSerializer` در `serializers.py`
- [x] ۱.۶ — تغییر `GroupViewSet` به `CustomRoleViewSet` در `views.py`
- [x] ۱.۷ — آپدیت `urls.py` (روتر)
- [x] ۱.۸ — آپدیت `init_roles.py` مدیریت کامند
- [x] ۱.۹ — آپدیت `UserSerializer.to_representation` (ارسال اطلاعات کامل نقش)
- [x] ۱.۱۰ — آپدیت `CustomTokenObtainPairSerializer` (ارسال اطلاعات نقش در لاگین)

## فاز ۲ — حذف هاردکدهای نام نقش از بک‌اند
- [x] ۲.۱ — حذف هاردکدها از `views.py` (چک‌های `name='admin'`)
- [x] ۲.۲ — حذف هاردکدها از `serializers.py`

## فاز ۳ — هماهنگ‌سازی فرانت‌اند
- [x] ۳.۱ — آپدیت اینترفیس `Role` در `accounts-http.service.ts`
- [x] ۳.۲ — حذف `rolesMap` هاردکد از `state.service.ts`
- [x] ۳.۳ — آپدیت `users.ts` (حذف هاردکد نقش‌های سیستمی + استفاده از `is_system`)
- [x] ۳.۴ — آپدیت `users.html` (فعال‌سازی Color Picker)
- [x] ۳.۵ — آپدیت `dispatch.ts` — **نیازی به تغییر نبود** (فیلتر بر اساس `role.name` عملیاتی و صحیح)

## تست و تأیید
- [x] بیلد بدون خطا (بک‌اند + فرانت‌اند)
- [ ] تست دستی CRUD نقش‌ها
- [ ] تست لاگین و دسترسی‌ها

</div>
