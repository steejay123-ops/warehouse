<div dir="rtl" align="right">

# طرح جامع معماری و تعیین سطوح دسترسی و تفکیک وظایف (Strict RBAC & Segregation of Duties)

> [!IMPORTANT]
> **اصل بنیادین ایزولاسیون نقش‌ها (Role Isolation Invariant):**
> کاربری که برای مثال فقط به عنوان «حسابدار» تعریف شده است، باید صرفاً و منحصراً به منوی حسابدار دسترسی داشته باشد و به هیچ وجه نباید سایر منوهای کارکرد (کارمند، سرپرست کارگاه، مدیر، خزانه‌دار) یا نرم‌افزار و کارتابل‌های انبارگردانی را مشاهده کرده یا به آن‌ها دسترسی داشته باشد.

---

## ۱. اهداف و چشم‌انداز طرح
این طرح پیاده‌سازی سازوکار غیرقابل‌نفوذ، قطعی و چندلایه‌ای برای تعیین، تفکیک و اجرای سطوح دسترسی (`Role-Based Access Control - RBAC`) و اصل تفکیک سخت‌گیرانه وظایف (`Segregation of Duties - SoD`) را در کل سامانه مستقر می‌سازد.

پوشش کامل سطوح دسترسی شامل چهار لایه است:
1. **لایه ناوبری و منوی سایدبار (`Sidebar Navigation & UI Layer`):** نمایش انحصاری آیتم‌های نقش فعال و پنهان‌سازی کامل سایر منوها.
2. **لایه حفاظت مسیرها (`Route Guards & Navigation Protection`):** جلوگیری از باز شدن مستقیم صفحات از طریق نوار آدرس (`Direct URL Input`).
3. **لایه تفکیک نرم‌افزارها (`Cross-App Boundary Isolation`):** ایزولاسیون کامل بین سامانه مالی و سامانه انبارداری و سامانه پدافند.
4. **لایه وب‌سرویس و تراکنش‌های بک‌اند (`API Endpoint Permissions & Transaction Guard`):** راستی‌آزمایی نقش و امضای دیجیتال توکن در کنترلرهای جنگو.

---

## ۲. ماتریس کامل سطوح دسترسی سیستم (System-Wide RBAC Matrix)

### بخش اول: سامانه مالی، کارکرد و پرسنلی (`Accounting / Personnel`)

| نام و جایگاه نقش | کد نقش (`activeRole`) | منوی اختصاصی در سایدبار | صفحات و روت‌های مجاز | مجوزهای اختصاصی بک‌اند | خطوط قرمز قطعی (SoD Prohibitions) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **کارمند کارگاه** | `operator` | منوی ثبت کارمند (تم کهربایی) | • کارکرد پرسنل (`/app/finance/employee-attendance`)<br>• کارکرد ماشین‌آلات (`/app/finance/employee-fleet`)<br>• ثبت فاکتور هزینه (`/app/finance/employee-invoices`)<br>• ثبت تن‌خواه (`/app/finance/employee-petty-cash`)<br>• تعریف خودرو (`/app/finance/employee-new-vehicle`)<br>• تعریف پرسنل (`/app/finance/employee-new-personnel`) | `view_sys_personnel_attendance`<br>`view_sys_fleet_attendance`<br>`can_act_as_operator` | تایید کارکرد، تغییر مبالغ، محاسبه حقوق، پرداخت، نرم‌افزار انبارداری |
| **سرپرست کارگاه** | `supervisor` | منوی سرپرست کارگاه (تم زمردی) | • تایید کارکرد پرسنل (`/app/finance/supervisor-attendance`)<br>• تایید کارکرد ناوگان (`/app/finance/supervisor-fleet`)<br>• تایید فاکتورها (`/app/finance/supervisor-invoices`)<br>• تایید تنخواه‌ها (`/app/finance/supervisor-petty-cash`)<br>• تایید پرسنل و ناوگان (`/app/finance/supervisor-new-profiles`)<br>• قفل دوره کارکرد (`/app/finance/supervisor-period-lock`) | `perm_approve_personnel_supervisor`<br>`perm_approve_fleet_supervisor`<br>`perm_lock_work_period`<br>`can_act_as_supervisor` | ثبت تردد اولیه، محاسبه حقوق و دستمزد، تایید نهایی پرداخت، دیسکت‌های بیمه و مالیات، انبارداری |
| **حسابدار** | `accountant` | منوی حسابدار (تم آبی) | • حقوق و دستمزد ماهانه (`/app/finance/accountant-payroll`)<br>• تسویه‌حساب ناوگان (`/app/finance/accountant-fleet`)<br>• ممیزی فاکتورهای هزینه (`/app/finance/accountant-invoices`)<br>• کنترل تن‌خواه‌گردان (`/app/finance/accountant-petty-cash`)<br>• دیسکت‌های بیمه و مالیات (`/app/finance/accountant-diskettes`)<br>• معین طرف‌حساب‌های مالی (`/app/finance/accountant-counterparties`)<br>• پروژه‌ها و بخش‌ها (`/app/finance/projects-and-sections`) | `view_sys_payroll`<br>`view_sys_fleet_settlement`<br>`perm_approve_personnel_finance`<br>`perm_approve_fleet_finance`<br>`can_act_as_accountant`<br>`view_sys_projects` | ثبت تردد خام روزانه، تایید اولیه کارگاه، صدور مجوز پرداخت مدیر، واریز خزانه، نرم‌افزار انبار |
| **مدیر شرکت** | `manager` | منوی مدیر (تم بنفش) | • داشبورد هوش مدیریتی (`/app/finance/manager-dashboard`)<br>• کارتابل تاییدات و پرداخت (`/app/finance/manager-approvals`)<br>• کنترل بودجه و هزینه‌ها (`/app/finance/manager-budget`)<br>• تصویب احکام و قراردادها (`/app/finance/manager-contracts`)<br>• گزارشات جامع مدیریتی (`/app/finance/manager-reports`) | `can_act_as_manager`<br>`perm_manager_payment_authorize`<br>`perm_approve_personnel_manager`<br>`perm_approve_fleet_manager` | ثبت تردد خام، دستکاری فرمول محاسبات حقوق، پرداخت مستقیم پایا (بدون خزانه)، انبارداری میدانی |
| **خزانه‌دار** | `treasury` | منوی خزانه‌دار (تم فیروزه‌ای) | • پرداخت حقوق و ناوگان (`/app/finance/treasurer-disbursements`)<br>• تسویه فاکتور و تن‌خواه (`/app/finance/treasurer-invoices`)<br>• حساب‌های بانکی و صندوق (`/app/finance/treasurer-bank-accounts`)<br>• مدیریت چک و اسناد (`/app/finance/treasurer-cheques`)<br>• مغایرت‌گیری و نقدینگی (`/app/finance/treasurer-reconciliation`) | `view_sys_treasury`<br>`perm_treasury_disburse_action` | ایجاد و تغییر مبالغ حقوق و فاکتورها، تاییدات کارکرد و سرپرستی، نرم‌افزار انبار |

---

### بخش دوم: سامانه انبارداری و انبارگردانی (`Warehouse / Inventory`)

| نام و جایگاه نقش | کد نقش (`activeRole`) | صفحات و منوهای مجاز | مجوزهای اختصاصی | خطوط قرمز قطعی (SoD Prohibitions) |
| :--- | :--- | :--- | :--- | :--- |
| **انبارگردان / شمارشگر کور** | `counter` | میزکار شمارش کور، اسکن بارکد و لیبل | `view_sys_counter`, `can_act_as_counter` | مشاهده موجودی دفتری، مشاهده مغایرت‌ها، کارتابل سرپرست، ماژول مالی |
| **سرپرست انبار و شمارش** | `warehouse_supervisor` | کارتابل سرپرست انبار، تخصیص کالا، بررسی مغایرت و بازشماری، ره‌گیری شمارش | `view_sys_supervisor`, `can_act_as_supervisor`, `view_sys_recounts`, `perm_rec_recount`, `perm_rec_dispatch` | تایید نهایی انبارگردانی، تغییر فاکتورهای گمرکی، دسترسی به ماژول مالی |
| **کارشناس اسناد و کالا** | `docs_specialist` | مدیریت کالا و کارتابل اسناد، تخصیص اسناد، صدور و طراحی لیبل | `view_wh_docs`, `can_act_as_doc_worker`, `view_wh_labels`, `view_wh_dispatch` | تایید نهایی اسناد، تایید فید MT، ماژول مالی |
| **سرپرست مالی اسناد انبار** | `doc_supervisor` | تاییدات سرپرست اسناد، فیلدهای مالی و گمرکی، مدیریت تغذیه MT | `view_wh_doc_approvals`, `perm_doc_approve_action`, `view_wh_customs`, `view_wh_feed_approvals`, `perm_feed_approve_action` | شمارش فیزیکی، تایید نهایی کل انبار، ماژول مالی |
| **مدیر انبار / ناظر عالی** | `manager_review` | داشبورد انبار، بررسی نهایی مدیر، ممیزی و لاگ انبار، گزارشات انبار | `view_wh_dashboard`, `view_sys_manager_review`, `perm_inventory_finalize`, `perm_wh_freeze` | ثبت دستی شمارش کور، ماژول مالی |

---

### بخش سوم: سامانه پدافند و مدیریت کلان (`Operations / SOC`)

| نام و جایگاه نقش | کد نقش (`activeRole`) | صفحات مجاز | مجوزهای اصلی | ملاحظات امنیتی |
| :--- | :--- | :--- | :--- | :--- |
| **فرمانده عملیات و پدافند** | `ops_commander` | کاک‌پیت عملیات، پایش سلامت سرور، مانیتورینگ سینک تبلت‌ها، حاکمیت RBAC | `admin_all`, `perm_sys_logs` | عدم امکان تغییر مستقیم رکوردهای مالی، تسویه و اسناد تجاری انبار |
| **مدیر ارشد سازمان** | `superuser` | دسترسی به تمام حوزه‌ها با امکان جابجایی بین نرم‌افزارها و نقش‌ها از طریق سوییچر | تمام مجوزها (`is_superuser = True`) | رعایت الزامات تایید دومرحله‌ای ۶ مجوز فوق‌حساس |

---

## ۳. معماری فنی اصلاحات مورد نیاز

### ۱. اصلاح سایدبار فرانت‌اند (`Strict Menu Isolation in layout.ts & layout.html`)
- **حذف فال‌بک‌های عمومی:** شرط‌های باز مانند `|| userPerms.includes('view_sys_personnel')` از متدهای سیگنالی منوها حذف می‌شوند.
- **انطباق بر `activeRole()`:**
  - هر اکاردئون منو تنها زمانی پر می‌شود که `activeRole` دقیقاً مطابق با آن نقش باشد (یا کاربر سوپریوزر باشد).
  - اگر کاربری مثلاً حسابدار باشد، آرایه‌های `employeeNavItems`, `supervisorNavItems`, `managerNavItems`, `treasurerNavItems` خالی خواهند بود و اکاردئون‌های آن‌ها از درخت DOM محو می‌شوند.
- **حذف تکرار منوی عمومی «کارکرد و حسابداری» (`accountingNavItems`):**
  - این بخش با منوهای ۵ نقشی یکپارچه و فیلتر می‌شود تا هیچ منوی موازی وجود نداشته باشد.
- **ایزولاسیون کارت تغییر انبار:**
  - دکمه‌ها و المان‌های انبارداری فقط زمانی در سایدبار قرار می‌گیرند که `personaService.hasWarehouseAccess()` مقدار `true` داشته باشد.

### ۲. ارتقای گارد مسیرها (`Route-Level Guarding in auth.guard.ts`)
- جدول `ROUTE_PERMISSIONS` با روت‌های جدید ۵ نقش هماهنگ شده است.
- منطق گارد ارتقا می‌یابد تا انطباق روت با `activeRole` را تضمین کند؛ در صورت عدم تطابق، کاربر فوراً به روت مجاز خود ریدایرکت خواهد شد.

### ۳. استانداردسازی پرزت‌های نقش در مدال مدیریت کاربران (`users.ts`)
- پرزت‌های پیش‌فرض دکمه‌های «تخصیص با یک کلیک» در مدال نقش‌ها اصلاح می‌شوند تا مجوزهای مازاد و غیرمرتبط (مانند اعطای تصادفی دسترسی انبار به حسابدار) به طور ریشه‌ای حذف شوند.

---

</div>
