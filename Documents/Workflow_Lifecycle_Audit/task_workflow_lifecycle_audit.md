# چک‌لیست وظایف ممیزی و ارتقای چرخه گردش‌کار سازمانی (کارمند تا مدیر)
## Task Breakdown: End-to-End Workflow Optimization & Defect Remediation

<div dir="rtl" align="right">

### فاز ۱: برطرف‌سازی استاب‌ها و اتصال واقعی ماژول‌های سرپرست و حسابدار
- [ ] <!-- id: 0 --> جایگزینی متغیرهای شبیه‌سازی (`items = []`) در `supervisor-attendance.ts` با سرویس واقعی `getAttendanceMatrix` <!-- priority: High -->
- [ ] <!-- id: 1 --> اتصال واقعی دکمه «قفل و ارسال دوره ماهانه» در `supervisor-period-lock.ts` به متد `periodWorkflowAction` <!-- priority: High -->
- [ ] <!-- id: 2 --> اتصال ماژول‌های کارکرد ناوگان `supervisor-fleet.ts` و `accountant-fleet.ts` به APIهای واقعی تردد و تسویه <!-- priority: High -->
- [ ] <!-- id: 3 --> اتصال پرتال فاکتورها در `supervisor-invoices.ts` و `accountant-invoices.ts` به ویوست `ExpenseInvoiceViewSet` <!-- priority: High -->
- [ ] <!-- id: 4 --> جایگزینی تسویه صوری در `treasurer-invoices.ts` با ثبت شماره تراکنش واقعی و فایل پیوست بانکی <!-- priority: High -->

### فاز ۲: یکپارچه‌سازی بک‌اند و استانداردسازی ماشین حالت ۵ سطحی
- [ ] <!-- id: 5 --> رفع فیلتر انحصاری سوپریوزر در `ExpenseInvoiceViewSet.perform_update` و افزودن اکشن‌های گردش‌کار <!-- priority: High -->
- [ ] <!-- id: 6 --> ثبت مدل‌های `ExpenseInvoice` و `PettyCashTransaction` در مپینگ موتور کارتابل ۵ سطحی <!-- priority: Medium -->
- [ ] <!-- id: 7 --> اتصال فعال متد `process_creation_with_auto_pass()` در تمام متدهای `perform_create` ویوست‌ها <!-- priority: Medium -->
- [ ] <!-- id: 8 --> تضمین اتمیک بودن و اعمال `select_for_update()` روی تمامی ترنزکشن‌های تایید پرونده‌ها <!-- priority: High -->

### فاز ۳: ممیزی تاریخچه‌ای و رهگیری مکاتبات رد / بازنگری
- [ ] <!-- id: 9 --> طراحی و پیاده‌سازی مدل لاگ ممیزی گردش‌کار (`WorkflowAuditLog`) برای ثبت سوابق رد/اصلاح <!-- priority: Medium -->
- [ ] <!-- id: 10 --> اتصال پنجره مودال Diff کارتابل مدیر و سرپرست به تایم‌لاین ممیزی سوابق اصلاحیه <!-- priority: Low -->

### فاز ۴: بهینه‌سازی تجربه کاربری (UX) و استانداردسازی هدرها
- [ ] <!-- id: 11 --> پیش‌واکشی خودکار شمارنده‌ها (Eager Loading) در `FinanceCartable` و پرتال‌های سرپرست <!-- priority: Medium -->
- [ ] <!-- id: 12 --> اعمال استانداردهای Unified Sticky Command Center روی پرتال‌های شش‌گانه سازمانی <!-- priority: Low -->

</div>
