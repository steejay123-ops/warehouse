<div dir="rtl" align="right">

# لیست وظایف رفع ۴ باگ ماژول انبارگردانی

## ۱. اصلاح فیلترینگ انبار
- `[x]` جایگزینی `selectedProject?.id` با `activeWarehouseId` در `counter-dashboard.ts`
- `[x]` جایگزینی در `supervisor-dashboard.ts`
- `[x]` جایگزینی در `manager-review.ts`
- `[x]` جایگزینی در `count-tracking.ts`

## ۲. دیالوگ تخصیص
- `[x]` ویرایش فایل `dispatch.ts`: اصلاح شرط جستجوی `u.id` بجای `username`
- `[x]` ویرایش فایل `dispatch.ts`: حذف تگ‌های HTML از متغیر message در دیالوگ

## ۳. پیگیری وضعیت
- `[x]` ویرایش فایل `count-tracking.html`: اضافه کردن `[visibleColumns]="visibleCols"`

## ۴. ارسال انتخابی
- `[x]` ویرایش فایل `counter-dashboard.ts`: افزودن متد `onSelectionChange`
- `[x]` ویرایش فایل `supervisor-dashboard.ts`: افزودن متد `onSelectionChange`
- `[x]` ویرایش فایل `manager-review.ts`: افزودن متد `onSelectionChange`

## بررسی نهایی
- `[x]` اطمینان از صحت کدها بدون ارور تایپ‌اسکریپت
- `[x]` ایجاد Walkthrough

</div>
