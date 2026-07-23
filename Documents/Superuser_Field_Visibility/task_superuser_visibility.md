<div dir="rtl" align="right">

# Task: Superuser Field Visibility

- `[x]` **فاز ۱: تغییرات Backend (serializers.py)**
  - `[x]` اضافه کردن چک کردن سطح دسترسی کاربر درخواست‌دهنده (`request.user`) در متد `create` کلاس `UserSerializer`.
  - `[x]` اضافه کردن چک کردن سطح دسترسی کاربر درخواست‌دهنده در متد `update` کلاس `UserSerializer`.

- `[x]` **فاز ۲: تغییرات Frontend (users.ts)**
  - `[x]` افزودن متغیر `is_superuser` به `userForm`.
  - `[x]` مقداردهی اولیه این فیلد در تابع `openUserModal` بر اساس وضعیت فعلی کاربر.

- `[x]` **فاز ۳: تغییرات Frontend (users.html)**
  - `[x]` ایجاد المان HTML سوییچ برای فعال/غیرفعال کردن `is_superuser`.
  - `[x]` محصور کردن المان با `*ngIf="state.appState.user.is_superuser || state.appState.user.roles.includes('admin')"` برای کنترل رویت‌پذیری.

- `[x]` **فاز ۴: تست و تایید تغییرات**

</div>
