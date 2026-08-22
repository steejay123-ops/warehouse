# <div dir="rtl" align="right">فهرست وظایف ارتقا و بهینه‌سازی کارتابل‌های انبارگردانی</div>

<div dir="rtl" align="right">

- [x] **فاز ۱: ارتقای جامع کارتابل سرپرست شمارش و مالی (`Supervisor Dashboard`)** <!-- id: phase1 -->
  - [x] افزودن `searchQuery` و فیلترهای زمانی/وضعیتی به همراه `debounceTime` در `supervisor-dashboard.ts` <!-- id: phase1_search_ts -->
  - [x] ایجاد نوار جستجوی اختصاصی و چیپ‌های فیلتر سریع در `supervisor-dashboard.html` <!-- id: phase1_search_html -->
  - [x] اتصال کامپوننت اسکنر بارکد (`BarcodeScannerComponent`) و شنونده بارکد سخت‌افزاری <!-- id: phase1_scanner -->
  - [x] فیلتر رویدادهای وب‌سوکت بر اساس `warehouse_id` انبار فعال <!-- id: phase1_ws_filter -->
  - [x] اعتبارسنجی بیلد پروژه فرانت‌اند با موفقیت کامل <!-- id: phase1_build -->
  - [x] تست و تایید صحت عملکرد فاز ۱ توسط کاربر <!-- id: phase1_verify -->

- [x] **فاز ۲: اصلاح منطق مغایرت و ارجاع در سرور (`Backend Logic Optimization`)** <!-- id: phase2 -->
  - [x] استانداردسازی مقایسه اعشاری مغایرت با `Decimal` در اکشن `bulk_manager_approve` <!-- id: phase2_decimal -->
  - [x] اصلاح و ایمن‌سازی جریان ارجاع کالا در `manager_reject` و `bulk_manager_reject` و حفظ سابقه دقیق شمارش در تاریخچه <!-- id: phase2_reject -->
  - [x] اجرای کامل تست‌های واحد ۳۵ گانه بک‌اند با موفقیت (`35 tests passed - OK`) <!-- id: phase2_tests -->
  - [x] تست و تایید صحت عملکرد فاز ۲ توسط کاربر <!-- id: phase2_verify -->

- [x] **فاز ۳: بهینه‌سازی کارایی و رندرینگ کارتابل شمارشگر (`Counter Dashboard`)** <!-- id: phase3 -->
  - [x] بهینه‌سازی رندرینگ DOM و تثبیت `trackByTaskId`، `trackByFieldKey` و `trackByColKey` در کارت‌ها و فرم‌های شمارشگر <!-- id: phase3_dom -->
  - [x] اعتبارسنجی ارسال `base_updated_at` در ذخیره محلی و صف همگام‌سازی فیلدهای پویا <!-- id: phase3_offline_sync -->
  - [x] اعتبارسنجی بیلد فرانت‌اند با موفقیت کامل <!-- id: phase3_build -->
  - [x] تست و تایید صحت عملکرد فاز ۳ توسط کاربر <!-- id: phase3_verify -->

- [x] **فاز ۴: تقویت داشبورد رهگیری و تفکیک کسری و مازاد (`Count Tracking & Discrepancy KPIs`)** <!-- id: phase4 -->
  - [x] محاسبه شاخص‌های تفکیکی `statShortage` و `statSurplus` در `count-tracking.ts` <!-- id: phase4_stats -->
  - [x] افزودن کارت‌های کلیکی فیلتر کسری و مازاد در `count-tracking.html` <!-- id: phase4_kpi_cards -->
  - [x] اعتبارسنجی بیلد فرانت‌اند با موفقیت کامل <!-- id: phase4_build -->
  - [x] تست و تایید نهایی کل پروژه توسط کاربر <!-- id: phase4_verify -->

</div>
