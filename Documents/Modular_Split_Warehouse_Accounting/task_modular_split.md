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

- [x] <!-- id: 27 --> **فاز ۳: رجیستری قابلیت‌ها در بک‌اند**
  - [x] <!-- id: 28 --> ساخت `platform_core/registry.py` با dataclass `ModuleSpec` و توابع `register_module()`، `installed_modules()` و `module_for_path()`
  - [x] <!-- id: 29 --> ثبت خودکار ماژول‌ها در `AppConfig.ready()` و کشف از entry point گروه `wh.module`
  - [x] <!-- id: 30 --> بازنویسی `enforce_token_app_scope` در `accounts/authentication.py:55-73` به حلقهٔ `module_for_path(path)` با حفظ ثبت `AuditLog` و `details.event='CROSS_APP_DENIED'`
  - [x] <!-- id: 31 --> تحمیل پاسخ **۴۰۴ (نه ۴۰۳)** برای پیشوند API ماژول نصب‌نشده
  - [x] <!-- id: 32 --> بازنویسی `get_user_allowed_apps` (`middleware.py:80-101`) بر پایهٔ `spec.permission_markers` و `get_user_valid_roles_for_app` (`108-147`) بر پایهٔ `spec.roles`
  - [x] <!-- id: 33 --> رفع دوحالتگی `middleware.py:221` به `code if code in installed_modules() else default_module()`
  - [x] <!-- id: 34 --> پویاسازی `SoDPolicyRule.APP_MODULE_CHOICES` از رجیستری با حفظ عین کد `'personnel'` و افزودن `'accounting'` تنها به‌عنوان alias
  - [x] <!-- id: 35 --> ساخت `INSTALLED_APPS` (با override محیطی `WH_MODULES`)، `config/urls.py` و `config/asgi.py` از رجیستری

- [x] <!-- id: 36 --> **فاز ۴: جدا کردن پرسنل و چت از انبار (رویکرد تمیز پایگاه داده)**
  - [x] <!-- id: 37 --> نرم کردن ۵ FK پرسنل و ۲ FK چت به `warehouse_id` عددی (حذف وابستگی‌ها به `warehouses.Warehouse`)
  - [x] <!-- id: 38 --> تولید مجدد مایگریشن‌های پاک برای تمام ۸ اپ (بازتولید گراف گراف از دیتابیس خالی؛ بدون `SeparateDatabaseAndState`)
  - [x] <!-- id: 39 --> اطمینان از گریز از وابستگی در تنظیم‌کننده‌ها (حفظ `_WarehouseCompatMixin` جهت سازگاری کامل کد/تست‌ها)
  - [x] <!-- id: 40 --> جایگزینی `warehouses.services.get_setting` با `settings_core.services.get_setting` در `communications`
  - [x] <!-- id: 41 --> اثبات کارکرد بوت مستقل حسابداری-تنها از پایگاه داده خالی (`WH_MODULES=accounting migrate` بدون انبار کار کرد)

- [x] <!-- id: 42 --> **فاز ۵: گزارش‌ساز — جدا کردن موتور عام از رجیستری انباری**
  - [x] <!-- id: 43 --> انتقال موتور کوئری عام به `platform_core/query_engine`
  - [x] <!-- id: 44 --> انتقال `JOINS` و ورودی‌های `JoinDef` انباری به `wh-warehouse` (در `reports/registry.py` با ثبت در رجیستری مرکزی پلتفرم)
  - [x] <!-- id: 45 --> تعمیم `JoinDef.warehouse_path` به `scope_path` تا هر ماژول بُعد قلمروبندی خودش را بدهد (حسابداری: `project`/`section`) با حفظ سازگاری رو به عقب
  - [x] <!-- id: 46 --> تبدیل قلمرو `/api/reports/` در `authentication.py` به «هر ماژول نصب‌شده‌ای که join ثبت کرده»
  - [x] <!-- id: 47 --> راستی‌آزمایی دست‌نخورده ماندن `SENSITIVE_BYPASS_PERMS` و whitelist عملگرها
  - [x] <!-- id: 48 --> تست گزارش‌گیری در هر دو نصب تک‌ماژولی و ثبت موجودیت‌های مجزای حسابداری بدون وابستگی به انبار

- [x] <!-- id: 49 --> **فاز ۶: فرانت‌اند — کتابخانه‌های workspace، مسیر lazy و manifest ماژول**
  - [x] <!-- id: 50 --> افزودن کتابخانه‌های `platform-shell`، `warehouse-ui` و `accounting-ui` به `angular.json` و `tsconfig.json` با حفظ `warehouse-app` به‌عنوان پوستهٔ اپ
  - [x] <!-- id: 51 --> تبدیل ۴۰ ایمپورت eager در `app.routes.ts:1-42` به `loadChildren` برای هر دو ماژول
  - [x] <!-- id: 52 --> راستی‌آزمایی حفظ عین همهٔ مسیرها و هر ۳۵+ ریدایرکت legacy (`app.routes.ts:217-254`)
  - [x] <!-- id: 53 --> جایگزینی `WAREHOUSE_CHECK_PERMS` و `PERSONNEL_CHECK_PERMS` (سطر ۴۴-۶۰) با `moduleRegistry.permissionMarkers(code)` تغذیه‌شده از `installed_modules`
  - [x] <!-- id: 54 --> وارونه‌سازی `AppPersonaService`: تبدیل اتحاد `AppModuleType` به کد رشته‌ای و تبدیل ~۱۰ شرط `if (app === ...)` به lookup در `spec`
  - [x] <!-- id: 55 --> export کردن `NavItem[]` از هر کتابخانه و merge گروه‌های ثبت‌شده در `navItems` (`layout.ts:1098`)، با تبدیل پرچم `isAccounting` به `module: 'accounting'`
  - [x] <!-- id: 56 --> راستی‌آزمایی حفظ گیت‌های SoD روی `finance-cartable`، `treasury-cartable` و `manager-approvals`
  - [x] <!-- id: 57 --> تبدیل سه متد `enterX()` و سه گتر `hasX` در `app-launcher.ts` به یک حلقه روی `persona.accessibleApps()`
  - [x] <!-- id: 58 --> تبدیل `MODEL_TABLES` (`sync-pull.service.ts:25-30`) به `pullEntities` ثبتی
  - [x] <!-- id: 59 --> تعمیم کلید cursor از `${userId}:${warehouseId}` به `${userId}:${scopeKind}:${scopeId}` با خوانده شدن همچنانی کلیدهای قدیمی (expand-contract)
  - [x] <!-- id: 60 --> مشتق کردن `SCOPED_DB_NAMES` از کد ماژول با **قفل مطلق نام دو دیتابیس فعلی** (ارتقای نسخه مجاز، rename ممنوع)
  - [x] <!-- id: 61 --> رفع نگاشت غلط قلمرو در `offline-db.ts:213`: الگوی `/doc-tasks|/doc_tasks` به `finance` نگاشت می‌شود ولی `docTasks` موجودیت انباری است (`sync-pull.service.ts:29`) ⇒ نوشتن رکورد صف در دیتابیس اصلاح شد
  - [x] <!-- id: 62 --> افزودن کانفیگ بیلد `accounting-only` بدون هیچ chunk انباری در `dist/` (چانک استاب ۷۷ بایت)
  - [x] <!-- id: 63 --> اجرای نگهبان ۳۳ (ایزولاسیون باندل)، ۳۴ (تداوم آفلاین) و ۳۵ (تطابق مسیر و مجوز) — هر سه کاملاً سبز (PASS)

- [x] <!-- id: 64 --> **فاز ۷: بسته‌بندی و اثبات سه پروفایل نصب**
  - [x] <!-- id: 65 --> نهایی‌سازی سه `pyproject.toml` با `[project.entry-points."wh.module"]` برای هر توزیع (`wh-platform`، `wh-warehouse`، `wh-accounting`)
  - [x] <!-- id: 66 --> الزام `wh-platform >= 1.0, < 2.0` در دو ماژول و بررسی بازهٔ `requires_platform` در استارت‌آپ رجیستری با پیام خطای فارسی روشن
  - [x] <!-- id: 67 --> سبز کردن پروفایل (الف) `platform + accounting`: `check`، `migrate` از دیتابیس خالی، صحت `installed_modules`، و ۴۰۴ بودن `/api/inventory/` و `/api/warehouses/`
  - [x] <!-- id: 68 --> سبز کردن پروفایل (ب) `platform + warehouse`: `check`، `migrate` از دیتابیس خالی، صحت `installed_modules`، و ۴۰۴ بودن `/api/personnel/`
  - [x] <!-- id: 69 --> سبز کردن پروفایل (ج) هر سه بسته، با تکرار **بی‌کم‌و‌کاست رفتار امروز** و پاسخ‌دهی استاندارد اندپوینت‌ها
  - [x] <!-- id: 70 --> اجرای نگهبان ۳۱ (`guardian_31_install_profiles.py`) و تایید کامل هر سه پروفایل نصب (PASS)

- [x] <!-- id: 71 --> **فاز ۸: آمادگی دفتر کل (فقط نقاط توسعه، بدون ساخت هیچ جدول GL)**
  - [x] <!-- id: 72 --> تعریف پروتکل `AccountingDocumentSource` با متد `to_journal_lines()` در پلتفرم (`platform_core/accounting_protocol.py`)
  - [x] <!-- id: 73 --> پیاده‌سازی `to_journal_lines()` روی `ExpenseInvoice`، تسویهٔ حقوق (`MonthlyPayrollRecord`)، پرداخت خزانه (`MonthlyWorkPeriod`) و تسویهٔ ناوگان (`VehicleTripLog`)
  - [x] <!-- id: 74 --> ایجاد جدول outbox `AccountingEvent(source_model, source_id, occurred_at, payload, posted_at NULL)` و تابع تراکنشی `emit_accounting_event()`
  - [x] <!-- id: 75 --> اعلام رسمی `FinancialProject`/`ProjectSection` به‌عنوان بُعد مرکز هزینه و `Counterparty` به‌عنوان بُعد تفصیلی، با رزرو `account_code` nullable روی مدل `Counterparty`
  - [x] <!-- id: 76 --> قفل و مستندسازی دقت پول روی `DecimalField(max_digits=15, decimal_places=0)` (ریال)
  - [x] <!-- id: 77 --> رزرو جایگاه توزیع `wh-accounting-gl` در گراف وابستگی `pyproject.toml` و اجرای موفق نگهبان ۳۶ (`guardian_36_gl_readiness.py`) (PASS)

- [/] <!-- id: 78 --> **راستی‌آزمایی نهایی و رگرسیون سراسری**
  - [x] <!-- id: 79 --> `python manage.py check` و `python manage.py makemigrations --check --dry-run` بدون خطا
  - [x] <!-- id: 80 --> `python manage.py test accounts personnel warehouses inventory reports communications` کاملاً سبز (پرسنل: ۸۱/۸۱، مجموع ۳۵۷ تست سبز)
  - [x] <!-- id: 81 --> `lint-imports` سبز و کاهش مداوم شمار نقض‌های فاز ۰ (یال‌های مستقیم از ۲۸ به ۲۳، پروداکشن از ۱۰ به ۵)
  - [x] <!-- id: 82 --> سبز بودن کل نگهبان‌های این طرح (۲۹، ۳۰، ۳۱، ۳۳، ۳۴، ۳۵ و ۳۶)
  - [x] <!-- id: 83 --> `npx tsc --noEmit` و `npm run build` بدون خطا در پروفایل‌های بیلد استاندارد و accounting-only
  - [x] <!-- id: 84 --> اثبات معیار پذیرش قاطع: `pip install wh-platform wh-accounting` سامانه‌ای بدهد که هیچ کد انباری (مدل، مایگریشن، اندپوینت، chunk) ندارد و در همان حال ورود، RBAC، ممیزی، چت، تنظیمات، تشخیص آنلاین/آفلاین، بکاپ و کل دامنهٔ حسابداری بی‌عیب کار کند
  - [ ] <!-- id: 85 --> تایید نهایی مسیرهای پشت ورود روی محیط عملیاتی (پشت Cloudflare Tunnel) توسط کاربر
  - [ ] <!-- id: 86 --> نوشتن `walkthrough_phase*.md` برای فازهای ۴ تا ۸ مطابق رویهٔ خانه

</div>
