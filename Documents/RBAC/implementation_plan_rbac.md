<div dir="rtl" align="right">

# پیاده‌سازی بررسی مجوزهای بک‌اند (Backend RBAC)

هدف از این طرح، ایمن‌سازی APIهای بک‌اند (جنگو) به گونه‌ای است که دقیقاً همان مجوزهای تعریف شده برای فرانت‌اند (مثل `view_sys_counter`، `perm_usr_edit` و غیره) در بک‌اند نیز بررسی شوند. در این حالت، حتی اگر درخواستی مستقیماً از طریق نرم‌افزاری غیر از فرانت‌اند (مانند اپلیکیشن موبایل یا Postman) ارسال شود، بک‌اند آن را بر اساس دسترسی‌های کاربر اعتبارسنجی می‌کند.

## User Review Required

> [!IMPORTANT]
> **بررسی و تایید ماتریس دسترسی بک‌اند:**  
> لطفاً دقت کنید که در این طرح، دسترسی‌ها را بر اساس سناریوهای رایج سیستم‌های انبارداری چیده‌ایم. در صورت نیاز به تغییر این منطق، قبل از اجرا اعلام کنید.

## Open Questions

> [!WARNING]
> **ابهامات و سوالات برای تصمیم‌گیری:**  
> ۱. **خواندن لیست انبارها:** در حال حاضر برای دیدن لیست انبارها (Warehouse)، آیا کاربران عادی (مثل شمارنده‌ها) هم باید بتوانند انبارهای مجاز خود را از طریق API دریافت کنند؟ (معمولاً خواندن لیست انبارها برای همه کاربرانی که لاگین کرده‌اند مجاز است، اما ایجاد/ویرایش انبار نیاز به مجوز `perm_wh_create` یا `perm_wh_edit` دارد. آیا این منطق تایید است؟)
> ۲. **خواندن آیتم‌ها (کالاها):** آیا فقط کسانی که دسترسی `view_wh_docs` دارند می‌توانند اطلاعات کالاها را در بک‌اند بخوانند یا شمارنده‌ها (`view_sys_counter`) هم برای انجام شمارش نیاز دارند دیتاهای خاصی از کالاها را بخوانند؟

---

## Proposed Changes

برای پیاده‌سازی این سیستم در بک‌اند، ما از قابلیت `BasePermission` در Django REST Framework استفاده خواهیم کرد.

### 1. Core / Permissions
یک فایل جدید در پروژه (مثلاً در اپلیکیشن `accounts`) برای مدیریت کلاس‌های دسترسی (Permission Classes) ایجاد می‌کنیم.

#### [NEW] `accounts/permissions.py`
در این فایل کلاس‌های زیر تعریف خواهند شد:
- `HasMenuAccess`: بررسی می‌کند که آیا کاربر دسترسی مشخص شده را دارد یا خیر. از آنجا که دسترسی‌های ما در مدل `CustomUser` (در اپلیکیشن accounts) تعریف شده‌اند، پیشوند آنها به صورت `accounts.view_sys_counter` و غیره خواهد بود.
- `IsAdminOrReadOnly`: کلاسی که اجازه خواندن را به همه می‌دهد اما ویرایش را محدود می‌کند.
- `IsSuperUser`: برای محدود کردن دسترسی فقط به سوپریوزرها.

### 2. ViewSets (API Endpoints)
سپس این مجوزها را روی ویوست‌های (ViewSets) موجود اعمال می‌کنیم. 

#### [MODIFY] `accounts/views.py`
- **`UserViewSet`**: 
  - عملیات مشاهده لیست کاربران `list/retrieve`: نیاز به `accounts.view_sys_users`
  - ایجاد کاربر جدید `create`: نیاز به `accounts.perm_usr_add`
  - ویرایش کاربر `update`: نیاز به `accounts.perm_usr_edit`
- **`GroupViewSet` (نقش‌ها)**:
  - نیازمند مجوز `accounts.perm_usr_role`
- **`PermissionViewSet`**:
  - معمولاً فقط خواندنی است و برای ساخت نقش استفاده می‌شود. نیازمند `accounts.perm_usr_role`.

#### [MODIFY] `warehouses/views.py`
- **`WarehouseViewSet`**:
  - عملیات مشاهده `list/retrieve`: آزاد برای کاربران تایید هویت شده (بر اساس فیلتر انبارهای مجاز).
  - ایجاد `create`: نیاز به `accounts.perm_wh_create`
  - ویرایش `update`: نیاز به `accounts.perm_wh_edit`

#### [MODIFY] `inventory/views.py`
- **`ItemViewSet`**:
  - عملیات مشاهده `list/retrieve`: نیاز به دسترسی‌های مرتبط با مدیریت کالا (`view_wh_docs`)
  - عملیات ویرایش `update/partial_update`: نیاز به `accounts.perm_wh_edit`
  - عملیات Bulk Update / تخصیص رکورد: بررسی مجوزهای خاص مانند `accounts.perm_rec_dispatch`
- **`CountTaskViewSet`**:
  - این ویوست باید بر اساس اکشن (Action) کاربر کنترل شود:
  - ثبت شمارش: نیاز به `accounts.view_sys_counter`
  - تأیید سرپرست: نیاز به `accounts.view_sys_supervisor`
  - بازشماری/مغایرت: نیاز به `accounts.view_sys_recounts`

### 3. Global Settings
در نهایت برای اطمینان از اینکه هیچ API ای به اشتباه باز نمی‌ماند:

#### [MODIFY] `config/settings.py`
- تنظیم `DEFAULT_PERMISSION_CLASSES` در بخش `REST_FRAMEWORK` به `IsAuthenticated`، تا مطمئن شویم هیچ API ناشناخته‌ای بدون لاگین در دسترس نخواهد بود.

---

## Verification Plan

### Automated Tests
- بررسی اینکه کاربر شمارنده (`ali`) در صورت تلاش برای ارسال درخواست ساخت کاربر (`POST /api/auth/users/`) ارور `403 Forbidden` دریافت کند.
- بررسی اینکه شمارنده بتواند لیست وظایف شمارش خود را (`GET /api/inventory/count-tasks/`) با موفقیت دریافت کند.

### Manual Verification
1. با کاربر `ali` وارد سیستم شویم.
2. از تب Network مرورگر (یا نرم‌افزار Postman) توکن کاربر `ali` را کپی کنیم.
3. درخواستی برای حذف یا ویرایش اطلاعات یک انبار با استفاده از این توکن ارسال کنیم.
4. تایید کنیم که سرور به درستی خطای عدم دسترسی (`403`) برمی‌گرداند.

</div>
