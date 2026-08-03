import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FilterCondition,
  FilterGroup,
  FilterNode,
  ReportFieldMeta,
  isFilterGroup,
} from '../../core/models/report.model';
import { FilterValueComponent } from './filter-value.component';

/**
 * گروه بازگشتی AND/OR درخت فیلتر
 *
 * درخت حین ویرایش state محلی (mutable) همین کامپوننت‌هاست؛ کامپوننت والد
 * (reports.ts) فقط لحظه اجرا snapshot کامل را به store می‌دهد — بنابراین
 * مشکل immutability/سیگنال در عمق درخت اصلاً پیش نمی‌آید.
 */
@Component({
  selector: 'app-filter-group',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterValueComponent],
  template: `
    <div class="rounded-xl border p-2.5 space-y-2"
         [class.border-rose-300]="group.not"
         [class.border-indigo-200]="!group.not && group.op === 'AND'"
         [class.bg-indigo-50/30]="group.op === 'AND'"
         [class.border-amber-200]="!group.not && group.op === 'OR'"
         [class.bg-amber-50/30]="group.op === 'OR'">

      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex rounded-lg overflow-hidden border border-slate-200 bg-white">
          <button type="button" (click)="setOp('AND')"
                  class="px-2.5 py-1 text-[10px] font-black transition-colors"
                  [class.bg-indigo-600]="group.op === 'AND'" [class.text-white]="group.op === 'AND'"
                  [class.text-slate-500]="group.op !== 'AND'">و (AND)</button>
          <button type="button" (click)="setOp('OR')"
                  class="px-2.5 py-1 text-[10px] font-black transition-colors"
                  [class.bg-amber-500]="group.op === 'OR'" [class.text-white]="group.op === 'OR'"
                  [class.text-slate-500]="group.op !== 'OR'">یا (OR)</button>
        </div>

        <button type="button" (click)="toggleNot(group)"
                title="نقیض کل گروه — ردیف‌هایی که این شرایط را ندارند"
                class="px-2.5 py-1 text-[10px] font-black rounded-lg border transition-colors"
                [class.bg-rose-600]="group.not" [class.text-white]="group.not"
                [class.border-rose-600]="group.not"
                [class.bg-white]="!group.not" [class.text-slate-500]="!group.not"
                [class.border-slate-200]="!group.not">جز (NOT)</button>

        <button type="button" (click)="addCondition()"
                class="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 rounded-lg px-2 py-1">
          + شرط
        </button>
        @if (depth < maxDepth) {
          <button type="button" (click)="addGroup()"
                  class="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1">
            + گروه تودرتو
          </button>
        }
        @if (depth > 0) {
          <button type="button" (click)="removeSelf.emit()"
                  class="text-[10px] font-bold text-rose-500 hover:text-rose-700 mr-auto">
            حذف گروه ✕
          </button>
        }
      </div>

      @for (child of group.children; track $index) {
        @if (isGroup(child)) {
          <app-filter-group
            [group]="asGroup(child)"
            [fields]="fields"
            [depth]="depth + 1"
            [maxDepth]="maxDepth"
            (removeSelf)="removeChild($index)"
            (changed)="changed.emit()" />
        } @else {
          <div class="flex items-center gap-2 flex-wrap bg-white rounded-lg border p-2"
               [class.border-rose-300]="asCond(child).not"
               [class.border-slate-200]="!asCond(child).not">
            <!-- نقیض شرط -->
            <button type="button" (click)="toggleNot(asCond(child))"
                    title="نقیض شرط"
                    class="w-6 h-6 shrink-0 text-xs font-black rounded-lg border transition-colors"
                    [class.bg-rose-600]="asCond(child).not" [class.text-white]="asCond(child).not"
                    [class.border-rose-600]="asCond(child).not"
                    [class.bg-white]="!asCond(child).not" [class.text-slate-400]="!asCond(child).not"
                    [class.border-slate-200]="!asCond(child).not">!</button>

            <!-- فیلد -->
            <select [ngModel]="asCond(child).field" (ngModelChange)="setField(asCond(child), $event)"
                    class="text-xs px-2 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-400 min-w-36">
              <option value="" disabled>فیلد…</option>
              @for (f of fields; track f.key) {
                <option [value]="f.key">{{ f.label }}</option>
              }
            </select>

            <!-- اپراتور -->
            <select [ngModel]="asCond(child).operator" (ngModelChange)="setOperator(asCond(child), $event)"
                    class="text-xs px-2 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-400">
              @for (op of operatorsFor(asCond(child).field); track op) {
                <option [value]="op">{{ opLabel(op) }}</option>
              }
            </select>

            <!-- مقدار -->
            <app-filter-value
              [field]="fieldMeta(asCond(child).field)"
              [operator]="asCond(child).operator"
              [value]="asCond(child).value"
              (valueChange)="setValue(asCond(child), $event)" />

            <button type="button" (click)="removeChild($index)"
                    class="text-rose-400 hover:text-rose-600 mr-auto text-xs font-bold px-1">✕</button>
          </div>
        }
      }

      @if (!group.children.length) {
        <div class="text-[10px] text-slate-400 py-1 text-center">شرطی تعریف نشده — دکمه «+ شرط» را بزنید</div>
      }
    </div>
  `,
})
export class FilterGroupComponent {
  @Input({ required: true }) group!: FilterGroup;
  @Input() fields: ReportFieldMeta[] = [];
  @Input() depth = 0;
  @Input() maxDepth = 4; // عمق ۵ سمت سرور؛ ریشه + ۴ سطح تودرتو
  @Output() removeSelf = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();

  private static readonly OP_LABELS: Record<string, string> = {
    eq: 'برابر', icontains: 'شامل', istartswith: 'شروع با', in: 'یکی از',
    isnull: 'خالی بودن', gt: 'بزرگ‌تر', gte: 'بزرگ‌تر یا مساوی',
    lt: 'کوچک‌تر', lte: 'کوچک‌تر یا مساوی', between: 'بازه',
  };

  isGroup = isFilterGroup;
  asGroup(n: FilterNode): FilterGroup { return n as FilterGroup; }
  asCond(n: FilterNode): FilterCondition { return n as FilterCondition; }

  fieldMeta(key: string): ReportFieldMeta | null {
    return this.fields.find((f) => f.key === key) ?? null;
  }

  operatorsFor(key: string): string[] {
    return this.fieldMeta(key)?.operators ?? [];
  }

  opLabel(op: string): string {
    return FilterGroupComponent.OP_LABELS[op] ?? op;
  }

  setOp(op: 'AND' | 'OR'): void {
    this.group.op = op;
    this.changed.emit();
  }

  toggleNot(node: FilterGroup | FilterCondition): void {
    if (node.not) delete node.not;
    else node.not = true;
    this.changed.emit();
  }

  addCondition(): void {
    const first = this.fields[0];
    this.group.children.push({
      field: first?.key ?? '',
      operator: (first?.operators[0] as any) ?? 'eq',
      value: null,
    });
    this.changed.emit();
  }

  addGroup(): void {
    this.group.children.push({ op: 'AND', children: [] });
    this.changed.emit();
  }

  removeChild(index: number): void {
    this.group.children.splice(index, 1);
    this.changed.emit();
  }

  setField(cond: FilterCondition, key: string): void {
    cond.field = key;
    const ops = this.operatorsFor(key);
    if (!ops.includes(cond.operator)) cond.operator = ops[0] as any;
    cond.value = null;
    this.changed.emit();
  }

  setOperator(cond: FilterCondition, op: string): void {
    cond.operator = op as any;
    if (op === 'between') cond.value = [null, null];
    else if (op === 'in') cond.value = [];
    else if (op === 'isnull') cond.value = true;
    else cond.value = null;
    this.changed.emit();
  }

  setValue(cond: FilterCondition, v: unknown): void {
    cond.value = v;
    this.changed.emit();
  }
}
