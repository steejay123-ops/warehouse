import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportTemplate } from '../../core/models/report.model';

/**
 * فهرست قالب‌های گزارش ذخیره‌شده (شخصی + عمومی)
 */
@Component({
  selector: 'app-saved-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <span class="text-xs font-black text-slate-700">قالب‌های ذخیره‌شده</span>
        <span class="text-[10px] text-slate-400">{{ templates.length }}</span>
      </div>

      <div class="max-h-[50vh] overflow-y-auto divide-y divide-slate-50">
        @if (!templates.length) {
          <div class="p-4 text-center text-[10px] text-slate-400">
            هنوز قالبی ذخیره نشده است
          </div>
        }
        @for (t of templates; track t.id) {
          <div class="p-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
               [class.bg-indigo-50]="t.id === activeId"
               (click)="load.emit(t)">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-slate-700 truncate flex-1">{{ t.name }}</span>
              @if (t.is_public) {
                <span class="text-[9px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-bold shrink-0">عمومی</span>
              }
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[9px] text-slate-400">{{ t.owner_username }}</span>
              @if (t.is_owner) {
                <button type="button" (click)="$event.stopPropagation(); togglePublic.emit(t)"
                        class="text-[9px] text-indigo-500 hover:text-indigo-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  {{ t.is_public ? 'خصوصی کن' : 'عمومی کن' }}
                </button>
                <button type="button" (click)="$event.stopPropagation(); remove.emit(t)"
                        class="text-[9px] text-rose-500 hover:text-rose-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity mr-auto">
                  حذف
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class SavedReportsComponent {
  @Input() templates: ReportTemplate[] = [];
  @Input() activeId: number | null = null;
  @Output() load = new EventEmitter<ReportTemplate>();
  @Output() remove = new EventEmitter<ReportTemplate>();
  @Output() togglePublic = new EventEmitter<ReportTemplate>();
}
