<div dir="rtl" align="right">

# لیست وظایف اجرایی طرح جامع چرخه تایید دو مرحله‌ای پرسنل و ناوگان (Task Breakdown)

- [ ] **فاز ۱: مدل‌های دیتابیس، مایگریشن و پیش‌نویس تغییرات**
  - [ ] افزودن فیلدهای `approval_status`, `manager_approved_by`, `manager_approved_at`, `accountant_approved_by`, `accountant_approved_at`, `rejection_reason`, `has_pending_changes` به `PersonnelProfile` و `VehicleDriverProfile` <!-- id: 1-1 -->
  - [ ] ایجاد مدل‌های `PersonnelChangeRequest` و `VehicleChangeRequest` برای مدیریت تمیز پیش‌نویس تغییرات در ویرایش <!-- id: 1-2 -->
  - [ ] تولید و اعمال مایگریشن جنگو با تنظیم مقدار پیش‌فرض `approved` برای داده‌های فعلی بدون تخریب داده‌های گذشته <!-- id: 1-3 -->
  - [ ] اجرای **ایجنت نگهبان ۱ (Schema & Migration Guardian)** <!-- id: 1-4 -->

- [ ] **فاز ۲: سیستم دسترسی‌های دانه‌ای (RBAC) و تعریف پرمیشن‌ها**
  - [ ] تعریف دسترسی‌های `can_approve_personnel_manager`, `can_approve_personnel_finance`, `can_approve_fleet_manager`, `can_approve_fleet_finance` در متادیتا و ماژول `accounts` <!-- id: 2-1 -->
  - [ ] به‌روزرسانی مدیریت نقش‌های سفارشی (`CustomRole`) جهت تخصیص ساده پرمیشن‌ها به مدیران و حسابداران <!-- id: 2-2 -->
  - [ ] اجرای **ایجنت نگهبان ۲ (RBAC Bypass & Security Guardian)** <!-- id: 2-3 -->

- [ ] **فاز ۳: لایه منطق بک‌اند، سرویس تاییدات و تغییرات**
  - [ ] پیاده‌سازی متدهای اختصاصی `approve_manager`, `approve_finance`, `request_revision`, `reject` در ViewSet پرسنل و ناوگان <!-- id: 3-1 -->
  - [ ] پیاده‌سازی منطق هوشمند ایجاد رکورد (ثبت توسط مدیر ⬅️ تایید خودکار مدیر / ثبت توسط حسابدار ⬅️ ارسال به مدیر و نهایی شدن پس از تایید مدیر) <!-- id: 3-2 -->
  - [ ] پیاده‌سازی مکانیزم هدایت درخواست‌های ویرایش پرسنل/خودروهای فعال به جدول `ChangeRequest` به جای بازنویسی مستقیم <!-- id: 3-3 -->
  - [ ] اعمال فیلتر سفت‌وسخت `approval_status='approved'` در `DailyAttendanceViewSet` و `VehicleTripViewSet` <!-- id: 3-4 -->
  - [ ] تنظیم ورود تمامی رکوردهای بارگذاری اکسل (`import-excel`) به صورت `draft` <!-- id: 3-5 -->
  - [ ] اجرای **ایجنت نگهبان ۳ (Workflow State Machine Guardian)** <!-- id: 3-6 -->
  - [ ] اجرای **ایجنت نگهبان ۴ (Attendance & Trip Lock Guardian)** <!-- id: 3-7 -->
  - [ ] اجرای **ایجنت نگهبان ۵ (Pending Edit Staging Guardian)** <!-- id: 3-8 -->

- [ ] **فاز ۴: رابط کاربری فرانت‌اند و کارتابل تاییدات (Frontend UI & Cartables)**
  - [ ] ایجاد تب/بخش اختصاصی کارتابل تاییدات (نمایش پرسنل و خودروهای در انتظار تایید مدیر یا حسابدار) <!-- id: 4-1 -->
  - [ ] پیاده‌سازی کامپوننت مقایسه تغییرات (Diff Viewer) جهت نمایش تغییرات درخواستی در ویرایش رکوردها <!-- id: 4-2 -->
  - [ ] به‌روزرسانی نشانگرها (Status Badges) و فرم‌های تعریف و ویرایش پرسنل و ناوگان <!-- id: 4-3 -->
  - [ ] اطمینان از فیلتر شدن خودکار لیست‌های حضور و غیاب و سرویس‌های روزانه بر اساس رکوردهای تایید شده <!-- id: 4-4 -->

- [ ] **فاز ۵: آزمون‌های نهایی، صحت‌سنجی جامع و عدم تغییر محاسبات گذشته**
  - [ ] اجرای **ایجنت نگهبان ۶ (Historical Payroll & Zero-Regression Guardian)** و تطبیق ۱۰۰٪ با اکسل مرجع شرکت <!-- id: 5-1 -->
  - [ ] اجرای کلیه تست‌های پکیج پرسنل (`manage.py test personnel`) و اطمینان از سبز بودن تمام تست‌ها <!-- id: 5-2 -->
  - [ ] مستندسازی کامل نتایج در `walkthrough.md` <!-- id: 5-3 -->

</div>
