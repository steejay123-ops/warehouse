import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ReportApiService } from '../../core/api/report-api.service';
import { NetworkStatusService } from '../../core/services/network-status.service';
import {
  EntityFieldsResponse,
  FilterGroup,
  ReportAggregation,
  ReportChart,
  ReportColumn,
  ReportEntity,
  ReportFieldMeta,
  ReportHaving,
  ReportSort,
  ReportSpec,
  ReportTemplate,
} from '../../core/models/report.model';

/**
 * Store سیگنالی گزارش‌ساز — state کامل صفحه /reports
 *
 * نکته state درخت فیلتر: درخت حین ویرایش state محلی کامپوننت‌هاست؛
 * فقط لحظه «اجرا» به‌صورت یک آبجکت کامل وارد این store می‌شود.
 */
@Injectable()
export class ReportStore {
  private api = inject(ReportApiService);
  private network = NetworkStatusService.getInstance();

  // ─── وضعیت شبکه (گزارش‌گیری فقط-آنلاین) ───
  readonly connectionState = toSignal(this.network.state$, {
    initialValue: this.network.state,
  });
  readonly isOffline = computed(() => this.connectionState() !== 'online');

  // ─── انتخاب موجودیت و متادیتا ───
  readonly entities = signal<ReportEntity[]>([]);
  readonly entityKey = signal<string | null>(null);
  readonly warehouseId = signal<number | null>(null);
  readonly fieldsMeta = signal<ReportFieldMeta[]>([]);
  readonly fieldsLoading = signal(false);

  readonly fieldByKey = computed(() => {
    const m = new Map<string, ReportFieldMeta>();
    for (const f of this.fieldsMeta()) m.set(f.key, f);
    return m;
  });

  // ─── spec در حال ساخت ───
  readonly selectedFields = signal<string[]>([]);
  readonly groupBy = signal<string[]>([]);
  readonly aggregations = signal<ReportAggregation[]>([]);
  readonly having = signal<ReportHaving[]>([]);
  readonly sort = signal<ReportSort[]>([]);
  readonly filters = signal<FilterGroup | null>(null); // فقط هنگام اجرا ست می‌شود
  readonly chart = signal<ReportChart | null>(null); // فقط-کلاینت؛ در قالب ذخیره می‌شود
  readonly page = signal(1);
  readonly pageSize = signal(50);

  readonly grouped = computed(() => this.groupBy().length > 0);

  /** aliasهای معتبر تجمیع — منبع گزینه‌های HAVING و محور Y نمودار */
  readonly aggAliases = computed(() =>
    this.aggregations().map((a) => a.alias || `${a.fn}_${a.field}`.replace(/__/g, '_')),
  );

  // ─── نتیجه ───
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly columns = signal<ReportColumn[]>([]);
  readonly count = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasRun = signal(false);

  // ─── قالب‌ها ───
  readonly templates = signal<ReportTemplate[]>([]);
  readonly activeTemplate = signal<ReportTemplate | null>(null);

  // ------------------------------------------------------------------ actions
  loadEntities(): void {
    this.api.getEntities().subscribe({
      next: (list) => this.entities.set(list),
      error: (e) => this.error.set(this.msg(e)),
    });
  }

  selectEntity(key: string | null, keepSpec = false): void {
    this.entityKey.set(key);
    if (!keepSpec) {
      this.selectedFields.set([]);
      this.groupBy.set([]);
      this.aggregations.set([]);
      this.having.set([]);
      this.sort.set([]);
      this.filters.set(null);
      this.chart.set(null);
      this.rows.set([]);
      this.columns.set([]);
      this.count.set(0);
      this.hasRun.set(false);
      this.activeTemplate.set(null);
    }
    this.error.set(null);
    this.fieldsMeta.set([]);
    if (key) this.loadFields();
  }

  setWarehouse(id: number | null): void {
    this.warehouseId.set(id);
    if (this.entityKey()) this.loadFields();
  }

  loadFields(): void {
    const key = this.entityKey();
    if (!key) return;
    this.fieldsLoading.set(true);
    this.api.getFields(key, this.warehouseId()).subscribe({
      next: (res: EntityFieldsResponse) => {
        this.fieldsMeta.set(res.fields);
        this.fieldsLoading.set(false);
        // فیلدهای انتخابی که دیگر مجاز/موجود نیستند حذف شوند
        const valid = new Set(res.fields.map((f) => f.key));
        this.selectedFields.update((arr) => arr.filter((k) => valid.has(k)));
        this.groupBy.update((arr) => arr.filter((k) => valid.has(k)));
        this.aggregations.update((arr) => arr.filter((a) => valid.has(a.field)));
        this.pruneAggDependents();
      },
      error: (e) => {
        this.fieldsLoading.set(false);
        this.error.set(this.msg(e));
      },
    });
  }

  /**
   * هرس وابسته‌های تجمیع: havingها و نمودار که alias/محورشان دیگر معتبر نیست.
   * بعد از هر تغییر aggregations/groupBy (از reports.ts) و بعد از loadFields صدا زده می‌شود.
   */
  pruneAggDependents(): void {
    const aliases = new Set(this.aggAliases());
    this.having.update((arr) => arr.filter((h) => aliases.has(h.alias)));
    const c = this.chart();
    if (c && (!aliases.has(c.y) || !this.groupBy().includes(c.x))) {
      this.chart.set(null);
    }
  }

  buildSpec(forExport = false): ReportSpec | null {
    const entity = this.entityKey();
    if (!entity) return null;
    const spec: ReportSpec = { entity };
    if (this.warehouseId()) spec.warehouse_id = this.warehouseId();
    if (this.grouped()) {
      spec.group_by = this.groupBy();
      spec.aggregations = this.aggregations();
      if (this.having().length) spec.having = this.having();
      if (this.chart()) spec.chart = this.chart(); // فقط-کلاینت؛ engine نادیده می‌گیرد
    } else {
      spec.fields = this.selectedFields();
    }
    const f = this.filters();
    if (f && f.children.length) spec.filters = f;
    if (this.sort().length) spec.sort = this.sort();
    if (!forExport) {
      spec.page = this.page();
      spec.page_size = this.pageSize();
    }
    return spec;
  }

  /** اجرای گزارش — درخت فیلتر کامل از کامپوننت فیلتر پاس می‌شود */
  run(filters?: FilterGroup | null): void {
    if (filters !== undefined) this.filters.set(filters);
    const spec = this.buildSpec();
    if (!spec) return;
    this.loading.set(true);
    this.error.set(null);
    this.api.run(spec).subscribe({
      next: (res) => {
        this.rows.set(res.rows);
        this.columns.set(res.columns);
        this.count.set(res.count);
        this.loading.set(false);
        this.hasRun.set(true);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(this.msg(e));
      },
    });
  }

  loadTemplates(): void {
    this.api.getTemplates().subscribe({
      next: (list) => this.templates.set(list),
      error: () => {}, // سایدبار قالب‌ها حیاتی نیست
    });
  }

  /** بارگذاری قالب ذخیره‌شده در سازنده */
  applyTemplate(t: ReportTemplate): void {
    this.activeTemplate.set(t);
    this.entityKey.set(t.entity);
    this.warehouseId.set((t.spec.warehouse_id as number) ?? t.warehouse ?? null);
    this.selectedFields.set(t.spec.fields ?? []);
    this.groupBy.set(t.spec.group_by ?? []);
    this.aggregations.set(t.spec.aggregations ?? []);
    this.having.set(t.spec.having ?? []);
    this.sort.set(t.spec.sort ?? []);
    this.filters.set(t.spec.filters ?? null);
    this.chart.set(t.spec.chart ?? null);
    this.page.set(1);
    this.rows.set([]);
    this.columns.set([]);
    this.count.set(0);
    this.hasRun.set(false);
    this.error.set(null);
    this.loadFields();
  }

  /** پیام خطای قابل نمایش — status 0 یعنی آفلاین/سرور در دسترس نیست */
  msg(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0 || e.status >= 520) {
        return 'گزارش‌گیری فقط در حالت آنلاین در دسترس است — اتصال به سرور برقرار نیست.';
      }
      const m = (e.error && (e.error.error || e.error.detail)) as string | undefined;
      if (m) return m;
    }
    return 'خطای غیرمنتظره در اجرای گزارش.';
  }
}
