<div dir="rtl" align="right">

# لیست وظایف: مدیریت حذف موجودیت‌ها

- `[x]` **فاز اول: پیاده‌سازی سیستم تحلیلگر اثرات در بک‌اند (Backend Analytics)**
  - `[x]` ایجاد فایل یا کلاس `DeleteImpactMixin` (مثلاً در `common/views.py` یا `common/mixins.py`).
  - `[x]` پیاده‌سازی متد `delete_impact` با استفاده از `django.db.models.deletion.Collector`.
  - `[x]` افزودن متد به ViewSet انبار (`WarehouseViewSet`).
  - `[x]` افزودن متد به ViewSet کاربر (`UserViewSet`).
  - `[x]` افزودن متد به ViewSet کالا (`ItemViewSet`).
- `[x]` **فاز دوم: ایمن‌سازی متدهای حذف فیزیکی (Backend Destructive Actions)**
  - `[x]` اصلاح متد `destroy` در `WarehouseViewSet`.
  - `[x]` اصلاح متد `destroy` در `UserViewSet`.
  - `[x]` اصلاح متد `destroy` در `ItemViewSet`.
- `[x]` **فاز سوم: توسعه کامپوننت هوشمند فرانت‌اند (Frontend Modal Component)**
  - `[x]` ایجاد ساختار اولیه کامپوننت `app-smart-delete-modal`.
  - `[x]` طراحی تب‌های غیرفعال‌سازی (Soft-Delete) و حذف فیزیکی (Hard-Delete).
  - `[x]` اتصال به API جدید `delete_impact` برای نمایش جدول اثرات مخرب.
  - `[x]` پیاده‌سازی منطق تاخیر (Delay) ۳ ثانیه‌ای برای دکمه حذف فیزیکی.
  - `[x]` پیاده‌سازی تاییدیه متنی مضاعف (تایپ کلمه "حذف").
- `[ ]` **فاز چهارم: جایگزینی در صفحات و تست یکپارچگی (Frontend Integration)**
  - `[ ]` جایگزینی در تب انبارها.
  - `[ ]` جایگزینی در تب کاربران.
  - `[ ]` جایگزینی در تب کالاها.
  - `[ ]` بررسی و تست صحت کارکرد.

</div>
