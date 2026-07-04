# 📋 Task List — فاز ۱: زیرساخت فرانت‌اند

## P0 — رفع مشکلات فوری
- [x] رفع تداخل TailwindCSS v3/v4
- [x] اضافه کردن فونت Vazirmatn از CDN
- [x] اضافه کردن `provideHttpClient()` به `app.config.ts`
- [x] ساخت فایل `environment.ts` و `environment.development.ts`

## P0 — تعریف مدل‌ها (TypeScript Interfaces)
- [x] `core/models/user.model.ts`
- [x] `core/models/project.model.ts`
- [x] `core/models/record.model.ts`
- [x] `core/models/audit-log.model.ts`
- [x] `core/models/api-response.model.ts`
- [x] `core/models/index.ts` (barrel export)

## P0 — لایه سرویس API
- [x] `core/api/api.service.ts` — HTTP wrapper
- [x] `core/api/project-api.service.ts`
- [x] `core/api/record-api.service.ts`
- [x] `core/api/user-api.service.ts`
- [x] `core/api/role-api.service.ts`
- [x] `core/api/dashboard-api.service.ts`
- [x] `core/api/audit-api.service.ts`
- [x] `core/api/feeding-api.service.ts`
- [x] `core/api/tag-api.service.ts`
- [x] `core/api/index.ts` (barrel export)

## P0 — احراز هویت
- [x] `core/auth/auth.service.ts` — login/logout/refresh (mock + JWT ready)
- [x] `core/auth/auth.guard.ts` — بازنویسی guard
- [x] `core/auth/role.guard.ts` — guard مبتنی بر نقش
- [x] `core/auth/auth.interceptor.ts` — attach JWT + handle 401
- [x] `core/error/error.interceptor.ts` — global error handling

## P0 — State Management
- [x] `core/stores/auth.store.ts` — Angular Signals

## ✅ Verification
- [x] Build successful (ng build --configuration development)
