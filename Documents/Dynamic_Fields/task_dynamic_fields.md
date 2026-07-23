<div dir="rtl" align="right">

# چک‌لیست تسک‌ها: فیلدهای پویا (Dynamic Fields)

## بک‌اند (Backend)
- `[x]` ایجاد مدل `ItemFieldDefinition` در `models.py` (Item Model Update)
- `[x]` اضافه کردن فیلد `dynamic_data = models.JSONField()` به مدل `Item` (JSON Field Setup)
- `[x]` اجرای `makemigrations` و `migrate` دیتابیس (Database Migration)
- `[x]` ایجاد `DynamicFieldDefinitionSerializer` (Serializer Creation)
- `[x]` به‌روزرسانی `ItemSerializer` برای خواندن/نوشتن دیتای پویا (Item Serializer Update)
- `[x]` ایجاد `DynamicFieldDefinitionViewSet` (ViewSet Setup)
- `[x]` ثبت روت در `urls.py` (API Routing)

## فرانت‌اند (Frontend)
- `[x]` تعریف اینترفیس `DynamicFieldDefinition` در `models` (TypeScript Interface)
- `[x]` ایجاد سرویس `DynamicFieldApiService` برای ارتباط با بک‌اند (API Service)
- `[x]` ساخت کامپوننت لیست و مدیریت فیلدهای پویا در بخش تنظیمات (Settings UI - `app-dynamic-fields`)
- `[x]` پیاده‌سازی متد خواندن فیلدها و رندر داینامیک ورودی‌ها در کارتابل تخصیص (Dispatch Modal)
- `[x]` ارسال دیتای پویا در آبجکت فرم به سرور در هنگام ذخیره کالا (`saveDynamicFields`)

## اعتبارسنجی (Verification)
- `[x]` بررسی عدم وجود خطای کامپایل (Compilation Check)
- `[ ]` تست دستی فرآیند به صورت end-to-end (توسط کاربر)

</div>
