<div dir="rtl" align="right">

# چک‌لیست وظایف پیاده‌سازی (Task List)

- [x] **فاز ۱: اصلاح لایه بک‌اند و حل ریشه‌ای خطای اعتبارسنجی شرکت (`company`)** <!-- id: 0 -->
    - [x] افزودن `extra_kwargs` و پاک‌سازی ولیدیتورهای خودکار یکتایی `company` در `PersonnelProfileSerializer` و `VehicleDriverProfileSerializer` <!-- id: 1 -->
    - [x] افزودن فیلد `company_id` به `ProjectSectionSerializer` <!-- id: 2 -->
    - [x] تزریق خودکار `company` در متد `create` و `perform_create` ویوهای پرسنل و ناوگان بر مبنای `section.project.company_id` <!-- id: 3 -->
    - [x] اجرای تست‌های اعتبارسنجی چرخه ثبت پرسنل و خودرو در بک‌اند (`tests_personnel_cycle.py` - ۷ تست پاس شد) <!-- id: 4 -->

- [x] **فاز ۲: پشتیبانی از یادداشت و توضیحات تایید در بک‌اند (`approval_note`)** <!-- id: 5 -->
    - [x] پشتیبانی از دریافت `note` / `approval_note` در اکشن‌های `approve-supervisor`، `approve-finance` و `approve-manager` پرسنل <!-- id: 6 -->
    - [x] پشتیبانی از دریافت `note` / `approval_note` در اکشن‌های تایید متناظر ناوگان و خودرو <!-- id: 7 -->
    - [x] ذخیره پایدار یادداشت‌های تایید در `WorkflowAuditLog` با متادیتا و جزئیات اقدام‌کننده <!-- id: 8 -->

- [x] **فاز ۳: اتصال فرانت‌اند و ارسال فیلد شرکت در فرم‌های ثبت پرسنل و خودرو** <!-- id: 9 -->
    - [x] به‌روزرسانی مدل‌های `ProjectSection`، `PersonnelProfile` و `VehicleDriverProfile` در فرانت‌اند با فیلدهای `company_id` و `company` <!-- id: 10 -->
    - [x] استخراج و ارسال شناسه شرکت در `savePersonnel()` فایل `employee-new-personnel.ts` <!-- id: 11 -->
    - [x] استخراج و ارسال شناسه شرکت در `saveVehicle()` فایل `employee-new-vehicle.ts` <!-- id: 12 -->
    - [x] به‌روزرسانی متدهای تایید در `personnel-api.service.ts` جهت ارسال پارامتر اختیاری `note` <!-- id: 13 -->

- [x] **فاز ۴: افزودن مودال ثبت توضیحات و بازبینی احکام در کارتابل‌ها** <!-- id: 14 -->
    - [x] پیاده‌سازی مودال تایید با کادر متنی توضیحات اختیاری در کارتابل سرپرست (`supervisor-new-profiles`) <!-- id: 15 -->
    - [x] پیاده‌سازی مودال تایید با کادر متنی توضیحات اختیاری در کارتابل مالی/حسابداری (`finance-cartable`) <!-- id: 16 -->
    - [x] پیاده‌سازی مودال تایید با کادر متنی توضیحات اختیاری در کارتابل مدیر (`manager-approvals`) <!-- id: 17 -->
    - [x] اطمینان از امکان ویرایش و بازبینی اطلاعات مالی و احکام پیش از تصویب نهایی در کارتابل مدیریت/حسابداری <!-- id: 18 -->

- [/] **فاز ۵: تست‌های جامع و اعتبارسنجی نهایی (Verification & Build)** <!-- id: 19 -->
    - [x] اجرای تست‌های خودکار فرانت‌اند (`employee-new-personnel.spec.ts` و `employee-new-vehicle.spec.ts` - ۱۱۱ تست پاس شد) <!-- id: 20 -->
    - [x] اجرای تست‌های خودکار کارتابل‌ها (`supervisor-new-profiles.spec.ts`، `finance-cartable.spec.ts`، `manager-approvals.spec.ts`، `personnel-approval-cycle.spec.ts` - ۲۳ تست پاس شد) <!-- id: 21 -->
    - [x] اجرای تست‌های خودکار بک‌اند (`tests_personnel_cycle.py` - ۷ تست کامل جنگو پاس شد) <!-- id: 22 -->
    - [/] اجرای موفق `npm run build` بدون خطای کامپایل <!-- id: 23 -->

</div>
