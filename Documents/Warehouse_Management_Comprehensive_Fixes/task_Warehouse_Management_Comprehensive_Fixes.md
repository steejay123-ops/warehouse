<div dir="rtl" align="right">

# لیست وظایف اصلاح و ارتقای جامع صفحه مدیریت انبارها (Warehouse Management Task List)

<!-- id: warehouse-management-comprehensive-fixes -->

- [x] **فاز ۱: بهینه‌سازی بک‌اند و حذف معضل N+1 کوئری** <!-- id: 1 -->
  - [x] بهینه‌سازی متد `get_queryset` در `WarehouseViewSet` با استفاده از `annotate` و شمارش شرطی اقلام <!-- id: 1.1 -->
  - [x] اصلاح متدهای `get_total_quantity` و `get_counted_quantity` در `WarehouseSerializer` جهت استفاده از مقادیر انوتیت‌شده <!-- id: 1.2 -->

- [x] **فاز ۲: اصلاح لاجیک، بارگذاری داده‌ها و فیلترها در فرانت‌اند (`projects.ts`)** <!-- id: 2 -->
  - [x] بارگذاری خودکار کاربران (`loadUsers` / `AccountsHttpService`) در صورت خالی بودن آرایه کاربران <!-- id: 2.1 -->
  - [x] کاهش زمان `debounceTime` از ۲۰۰۰ میلی‌ثانیه به ۳۰۰ میلی‌ثانیه برای واکنش‌گرایی سریع URL <!-- id: 2.2 -->
  - [x] افزودن سینک دوطرفه `statusFilter` با `queryParams` در آدرس URL <!-- id: 2.3 -->
  - [x] ارتقای متد فیلتر جستجو (`filteredProjects`) به صورت Case-Insensitive و پوشش کلیه فیلدها <!-- id: 2.4 -->
  - [x] افزودن پالت رنگی (`colorPalette`) و متد کمکی آواتار (`getWarehouseInitials`) و شمارنده دقیق انبارهای فعال <!-- id: 2.5 -->
  - [x] پاکسازی متدهای مرده (`downloadTemplate`, `goToDocs`, `templateModalOpen`) <!-- id: 2.6 -->

- [x] **فاز ۳: اصلاح فرم‌ها و مدال‌ها در تمپلیت (`projects.html`)** <!-- id: 3 -->
  - [x] اصلاح باگ اینپوت کد انبار در مدال ویرایش از `editingProject.id` به `editingProject.code` و برداشتن وضعیت فقط‌خواندنی <!-- id: 3.1 -->
  - [x] افزودن فیلد انتخاب رنگ انبار (Color Palette Picker) با پیش‌نمایش در مدال‌های ایجاد و ویرایش <!-- id: 3.2 -->
  - [x] اصلاح نمایش آواتار کارت‌های انبار با `getWarehouseInitials(p)` و سازگاری کامل رنگ‌ها <!-- id: 3.3 -->
  - [x] اصلاح شمارنده هدر به `activeProjectsCount` <!-- id: 3.4 -->
  - [x] حذف کامل تگ مدال مرده `#templateModal` <!-- id: 3.5 -->

- [x] **فاز ۴: تنظیم و تطبیق دقیق مجوزهای دسترسی (RBAC Permissions)** <!-- id: 4 -->
  - [x] افزودن `*appHasPermission="'perm_wh_create'"` به دکمه‌های «انبار جدید» و «آپلود اکسل» <!-- id: 4.1 -->
  - [x] افزودن `*appHasPermission="'perm_wh_edit'"` به دکمه «ویرایش مشخصات انبار» <!-- id: 4.2 -->
  - [x] تنظیم `*appHasPermission="'perm_wh_freeze'"` برای فعال‌سازی و بایگانی انبار <!-- id: 4.3 -->
  - [x] تنظیم `*appHasPermission="'perm_wh_freeze'"` برای دکمه بایگانی/حذف انبار <!-- id: 4.4 -->

- [x] **فاز ۵: اعتبارسنجی نهایی و تست جامع** <!-- id: 5 -->
  - [x] بررسی لاگ‌های کامپایل انگولار و ترمینال <!-- id: 5.1 -->
  - [x] تست کامل عملکردهای CRUD، جستجو، تغییر رنگ، آپلود/دانلود اکسل و بررسی در مرورگر <!-- id: 5.2 -->

</div>
