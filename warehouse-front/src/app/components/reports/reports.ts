import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehouseHttpService } from '../../core/http/warehouse-http.service';
import { ReportApiService } from '../../core/api/report-api.service';
import { AuthStore } from '../../core/stores/auth.store';
import {
  AggFn,
  ChartType,
  FilterGroup,
  HavingOperator,
  ReportChart,
  ReportTemplate,
} from '../../core/models/report.model';
import { ToastService } from '../../shared/components/toast/toast.component';
import {
  DataTableComponent,
  PageEvent,
  SortState,
  TableColumnDirective,
} from '../../shared/components/data-table/data-table.component';
import { ReportStore } from './report-store';
import { FilterGroupComponent } from './filter-group.component';
import { SavedReportsComponent } from './saved-reports.component';
import { ExportProgressComponent } from './export-progress.component';
import { ReportChartComponent } from './report-chart.component';

/**
 * صفحه گزارش‌ساز پویا — پوسته اصلی
 * سایدبار قالب‌های ذخیره‌شده + سازنده (موجودیت ← فیلدها ← فیلتر ← گروه‌بندی ← اجرا)
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DataTableComponent, TableColumnDirective,
    FilterGroupComponent, SavedReportsComponent, ExportProgressComponent,
    ReportChartComponent,
  ],
  providers: [ReportStore],
  templateUrl: './reports.html',
})
export class Reports implements OnInit {
  readonly store = inject(ReportStore);
  private reportApi = inject(ReportApiService);
  private warehouseHttp = inject(WarehouseHttpService);
  private toast = inject(ToastService);
  private authStore = inject(AuthStore);

  // ─── انبارها برای فیلدهای پویا/scope ───
  warehouses = signal<{ id: number; name: string }[]>([]);

  // ─── درخت فیلتر: state محلی — فقط هنگام اجرا وارد store می‌شود ───
  filterRoot: FilterGroup = { op: 'AND', children: [] };

  // ─── جستجوی فیلدها ───
  fieldSearch = signal('');
  readonly visibleFields = computed(() => {
    const q = this.fieldSearch().trim();
    const all = this.store.fieldsMeta();
    if (!q) return all;
    return all.filter((f) => f.label.includes(q) || f.key.includes(q));
  });

  // ─── تجمیع ───
  readonly aggFns: { value: AggFn; label: string }[] = [
    { value: 'count', label: 'تعداد' },
    { value: 'sum', label: 'جمع' },
    { value: 'avg', label: 'میانگین' },
    { value: 'min', label: 'کمینه' },
    { value: 'max', label: 'بیشینه' },
  ];

  // ─── مودال ذخیره قالب ───
  isSaveModalOpen = signal(false);
  saveName = '';
  saveDescription = '';
  saveIsPublic = false;

  // ─── job خروجی بزرگ ───
  exportJobId = signal<number | null>(null);
  exportTotalRows = signal(0);
  exporting = signal(false);

  ngOnInit(): void {
    this.store.loadEntities();
    this.store.loadTemplates();
    this.warehouseHttp.getAll().subscribe({
      next: (list) => this.warehouses.set(list.map((w) => ({ id: w.id, name: w.name }))),
      error: () => {},
    });
    // در کانتکست انبار، انبار فعال پیش‌فرض شود
    const active = this.authStore.activeWarehouseId();
    if (typeof active === 'number') this.store.warehouseId.set(active);
  }

  // ------------------------------------------------------------ entity/fields
  onEntityChange(key: string): void {
    this.filterRoot = { op: 'AND', children: [] };
    this.store.selectEntity(key || null);
  }

  onWarehouseChange(v: number | null): void {
    this.store.setWarehouse(v ?? null);
  }

  toggleField(key: string): void {
    this.store.selectedFields.update((arr) =>
      arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key],
    );
  }

  moveField(key: string, dir: -1 | 1): void {
    this.store.selectedFields.update((arr) => {
      const i = arr.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      const copy = [...arr];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  // ------------------------------------------------------------ گروه‌بندی
  toggleGroupBy(key: string): void {
    this.store.groupBy.update((arr) =>
      arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key],
    );
    // اولین تجمیع پیش‌فرض: تعداد ردیف
    if (this.store.groupBy().length && !this.store.aggregations().length) {
      const idField = this.store.fieldsMeta().find((f) => f.key === 'id');
      if (idField) {
        this.store.aggregations.set([{ field: 'id', fn: 'count', alias: 'row_count' }]);
      }
    }
    this.store.pruneAggDependents();
  }

  addAggregation(): void {
    const numeric = this.store.fieldsMeta().find((f) => f.aggregatable);
    const target = numeric ?? this.store.fieldsMeta().find((f) => f.key === 'id');
    if (!target) return;
    this.store.aggregations.update((arr) => [
      ...arr,
      { field: target.key, fn: numeric ? 'sum' : 'count', alias: '' },
    ]);
  }

  updateAggregation(index: number, patch: Partial<{ field: string; fn: AggFn; alias: string }>): void {
    this.store.aggregations.update((arr) =>
      arr.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );
    this.store.pruneAggDependents();
  }

  removeAggregation(index: number): void {
    this.store.aggregations.update((arr) => arr.filter((_, i) => i !== index));
    this.store.pruneAggDependents();
  }

  aggregatableFields() {
    return this.store.fieldsMeta().filter((f) => f.aggregatable || f.key === 'id');
  }

  groupableFields() {
    return this.store.fieldsMeta().filter((f) => f.groupable);
  }

  // ------------------------------------------------------ HAVING (شرط تجمیع)
  readonly havingOps: { value: HavingOperator; label: string }[] = [
    { value: 'eq', label: 'برابر' },
    { value: 'gt', label: 'بزرگ‌تر' },
    { value: 'gte', label: 'بزرگ‌تر یا مساوی' },
    { value: 'lt', label: 'کوچک‌تر' },
    { value: 'lte', label: 'کوچک‌تر یا مساوی' },
    { value: 'between', label: 'بازه' },
  ];

  /** برچسب نمایشی alias — نام alias یا «تابع + برچسب فیلد» */
  aliasLabel(alias: string): string {
    const i = this.store.aggAliases().indexOf(alias);
    const agg = this.store.aggregations()[i];
    if (!agg) return alias;
    const fn = this.aggFns.find((f) => f.value === agg.fn)?.label ?? agg.fn;
    const field = this.store.fieldByKey().get(agg.field)?.label ?? agg.field;
    return `${fn} ${field}`;
  }

  addHaving(): void {
    const alias = this.store.aggAliases()[0];
    if (!alias) return;
    this.store.having.update((arr) => [...arr, { alias, operator: 'gte', value: null }]);
  }

  updateHaving(index: number, patch: Partial<{ alias: string; operator: HavingOperator; value: unknown }>): void {
    this.store.having.update((arr) =>
      arr.map((h, i) => {
        if (i !== index) return h;
        const next = { ...h, ...patch };
        if (patch.operator === 'between' && !Array.isArray(next.value)) next.value = [null, null];
        if (patch.operator && patch.operator !== 'between' && Array.isArray(next.value)) next.value = null;
        return next;
      }),
    );
  }

  updateHavingBetween(index: number, pos: 0 | 1, v: unknown): void {
    this.store.having.update((arr) =>
      arr.map((h, i) => {
        if (i !== index) return h;
        const pair = Array.isArray(h.value) ? [...h.value] : [null, null];
        pair[pos] = v === '' ? null : v;
        return { ...h, value: pair };
      }),
    );
  }

  removeHaving(index: number): void {
    this.store.having.update((arr) => arr.filter((_, i) => i !== index));
  }

  havingBetweenVal(value: unknown, pos: 0 | 1): unknown {
    return Array.isArray(value) ? (value[pos] ?? '') : '';
  }

  // ---------------------------------------------------------------- نمودار
  readonly chartTypes: { value: ChartType; label: string }[] = [
    { value: 'bar', label: 'ستونی' },
    { value: 'pie', label: 'دایره‌ای' },
    { value: 'line', label: 'خطی' },
  ];

  setChart(patch: Partial<ReportChart>): void {
    const cur = this.store.chart() ?? { type: 'bar' as ChartType, x: '', y: '' };
    const next = { ...cur, ...patch };
    // پیش‌فرض هوشمند: تنها گزینه موجود انتخاب شود
    if (!next.x && this.store.groupBy().length === 1) next.x = this.store.groupBy()[0];
    if (!next.y && this.store.aggAliases().length === 1) next.y = this.store.aggAliases()[0];
    this.store.chart.set(next);
  }

  clearChart(): void {
    this.store.chart.set(null);
  }

  chartXLabel(): string {
    const c = this.store.chart();
    if (!c) return '';
    return this.store.fieldByKey().get(c.x)?.label ?? c.x;
  }

  chartYLabel(): string {
    const c = this.store.chart();
    return c ? this.aliasLabel(c.y) : '';
  }

  chartReady(): boolean {
    const c = this.store.chart();
    return !!(c && c.type && c.x && c.y);
  }

  // ------------------------------------------------------------------ اجرا
  runReport(): void {
    if (this.store.isOffline()) {
      this.toast.warning('گزارش‌گیری فقط در حالت آنلاین در دسترس است.');
      return;
    }
    this.store.page.set(1);
    // snapshot کامل درخت فیلتر → store (آبجکت جدید)
    const snapshot: FilterGroup = JSON.parse(JSON.stringify(this.filterRoot));
    this.store.run(snapshot.children.length ? snapshot : null);
  }

  onPageChanged(e: PageEvent): void {
    this.store.page.set(e.page);
    this.store.pageSize.set(e.pageSize);
    this.store.run();
  }

  onSortChanged(s: SortState): void {
    if (!s.key) {
      this.store.sort.set([]);
    } else {
      this.store.sort.set([{ field: s.key, dir: s.direction }]);
    }
    this.store.page.set(1);
    this.store.run();
  }

  // ------------------------------------------------------------------ Excel
  exportExcel(): void {
    if (this.store.isOffline()) {
      this.toast.warning('خروجی Excel فقط در حالت آنلاین در دسترس است.');
      return;
    }
    const spec = this.store.buildSpec(true);
    if (!spec) return;
    spec.report_name = this.store.activeTemplate()?.name || 'report';
    this.exporting.set(true);
    this.reportApi.export(spec).subscribe({
      next: (outcome) => {
        this.exporting.set(false);
        if (outcome.kind === 'file') {
          const url = URL.createObjectURL(outcome.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${spec.report_name}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
          this.toast.success('فایل Excel دانلود شد.');
        } else {
          this.exportJobId.set(outcome.jobId);
          this.exportTotalRows.set(outcome.totalRows);
          this.toast.info('نتیجه بزرگ است؛ فایل در سرور تولید می‌شود و درصد پیشرفت را می‌بینید.');
        }
      },
      error: async (e) => {
        this.exporting.set(false);
        // خطای blob → متن JSON را دربیاور
        let msg = 'خطا در تولید خروجی Excel.';
        try {
          if (e?.error instanceof Blob) {
            const j = JSON.parse(await e.error.text());
            msg = j.error || j.detail || msg;
          } else {
            msg = this.store.msg(e);
          }
        } catch { /* پیام پیش‌فرض */ }
        this.toast.error(msg);
      },
    });
  }

  // ------------------------------------------------------------------ قالب‌ها
  openSaveModal(): void {
    const t = this.store.activeTemplate();
    this.saveName = t?.name ?? '';
    this.saveDescription = t?.description ?? '';
    this.saveIsPublic = t?.is_public ?? false;
    this.isSaveModalOpen.set(true);
  }

  saveTemplate(asNew: boolean): void {
    const entity = this.store.entityKey();
    if (!entity || !this.saveName.trim()) return;
    const snapshot: FilterGroup = JSON.parse(JSON.stringify(this.filterRoot));
    this.store.filters.set(snapshot.children.length ? snapshot : null);
    const spec = this.store.buildSpec(true);
    if (!spec) return;

    const payload = {
      name: this.saveName.trim(),
      description: this.saveDescription.trim() || null,
      entity,
      spec,
      is_public: this.saveIsPublic,
      warehouse: this.store.warehouseId(),
    } as Partial<ReportTemplate>;

    const existing = this.store.activeTemplate();
    const req = (!asNew && existing && existing.is_owner)
      ? this.reportApi.updateTemplate(existing.id, payload)
      : this.reportApi.createTemplate(payload);

    req.subscribe({
      next: (t) => {
        this.toast.success('قالب گزارش ذخیره شد.');
        this.isSaveModalOpen.set(false);
        this.store.activeTemplate.set(t);
        this.store.loadTemplates();
      },
      error: (e) => this.toast.error(this.store.msg(e)),
    });
  }

  loadTemplate(t: ReportTemplate): void {
    this.store.applyTemplate(t);
    this.filterRoot = t.spec.filters
      ? JSON.parse(JSON.stringify(t.spec.filters))
      : { op: 'AND', children: [] };
  }

  deleteTemplate(t: ReportTemplate): void {
    if (!confirm(`قالب «${t.name}» حذف شود؟`)) return;
    this.reportApi.deleteTemplate(t.id).subscribe({
      next: () => {
        this.toast.success('قالب حذف شد.');
        if (this.store.activeTemplate()?.id === t.id) this.store.activeTemplate.set(null);
        this.store.loadTemplates();
      },
      error: (e) => this.toast.error(this.store.msg(e)),
    });
  }

  toggleTemplatePublic(t: ReportTemplate): void {
    this.reportApi.updateTemplate(t.id, { is_public: !t.is_public }).subscribe({
      next: () => {
        this.toast.success(t.is_public ? 'قالب خصوصی شد.' : 'قالب عمومی شد.');
        this.store.loadTemplates();
      },
      error: (e) => this.toast.error(this.store.msg(e)),
    });
  }

  // ------------------------------------------------------------------ نمایش
  formatCell(value: unknown, type: string): string {
    if (value === null || value === undefined || value === '') return '—';
    if (type === 'boolean') return value === true || value === 'true' ? 'بله' : 'خیر';
    if ((type === 'date' || type === 'datetime') && typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('fa-IR', {
          dateStyle: 'short',
          ...(type === 'datetime' ? { timeStyle: 'short' } : {}),
        }).format(d);
      }
    }
    return String(value);
  }
}
