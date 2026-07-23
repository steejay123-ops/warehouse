<div dir="rtl" align="right">

# لیست وظایف (Task List): مهاجرت موجودی سیستم به `bal4miv`

- [x] **بخش فرانت‌اند (Counter Dashboard)**
  - حذف فیلد `bal4miv` از لیست شبکه‌ای مشخصات دائمی کالا.
  - جایگزینی فیلد `balance` با `bal4miv` در بخش نمایش موجودی سیستمی (اعمال شرط `is_blind` روی `bal4miv`).

- [x] **بخش فرانت‌اند (Manager Review)**
  - تغییر منطق تابع `isMatched` در فایل `manager-review.ts` جهت مقایسه مقدار شمرده شده با `bal4miv`.
  - تغییر فیلدهای نمایشی در HTML تا `bal4miv` را به عنوان موجودی سیستمی نشان دهند.

- [x] **بخش بک‌اند (Django Views)**
  - تغییر منطق تشخیص مغایرت (`has_conflict`) در `views.py` (`bulk_manager_approve`) تا با `bal4miv` مقایسه انجام شود.
  - حفظ منطق ذخیره‌سازی که روی فیلد `balance` می‌نویسد (بدون تغییر).

- [x] **بررسی کامپایل و تست**
  - اجرای Type Check در انگولار.
  - ثبت تغییرات در `walkthrough.md`.

</div>
