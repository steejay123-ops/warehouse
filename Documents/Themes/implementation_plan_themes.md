<div dir="rtl" align="right">

# پیاده‌سازی سیستم مدیریت تم (Theme Management System)

این طرح برای پیاده‌سازی یک سیستم مدیریت تم پویا (Dynamic Theming) با پشتیبانی از ۵ تم مختلف (روشن، تاریک، صنعتی، سازمانی و کنتراست بالا) در برنامه Angular با استفاده از TailwindCSS طراحی شده است.

## User Review Required

> [!WARNING]
> اجرای این طرح نیازمند جایگزینی کلاس‌های رنگی ثابت Tailwind (مثل `bg-white` و `text-gray-800`) با کلاس‌های سفارشی (مثل `bg-background` و `text-foreground`) در کل برنامه است.

> [!IMPORTANT]
> برای این کار، فایل `tailwind.config.js` باید تغییر کند تا رنگ‌های جدید به آن شناسانده شوند.

## Open Questions

> [!NOTE]
> ۱. آیا تمایل دارید سیستم تشخیص خودکار تم سیستم کاربر (System Preference) را به عنوان پیش‌فرض قرار دهیم؟
> ۲. دکمه تغییر تم را ترجیح می‌دهید در کدام بخش قرار دهیم؟ (در منوی کناری، نوار بالایی یا در صفحه تنظیمات کاربر؟)

## Proposed Changes

---

### پیکربندی Tailwind و CSS پایه (Core CSS & Tailwind Config)

#### [MODIFY] [styles.css](file:///e:/warehouse%20project/warehouse-front/src/styles.css)
- تعریف متغیرهای CSS (CSS Variables) برای رنگ‌های پایه در `:root` برای تم روشن.
- اضافه کردن انتخابگرهای `[data-theme="dark"]`, `[data-theme="industrial"]`, `[data-theme="corporate"]` و `[data-theme="high-contrast"]` با رنگ‌های اختصاصی.

#### [MODIFY] `tailwind.config.js`
- افزونه `extend.colors` برای اتصال کلاس‌های Tailwind به متغیرهای CSS (مثلاً `primary: "var(--color-primary)"`).

---

### سرویس و کامپوننت‌های Angular

#### [NEW] `src/app/core/services/theme.service.ts`
- ایجاد سرویسی برای مدیریت حالت تم.
- خواندن و نوشتن تم انتخابی در `localStorage` برای ماندگاری (Persistence).
- تغییر ویژگی `data-theme` روی تگ `document.body`.

#### [NEW] `src/app/components/layout/theme-switcher/theme-switcher.component.ts`
- یک کامپوننت UI (دراپ‌داون یا دکمه) برای انتخاب بین ۵ تم موجود.

#### [MODIFY] [layout.ts](file:///e:/warehouse%20project/warehouse-front/src/app/components/layout/layout.ts)
- اضافه کردن `ThemeSwitcherComponent` به نوار منوی اصلی برنامه.
- اعمال تغییرات کلاس‌های CSS برای پشتیبانی از تم‌های داینامیک.

---

### اصلاح کلاس‌های کامپوننت‌ها (UI Refactoring)

#### [MODIFY] `src/app/components/**/*.ts` (همه کامپوننت‌های دارای ظاهر)
- جایگزینی کلاس‌هایی مانند `bg-white`, `bg-slate-900` با `bg-background` یا `bg-surface`.
- جایگزینی کلاس‌هایی مانند `text-slate-800`, `text-white` با `text-foreground` یا `text-primary`.
- جایگزینی کلاس‌های `border-*` با کلاس‌های مدیریت شده توسط تم.

## Verification Plan

### Automated Tests
- بررسی اجرای موفق `npm run start` و عدم وجود خطای کامپایل در Angular و Tailwind.

### Manual Verification
۱. باز کردن برنامه در مرورگر.
۲. تغییر تم از طریق دکمه Theme Switcher و بررسی اعمال آنی رنگ‌ها.
۳. بررسی خوانایی و زیبایی عناصر اصلی (جداول، کارت‌ها، سایدبار) در هر ۵ تم.
۴. رفرش کردن صفحه و اطمینان از باقی ماندن تم انتخابی.

</div>
