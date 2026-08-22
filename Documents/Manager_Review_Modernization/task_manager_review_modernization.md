<div dir="rtl" align="right">

# چک‌لیست تسک‌های نوسازی و ارتقای کارتابل مدیر (Manager Review Modernization Tasklist)

- [x] **فاز ۱: تجزیه و تحلیل و همگام‌سازی معماری تایپ‌اسکریپت مدیر** (Phase 1: Architectural Analysis & TS Logic Porting) <!-- id: 0 -->
  - [x] تطبیق ایمپورت‌ها و کامپوننت‌های مدرن (`PersianDatePipe`, `OfflinePendingBadgeComponent`, `BarcodeScannerComponent`, `WarehouseSelectorComponent`) <!-- id: 1 -->
  - [x] پیاده‌سازی متدهای اختصاصی دامین مدیر (`bulkManagerApprove`, `bulkManagerReject`, `claim_tasks`, `claim_doc_tasks`) <!-- id: 2 -->
  - [x] پیاده‌سازی سورت ۶ حالته هوشمند و فیلترهای چیپ لوکیشن و تقویم <!-- id: 3 -->
  - [x] پیاده‌سازی موتور جستجوی جامع با نرمال‌سازی حروف فارسی و اعداد <!-- id: 4 -->
  - [x] ایجاد قابلیت‌های تعاملی موبایل (ویبره، لمس طولانی، ژست‌های حرکتی) و وب‌سوکت این‌پلیس <!-- id: 5 -->
  - [x] تایید و صحه‌گذاری ایجنت نگهبان فاز ۱ (Guardian Agent Phase 1 Verification: **PASSED**) <!-- id: 6 -->

- [x] **فاز ۲: پایداری دولایه وضعیت، اکشن‌های گروهی و استیت منیجمنت** (Phase 2: Two-Tier State Persistence & Bulk Actions) <!-- id: 7 -->
  - [x] ذخیره‌سازی و بازیابی تب‌ها و سورت در `LocalStorage` و `URL QueryParams` <!-- id: 8 -->
  - [x] تایید نهایی دسته‌جمعی اقلام با `countTaskApi.bulkManagerApprove` <!-- id: 9 -->
  - [x] تایید نهایی اسناد مالی با `docTaskApi.bulkManagerApprove` <!-- id: 10 -->
  - [x] رد گروهی و تکی با ثبت الزامی علت رد مدیر <!-- id: 11 -->
  - [x] تایید و صحه‌گذاری ایجنت نگهبان فاز ۲ (Guardian Agent Phase 2 Verification: **PASSED**) <!-- id: 12 -->

- [x] **فاز ۳: نوسازی تمپلیت HTML و اتصال کامل شاسی سرپرست با دامین مدیر** (Phase 3: HTML Template Modernization) <!-- id: 13 -->
  - [x] پیاده‌سازی شاسی کامل ۴ تب (`my-tasks`, `pool`, `doc`, `doc-pool`) <!-- id: 14 -->
  - [x] هدر ارگونومیک، سلکتور انبار، اسکنر دوربین و خروجی اکسل <!-- id: 15 -->
  - [x] نوار ابزار چسبان شیشه‌ای (Sticky Glassmorphic Bar) با اکشن‌بار شناور <!-- id: 16 -->
  - [x] طراحی کارت‌های مدرن اقلام با نمایش مغایرت (منطبق/مغایرت‌دار)، یادداشت‌ها و اکشن‌ها <!-- id: 17 -->
  - [x] مودال‌های جزئیات کامل شمارش و اسناد با `PersianDatePipe`، فیلدهای داینامیک و اکشن‌های نهایی <!-- id: 18 -->
  - [x] دیالوگ‌های تایید نهایی، رد گروهی و خروجی اکسل سفارشی <!-- id: 19 -->
  - [x] تایید و صحه‌گذاری ایجنت نگهبان فاز ۳ (Guardian Agent Phase 3 Verification: **PASSED**) <!-- id: 20 -->

- [x] **فاز ۴: تست یکپارچگی بک‌اند و بیلد فرانت‌اند** (Phase 4: Backend Integration & Frontend Build Verification) <!-- id: 21 -->
  - [x] اجرای موفق تست‌های بک‌اند با جنگو (`Ran 35 tests in 36.191s - OK`) <!-- id: 22 -->
  - [x] بیلد فرانت‌اند با Angular CLI (`Application bundle generation complete - 0 errors`) <!-- id: 23 -->
  - [x] تایید و صحه‌گذاری ایجنت نگهبان فاز ۴ (Guardian Agent Phase 4 Verification: **PASSED**) <!-- id: 24 -->

- [x] **فاز ۵: تست تعاملی مرورگر و گزارش جامع عملکرد ایجنت نگهبان** (Phase 5: Browser Subagent E2E Verification & Final Report) <!-- id: 25 -->
  - [x] ناوبری مرورگر به کارتابل مدیر (`/manager-review`) و ثبت اسکرین‌شات‌ها <!-- id: 26 -->
  - [x] راستی‌آزمایی تغییر تب‌ها بین انبارگردانی و اسناد مالی <!-- id: 27 -->
  - [x] راستی‌آزمایی دراپ‌دان سورت هوشمند و مودال خروجی اکسل <!-- id: 28 -->
  - [x] تدوین گزارش جامع عملکرد ایجنت نگهبان و Walkthrough <!-- id: 29 -->

</div>
