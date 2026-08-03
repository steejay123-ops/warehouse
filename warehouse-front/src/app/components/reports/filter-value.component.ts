import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgPersianDatepickerModule } from 'ng-persian-datepicker';
import { ReportFieldMeta, ReportOperator } from '../../core/models/report.model';

/**
 * کنترل مقدار فیلتر بر اساس نوع فیلد + اپراتور
 * تاریخ: انتخاب جلالی با ng-persian-datepicker، خروجی ISO میلادی ($event.gregorian)
 */
@Component({
  selector: 'app-filter-value',
  standalone: true,
  imports: [CommonModule, FormsModule, NgPersianDatepickerModule],
  template: `
    @if (operator === 'isnull') {
      <select [ngModel]="value" (ngModelChange)="setValue($event)" class="ctl">
        <option [ngValue]="true">خالی است</option>
        <option [ngValue]="false">خالی نیست</option>
      </select>
    } @else if (operator === 'between') {
      <div class="flex items-center gap-1">
        @if (isDate) {
          <ng-persian-datepicker [dateInitValue]="false" (dateOnSelect)="setPair(0, $event.gregorian)">
            <input type="text" class="ctl w-28" placeholder="از تاریخ" [value]="pairLabel(0)" readonly>
          </ng-persian-datepicker>
          <ng-persian-datepicker [dateInitValue]="false" (dateOnSelect)="setPair(1, $event.gregorian)">
            <input type="text" class="ctl w-28" placeholder="تا تاریخ" [value]="pairLabel(1)" readonly>
          </ng-persian-datepicker>
        } @else {
          <input type="number" class="ctl w-24" placeholder="از" [ngModel]="pair()[0]" (ngModelChange)="setPair(0, $event)">
          <input type="number" class="ctl w-24" placeholder="تا" [ngModel]="pair()[1]" (ngModelChange)="setPair(1, $event)">
        }
      </div>
    } @else if (operator === 'in') {
      @if (field?.type === 'choice' && field?.choices?.length) {
        <select multiple [ngModel]="value || []" (ngModelChange)="setValue($event)" class="ctl min-w-40" size="3">
          @for (c of field!.choices; track c) {
            <option [ngValue]="c">{{ c }}</option>
          }
        </select>
      } @else {
        <input type="text" class="ctl min-w-40" placeholder="مقادیر با ویرگول جدا شوند"
               [ngModel]="listAsText" (ngModelChange)="setList($event)">
      }
    } @else if (field?.type === 'boolean') {
      <select [ngModel]="value" (ngModelChange)="setValue($event)" class="ctl">
        <option [ngValue]="true">بله</option>
        <option [ngValue]="false">خیر</option>
      </select>
    } @else if (field?.type === 'choice') {
      <select [ngModel]="value" (ngModelChange)="setValue($event)" class="ctl min-w-32">
        <option [ngValue]="null" disabled>انتخاب کنید…</option>
        @for (c of field!.choices || []; track c) {
          <option [ngValue]="c">{{ c }}</option>
        }
      </select>
    } @else if (isDate) {
      <ng-persian-datepicker [dateInitValue]="false" (dateOnSelect)="setValue($event.gregorian)">
        <input type="text" class="ctl w-32" placeholder="انتخاب تاریخ" [value]="value || ''" readonly>
      </ng-persian-datepicker>
    } @else if (field?.type === 'number') {
      <input type="number" class="ctl w-28" placeholder="عدد" [ngModel]="value" (ngModelChange)="setValue($event)">
    } @else {
      <input type="text" class="ctl min-w-36" placeholder="مقدار" [ngModel]="value" (ngModelChange)="setValue($event)">
    }
  `,
  styles: [`
    .ctl {
      font-size: 0.75rem;
      padding: 0.375rem 0.5rem;
      border-radius: 0.5rem;
      border: 1px solid #e2e8f0;
      background: #fff;
      outline: none;
    }
    .ctl:focus { border-color: #818cf8; box-shadow: 0 0 0 1px #818cf8; }
  `],
})
export class FilterValueComponent {
  @Input() field: ReportFieldMeta | null = null;
  @Input() operator: ReportOperator = 'eq';
  @Input() value: any = null;
  @Output() valueChange = new EventEmitter<any>();

  get isDate(): boolean {
    return this.field?.type === 'date' || this.field?.type === 'datetime';
  }

  get listAsText(): string {
    return Array.isArray(this.value) ? this.value.join('، ') : '';
  }

  setValue(v: any): void {
    this.value = v;
    this.valueChange.emit(v);
  }

  setList(text: string): void {
    const arr = String(text)
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);
    this.setValue(arr);
  }

  pair(): any[] {
    return Array.isArray(this.value) && this.value.length === 2 ? this.value : [null, null];
  }

  pairLabel(i: number): string {
    const p = this.pair();
    return p[i] ? String(p[i]) : '';
  }

  setPair(i: number, v: any): void {
    const p = [...this.pair()];
    p[i] = v;
    this.setValue(p);
  }
}
