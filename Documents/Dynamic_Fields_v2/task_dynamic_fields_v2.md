<div dir="rtl" align="right">

# چک‌لیست تسک‌ها: فیلدهای پویا نسخه ۲ و اصلاح انبار

## 1. اصلاح کانتکست انبار (Frontend)
- `[x]` پنهان کردن کامپوننت `app-warehouse-selector` در صورت حضور در کانتکست انبار در `counter-dashboard.html`
- `[x]` پنهان کردن کامپوننت `app-warehouse-selector` در `supervisor-dashboard.html`
- `[x]` پنهان کردن کامپوننت `app-warehouse-selector` در `manager-review.html`

## 2. ارتقای مدل فیلدهای پویا (Backend)
- `[x]` ویرایش مدل `ItemFieldDefinition` در `inventory/models.py` (افزودن `default_value`)
- `[x]` ویرایش `DynamicFieldDefinitionSerializer` در `inventory/serializers.py`
- `[x]` ویرایش `DynamicFieldDefinitionViewSet` در `inventory/views.py` (افزودن لاجیک تغییر نام کلید در دیتای پویا کالاها)
- `[x]` ساخت و اعمال مایگریشن (`makemigrations` و `migrate`)

## 3. ارتقای فرم و رابط کاربری (Frontend)
- `[x]` افزودن `default_value` به `dynamic-field.model.ts`
- `[x]` ویرایش `dynamic-fields.html` برای نمایش فرم افزودن/ویرایش و گرفتن مقدار پیش‌فرض
- `[x]` پیاده‌سازی لاجیک ویرایش و ارتباط با API در `dynamic-fields.ts`

## 4. تست و اعتبارسنجی
- `[ ]` اطمینان از عدم وجود خطای کامپایل بک‌اند و فرانت‌اند

</div>
