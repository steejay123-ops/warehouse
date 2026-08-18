<div dir="rtl" align="right">

# برنامه پیاده‌سازی قانون فازبندی وظایف (Phased Execution & Granular Tasks)

این تغییر با هدف افزودن یک بند قانونی دائمی به قوانین سیستم (`AGENTS.md`) طراحی شده است تا تمام درخواست‌ها و تسک‌های آینده به صورت خودکار به فازهای کوچک و قابل تست تقسیم شوند.

---

## بررسی کاربر (User Review Required)

> [!NOTE]
> بند جدید به عنوان بخش پنجم (`### 5. Phased Execution & Granular Tasks`) به فایل قوانین محلی پروژه (`.agents/AGENTS.md`) اضافه خواهد شد.

---

## تغییرات پیشنهادی (Proposed Changes)

### قوانین و دستورالعمل‌های عامل هوشمند (Agent Rules)

#### [MODIFY] [AGENTS.md](file:///e:/warehouse%20project/.agents/AGENTS.md)
* اضافه کردن بخش ۵ با عنوان **Phased Execution & Granular Tasks**
* تعریف الزامات تفکیک وظایف، راستی‌آزمایی مرحله‌ای و جلوگیری از تغییرات حجیم هم‌زمان

```markdown
### 5. Phased Execution & Granular Tasks
- **Mandatory Task Decomposition:** Break down large, multi-step, or complex requests into small, self-contained, and reviewable phases.
- **Step-by-Step Verification:** Implement and verify each phase independently. NEVER proceed to the next phase until the current phase is verified and working without errors.
- **Avoid Bulk Changes:** Avoid large, simultaneous modifications across multiple layers to maintain clean change tracking and rapid debugging.
```

---

## برنامه راستی‌آزمایی (Verification Plan)

### بررسی صحت فایل‌ها (File Verification)
* بررسی ساختار فایل `.agents/AGENTS.md` و اطمینان از قرارگیری در انتهای فایل بدون تداخل با بخش‌های ۱ تا ۴
* اطمینان از حفظ قالب‌بندی استاندارد مارک‌داون

</div>
