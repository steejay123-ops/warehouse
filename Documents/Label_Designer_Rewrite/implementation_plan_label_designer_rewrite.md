<div dir="rtl" align="right">

# بازنویسی کامل طراح لیبل — فاز ۱: بوم Drag & Drop

## خلاصه مسئله
کامپوننت فعلی `LabelDesigner` یک نمونه اولیه (PoC) است که هیچ Persistence بکندی، هیچ تفکیک Global/Override واقعی، و هیچ عملکرد چاپ واقعی ندارد. هدف فاز ۱ این است که یک طراح لیبل Drag & Drop حرفه‌ای بسازیم که:

1. کاربر بتواند فیلدهای نمایشی روی لیبل را انتخاب و با Drag & Drop جایگذاری کند
2. کاربر انتخاب کند کدام فیلد جدول به عنوان (QR Code) استفاده شود
3. تنظیمات ساختار لیبل در بکند ذخیره شود (Global + Override per Warehouse)
4. از صفحه تخصیص کالا (Dispatch) دکمه «چاپ لیبل QR رکوردهای منتخب» واقعاً لیبل تولید و چاپ کند

---

## بررسی توسط کاربر (User Review Required)

> [!IMPORTANT]
> **انتخاب رویکرد Canvas: بدون کتابخانه خارجی**
> برای Drag & Drop از API بومی مرورگر (HTML5 Drag & Drop / Mouse Events) استفاده می‌کنم و هیچ کتابخانه خارجی (مثل Fabric.js یا Konva) نصب نمی‌شود. دلیل:
> - حجم باندل کوچکتر
> - سازگاری کامل با Angular 22
> - کنترل کامل روی رندر و استایل
> - برای لیبل‌هایی با ۵-۱۰ المان متنی + QR، Canvas پیچیده لازم نیست

> [!IMPORTANT]
> **تولید PDF چاپی در بکند**
> PDF نهایی در سرور Django تولید می‌شود (با `reportlab`) و فرانت‌اند فقط دانلود می‌کند. این روش:
> - مستقل از مرورگر کاربر است
> - QR Code در سرور ساخته می‌شود (با `qrcode`)
> - کیفیت چاپ DPI بالا تضمین شده

---

## سوالات باز (Open Questions)

> [!NOTE]
> **۱. ابعاد فیزیکی لیبل**
> آیا فعلاً فقط یک سایز لیبل (مثلاً ۷۰×۴۰ میلی‌متر) پشتیبانی شود یا کاربر باید بتواند ابعاد دلخواه تنظیم کند؟ پیشنهاد من: ابعاد قابل تنظیم با پیش‌فرض ۷۰×۴۰mm.

> [!NOTE]
> **۲. چیدمان شبکه‌ای (Grid Layout)**
> آیا لیبل‌ها روی کاغذ A4 به صورت شبکه‌ای (مثلاً ۳×۷) چاپ شوند؟ یا فقط برای لیبل‌پرینتر حرارتی (رولی) خروجی بگیریم؟ پیشنهاد من: هر دو — با یک تنظیم ساده "نوع خروجی".

> [!NOTE]
> **۳. چاپ مستقیم یا دانلود PDF؟**
> آیا PDF فقط دانلود شود یا مستقیماً به پرینتر ارسال شود؟ پیشنهاد من: در فاز ۱ فقط دانلود PDF.

---

## تغییرات پیشنهادی (Proposed Changes)

---

### 🔵 کامپوننت ۱: مدل داده‌ای بکند (Django Model + API)

#### [MODIFY] models.py
- افزودن مدل `LabelTemplate` برای ذخیره ساختار لیبل

#### [NEW] label_views.py
- API Endpoints:
  - `GET /api/label-templates/?warehouse=<id>` — لیست تمپلیت‌ها (با Fallback به Global)
  - `POST /api/label-templates/` — ساخت/ویرایش تمپلیت
  - `POST /api/label-templates/generate-pdf/` — تولید PDF با داده‌های رکوردها

#### [NEW] label_serializers.py
- سریالایزر برای `LabelTemplate`

---

### 🟢 کامپوننت ۲: سرویس فرانت‌اند (Angular Service)

#### [NEW] label-api.service.ts
- متدها:
  - `getTemplate(warehouseId)` — دریافت تمپلیت فعال (با fallback)
  - `saveTemplate(template)` — ذخیره ساختار لیبل
  - `generatePdf(templateId, itemIds)` — درخواست تولید PDF و دانلود فایل
  - `getAvailableFields(warehouseId)` — لیست تمام فیلدهای جدول Item + Dynamic Fields

---

### 🔴 کامپوننت ۳: بازنویسی کامپوننت LabelDesigner (قلب پروژه)

#### [MODIFY] label-designer.ts
بازنویسی کامل — بوم Drag & Drop با المان‌های قابل جابجایی

#### [MODIFY] label-designer.html
بازنویسی کامل — UI دو ستونه (پنل فیلدها + بوم طراحی)

#### [MODIFY] label-designer.css
استایل‌های بوم طراحی، Grid خطوط راهنما، حالت Drag، Selection handles

---

### 🟡 کامپوننت ۴: اتصال به صفحه Dispatch

#### [MODIFY] dispatch.ts
بازنویسی `executeBatchLabelPrint()` — ارسال به بکند و دانلود PDF

#### [MODIFY] dispatch.html
افزودن Modal چاپ لیبل

---

### 🟣 کامپوننت ۵: اتصال به صفحات تنظیمات

#### [MODIFY] wh-settings — ارسال warehouseId
#### [MODIFY] settings — ارسال null (Global)

---

### 🔵 کامپوننت ۶: تولید PDF (Backend)

#### [NEW] label_pdf_generator.py
موتور تولید PDF با reportlab + qrcode + فونت فارسی

---

## خلاصه فایل‌ها

| وضعیت | فایل | تغییر |
|:---:|---|---|
| ✏️ | `warehouses/models.py` | افزودن مدل `LabelTemplate` |
| 🆕 | `warehouses/label_views.py` | API endpoints |
| 🆕 | `warehouses/label_serializers.py` | سریالایزر |
| 🆕 | `warehouses/label_pdf_generator.py` | موتور تولید PDF |
| 🆕 | `core/api/label-api.service.ts` | سرویس Angular |
| ✏️ | `label-designer.ts` | بازنویسی کامل |
| ✏️ | `label-designer.html` | بازنویسی کامل |
| ✏️ | `label-designer.css` | استایل‌های بوم |
| ✏️ | `dispatch.ts` + `.html` | اتصال واقعی به چاپ |
| ✏️ | `wh-settings` + `settings` | ارسال Input |

</div>
