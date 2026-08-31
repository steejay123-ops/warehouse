<div dir="rtl" align="right">

# لیست وظایف اجرایی چرخه تایید دو مرحله‌ای پرسنل و ناوگان (Task Checklist)

- [x] **فاز ۱: مدل‌های دیتابیس، مایگریشن و پیش‌نویس تغییرات**
  - [x] افزودن فیلدهای `approval_status`, `manager_approved_by`, `manager_approved_at`, `accountant_approved_by`, `accountant_approved_at`, `rejection_reason`, `has_pending_changes` به `PersonnelProfile` و `VehicleDriverProfile` <!-- id: 1-1 -->
  - [x] ایجاد مدل‌های `PersonnelChangeRequest` و `VehicleChangeRequest` برای مدیریت تمیز پیش‌نویس تغییرات در ویرایش <!-- id: 1-2 -->
  - [x] تولید و اعمال مایگریشن جنگو با تنظیم مقدار پیش‌فرض `approved` برای داده‌های فعلی بدون تخریب داده‌های گذشته <!-- id: 1-3 -->
  - [x] اجرای **ایجنت نگهبان ۱ (Schema & Migration Guardian)** <!-- id: 1-4 -->

- [x] **فاز ۲: سیستم دسترسی‌های دانه‌ای (RBAC) و تعریف پرمیشن‌ها**
  - [x] تعریف دسترسی‌های `can_approve_personnel_manager`, `can_approve_personnel_finance`, `can_approve_fleet_manager`, `can_approve_fleet_finance` در متادیتا و ماژول `accounts` <!-- id: 2-1 -->
  - [x] به‌روزرسانی مدیریت نقش‌های سفارشی (`CustomRole`) جهت تخصیص ساده پرمیشن‌ها به مدیران و حسابداران <!-- id: 2-2 -->
  - [x] اجرای **ایجنت نگهبان ۲ (RBAC Bypass & Security Guardian)** <!-- id: 2-3 -->

- [x] **فاز ۳: لایه منطق بک‌اند، سرویس تاییدات و تغییرات**
  - [x] پیاده‌سازی متدهای اختصاصی `approve_manager`, `approve_finance`, `request_revision`, `reject` در ViewSet پرسنل و ناوگان <!-- id: 3-1 -->
  - [x] پیاده‌سازی منطق هوشمند ایجاد رکورد (ثبت توسط مدیر ⬅️ تایید خودکار مدیر / ثبت توسط حسابدار ⬅️ ارسال به مدیر و نهایی شدن پس از تایید مدیر) <!-- id: 3-2 -->
  - [x] پیاده‌سازی مکانیزم هدایت درخواست‌های ویرایش پرسنل/خودروهای فعال به جدول `ChangeRequest` به جای بازنویسی مستقیم <!-- id: 3-3 -->
  - [x] اعمال فیلتر سفت‌وسخت `approval_status='approved'` در `DailyAttendanceViewSet` و `VehicleTripViewSet` <!-- id: 3-4 -->
  - [x] تنظیم ورود تمامی رکوردهای بارگذاری اکسل (`import-excel`) به صورت `draft` <!-- id: 3-5 -->
  - [x] اجرای **ایجنت نگهبان ۳ (Workflow State Machine Guardian)** <!-- id: 3-6 -->
  - [x] اجرای **ایجنت نگهبان ۴ (Attendance & Trip Lock Guardian)** <!-- id: 3-7 -->
  - [x] اجرای **ایجنت نگهبان ۵ (Pending Edit Staging Guardian)** <!-- id: 3-8 -->

- [x] **فاز ۴: رابط کاربری فرانت‌اند و کارتابل تاییدات (Frontend UI & Cartables)**
  - [x] ایجاد تب/بخش اختصاصی کارتابل تاییدات (نمایش پرسنل و خودروهای در انتظار تایید مدیر یا حسابدار) <!-- id: 4-1 -->
  - [x] پیاده‌سازی کامپوننت مقایسه تغییرات (Diff Viewer) جهت نمایش تغییرات درخواستی در ویرایش رکوردها <!-- id: 4-2 -->
  - [x] به‌روزرسانی نشانگرها (Status Badges) و فرم‌های تعریف و ویرایش پرسنل و ناوگان <!-- id: 4-3 -->
  - [x] اطمینان از فیلتر شدن خودکار لیست‌های حضور و غیاب و سرویس‌های روزانه بر اساس رکوردهای تایید شده <!-- id: 4-4 -->

- [x] **فاز ۵: آزمون‌های نهایی، صحت‌سنجی جامع و عدم تغییر محاسبات گذشته**
  - [x] اجرای **ایجنت نگهبان ۶ (Historical Payroll & Zero-Regression Guardian)** و تطبیق ۱۰۰٪ با اکسل مرجع شرکت <!-- id: 5-1 -->
  - [x] اجرای کلیه تست‌های پکیج پرسنل (`manage.py test personnel`) و اطمینان از سبز بودن تمام تست‌ها <!-- id: 5-2 -->
  - [x] مستندسازی کامل نتایج در `walkthrough_approval_workflow.md` <!-- id: 5-3 -->

</div>
