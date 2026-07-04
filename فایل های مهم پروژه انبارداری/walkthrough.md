# 🚀 Walkthrough — فاز ۱: زیرساخت فرانت‌اند

## خلاصه
زیرساخت معماری فرانت‌اند بازسازی شد تا آماده اتصال به بک‌اند Django + PostgreSQL باشد. فعلاً با **mock data** کار می‌کند و با تغییر `environment.useMockData = false` به API واقعی وصل می‌شود.

---

## فایل‌های جدید (۲۷ فایل)

### مدل‌ها — `core/models/`
| فایل | شرح |
|-------|------|
| [user.model.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/models/user.model.ts) | `User`, `Role`, `Permission` + payload types |
| [project.model.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/models/project.model.ts) | `Project`, `ProjectStats` + payload types |
| [record.model.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/models/record.model.ts) | `Record`, `Tag`, status enums, filter/bulk payload types |
| [audit-log.model.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/models/audit-log.model.ts) | `AuditLog`, `ImportLog` + filter types |
| [api-response.model.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/models/api-response.model.ts) | `Paginated<T>`, `ApiError`, `AuthTokens`, `LoginResponse`, `DashboardSummary` |
| [index.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/models/index.ts) | Barrel export |

### سرویس‌های API — `core/api/`
| فایل | Endpoints |
|-------|-----------|
| [api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/api.service.ts) | Base HTTP wrapper با trailing slash برای DRF |
| [project-api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/project-api.service.ts) | `GET/POST/PATCH/DELETE /projects/` + stats + export |
| [record-api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/record-api.service.ts) | CRUD + bulk-import/dispatch/tag/label/recount + export |
| [user-api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/user-api.service.ts) | CRUD + suspend + reset-password |
| [role-api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/role-api.service.ts) | CRUD + permissions list |
| [dashboard-api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/dashboard-api.service.ts) | summary + weekly chart + progress |
| [audit-api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/audit-api.service.ts) | Audit log listing with filters |
| [feeding-api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/feeding-api.service.ts) | MT26/MT49 export + confirm |
| [tag-api.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/tag-api.service.ts) | Tag list + create |
| [index.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/api/index.ts) | Barrel export |

### احراز هویت — `core/auth/`
| فایل | شرح |
|-------|------|
| [auth.service.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/auth/auth.service.ts) | JWT login/logout/refresh با Angular Signals + mock fallback |
| [auth.guard.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/auth/auth.guard.ts) | گارد احراز هویت |
| [role.guard.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/auth/role.guard.ts) | گارد نقش‌محور (factory pattern) |
| [auth.interceptor.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/auth/auth.interceptor.ts) | Auto-attach JWT + refresh on 401 |
| [index.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/auth/index.ts) | Barrel export |

### خطایابی — `core/error/`
| فایل | شرح |
|-------|------|
| [error.interceptor.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/error/error.interceptor.ts) | Global error → Persian toast messages |

### State — `core/stores/`
| فایل | شرح |
|-------|------|
| [auth.store.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/stores/auth.store.ts) | UI signals: active warehouse, current tab, sidebar |
| [index.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/core/stores/index.ts) | Barrel export |

### محیط — `environments/`
| فایل | شرح |
|-------|------|
| [environment.ts](file:///e:/Front%20Project8.3/warehouse-app/src/environments/environment.ts) | Production: `useMockData = false` |
| [environment.development.ts](file:///e:/Front%20Project8.3/warehouse-app/src/environments/environment.development.ts) | Development: `useMockData = true` |

---

## فایل‌های ویرایش شده (۴ فایل)

| فایل | تغییر |
|-------|--------|
| [app.config.ts](file:///e:/Front%20Project8.3/warehouse-app/src/app/app.config.ts) | اضافه شدن `provideHttpClient` + interceptors |
| [index.html](file:///e:/Front%20Project8.3/warehouse-app/src/index.html) | فونت Vazirmatn CDN + meta description |
| [package.json](file:///e:/Front%20Project8.3/warehouse-app/package.json) | حذف `@tailwindcss/postcss` v4 (رفع تداخل با v3) |
| [angular.json](file:///e:/Front%20Project8.3/warehouse-app/angular.json) | `fileReplacements` برای environment |

---

## ساختار جدید `core/`

```
src/app/core/
├── api/
│   ├── api.service.ts
│   ├── audit-api.service.ts
│   ├── dashboard-api.service.ts
│   ├── feeding-api.service.ts
│   ├── index.ts
│   ├── project-api.service.ts
│   ├── record-api.service.ts
│   ├── role-api.service.ts
│   ├── tag-api.service.ts
│   └── user-api.service.ts
├── auth/
│   ├── auth.guard.ts
│   ├── auth.interceptor.ts
│   ├── auth.service.ts
│   ├── index.ts
│   └── role.guard.ts
├── error/
│   └── error.interceptor.ts
├── models/
│   ├── api-response.model.ts
│   ├── audit-log.model.ts
│   ├── index.ts
│   ├── project.model.ts
│   ├── record.model.ts
│   └── user.model.ts
└── stores/
    ├── auth.store.ts
    └── index.ts
```

---

## تست و اعتبارسنجی
- ✅ `ng build --configuration development` — Build موفق
- ✅ تمام فایل‌های جدید بدون خطای TypeScript compile شدند
- ✅ Interceptors به درستی در `app.config.ts` ثبت شدند

---

## گام بعدی — فاز ۲
فاز ۲ شامل ساخت **کامپوننت‌های مشترک** (DataTable، Modal، Toast، StatusBadge و...) است. آیا ادامه دهیم؟
