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
    <div class="relative w-full">
      <select
        [ngModel]="activeId"
        (ngModelChange)="onChanged($event)"
        class="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border-0 rounded-xl px-3 py-1.5 outline-none cursor-pointer transition-colors w-full"
      >
        <option [ngValue]="null" disabled hidden>انتخاب انبار...</option>
        @for (project of projects; track project.id) {
          <option [value]="project.id">{{ project.name }}</option>
        }
      </select>
    </div>
  `,
})
export class WarehouseSelectorComponent {
  @Input() projects: { id: number | string; name: string }[] = [];
  @Input() activeId: number | string | null = null;
  @Output() changed = new EventEmitter<number | string | null>();

  onChanged(value: string | null): void {
    const parsed = value === null ? null : (isNaN(+value) ? value : +value);
    this.changed.emit(parsed);
  }
}
