import { Component, Input, Output, EventEmitter, signal, computed, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-deep-sync-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal [isOpen]="isOpen" (closed)="close()" title="بروزرسانی عمیق" sizeClass="max-w-xl">
      <div class="px-6 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        
        <!-- Header & Info -->
        <div class="flex items-start gap-4 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
          <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-indigo-900 mb-1">انتخاب انبارهای هدف</h3>
            <p class="text-xs text-indigo-700/80 leading-relaxed">
              با بروزرسانی عمیق، اطلاعات آفلاین ذخیره‌شده برای انبارهای انتخاب‌شده کاملاً پاک شده و از نو دریافت می‌شود. این فرآیند امن است اما ممکن است بسته به حجم داده‌ها کمی زمان‌بر باشد.
            </p>
          </div>
        </div>

        <!-- Selection Controls -->
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs font-bold text-slate-700">لیست انبارها ({{ warehouses.length }})</span>
          <button 
            (click)="toggleSelectAll()"
            class="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            [ngClass]="allSelected() ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'"
          >
            {{ allSelected() ? 'لغو انتخاب همه' : 'انتخاب همه' }}
          </button>
        </div>

        <!-- Modern Selectable List -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          @for (wh of warehouses; track wh.id) {
            <div 
              (click)="toggleWarehouse(wh.id)"
              class="relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer group"
              [ngClass]="{
                'border-indigo-500 bg-indigo-50/30': isSelected(wh.id),
                'border-slate-100 bg-white hover:border-slate-300': !isSelected(wh.id)
              }"
            >
              <!-- Modern Check Indicator -->
              <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                   [ngClass]="isSelected(wh.id) ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-slate-50 group-hover:border-slate-400'">
                @if (isSelected(wh.id)) {
                  <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                }
              </div>
              
              <!-- Content -->
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold text-slate-800 truncate">{{ wh.name }}</h4>
              </div>
            </div>
          }
        </div>

      </div>

      <!-- Footer Actions -->
      <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
        <button 
          (click)="close()"
          class="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
        >
          انصراف
        </button>
        <button 
          (click)="confirm()"
          [disabled]="selectedIds().length === 0"
          class="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-sm"
          [ngClass]="selectedIds().length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          شروع بروزرسانی ({{ selectedIds().length }})
        </button>
      </div>
    </app-modal>
  `
})
export class DeepSyncModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() warehouses: { id: number; name: string }[] = [];
  @Input() preselectId: number | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() startSync = new EventEmitter<number[]>();

  selectedIds = signal<number[]>([]);

  allSelected = computed(() => {
    const ids = this.selectedIds();
    return this.warehouses.length > 0 && ids.length === this.warehouses.length;
  });

  ngOnChanges(changes: any) {
    if (changes.isOpen && this.isOpen) {
      if (this.preselectId) {
        this.selectedIds.set([this.preselectId]);
      } else {
        this.selectedIds.set([]);
      }
    }
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  toggleWarehouse(id: number) {
    const current = this.selectedIds();
    if (current.includes(id)) {
      this.selectedIds.set(current.filter(x => x !== id));
    } else {
      this.selectedIds.set([...current, id]);
    }
  }

  toggleSelectAll() {
    if (this.allSelected()) {
      this.selectedIds.set([]);
    } else {
      this.selectedIds.set(this.warehouses.map(w => w.id));
    }
  }

  close() {
    this.closed.emit();
  }

  confirm() {
    if (this.selectedIds().length === 0) return;
    this.startSync.emit(this.selectedIds());
    this.close();
  }
}
