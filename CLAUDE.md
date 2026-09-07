# قوانین و معماری پروژه

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits
- Validate input at system boundaries

## مجوزها و حالت کاری

- مجوزها **bypass** هستند: در `.claude/settings.local.json` پروژه و در `~/.claude/settings.json` سراسری، `permissions.defaultMode` برابر `bypassPermissions` است (`skipDangerousModePermissionPrompt: true`). برای دستورها و ویرایش‌ها تأیید اضافه از کاربر نخواه.
- تنها استثنا که عمداً حفظ شده: ردِ خواندن `.env` / `.env.*` در `.claude/settings.json`. این quiet است (اعلان نمی‌سازد) و برای جلوگیری از درزِ کلیدهاست. فقط با درخواست صریح کاربر حذف شود.
- کار فقط روی شاخهٔ `main` در پوشهٔ اصلی `E:/warehouse project`. بدون اجازهٔ کاربر شاخه یا worktree جدید نساز؛ حتی اگر سشن داخل worktree باز شد، ویرایش‌ها را با مسیر مطلق روی main انجام بده.

## ساختار مخزن (monorepo)

- `warehouse-backend/` — بک‌اند Django (با `venv/`). پیکربندی در `warehouse-backend/config/` (`settings.py`, `urls.py`, `asgi.py`, `wsgi.py`).
- `warehouse-front/` — فرانت Angular (`src/app/`). سرویس‌های کلیدی در `src/app/core/services/`.
- `scripts/` — اسکریپت‌های نگهبان/آزمون (`scripts/e2e/`).
- `Documents/Modular_Split_Warehouse_Accounting/` — مستندات و چک‌لیست جداسازی ماژول‌ها.
- `pyproject.toml` — بستهٔ چتر توسعه‌ای `wh-suite` (فقط dev؛ `import-linter==2.3` dev).

### اپ‌های بک‌اند (Django)

`accounts`, `common`, `communications`, `config`, `inventory`, `notifications`, `personnel`, `reports`, `settings_core`, `warehouses`.

- `config` — تنظیمات و بوت سیستم. `AUTH_USER_MODEL` موضوعِ جداسازی است؛ در نگهبان‌ها گاه `auth.User`.
- `settings_core` — اپ پلتفرمی که از `warehouses` جدا شد؛ مدل `SystemSetting` با `SeparateDatabaseAndState` و `db_table='warehouses_systemsetting'`. توابع تنظیمات در `settings_core/services.py`؛ shim در `warehouses/services.py`؛ Viewsetها در `settings_core/views.py`. کلید `installed_modules` در `/api/public/config/`.
- `warehouses` — هستهٔ انبار. `Warehouse.assigned_users` (M2M، `db_table='accounts_customuser_assigned_warehouses'`). `management/commands/setup_project.py`.
- `accounts` — کاربران و حسابداری. `AuditLog.warehouse_id` عددی (IntegerField) با همان ستون/ایندکس قبلی؛ رجیستری `AUDIT_MODULES` در `accounts/models.py`.
- `personnel` — ماژول‌های حسابداری (attendance/fleet/payroll/treasury/projects/invoices) که در `personnel/apps.py` ثبت می‌شوند.
- `communications` — چت.
- `reports` — موتور گزارش‌ساز (در `reports/`؛ فایل‌های `engine.py`, `registry.py`, `views.py`, `pdf.py`).

## معماری فرانت (Angular)

- سرویس‌های حیاتی در `src/app/core/services/`: `offline-db.ts`, `offline-sync.service.ts`, `server-reachability.ts`, `sync-pull.service.ts`, `network-status.service.ts`, `photo-upload-queue.service.ts`, `session-tab.service.ts`, `system-health.service.ts`, `import.service.ts`, `communication.service.ts`.
- آفلاین/PWA: Service Worker انگولار با وصلهٔ پس از build در `tools/patch-ngsw-530.js` که در `npm run build` اجرا می‌شود (build مستقیم `ng build` وصله را جا می‌اندازد — همیشه `npm run build`).

## قواعد سخت و تصمیم‌های پذیرفته‌شده

- **هیچ داده‌ای نباید از بین برود.** کش منقضی‌شده پاک نمی‌شود، فقط `isStale` گزارش می‌شود. رکورد صف همگام‌سازی فقط با پذیرش صریح سرور (2xx) یا رد صریح (4xx) حذف می‌شود؛ 5xx یعنی retry، نه حذف. هر تغییری که مسیر از-دست-رفتن داده باز کند قبل از اعمال باید مطرح شود.
- **پشت Cloudflare Tunnel** (`app.farsalish.ir`): کدهای ۵۲۰–۵۳۰ یعنی origin در دسترس نیست، نه خطای بک‌اند. جای دیباگ خطای عملیاتی، اول بررسی کن خطا از Cloudflare است یا Django. تفسیر وضعیت HTTP باید از `isServerUnreachable()` در `core/services/server-reachability.ts` استفاده کند، نه `status >= 500` یا `status === 0`.
- **تصمیم‌های آگاهانهٔ کاربر (در ممیزی به‌عنوان ایراد گزارش نشوند):** فهرست مخاطبین چت (`ChatContactsListView` در `communications/views.py`) عمداً همهٔ کاربران فعال را برمی‌گرداند و به انبار محدود نمی‌شود؛ و کاربران احراز هویت‌شده سقف نرخ کلی ندارند (فقط `AnonRateThrottle` و `ScopedRateThrottle` فعال‌اند) تا پشت تونل قفل نشوند.
- **جستجوی متن فارسی هرگز با `grep` در Bash** — Git Bash ویندوز UTF-8 را مخدوش می‌کند؛ از ابزار Grep استفاده کن.
- **گذرواژه/صفحات پشت ورود را خودم نمی‌بینم** — تأیید نهایی هر چیزی پشت صفحهٔ ورود (داشبورد، انبارها، شمارش) با کاربر است. تا جایی که ممکن است با شبیه‌سازی سمت سرور یا روی صفحهٔ لاگین تأیید کن و صریح بگو چه چیزی تأییدنشده مانده و کاربر چطور خودش بیازماید.
- **کارهای ساده را به خود کاربر بسپار** (بیلد، ری‌استارت، حذف پوشه، `git pull`) تا توکن مصرف نشود؛ فقط دستور آماده بده. برای کارهای ارزشمند (ریشه‌یابی، معماری، تغییر چندفایلی) خودت انجام بده. پاسخ‌ها کوتاه بمانند.

## جداسازی ماژول‌ها (modular split)

طرح «انبارگردانی و حسابداری به دو ماژول نصب‌شدنی مستقل». مرجع: `Documents/Modular_Split_Warehouse_Accounting/implementation_plan_modular_split.md`؛ چک‌لیست `task_modular_split.md`؛ walkthrough هر فاز `walkthrough_phaseN.md`.

- **فاز ۰:** حصار C1–C4 در `.importlinter`، چتر dev `wh-suite`، نگهبان ۲۹ (`scripts/e2e/guardian_modularization.py`)، baseline `modularization_baseline.json`.
- **فاز ۱:** اپ `settings_core`؛ `SystemSetting` منتقل شد (صفر مهاجرت داده)؛ ستون `warehouse_id` عددی؛ رفتار CASCADE با سیگنال `post_delete` در `warehouses/signals.py`.
- **فاز ۲:** بریدن یال‌های هسته → انبار (expand-contract صفر مهاجرت داده): M2M `assigned_warehouses` به `warehouses`؛ `AuditLog.warehouse_id` عددی؛ رجیستری `AUDIT_MODULES`؛ `setup_project.py` به `warehouses/management/commands/`؛ مایگریشن‌های دستی `accounts/0035` و `warehouses/0005`.
- **فاز ۳** (رجیستری قابلیت‌ها) قلب طرح است و **فقط با درخواست صریح کاربر** آغاز می‌شود.

## دستورها و ابزارها

- اجرای `lint-imports` نیازمند `PYTHONUTF8=1` است (فارسی در فایل‌های config). حالت خروجی `lint-imports` عمداً report-only با کد ۱ است؛ دروازهٔ واقعی نگهبان ۲۹ است که شمار نقض‌ها را با baseline مقایسه می‌کند و فقط در صورت *افزایش* شکست می‌خورد.
- نگهبان‌ها: `python scripts/e2e/guardian_modularization.py` (۲۹), `guardian_30_settings_core.py`, `guardian_32_zero_migration.py`, `guardian_all.py`.
- تست: `./venv/Scripts/python.exe manage.py test ...` (دیتابیس تست postgres در محیط توسعهٔ من در دسترس نیست؛ اجرای تست سنگین با کاربر است).
- چک: `./venv/Scripts/python.exe manage.py check`.
