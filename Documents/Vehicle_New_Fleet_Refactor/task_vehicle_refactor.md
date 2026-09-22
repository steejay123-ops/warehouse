<div dir="rtl" align="right">

# فهرست وظایف فازبندی‌شده بازطراحی و ارتقای ناوگان جدید (Vehicle New Fleet Refactor Task List)
* **سند تفصیلی طرح:** [`Documents/Vehicle_New_Fleet_Refactor/implementation_plan_vehicle_refactor.md`](file:///e:/warehouse%20project/Documents/Vehicle_New_Fleet_Refactor/implementation_plan_vehicle_refactor.md)
* **سند مرجع جامع:** [`Documents/plan_employee_new_vehicle_comprehensive.md`](file:///e:/warehouse%20project/Documents/plan_employee_new_vehicle_comprehensive.md)
* **وضعیت جاری:** ⏳ فاز برنامه‌ریزی و طراحی (در انتظار تایید نهایی کاربر - هیچ کدی تغییر نکرده است)

---

## فاز ۱: بازطراحی UI فرانت‌اند، هدر چسبان و انتقال فرم به مودال (Header & Modal Refactor)
- [ ] <!-- id: VNF.1.1 --> حذف فرم درون‌خطی ۵۰۰ پیکسلی از بالای جدول و جایگزینی با دکمه آیکونی «افزودن خودرو جدید» (`w-9 h-9`, آبی آسمانی) <!-- priority: High -->
- [ ] <!-- id: VNF.1.2 --> پیاده‌سازی هدر چسبان شیشه‌ای (`sticky top-0 z-30 bg-slate-50/95`) مطابق استاندارد `projects-and-sections` <!-- priority: High -->
- [ ] <!-- id: VNF.1.3 --> استقرار دکمه‌های آیکونی سه‌گانه هدر (اکسل سبز، ایمپورت ایندیگو، ریفرش اسلیت) با تولتیپ فارسی <!-- priority: High -->
- [ ] <!-- id: VNF.1.4 --> ساخت مودال شناور ثبت خودرو (`isNewVehicleModalOpen`) با انیمیشن ورود و پشتیبانی از Bottom Sheet در موبایل <!-- priority: High -->
- [ ] <!-- id: VNF.1.5 --> بازطراحی فیلد پلاک خودرو با فرمت گرافیکی ۴ قسمتی استاندارد ایران (ایران - ۳ رقم - حرف - ۲ رقم) <!-- priority: High -->
- [ ] <!-- id: VNF.1.6 --> اصلاح فیلد شماره شبا با پیش‌وند ثابت LTR (`IR`)، فونت مونو و اکشن کپی سریع <!-- priority: Medium -->
- [ ] <!-- id: VNF.1.7 --> اعمال فرمت‌بندی ۳ رقمی مبالغ کرایه/نرخ با حفظ موقعیت کرسر و برچسب تومان/ریال <!-- priority: Medium -->

## فاز ۲: چرخه کارتابل، گردش کار بازنگری و امکان ویرایش رکوردهای مصوب (Workflow & Approval)
- [ ] <!-- id: VNF.2.1 --> افزودن دو دکمه در مودال: «ذخیره به عنوان پیش‌نویس» (`draft`) و «ارسال به سرپرست» (`pending_supervisor`) <!-- priority: High -->
- [ ] <!-- id: VNF.2.2 --> تعبیه دکمه موشک در ستون عملیات جدول برای ارسال فوری رکوردهای پیش‌نویس به سرپرست <!-- priority: High -->
- [ ] <!-- id: VNF.2.3 --> باز کردن قفل ویرایش رکوردهای مصوب از طریق ثبت درخواست تغییرات (`VehicleChangeRequest`) با ثبت علت <!-- priority: High -->
- [ ] <!-- id: VNF.2.4 --> افزودن تب‌های «عودت جهت اصلاح» و «رد شده» به نوار وضعیت‌ها با شمارنده‌های عددی پویا <!-- priority: High -->
- [ ] <!-- id: VNF.2.5 --> نمایش بنر هشدار زردرنگ دلیل عودت سرپرست/مدیر به همراه امکان ارسال مجدد پس از اصلاح <!-- priority: High -->
- [ ] <!-- id: VNF.2.6 --> همگام‌سازی فیلتر تب فعال و جستجو با پارامترهای آدرس مرورگر (URL Query Params) <!-- priority: Medium -->

## فاز ۳: ایمن‌سازی امنیتی و رفع باگ تنزل رتبه در بک‌اند (Backend Security & Logic)
- [ ] <!-- id: VNF.3.1 --> **رفع باگ حیاتی تنزل رتبه (`views.py:1040-1050`):** فیلتر کردن `approval_status` و کلیدهای خارجی از متد تایید تغییرات مدیر <!-- priority: Critical -->
- [ ] <!-- id: VNF.3.2 --> اعمال فیلتر قلمرو بخش‌ها (`UserSectionAssignment`) در متد `get_queryset` و `perform_create` در بک‌اند <!-- priority: High -->
- [ ] <!-- id: VNF.3.3 --> بازنویسی متد `destroy` در `VehicleDriverProfileViewSet` جهت جلوگیری از حذف فیزیکی رکوردهای دارای لاگ تردد <!-- priority: High -->
- [ ] <!-- id: VNF.3.4 --> پیاده‌سازی متد ارسال رویداد وب‌سوکت (`broadcast_vehicle_update`) در لایه بک‌اند <!-- priority: High -->
- [ ] <!-- id: VNF.3.5 --> تکمیل متدهای وب‌سرویس در `PersonnelApiService` (شامل `updateVehicleProfile` و `importVehicleExcel`) <!-- priority: High -->

## فاز ۴: ورود اکسل، وب‌سوکت و ارگونومی داده‌ها (Excel & Real-time Integration)
- [ ] <!-- id: VNF.4.1 --> ساخت مودال ورود فایل اکسل مشخصات ناوگان با نگاشت ستون‌ها و اعتبارسنجی پلاک‌ها <!-- priority: Medium -->
- [ ] <!-- id: VNF.4.2 --> ایجاد اندپوینت `import_excel` در بک‌اند با پشتیبانی از تراکنش اتمیک و مدیریت خطاها <!-- priority: Medium -->
- [ ] <!-- id: VNF.4.3 --> اتصال فرانت‌اند به وب‌سوکت جهت بروزرسانی لحظه‌ای وضعیت خودروها بدون رفرش صفحه <!-- priority: Medium -->
- [ ] <!-- id: VNF.4.4 --> پیاده‌سازی تاخیر زمانی ۳۰۰ میلی‌ثانیه (`debounceTime(300)`) در جستجوی جدول <!-- priority: Medium -->
- [ ] <!-- id: VNF.4.5 --> تفکیک هویت مالک و راننده در فرم با چک‌باکس «مالک شخص راننده است» <!-- priority: Low -->

## فاز ۵: نمای موبایل، آزمون‌های سریع DOM و راستی‌آزمایی کیفیت (Mobile & Testing)
- [ ] <!-- id: VNF.5.1 --> طراحی و استقرار کارت‌های ارگونومیک لمسی در نمای موبایل (بدون اسکرول افقی) <!-- priority: High -->
- [ ] <!-- id: VNF.5.2 --> نگارش حداقل ۱۰ آزمون سریع DOM و کامپوننت با Vitest و jsdom در `employee-new-vehicle.spec.ts` <!-- priority: High -->
- [ ] <!-- id: VNF.5.3 --> اجرای تست‌های بک‌اند Django جهت اعتبارسنجی چرخه کامل حیات ناوگان <!-- priority: High -->
- [ ] <!-- id: VNF.5.4 --> اعتبارسنجی بیلد فرانت‌اند با دستور `npx tsc --noEmit` جهت تضمین صفر خطا <!-- priority: High -->
- [ ] <!-- id: VNF.5.5 --> ثبت گزارش نهایی در `walkthrough_vehicle_refactor.md` طبق استاندارد DUAL-SAVE <!-- priority: Medium -->

</div>
