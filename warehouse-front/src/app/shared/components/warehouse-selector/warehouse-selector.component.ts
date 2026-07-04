import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/stores/auth.store';

/**
 * انتخاب انبار فعال — استخراج شده از layout (فعلاً ۲ بار تکرار شده بود)
 *
 * استفاده:
 *   <app-warehouse-selector
 *     [projects]="projects"
 *     [activeId]="store.activeWarehouseId()"
 *     (changed)="store.setActiveWarehouse($event)"
 *   />
 */
@Component({
  selector: 'app-warehouse-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative">
      <select
        [ngModel]="activeId"
        (ngModelChange)="onChanged($event)"
        class="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border-0 rounded-xl px-3 py-1.5 outline-none cursor-pointer transition-colors appearance-none"
        [class.pr-8]="!compact"
        [class.w-full]="fullWidth"
      >
        <option value="ALL">🌍 همه انبارها (نمایش تجمیعی)</option>
        @for (project of projects; track project.id) {
          <option [value]="project.id">{{ project.name }}</option>
        }
      </select>
      <div class="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
  `,
})
export class WarehouseSelectorComponent {
  @Input() projects: { id: number | string; name: string }[] = [];
  @Input() activeId: number | string = 'ALL';
  @Input() compact = false;
  @Input() fullWidth = false;
  @Output() changed = new EventEmitter<number | string>();

  onChanged(value: string): void {
    const parsed = value === 'ALL' ? 'ALL' : (isNaN(+value) ? value : +value);
    this.changed.emit(parsed);
  }
}
