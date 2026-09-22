<div dir="rtl" align="right">

# گزارش طرح و بازرسی صفحه ناوگان جدید (Vehicle New Fleet Refactor Walkthrough)
* **سند طرح اجرایی:** [`Documents/Vehicle_New_Fleet_Refactor/implementation_plan_vehicle_refactor.md`](file:///e:/warehouse%20project/Documents/Vehicle_New_Fleet_Refactor/implementation_plan_vehicle_refactor.md)
* **سند فهرست تسک‌ها:** [`Documents/Vehicle_New_Fleet_Refactor/task_vehicle_refactor.md`](file:///e:/warehouse%20project/Documents/Vehicle_New_Fleet_Refactor/task_vehicle_refactor.md)
* **وضعیت:** ⏳ مرحله طراحی و تدوین برنامه جامع (آماده تایید کاربر جهت شروع فاز اجرایی)

---

## ۱. خلاصه اقدامات انجام‌شده در فاز بازرسی عمیق

در این مرحله و در راستای دستور کاربر، چت پیشین به شماره `77db11aa-0120-454d-ab20-37e8908ccdec` و کدهای صفحه پرسنل جدید (`employee-new-personnel`) به صورت بسیار عمیق مورد بازبینی و تحلیل قرار گرفتند. تمام دستاوردها و باگ‌های رفع‌شده در آن صفحه استخراج گردیده و با وضعیت فعلی صفحه ناوگان جدید (`employee-new-vehicle`) خط به خط مقایسه شدند.

### یافته‌های کلیدی ممیزی:
1. **فرم درون‌خطی دست‌وپاگیر:** فرم فعلی بیش از ۵۰۰ پیکسل ارتفاع دارد و کاربر برای دیدن لیست خودروها باید دائم اسکرول کند. این فرم باید به مودال شناور منتقل شود.
2. **فقدان مسیر ارسال به سرپرست:** رکوردهای ثبت‌شده مستقیماً در وضعیت `draft` متوقف می‌شوند و دکمه‌ای برای ارسال به کارتابل سرپرست ندارند.
3. **باگ فاجعه‌بار تنزل رتبه در بک‌اند:** در صورت تایید تغییرات یک خودروی فعال توسط مدیر، وضعیت تایید خودرو به دلیل نبود فیلتر روی فیلدهای `diff` به `pending_supervisor` بازمی‌گردد!
4. **حفره امنیتی قلمرو پروژه/بخش:** کاربران عادی می‌توانند خودروهای ثبت‌شده در پروژه‌های خارج از انتساب خود را مشاهده کنند.
5. **ریسک حذف فیزیکی (Cascade Delete):** متد حذف دیتابیسی باز است و ممکن است سوابق کارکرد ناوگان و اسناد تسویه را نیز حذف کند.

---

## ۲. جدول وضعیت فایل‌های تحت تاثیر و نیازمند تغییر

| ردیف | مسیر فایل | نوع تغییر | شرح وظیفه در فاز اجرا |
| :---: | :--- | :---: | :--- |
| **۱** | `warehouse-front/src/app/components/finance/employee/employee-new-vehicle/employee-new-vehicle.html` | تغییر اساسی | حذف فرم درون‌خطی، ایجاد هدر چسبان، افزودن مودال شناور و نمای کارتی موبایل |
| **۲** | `warehouse-front/src/app/components/finance/employee/employee-new-vehicle/employee-new-vehicle.ts` | تغییر اساسی | مدیریت استیت مودال، لاجیک دوگانه ذخیره/ارسال، وب‌سوکت، دی‌بانس جستجو و URL sync |
| **۳** | `warehouse-front/src/app/services/personnel-api.service.ts` | ارتقا | افزودن متدهای `updateVehicleProfile`، `importVehicleExcel` و دانلود تمپلیت |
| **۴** | `warehouse-backend/personnel/views.py` | ارتقای امنیتی | فیلتر `approval_status` در تایید تغییرات، اصلاح `get_queryset` بر اساس بخش و متد ایمن `destroy` |
| **۵** | `warehouse-front/src/app/components/finance/employee/employee-new-vehicle/employee-new-vehicle.spec.ts` | جدید / تست | آزمون‌های سریع کامپوننت و DOM در محیط Vitest و jsdom |

---

## ۳. وضعیت اجرای آزمون‌ها و شاخص‌های کیفی

> [!NOTE]
> در حال حاضر به دلیل عدم ورود به فاز دستکاری کد (بر اساس شرط صریح کاربر: *«فعلا کد ها را تغییر نده فقط طرح بنویس»*)، هیچ تغییری در فایل‌های سورس پروژه ایجاد نشده است. به محض دریافت دستور تایید از سوی کاربر، مراحل اجرایی طبق فازبندی سند تسک‌ها آغاز و نتایج تست‌ها در این بخش درج خواهد شد.

</div>
