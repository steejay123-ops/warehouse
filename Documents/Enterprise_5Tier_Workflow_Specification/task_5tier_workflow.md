<div dir="rtl" align="right">

# چک‌لیست تسک‌های اجرایی گردش کار ۵ سطحی سازمانی (Enterprise 5-Tier Workflow)

## فاز ۱: پایگاه داده، فیلدها و ماشین حالت ۵ سطحی بک‌اند
- [x] مدل‌های پرسنل (`PersonnelProfile`): افزودن فیلدهای ۵ سطحی تایید (`supervisor_approved_by/at`, `accountant_approved_by/at`, `manager_approved_by/at`, `treasury_paid_by/at`, `auto_passed`, `payment_tracking_code`, `payment_method`, `rejection_reason`) <!-- id: 101 -->
- [x] مدل‌های ناوگان (`VehicleDriverProfile`): افزودن فیلدهای ۵ سطحی تایید و تسویه <!-- id: 102 -->
- [x] مدل‌های درخواست تغییرات (`PersonnelChangeRequest` & `VehicleChangeRequest`): ارتقا به وضعیت‌های ۵ مرحله‌ای (`pending_supervisor`, `pending_accountant`, `pending_manager`, `approved`, `rejected`, `revision_required`) <!-- id: 103 -->
- [x] مدل‌های دوره‌های ماهانه و کارکرد (`MonthlyWorkPeriod`, `DailyAttendance`, `VehicleTripLog`, `MonthlyPayrollRecord`): افزودن فیلدهای وضعیت مالی `ready_to_pay` و `paid` و متادیتای پرداخت <!-- id: 104 -->
- [x] پیاده‌سازی سرویس متمرکز ماشین حالت و عبور خودکار اتمیک (`personnel/workflow_engine.py`): شامل متدهای `advance_workflow_step`, `request_workflow_revision`, `reject_workflow`, `process_auto_pass` با قفل سطری `select_for_update()` درون `transaction.atomic()` <!-- id: 105 -->
- [x] ارتقا و هماهنگ‌سازی ایجنت‌های نگهبان تاییدیه (`phase_guardian_approval.py`): پوشش کامل نگهبان ۱ تا ۷ برای اعتبارسنجی ۱۰۰٪ مدل‌ها، مایگریشن و تراکنش‌های همروند <!-- id: 106 -->
- [x] ایجاد و اجرای مهاجرت پایگاه داده جنگو (`makemigrations` و `migrate`) با استراتژی حفظ رکوردهای فعال قبلی <!-- id: 107 -->
- [x] اجرای سوئیت تست خودکار جامع فاز ۱ و تایید سبز ۱۰۰٪ با ایجنت‌های نگهبان <!-- id: 108 -->

## فاز ۲: موتور خزانه‌داری، دیسکت‌های پایا و تسویه اتمیک
- [x] توسعه سرویس خزانه‌داری (`personnel/treasury_engine.py`) جهت مدیریت تسویه‌های تکی و گروهی <!-- id: 201 -->
- [x] پیاده‌سازی تولید دیسکت‌های استاندارد واریز پایا و ساتنا در `treasury_engine.py` با کدگذاری UTF-8 BOM <!-- id: 202 -->
- [x] پیاده‌سازی مکانیسم تسویه تفکیکی (`Isolated Settlement`) در صورت بروز خطای شبا بدون انسداد کل دسته <!-- id: 203 -->
- [x] پیاده‌سازی فریز قطعی سوابق تسویه‌شده و ثبت کدهای پیگیری بانکی شاپرک/پایا <!-- id: 204 -->

## فاز ۳: لایه API، دسترسی‌های RBAC و کارتابل‌های تجمیعی
- [x] تعریف دسترسی‌های ۵ سطحی و نقش‌های تفکیک‌شده در بک‌اند (`accounts/permissions.py`) <!-- id: 301 -->
- [x] ایجاد اندپوینت کارتابل سرپرست (`/api/personnel/cartable/supervisor/`) <!-- id: 302 -->
- [x] ایجاد اندپوینت کارتابل حسابدار (`/api/personnel/cartable/accountant/`) <!-- id: 303 -->
- [x] ایجاد اندپوینت کارتابل مدیر شرکت (`/api/personnel/cartable/manager/`) <!-- id: 304 -->
- [x] ایجاد اندپوینت کارتابل خزانه‌دار (`/api/personnel/cartable/treasury/`) و دانلود دیسکت‌ها <!-- id: 305 -->

## فاز ۴: رابط کاربری فرانت‌اند (Angular 19 Standalone)
- [x] تفکیک منوها و گاردهای روت بر اساس ۵ نقش سازمانی در `layout.ts` <!-- id: 401 -->
- [x] پیاده‌سازی پورتال مستقل کارتابل خزانه‌داری (`treasury-cartable`) با کارت‌های KPI و مودال پرداخت <!-- id: 402 -->
- [x] افزودن متدهای کارتابل ۵ سطحی به سرویس API کلاینت (`personnel-api.service.ts`) <!-- id: 403 -->
- [x] اجرای تست‌های فرانت‌اند و اطمینان از بیلد بدون خطای انگولار (`Application bundle generation complete`) <!-- id: 404 -->

</div>
