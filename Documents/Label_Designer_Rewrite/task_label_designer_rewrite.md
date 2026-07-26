<div dir="rtl" align="right">

# وظایف بازنویسی طراح لیبل — فاز ۱

## کامپوننت ۱: مدل بکند (Django)
- [ ] افزودن مدل `LabelTemplate` به `warehouses/models.py`
- [ ] ساخت و اجرای Migration
- [ ] ایجاد `label_serializers.py`
- [ ] ایجاد `label_views.py` با APIهای CRUD + تولید PDF
- [ ] ثبت URLs در `warehouses/urls.py`

## کامپوننت ۲: سرویس فرانت‌اند
- [ ] ایجاد `label-api.service.ts`

## کامپوننت ۳: بازنویسی کامپوننت LabelDesigner (قلب)
- [ ] بازنویسی `label-designer.ts` — State + Drag & Drop logic
- [ ] بازنویسی `label-designer.html` — بوم طراحی + پنل فیلدها
- [ ] بازنویسی `label-designer.css` — استایل‌های Canvas

## کامپوننت ۴: اتصال به Dispatch
- [ ] بازنویسی `executeBatchLabelPrint()` در `dispatch.ts`
- [ ] افزودن Modal چاپ در `dispatch.html`

## کامپوننت ۵: اتصال به تنظیمات
- [ ] ارسال `warehouseId` در `wh-settings.html`
- [ ] ارسال `null` در `settings.html`

## کامپوننت ۶: تولید PDF
- [ ] ایجاد `label_pdf_generator.py`
- [ ] نصب `reportlab` و `qrcode` در venv

## تأیید نهایی
- [ ] تست ساخت تمپلیت و ذخیره در بکند
- [ ] تست Drag & Drop روی بوم
- [ ] تست چاپ PDF از Dispatch
- [ ] بررسی QR Code قابل اسکن

</div>
