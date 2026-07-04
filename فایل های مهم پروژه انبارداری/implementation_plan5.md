# 🔍 مرور فاز ۵: اتصال به Backend (Django REST API)

## 📌 خلاصه وضعیت فعلی پروژه

فازهای قبلی با موفقیت انجام شده‌اند:

| فاز | عنوان | وضعیت |
|-----|-------|-------|
| فاز ۱ | مهاجرت به Angular 19 + Tailwind CSS | ✅ تکمیل |
| فاز ۲ | ساخت کامپوننت‌های مشترک (Modal, ConfirmDialog, DataTable, FileUpload, StatusBadge) | ✅ تکمیل |
| فاز ۳ | ساخت سرویس‌ها و ساختار core (State, Auth, Toast) | ✅ تکمیل |
| فاز ۴ | بازنویسی صفحات داخلی (Projects, Dispatch, Docs) با کامپوننت‌های جدید | ✅ تکمیل |
| **فاز ۵** | **اتصال به Backend (Django + PostgreSQL)** | ⏳ **آماده شروع** |

---

## 🎯 هدف فاز ۵

در فاز ۴ (و سوالات باز آن) مشخص شده بود که گام بعدی **اتصال Angular به Backend واقعی** است. در حال حاضر تمام داده‌ها به صورت **Mock** در `state.service.ts` ذخیره شده‌اند و هیچ API واقعی وجود ندارد.

**فاز ۵ شامل این کارهاست:**

### ۱. ساخت Django Backend
- راه‌اندازی پروژه Django
- ایجاد مدل‌ها (Warehouse, Record, User, Role, Tag, Assignment)
- اتصال به PostgreSQL
- پیاده‌سازی REST API با Django REST Framework
- احراز هویت JWT (`djangorestframework-simplejwt`)

### ۲. REST API Endpoints (طبق طراحی اولیه)
```
POST   /api/auth/login/                    # ورود (JWT)
POST   /api/auth/refresh/                  # بروزرسانی توکن
POST   /api/auth/logout/                   # خروج

GET    /api/warehouses/                    # لیست انبارها
POST   /api/warehouses/                    # ایجاد انبار جدید
GET    /api/warehouses/{id}/               # جزئیات انبار
PATCH  /api/warehouses/{id}/               # ویرایش انبار
DELETE /api/warehouses/{id}/               # حذف/بایگانی انبار
PATCH  /api/warehouses/{id}/freeze/        # فریز/آنفریز
GET    /api/warehouses/{id}/stats/         # آمار و KPI

GET    /api/records/?warehouse={id}        # لیست رکوردها
POST   /api/records/                       # ایجاد رکورد
PATCH  /api/records/{id}/                  # ویرایش رکورد
POST   /api/records/bulk-assign/           # تخصیص گروهی
POST   /api/records/bulk-tag/              # تگ‌گذاری گروهی
POST   /api/records/import/                # آپلود اکسل

GET    /api/users/                         # لیست کاربران
POST   /api/users/                         # ایجاد کاربر
PATCH  /api/users/{id}/                    # ویرایش کاربر
PATCH  /api/users/{id}/toggle-status/      # تعلیق/فعالسازی
POST   /api/users/{id}/reset-password/     # ریست رمز

GET    /api/roles/                         # لیست نقش‌ها (tree)
POST   /api/roles/                         # ایجاد نقش
PATCH  /api/roles/{id}/                    # ویرایش نقش
DELETE /api/roles/{id}/                    # حذف نقش

GET    /api/dashboard/kpi/                 # آمار داشبورد
```

### ۳. تغییرات در Angular Frontend
- ایجاد سرویس‌های HTTP جداگانه (جایگزین Mock data):
  - `WarehouseHttpService`
  - `RecordHttpService`
  - `UserHttpService`
  - `RoleHttpService`
  - `AuthHttpService`
- اتصال `HttpClient` به API واقعی
- مدیریت JWT Token (Interceptor)
- مدیریت خطاها (Error Handling)

### ۴. ساختار پیشنهادی Backend
```
backend/
├── config/                  # تنظیمات Django
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── accounts/            # مدیریت کاربران و احراز هویت
│   ├── warehouses/          # مدیریت انبارها
│   ├── inventory/           # رکوردهای کالا
│   ├── roles/               # نقش‌های سازمانی
│   └── notifications/       # (اختیاری) Django Channels
├── requirements/
│   ├── base.txt
│   └── development.txt
├── manage.py
└── docker-compose.yml       # PostgreSQL + Redis
```

---

## ❓ سوالات مهم قبل از شروع

> [!IMPORTANT]
> لطفاً قبل از شروع پیاده‌سازی، موارد زیر را مشخص کنید:

### ۱. آیا PostgreSQL نصب شده است؟
- آیا PostgreSQL روی سیستم شما نصب و در حال اجراست؟
- اگر نه، آیا ترجیح می‌دهید از Docker استفاده کنیم یا نصب مستقیم؟

### ۲. محل پروژه Backend
- آیا پروژه بکند را در همین پوشه `e:\Front Project8.3` ایجاد کنیم (مثلاً `e:\Front Project8.3\backend`)؟
- یا در ریپوی جدا؟

### ۳. اولویت‌بندی
- آیا می‌خواهید ابتدا **فقط Backend** ساخته شود و بعد اتصال انجام شود؟
- یا ترجیح می‌دهید **همزمان** Backend + اتصال Frontend انجام شود؟

### ۴. WebSocket
- آیا به اعلان‌های لحظه‌ای (real-time notifications) نیاز دارید؟
- یا فعلاً REST API کافی است؟

### ۵. Deploy
- آیا نیاز به استقرار روی سرور (Deploy) دارید؟
- یا فعلاً فقط توسعه محلی (localhost) کافی است؟

---

## 🗺️ ساختار فایل‌های فعلی Angular (مرتبط با فاز ۵)

| فایل/سرویس | وضعیت فعلی | تغییر در فاز ۵ |
|-------------|-----------|----------------|
| `state.service.ts` (15KB) | Mock data hardcoded | جایگزینی با HTTP Services |
| `auth.service.ts` | Mock login | اتصال به JWT API |
| `toast.service.ts` | بدون تغییر | بدون تغییر |
| کامپوننت‌های صفحات | وابسته به `state.service` | اتصال به سرویس‌های HTTP جدید |

