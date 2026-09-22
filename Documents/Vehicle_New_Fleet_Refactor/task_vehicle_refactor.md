<div dir="rtl" align="right">

# فهرست وظایف فازبندی‌شده بازطراحی و ارتقای ناوگان جدید (Vehicle New Fleet Refactor Task List)
* **سند تفصیلی طرح:** [`Documents/Vehicle_New_Fleet_Refactor/implementation_plan_vehicle_refactor.md`](file:///e:/warehouse%20project/Documents/Vehicle_New_Fleet_Refactor/implementation_plan_vehicle_refactor.md)
* **گزارش ارزیابی نهایی:** [`Documents/Vehicle_New_Fleet_Refactor/walkthrough_vehicle_refactor.md`](file:///e:/warehouse%20project/Documents/Vehicle_New_Fleet_Refactor/walkthrough_vehicle_refactor.md)
* **وضعیت جاری:** ✅ اجرای صددرصد و راستی‌آزمایی کامل (تمام تست‌های بک‌اند و فرانت‌اند با موفقیت پاس شدند)

---

## فاز ۱: بازطراحی UI فرانت‌اند، هدر چسبان و انتقال فرم به مودال (Header & Modal Refactor)
- [x] <!-- id: VNF.1.1 --> حذف فرم درون‌خطی ۵۰۰ پیکسلی از بالای جدول و جایگزینی با دکمه آیکونی «افزودن خودرو جدید» (`w-9 h-9`, ایندیگو/آبی) <!-- priority: High -->
- [x] <!-- id: VNF.1.2 --> پیاده‌سازی هدر چسبان شیشه‌ای (`sticky top-0 z-30 bg-slate-50/95`) مطابق استاندارد `projects-and-sections` <!-- priority: High -->
- [x] <!-- id: VNF.1.3 --> استقرار دکمه‌های آیکونی استاندارد هدر (اکسل سبز، ایمپورت ایندیگو، ریفرش اسلیت، ثبت خودرو جدید) با تولتیپ فارسی <!-- priority: High -->
- [x] <!-- id: VNF.1.4 --> ساخت مودال شناور ثبت/ویرایش خودرو (`isNewVehicleModalOpen`) با انیمیشن ورود و پشتیبانی کامل از کلید Escape <!-- priority: High -->
- [x] <!-- id: VNF.1.5 --> بازطراحی فیلد پلاک خودرو با فرمت گرافیکی ۴ قسمتی استاندارد ایران (ایران - ۳ رقم - حرف - ۲ رقم) همراه با پیش‌نمایش گرافیکی پلاک ملی <!-- priority: High -->
- [x] <!-- id: VNF.1.6 --> اصلاح فیلد شماره شبا با پیش‌وند ثابت LTR (`IR`)، فونت مونو، تشخیص خودکار بانک و اکشن کپی سریع <!-- priority: Medium -->
- [x] <!-- id: VNF.1.7 --> اعمال فرمت‌بندی ۳ رقمی مبالغ کرایه/نرخ با حفظ موقعیت کرسر و محاسبه زنده معادل تومان <!-- priority: Medium -->

## فاز ۲: چرخه کارتابل، گردش کار بازنگری و امکان ویرایش رکوردهای مصوب (Workflow & Approval)
- [x] <!-- id: VNF.2.1 --> افزودن دو دکمه در مودال: «ذخیره به عنوان پیش‌نویس» (`draft`) و «ارسال به سرپرست» (`pending_supervisor`) <!-- priority: High -->
- [x] <!-- id: VNF.2.2 --> تعبیه دکمه موشک در ستون عملیات جدول برای ارسال فوری رکوردهای پیش‌نویس به سرپرست <!-- priority: High -->
- [x] <!-- id: VNF.2.3 --> باز کردن قفل ویرایش رکوردهای مصوب از طریق ثبت درخواست تغییرات (`VehicleChangeRequest`) با بنر هشدار زردرنگ <!-- priority: High -->
- [x] <!-- id: VNF.2.4 --> افزودن تب‌های «عودت جهت اصلاح» و «رد شده» به نوار وضعیت‌ها با شمارنده‌های عددی پویا <!-- priority: High -->
- [x] <!-- id: VNF.2.5 --> نمایش بنر هشدار نارنجی دلیل عودت سرپرست/مدیر به همراه امکان اصلاح و ارسال مجدد <!-- priority: High -->
- [x] <!-- id: VNF.2.6 --> همگام‌سازی فیلتر تب فعال و جستجو با پارامترهای آدرس مرورگر (URL Query Params) <!-- priority: Medium -->

## فاز ۳: ایمن‌سازی امنیتی و رفع باگ تنزل رتبه در بک‌اند (Backend Security & Logic)
- [x] <!-- id: VNF.3.1 --> **رفع باگ حیاتی تنزل رتبه (`views.py`):** فیلتر کردن `approval_status` و کلیدهای ساختاری از متد تایید تغییرات مدیر با `excluded_fields` <!-- priority: Critical -->
- [x] <!-- id: VNF.3.2 --> اعمال فیلتر قلمرو بخش‌ها (`UserSectionAssignment`) در متد `get_queryset` و `perform_create` در بک‌اند <!-- priority: High -->
- [x] <!-- id: VNF.3.3 --> بازنویسی متد `destroy` در `VehicleDriverProfileViewSet` جهت جلوگیری از حذف فیزیکی رکوردهای دارای لاگ تردد <!-- priority: High -->
- [x] <!-- id: VNF.3.4 --> پیاده‌سازی متد ارسال رویداد وب‌سوکت (`broadcast_vehicle_update`) در لایه بک‌اند روی کلیه اکشن‌های کارتابل <!-- priority: High -->
- [x] <!-- id: VNF.3.5 --> تکمیل متدهای وب‌سرویس در `PersonnelApiService` (شامل `downloadVehicleTemplate`، `importVehicleExcel` و `importVehicleExcelModal`) <!-- priority: High -->

## فاز ۴: ورود اکسل، وب‌سوکت و ارگونومی داده‌ها (Excel & Real-time Integration)
- [x] <!-- id: VNF.4.1 --> اتصال کامپوننت مودال استاندارد ورود فایل اکسل مشخصات ناوگان (`app-excel-import-modal`) با پشتیبانی از dry-run <!-- priority: Medium -->
- [x] <!-- id: VNF.4.2 --> ایجاد اندپوینت‌های `import-excel` و `download-template` در بک‌اند بر اساس پلاک خودرو و هدر ۲ ردیفه رسمی <!-- priority: Medium -->
- [x] <!-- id: VNF.4.3 --> اتصال فرانت‌اند به وب‌سوکت جهت بروزرسانی لحظه‌ای وضعیت خودروها بدون رفرش صفحه <!-- priority: Medium -->
- [x] <!-- id: VNF.4.4 --> پیاده‌سازی تاخیر زمانی ۳۰۰ میلی‌ثانیه (`debounceTime(300)`) در جستجوی جدول <!-- priority: Medium -->
- [x] <!-- id: VNF.4.5 --> تفکیک هوشمند نام بانک و شماره حساب از ساختار شبا در فرم ثبت و ویرایش <!-- priority: Low -->

## فاز ۵: نمای موبایل، آزمون‌های سریع DOM و راستی‌آزمایی کیفیت (Mobile & Testing)
- [x] <!-- id: VNF.5.1 --> طراحی و استقرار کارت‌های ارگونومیک لمسی در نمای موبایل (`md:hidden`) بدون اسکرول افقی <!-- priority: High -->
- [x] <!-- id: VNF.5.2 --> نگارش و اجرای ۲۳ آزمون جامع DOM و کامپوننت با Vitest و jsdom در `employee-new-vehicle.spec.ts` (۱۰۰٪ قبولی) <!-- priority: High -->
- [x] <!-- id: VNF.5.3 --> اجرای تست‌های بک‌اند Django در `tests_vehicle_cycle.py` (۶ تست از ۶ تست کاملاً موفق) <!-- priority: High -->
- [x] <!-- id: VNF.5.4 --> اعتبارسنجی کامل بیلد فرانت‌اند با دستور `npx tsc --noEmit` با خروجی صفر خطا <!-- priority: High -->
- [x] <!-- id: VNF.5.5 --> ثبت گزارش نهایی در `walkthrough_vehicle_refactor.md` طبق استاندارد DUAL-SAVE <!-- priority: Medium -->

</div>
