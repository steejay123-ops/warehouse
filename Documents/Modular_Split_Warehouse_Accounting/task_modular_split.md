# چک‌لیست تسک‌های اجرایی: جداسازی انبارگردانی و حسابداری به دو ماژول نصب‌شدنی مستقل

<div dir="rtl" align="right">

- [x] <!-- id: 0 --> **فاز ۰: نصب حصار پیش از هر تغییر رفتاری**
  - [x] <!-- id: 1 --> افزودن `pyproject.toml` با اعلام سه توزیع `wh-platform`، `wh-warehouse` و `wh-accounting` (در توسعه همه کنار هم نصب)
  - [x] <!-- id: 2 --> افزودن `.importlinter` با قراردادهای C1 (لایه‌بندی)، C2 (استقلال ماژول‌ها)، C3 (پاکی هسته) و C4 (استثنای مهارشده) در حالت report-only
  - [x] <!-- id: 3 --> اجرای `lint-imports` و ثبت snapshot تعداد نقض‌های فعلی به‌عنوان مبنای مقایسه
  - [x] <!-- id: 4 --> پیاده‌سازی ایجنت نگهبان ۲۹ (`scripts/e2e/guardian_modularization.py`) با تحمیل کاهش یکنوای نقض‌ها
  - [x] <!-- id: 5 --> تایید عدم رگرسیون: هیچ تست موجودی سرخ نشده و نگهبان‌های ۱ تا ۲۸ سبزند

- [x] <!-- id: 6 --> **فاز ۱: آزادسازی هستهٔ تنظیمات و کانفیگ بوت از اپ انبار**
  - [x] <!-- id: 7 --> ایجاد اپلیکیشن پلتفرمی `settings_core`
  - [x] <!-- id: 8 --> انتقال مدل `SystemSetting` با `SeparateDatabaseAndState` و تثبیت `db_table='warehouses_systemsetting'` (صفر مهاجرت داده)
  - [x] <!-- id: 9 --> تبدیل `SystemSetting.warehouse` به `warehouse_id = IntegerField(null=True, db_index=True, db_column='warehouse_id')`
  - [x] <!-- id: 10 --> بازسازی رفتار CASCADE با سیگنال `post_delete` که از سمت `wh-warehouse` ثبت می‌شود
  - [x] <!-- id: 11 --> انتقال `get_setting`، `get_all_settings`، `clear_setting_cache`، `compute_settings_etag`، `validate_settings_payload` و `DEFAULT_SETTINGS` به `settings_core.services`
  - [x] <!-- id: 12 --> ایجاد لایهٔ shim در `warehouses.services` با re-export همان نام‌ها (حفظ هر ۳ فراخوان `communications` و فراخوان‌های `inventory`/`reports`)
  - [x] <!-- id: 13 --> انتقال `SettingsViewSet` و `PublicConfigViewSet` به `settings_core.views` با حفظ عین مسیرهای `/api/settings/global/` و `/api/public/config/`
  - [x] <!-- id: 14 --> تفکیک کلیدهای پیش‌فرض: کلیدهای پلتفرمی در هسته، کلیدهای انباری ثبت‌شده از `wh-warehouse`
  - [x] <!-- id: 15 --> افزودن کلید `installed_modules` به پاسخ `/api/public/config/` به‌عنوان manifest ماژول برای فرانت‌اند
  - [x] <!-- id: 16 --> اجرای نگهبان ۳۰: با حذف `warehouses` از `INSTALLED_APPS` هر دو اندپوینت تنظیمات پاسخ می‌دهند

- [x] <!-- id: 17 --> **فاز ۲: بریدن یال‌های FK هسته → انبار (expand-contract، صفر مهاجرت داده)**
  - [x] <!-- id: 18 --> اعلام M2M در اپ `warehouses` روی `Warehouse` با `related_name='assigned_warehouses'` و `db_table='accounts_customuser_assigned_warehouses'`
  - [x] <!-- id: 19 --> حذف `assigned_warehouses` از `accounts/models.py:20` و ثبت هر دو طرف با `SeparateDatabaseAndState`
  - [x] <!-- id: 20 --> راستی‌آزمایی سالم بودن اکسسور `user.assigned_warehouses` در همهٔ فراخوان‌های تولیدی (`accounts/admin.py`، `excel_utils.py`، `serializers.py`، `views.py`، `common/warehouse_scope.py`)
  - [x] <!-- id: 21 --> تبدیل ایمپورت ماژول‌سطح `Warehouse` در `accounts/serializers.py:5` و `accounts/excel_utils.py:16` به resolve اختیاری با `apps.is_installed('warehouses')` و حذف فیلد در نصب بدون انبار
  - [x] <!-- id: 22 --> انتقال `accounts/management/commands/setup_project.py` به `warehouses/management/commands/`
  - [x] <!-- id: 23 --> افزودن گارد `apps.is_installed` به ایمپورت‌های تنبل موجود در `accounts/audit_utils.py:115,121` و `accounts/rollback_service.py:151-160`
  - [x] <!-- id: 24 --> تبدیل `AuditLog.warehouse` به `warehouse_id = IntegerField(null=True, db_index=True, db_column='warehouse_id')` روی همان ستون و همان ایندکس
  - [x] <!-- id: 25 --> تبدیل `AuditLog.MODULE_CHOICES` به رجیستری و افزودن ماژول‌های حسابداری (`attendance`، `fleet`، `payroll`، `treasury`، `projects`، `invoices`) که امروز کلاً غایب‌اند
  - [x] <!-- id: 26 --> اجرای نگهبان ۳۲: `sqlmigrate` هیچ `ALTER`/`COPY` روی سه جدول حساس نشان ندهد و شمار ردیف‌ها قبل و بعد یکسان باشد

- [ ] <!-- id: 27 --> **فاز ۳: رجیستری قابلیت‌ها در بک‌اند**
  - [ ] <!-- id: 28 --> ساخت `platform_core/registry.py` با dataclass `ModuleSpec` و توابع `register_module()`، `installed_modules()` و `module_for_path()`
  - [ ] <!-- id: 29 --> ثبت خودکار ماژول‌ها در `AppConfig.ready()` و کشف از entry point گروه `wh.module`
  - [ ] <!-- id: 30 --> بازنویسی `enforce_token_app_scope` در `accounts/authentication.py:55-73` به حلقهٔ `module_for_path(path)` با حفظ ثبت `AuditLog` و `details.event='CROSS_APP_DENIED'`
  - [ ] <!-- id: 31 --> تحمیل پاسخ **۴۰۴ (نه ۴۰۳)** برای پیشوند API ماژول نصب‌نشده
  - [ ] <!-- id: 32 --> بازنویسی `get_user_allowed_apps` (`middleware.py:80-101`) بر پایهٔ `spec.permission_markers` و `get_user_valid_roles_for_app` (`108-147`) بر پایهٔ `spec.roles`
  - [ ] <!-- id: 33 --> رفع دوحالتگی `middleware.py:221` به `code if code in installed_modules() else default_module()`
  - [ ] <!-- id: 34 --> پویاسازی `SoDPolicyRule.APP_MODULE_CHOICES` از رجیستری با حفظ عین کد `'personnel'` و افزودن `'accounting'` تنها به‌عنوان alias
  - [ ] <!-- id: 35 --> ساخت `INSTALLED_APPS` (با override محیطی `WH_MODULES`)، `config/urls.py` و `config/asgi.py` از رجیستری

- [ ] <!-- id: 36 --> **فاز ۴: جدا کردن چت از دامنهٔ انبار (پرریسک‌ترین تغییر دیتابیسی)**
  - [ ] <!-- id: 37 --> نرم کردن دو FK در `communications/models.py:24` و `:207` به `warehouse_id` عددی nullable با همان `db_column` و `SeparateDatabaseAndState`
  - [ ] <!-- id: 38 --> تغذیهٔ دامنهٔ دید مخاطبین از گراف کاربر پلتفرم (بدون تغییر رفتار؛ عدم محدودیت انباری مخاطبین تصمیم پذیرفته‌شدهٔ پروژه است)
  - [ ] <!-- id: 39 --> جایگزینی `warehouses.services.get_setting` با `settings_core.services.get_setting` در `consumers.py:79`، `permissions.py:33` و `views.py:42`
  - [ ] <!-- id: 40 --> قرار دادن `communications/views.py:528` و مصرف `inventory.models` درون گارد رجیستری (غیرفعال شدن بی‌صدای اشتراک کالا در نصب حسابداری‌تنها)
  - [ ] <!-- id: 41 --> راستی‌آزمایی کارکرد کامل چت (متن، فایل، وب‌سوکت) در نصب حسابداری‌تنها

- [ ] <!-- id: 42 --> **فاز ۵: گزارش‌ساز — جدا کردن موتور عام از رجیستری انباری**
  - [ ] <!-- id: 43 --> انتقال موتور کوئری عام به `platform_core/query_engine`
  - [ ] <!-- id: 44 --> انتقال `JOINS` و ورودی‌های `JoinDef` انباری به `wh-warehouse`
  - [ ] <!-- id: 45 --> تعمیم `JoinDef.warehouse_path` به `scope_path` تا هر ماژول بُعد قلمروبندی خودش را بدهد (حسابداری: `project`/`section`)
  - [ ] <!-- id: 46 --> تبدیل قلمرو `/api/reports/` در `authentication.py` به «هر ماژول نصب‌شده‌ای که join ثبت کرده»
  - [ ] <!-- id: 47 --> راستی‌آزمایی دست‌نخورده ماندن `SENSITIVE_BYPASS_PERMS` و whitelist عملگرها
  - [ ] <!-- id: 48 --> تست گزارش‌گیری در هر دو نصب تک‌ماژولی

- [ ] <!-- id: 49 --> **فاز ۶: فرانت‌اند — کتابخانه‌های workspace، مسیر lazy و manifest ماژول**
  - [ ] <!-- id: 50 --> افزودن کتابخانه‌های `platform-shell`، `warehouse-ui` و `accounting-ui` به `angular.json` با حفظ `warehouse-app` به‌عنوان پوستهٔ اپ
  - [ ] <!-- id: 51 --> تبدیل ۴۰ ایمپورت eager در `app.routes.ts:1-42` به `loadChildren` برای هر دو ماژول
  - [ ] <!-- id: 52 --> راستی‌آزمایی حفظ عین همهٔ مسیرها و هر ۳۵ ریدایرکت legacy (`app.routes.ts:217-254`)
  - [ ] <!-- id: 53 --> جایگزینی `WAREHOUSE_CHECK_PERMS` و `PERSONNEL_CHECK_PERMS` (سطر ۴۴-۶۰) با `moduleRegistry.permissionMarkers(code)` تغذیه‌شده از `installed_modules`
  - [ ] <!-- id: 54 --> وارونه‌سازی `AppPersonaService`: تبدیل اتحاد `AppModuleType` به کد رشته‌ای و تبدیل ~۱۰ شرط `if (app === ...)` به lookup در `spec`
  - [ ] <!-- id: 55 --> export کردن `NavItem[]` از هر کتابخانه و merge گروه‌های ثبت‌شده در `navItems` (`layout.ts:1098`)، با تبدیل پرچم `isAccounting` به `module: 'accounting'`
  - [ ] <!-- id: 56 --> راستی‌آزمایی حفظ گیت‌های SoD روی `finance-cartable`، `treasury-cartable` و `manager-approvals`
  - [ ] <!-- id: 57 --> تبدیل سه متد `enterX()` و سه گتر `hasX` در `app-launcher.ts` به یک حلقه روی `persona.accessibleApps()`
  - [ ] <!-- id: 58 --> تبدیل `MODEL_TABLES` (`sync-pull.service.ts:25-30`) به `pullEntities` ثبتی
  - [ ] <!-- id: 59 --> تعمیم کلید cursor از `${userId}:${warehouseId}` به `${userId}:${scopeKind}:${scopeId}` با خوانده شدن همچنانی کلیدهای قدیمی (expand-contract)
  - [ ] <!-- id: 60 --> مشتق کردن `SCOPED_DB_NAMES` از کد ماژول با **قفل مطلق نام دو دیتابیس فعلی** (ارتقای نسخه مجاز، rename ممنوع)
  - [ ] <!-- id: 61 --> رفع نگاشت غلط قلمرو در `offline-db.ts:213`: الگوی `/doc-tasks|/doc_tasks` به `finance` نگاشت می‌شود ولی `docTasks` موجودیت انباری است (`sync-pull.service.ts:29`) ⇒ نوشتن رکورد صف در دیتابیس اشتباه
  - [ ] <!-- id: 62 --> افزودن کانفیگ بیلد `accounting-only` بدون هیچ chunk انباری در `dist/`
  - [ ] <!-- id: 63 --> اجرای نگهبان ۳۳ (ایزولاسیون باندل)، ۳۴ (تداوم آفلاین) و ۳۵ (تطابق مسیر و مجوز)

- [ ] <!-- id: 64 --> **فاز ۷: بسته‌بندی و اثبات سه پروفایل نصب**
  - [ ] <!-- id: 65 --> نهایی‌سازی سه `pyproject.toml` با `[project.entry-points."wh.module"]` برای هر توزیع
  - [ ] <!-- id: 66 --> الزام `wh-platform >= 1.0, < 2.0` در دو ماژول و بررسی بازهٔ `requires_platform` در استارت‌آپ رجیستری با پیام خطای فارسی روشن
  - [ ] <!-- id: 67 --> سبز کردن پروفایل (الف) `platform + accounting`: `check`، `migrate` از دیتابیس خالی، صحت `installed_modules`، و ۴۰۴ بودن `/api/inventory/`
  - [ ] <!-- id: 68 --> سبز کردن پروفایل (ب) `platform + warehouse`
  - [ ] <!-- id: 69 --> سبز کردن پروفایل (ج) هر سه بسته، با تکرار **بی‌کم‌و‌کاست رفتار امروز**
  - [ ] <!-- id: 70 --> اجرای نگهبان ۳۱ روی هر سه venv جدا (مخزن CI ندارد؛ افزودن CI خارج از دامنهٔ این طرح است)

- [ ] <!-- id: 71 --> **فاز ۸: آمادگی دفتر کل (فقط نقاط توسعه، بدون ساخت هیچ جدول GL)**
  - [ ] <!-- id: 72 --> تعریف پروتکل `AccountingDocumentSource` با متد `to_journal_lines()` در پلتفرم (فقط پروتکل، نه دفتر)
  - [ ] <!-- id: 73 --> پیاده‌سازی `to_journal_lines()` روی `ExpenseInvoice`، تسویهٔ حقوق، پرداخت خزانه و تسویهٔ ناوگان
  - [ ] <!-- id: 74 --> ایجاد جدول outbox `AccountingEvent(source_model, source_id, occurred_at, payload, posted_at NULL)` با نوشتن تراکنشی درون همان جریان‌های تایید موجود
  - [ ] <!-- id: 75 --> اعلام رسمی `FinancialProject`/`ProjectSection` به‌عنوان بُعد مرکز هزینه و `Counterparty` به‌عنوان بُعد تفصیلی، با رزرو `account_code` nullable
  - [ ] <!-- id: 76 --> قفل و مستندسازی دقت پول روی `DecimalField(max_digits=15, decimal_places=0)` (ریال)
  - [ ] <!-- id: 77 --> رزرو جایگاه توزیع `wh-accounting-gl` در گراف وابستگی و اجرای نگهبان ۳۶

- [ ] <!-- id: 78 --> **راستی‌آزمایی نهایی و رگرسیون سراسری**
  - [ ] <!-- id: 79 --> `python manage.py check` و `python manage.py makemigrations --check --dry-run` بدون خطا
  - [ ] <!-- id: 80 --> `python manage.py test accounts personnel warehouses inventory reports communications` کاملاً سبز (پرسنل: ۷۵/۷۵)
  - [ ] <!-- id: 81 --> `lint-imports` سبز و صفر شدن snapshot نقض‌های فاز ۰
  - [ ] <!-- id: 82 --> سبز بودن کل نگهبان‌های ۱ تا ۲۸ (عدم رگرسیون) و ۲۹ تا ۳۶ (نگهبان‌های این طرح)
  - [ ] <!-- id: 83 --> `npx tsc --noEmit` و `npm run build` بدون خطا در هر سه پروفایل بیلد
  - [ ] <!-- id: 84 --> اثبات معیار پذیرش قاطع: `pip install wh-platform wh-accounting` سامانه‌ای بدهد که هیچ کد انباری (مدل، مایگریشن، اندپوینت، chunk) ندارد و در همان حال ورود، RBAC، ممیزی، چت، تنظیمات، تشخیص آنلاین/آفلاین، بکاپ و کل دامنهٔ حسابداری بی‌عیب کار کند
  - [ ] <!-- id: 85 --> تایید نهایی مسیرهای پشت ورود روی محیط عملیاتی (پشت Cloudflare Tunnel) توسط کاربر
  - [ ] <!-- id: 86 --> نوشتن `walkthrough_phase*.md` برای هر فاز **پس از** اتمام همان فاز، مطابق رویهٔ خانه

</div>
