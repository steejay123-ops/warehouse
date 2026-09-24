<div dir="rtl" align="right">

# فهرست وظایف تفصیلی طرح شناسنامه حقوقی، بایگانی مدارک و پروفایل پیشرفته شرکت‌ها
## (Company Legal Profile, Document Archive & Governance Tasklist)

---

### 🔹 فاز ۱: بک‌اند، مدل‌های داده و مایگریشن اسکیما (Database & Models)
- [ ] <!-- id: CLP-1.1 --> گسترش فیلدهای مدل `Company` در [personnel/models.py](file:///e:/warehouse%20project/warehouse-backend/personnel/models.py) شامل: نوع شرکت، شماره و تاریخ ثبت، سرمایه ثبتی، ارکان هیئت‌مدیره و امضاداران، انقضای هیئت‌مدیره، کد کارگاه بیمه و شعبه، ردیف پیمان، شناسه مودیان و کد اقتصادی جدید، شبا و حساب رسمی، اساسنامه و روزنامه رسمی <!-- priority: Critical -->
- [ ] <!-- id: CLP-1.2 --> تعریف مدل رابطه نامحدود `CompanyDocument` در [personnel/models.py](file:///e:/warehouse%20project/warehouse-backend/personnel/models.py) شامل نوع مدرک، عنوان، فایل، سایز، تاریخ صدور و انقضا، پرچم `is_confidential`، کاربر بارگذاری‌کننده و پراپرتی‌های وضعیت انقضا <!-- priority: Critical -->
- [ ] <!-- id: CLP-1.3 --> تولید و اعمال مایگریشن امن اسکیما پایگاه داده (`python manage.py makemigrations personnel` و `migrate`) <!-- priority: Critical -->

---

### 🔹 فاز ۲: کنترلرها، امنیت رسانه‌ها و وب‌سرویس (API, Security & RBAC)
- [ ] <!-- id: CLP-2.1 --> اضافه کردن پیشوندهای `company_documents/` و `company_core_docs/` به `PROTECTED_PREFIXES` در [common/media_urls.py](file:///e:/warehouse%20project/warehouse-backend/common/media_urls.py) جهت محافظت از دانلود فایل‌ها <!-- priority: High -->
- [ ] <!-- id: CLP-2.2 --> پیاده‌سازی `CompanyDocumentSerializer` و به‌روزرسانی `CompanySerializer` در [personnel/serializers.py](file:///e:/warehouse%20project/warehouse-backend/personnel/serializers.py) همراه با پراپرتی‌های پویا و متادیتای سلامت اسناد <!-- priority: High -->
- [ ] <!-- id: CLP-2.3 --> ایجاد کنترلر `CompanyDocumentViewSet` در [personnel/views.py](file:///e:/warehouse%20project/warehouse-backend/personnel/views.py) با اعتبارسنجی چندشرکتی (`validate_user_company_access`) و فیلتر اسناد محرمانه برای کاربران عادی <!-- priority: High -->
- [ ] <!-- id: CLP-2.4 --> ثبت روت اختصاصی `company-documents` در [personnel/urls.py](file:///e:/warehouse%20project/warehouse-backend/personnel/urls.py) <!-- priority: High -->
- [ ] <!-- id: CLP-2.5 --> پیاده‌سازی اکشن اختصاصی `expiring_documents` در `CompanyViewSet` جهت خروجی مدارک منقضی یا در آستانه انقضا هلدینگ <!-- priority: High -->
- [ ] <!-- id: CLP-2.6 --> ارتقای خروجی اکسل ۲ ردیفه شرکت‌ها در `CompanyViewSet.export_excel` با افزودن ستون‌های کارگاهی، مودیان، بانکی و وضعیت اسناد <!-- priority: Medium -->

---

### 🔹 فاز ۳: استودیوی مودال ۵ تبی و مدیریت اسناد در فرانت‌اند (UI/UX)
- [ ] <!-- id: CLP-3.1 --> به‌روزرسانی اینترفیس `Company` و افزودن اینترفیس `CompanyDocument` در [company.model.ts](file:///e:/warehouse%20project/warehouse-front/src/app/core/models/company.model.ts) <!-- priority: High -->
- [ ] <!-- id: CLP-3.2 --> افزودن متدهای بارگذاری، حذف و استعلام اسناد به [company-api.service.ts](file:///e:/warehouse%20project/warehouse-front/src/app/core/api/company-api.service.ts) <!-- priority: High -->
- [ ] <!-- id: CLP-3.3 --> بازطراحی فرم مودال شرکت در [companies.html](file:///e:/warehouse%20project/warehouse-front/src/app/components/operations/companies/companies.html) و [companies.ts](file:///e:/warehouse%20project/warehouse-front/src/app/components/operations/companies/companies.ts) به یک استودیوی مدرن ۵ تبی ارگونومیک (هویتی، مدارک، هیئت‌مدیره، بیمه/مودیان، بانک) <!-- priority: High -->
- [ ] <!-- id: CLP-3.4 --> پیاده‌سازی تب اختصاصی بایگانی مدارک شامل آپلود سریع اساسنامه و روزنامه رسمی، فرم دراپ‌زون افزودن سند جدید با تاریخ صدور و انقضا و جدول اسناد با بج‌های وضعیت <!-- priority: High -->

---

### 🔹 فاز ۴: سیستم هشدار انقضا، ستون سلامت و ویجت داشبورد (Smart Alerts & Cockpit)
- [ ] <!-- id: CLP-4.1 --> اضافه کردن ستون وضعیت سلامت مدارک به جدول اصلی شرکت‌ها در [companies.html](file:///e:/warehouse%20project/warehouse-front/src/app/components/operations/companies/companies.html) با بج‌های سه‌سطحه (سبز/زرد/قرمز) <!-- priority: High -->
- [ ] <!-- id: CLP-4.2 --> افزودن ویجت نظارتی «پایش سررسید مدارک و روزنامه‌های رسمی هلدینگ» در داشبورد مرکز عملیات [operations-cockpit.ts](file:///e:/warehouse%20project/warehouse-front/src/app/components/operations/operations-cockpit/operations-cockpit.ts) و قالب HTML آن <!-- priority: High -->
- [ ] <!-- id: CLP-4.3 --> نمایش روزشمار تا انقضا و دکمه اقدام سریع جهت ورود مستقیم به پروفایل شرکت و تمدید سند <!-- priority: Medium -->

---

### 🔹 فاز ۵: آزمون‌های یکپارچگی، تست‌های Vitest DOM و صحه‌گذاری (Testing & QA)
- [ ] <!-- id: CLP-5.1 --> نگارش آزمون‌های جامع بک‌اند در [personnel/test_company_documents.py](file:///e:/warehouse%20project/warehouse-backend/personnel/test_company_documents.py) (آپلود، محاسبات انقضا، ایزولاسیون شرکتی و فیلتر اسناد محرمانه) <!-- priority: Critical -->
- [ ] <!-- id: CLP-5.2 --> اجرای تست‌های سریع DOM نوع ۱ (Vitest) در [companies.dom.spec.ts](file:///e:/warehouse%20project/warehouse-front/src/app/components/operations/companies/companies.dom.spec.ts) برای ارزیابی ۵ تب و تعاملات اسناد <!-- priority: High -->
- [ ] <!-- id: CLP-5.3 --> بررسی عدم وجود هرگونه خطای کامپایل تایپ‌اسکریپت (`npx tsc --noEmit`) و موفقیت بیلد نهایی (`npm run build`) <!-- priority: Critical -->
- [ ] <!-- id: CLP-5.4 --> ثبت سند گزارش تحویل (`walkthrough_company_legal_profile.md`) طبق استاندارد DUAL-SAVE <!-- priority: Medium -->

</div>
