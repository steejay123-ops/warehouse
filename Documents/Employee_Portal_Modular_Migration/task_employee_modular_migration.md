<div dir="rtl" align="right">

# فهرست وظایف فازبندی‌شده انتقال ماژولار کارکرد و ناوگان به منوی کارمند
## (Employee Portal Modular Migration Task Checklist)

---

- [x] <!-- id: task_emp_mig_p1 --> **فاز ۱: استقرار کامل موتور کارکرد پرسنل در صفحه `employee-attendance`**
  - [x] <!-- id: task_emp_mig_p1_1 --> انتقال متغیرها و محاسبات حضور و غیاب ماتریسی روزانه (`attendanceRows`, `onStatusChange`, `saveAttendanceMatrix`)
  - [x] <!-- id: task_emp_mig_p1_2 --> انتقال جدول تقویم ۳۱ روزه ماهانه کارکرد پرسنل (`monthlyGridRows`, `loadMonthlyGrid`)
  - [x] <!-- id: task_emp_mig_p1_3 --> کپی مودال ویرایش جزییات روز پرسنل (`isDayDetailModalOpen`) همراه با ساعات موثر و مرخصی
  - [x] <!-- id: task_emp_mig_p1_4 --> کپی مودال اعمال دسته‌ای ساعات (`isBulkHoursModalOpen`) با گزینه‌های ۱۰ ساعت حاضر و ۵ ساعت نیمه‌وقت
  - [x] <!-- id: task_emp_mig_p1_5 --> کپی مودال اعمال بازه تاریخی ماهانه (`isRangeModalOpen`) با امکان حذف روزهای جمعه
  - [x] <!-- id: task_emp_mig_p1_6 --> اتصال پیست هوشمند اکسل پرسنل و مچینگ کد ملی بر اساس پرسنل مجاز بخش
  - [x] <!-- id: task_emp_mig_p1_7 --> انتقال پنجره پیش‌نمایش چاپی تایم‌شیت استاندارد پرسنل با عنوان رسمی بخش کارگاه
  - [x] <!-- id: task_emp_mig_p1_8 --> اتصال زنده تغییرات از طریق وب‌سوکت (`WebSocketService`) و مدیریت تداخل‌های همزمان
  - [x] <!-- id: task_emp_mig_p1_9 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G1 (فیلتر اجباری `section_id` پرسنل)

- [x] <!-- id: task_emp_mig_p2 --> **فاز ۲: استقرار کامل موتور تردد و کارکرد ناوگان در صفحه `employee-fleet`**
  - [x] <!-- id: task_emp_mig_p2_1 --> انتقال ماتریس روزانه ثبت سرویس‌های ناوگان (`vehicleRows`, `loadVehicleMatrix`, `saveVehicleMatrix`)
  - [x] <!-- id: task_emp_mig_p2_2 --> انتقال جدول تقویم ۳۱ روزه کارکرد و سرویس‌های ماهانه ماشین‌آلات (`fleetMonthlyGridRows`)
  - [x] <!-- id: task_emp_mig_p2_3 --> کپی مودال جزییات سرویس روز خودرو (`isFleetDayDetailModalOpen`) شامل تعداد سرویس، نرخ، حواله و مبدا-مقصد
  - [x] <!-- id: task_emp_mig_p2_4 --> اتصال پیست هوشمند اکسل کارکرد ناوگان (`isFleetExcelPasteModalOpen`)
  - [x] <!-- id: task_emp_mig_p2_5 --> کپی فرم و قالب چاپی خلاصه کارکرد ماهانه ماشین‌آلات بخش (`isFleetPrintModalOpen`)
  - [x] <!-- id: task_emp_mig_p2_6 --> کپی تاریخچه و لاگ ممیزی تردد ناوگان (`isFleetAuditLogsModalOpen`)
  - [x] <!-- id: task_emp_mig_p2_7 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G1 (فیلتر اجباری `section_id` ماشین‌آلات)

- [x] <!-- id: task_emp_mig_p3 --> **فاز ۳: استقرار کارتابل و فرم ثبت فاکتور هزینه در صفحه `employee-invoices`**
  - [x] <!-- id: task_emp_mig_p3_1 --> پیاده‌سازی جدول کارتابل فاکتورهای ثبت‌شده با برچسب‌های وضعیت (`پیش‌نویس`، `تایید مدیر`، `پرداخت‌شده`)
  - [x] <!-- id: task_emp_mig_p3_2 --> ساخت فرم استاندارد ثبت فاکتور هزینه (شماره فاکتور، تاریخ شمسی، مبلغ ریالی، دسته‌بندی هزینه، آپلود تصویر پیوست)
  - [x] <!-- id: task_emp_mig_p3_3 --> پیاده‌سازی مودال تعریف سریع طرف‌حساب جدید (`QuickCounterpartyModal`) با فیلدهای شماره تماس، کد ملی/شناسه و شبا
  - [x] <!-- id: task_emp_mig_p3_4 --> قفل خودکار و تضمین ذخیره فاکتورهای جدید کارمند در وضعیت `status = 'draft'`
  - [x] <!-- id: task_emp_mig_p3_5 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G2 (تحمیل وضعیت پیش‌نویس برای فاکتورها)

- [x] <!-- id: task_emp_mig_p4 --> **فاز ۴: استقرار فرم تعریف خودرو جدید در صفحه `employee-new-vehicle`**
  - [x] <!-- id: task_emp_mig_p4_1 --> پیاده‌سازی فرم استاندارد مشخصات خودرو (پلاک ملی، نوع خودرو، نوع مالکیت، نام راننده، شماره همراه)
  - [x] <!-- id: task_emp_mig_p4_2 --> اتصال موتور اعتبارسنجی آنلاین شبا (`validateSheba`) و دیکشنری بانک‌های ایران (`IRANIAN_BANKS`)
  - [x] <!-- id: task_emp_mig_p4_3 --> نمایش جدول خودروهای اخیراً ثبت‌شده توسط کارمند به همراه برچسب وضعیت تایید
  - [x] <!-- id: task_emp_mig_p4_4 --> قفل فیلد بخش روی بخش فعال و ذخیره قطعی با وضعیت `approval_status = 'draft'`
  - [x] <!-- id: task_emp_mig_p4_5 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G2 (تحمیل وضعیت پیش‌نویس برای خودروها)

- [x] <!-- id: task_emp_mig_p5 --> **فاز ۵: استقرار فرم تعریف پرسنل جدید در صفحه `employee-new-personnel`**
  - [x] <!-- id: task_emp_mig_p5_1 --> پیاده‌سازی فرم مشخصات پرسنل (نام و نام خانوادگی، کد ملی، شماره موبایل، سمت شغلی، شماره حساب و شبا)
  - [x] <!-- id: task_emp_mig_p5_2 --> اتصال اعتبارسنجی الگوریتم کد ملی ۱۰ رقمی و فرمت شبا
  - [x] <!-- id: task_emp_mig_p5_3 --> نمایش جدول نیروهای جدید معرفی‌شده در بخش جاری با وضعیت تایید مدیر
  - [x] <!-- id: task_emp_mig_p5_4 --> انتساب خودکار پرسنل به بخش فعال و ذخیره با وضعیت `is_active = False` یا `draft`
  - [x] <!-- id: task_emp_mig_p5_5 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G2 (تحمیل وضعیت پیش‌نویس برای پرسنل)

- [x] <!-- id: task_emp_mig_p6 --> **فاز ۶: اعتبارسنجی جامع کیفیت، تست بیلد و راستی‌آزمایی نهایی**
  - [x] <!-- id: task_emp_mig_p6_1 --> اجرای تست سوئیت ایجنت‌های نگهبان سخت‌گیر (`section_guardian.py`)
  - [x] <!-- id: task_emp_mig_p6_2 --> بررسی و تایید بدون خطای تایپ‌اسکریپت (`npx tsc --noEmit`)
  - [x] <!-- id: task_emp_mig_p6_3 --> ارزیابی نهایی بیلد باندل‌های پروداکشن انگولار (`npx ng build`)
  - [x] <!-- id: task_emp_mig_p6_4 --> تهیه و ثبت مستندات Walkthrough پایان فاز و گزارش تفصیلی به کاربر

- [x] <!-- id: task_emp_mig_p7 --> **فاز ۷: ماژول تخصصی مدیریت تنخواه‌گردان کارمند (`employee-petty-cash`)**
  - [x] <!-- id: task_emp_mig_p7_1 --> پیاده‌سازی مدل‌های دیتابیس `PettyCashAccount` و `PettyCashTransaction` با مایگریشن رسمی (`0007_pettycashaccount_pettycashtransaction.py`)
  - [x] <!-- id: task_emp_mig_p7_2 --> پیاده‌سازی سریالایزرها و ویوست‌ها با اکشن‌های زنده مانده‌گیری (`my_balance`) و درخواست شارژ مجدد (`request_replenishment`)
  - [x] <!-- id: task_emp_mig_p7_3 --> ایجاد کامپوننت مستقل `EmployeePettyCashHubComponent` مجهز به هدر استیکی فرماندهی یکپارچه و کارت‌های KPI مانده نقد و نوار سقف اعتبار
  - [x] <!-- id: task_emp_mig_p7_4 --> فرم مودال ثبت هزینه تنخواه، مودال درخواست شارژ مجدد، پیوست مدارک و تعریف سریع طرف‌حساب
  - [x] <!-- id: task_emp_mig_p7_5 --> ثبت روت اختصاصی `employee-petty-cash` در `accounting.routes.ts` و آیتم منوی `EMPLOYEE_NAV_ITEMS` در `nav-items.ts`
  - [x] <!-- id: task_emp_mig_p7_6 --> نگارش ۱۶ تست واحد جامع Vitest و پاس شدن ۱۰۰٪ تست‌های کل ماژول‌های کارمند (۱۱۸ تست)

</div>
