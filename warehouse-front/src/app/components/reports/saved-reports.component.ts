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
      <div class="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <span class="text-xs font-black text-slate-800">قالب‌های ذخیره‌شده</span>
        <span class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/60">{{ templates.length }}</span>
      </div>

      <div class="max-h-[50vh] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
        @if (!templates.length) {
          <div class="p-5 text-center text-xs text-slate-400">
            هنوز قالبی ذخیره نشده است
          </div>
        }
        @for (t of templates; track t.id) {
          <div class="p-3 hover:bg-slate-50 transition-all cursor-pointer group"
               [class.bg-indigo-50/70]="t.id === activeId"
               [class.border-r-4]="t.id === activeId"
               [class.border-indigo-600]="t.id === activeId"
               (click)="load.emit(t)">
            <div class="flex items-center gap-1.5 justify-between">
              <span class="text-xs font-bold text-slate-800 truncate flex-1" [class.text-indigo-700]="t.id === activeId">{{ t.name }}</span>
              @if (t.is_public) {
                <span class="text-[9px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-bold shrink-0">عمومی</span>
              }
            </div>
            <div class="flex items-center gap-2 mt-1.5">
              <span class="text-[10px] text-slate-400">{{ t.owner_username }}</span>
              @if (t.is_owner) {
                <button type="button" (click)="$event.stopPropagation(); togglePublic.emit(t)"
                        class="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold transition-all sm:opacity-0 sm:group-hover:opacity-100 px-1 py-0.5 rounded hover:bg-indigo-100/50">
                  {{ t.is_public ? 'خصوصی‌سازی' : 'عمومی‌سازی' }}
                </button>
                <button type="button" (click)="$event.stopPropagation(); remove.emit(t)"
                        class="text-[10px] text-rose-500 hover:text-rose-700 font-bold transition-all sm:opacity-0 sm:group-hover:opacity-100 mr-auto px-1 py-0.5 rounded hover:bg-rose-50">
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
