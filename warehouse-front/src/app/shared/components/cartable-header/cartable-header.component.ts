import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  CartableDomain, 
  CartableWorkflowTab, 
  CartableStatusFilter, 
  CartableDateFilter, 
  CartableStatusCounts, 
  CartableMetrics,
  CartableSortOption,
  CARTABLE_STATUS_LABELS,
  CARTABLE_STATUS_SUPERVISOR_LABELS,
  CARTABLE_DATE_LABELS,
  CARTABLE_TAB_LABELS 
} from '../../../core/models/cartable.model';

@Component({
  selector: 'app-cartable-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="w-full" dir="rtl">
      <!-- Domain Switcher (Optional for Supervisor & Manager) -->
      <div *ngIf="showDomainSwitcher" class="flex items-center justify-center p-1 bg-slate-100/90 rounded-2xl mb-4 border border-slate-200/60 max-w-md mx-auto shadow-inner">
        <button
          type="button"
          (click)="onDomainChange('counting')"
          [ngClass]="activeDomain === 'counting' ? 'bg-white text-indigo-700 shadow-sm font-black' : 'text-slate-500 font-bold hover:text-slate-800'"
          class="flex-1 py-2 text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span>شمارش فیزیکی (انبار)</span>
        </button>

        <button
          type="button"
          (click)="onDomainChange('financial')"
          [ngClass]="activeDomain === 'financial' ? 'bg-white text-indigo-700 shadow-sm font-black' : 'text-slate-500 font-bold hover:text-slate-800'"
          class="flex-1 py-2 text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>اسناد مالی و گمرک</span>
        </button>
      </div>

      <!-- Primary Tabs (My Tasks / Pool) -->
      <div class="flex border-b border-slate-200 mb-4 px-2">
        <button 
          (click)="onTabChange('my-tasks')" 
          [class.border-indigo-600]="activeTab === 'my-tasks'" 
          [class.text-indigo-600]="activeTab === 'my-tasks'" 
          class="px-4 py-3 border-b-2 border-transparent font-bold text-sm transition-colors text-slate-500 hover:text-slate-800"
        >
          {{ tabLabels[activeDomain]['my-tasks'] }}
        </button>
        <button 
          (click)="onTabChange('pool')" 
          [class.border-indigo-600]="activeTab === 'pool'" 
          [class.text-indigo-600]="activeTab === 'pool'" 
          class="px-4 py-3 border-b-2 border-transparent font-bold text-sm transition-colors text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
        >
          <span>{{ tabLabels[activeDomain]['pool'] }}</span>
          <span *ngIf="poolCount > 0" class="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">
            {{ poolCount }}
          </span>
        </button>
      </div>

      <!-- Performance Metrics Cards (When not in pool and has metrics) -->
      <div class="grid grid-cols-3 gap-3 mb-4" *ngIf="activeTab === 'my-tasks' && metrics">
        <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm text-center flex flex-col justify-center">
          <span class="text-[10px] text-slate-500 font-bold mb-1">کل تسک‌ها</span>
          <span class="text-lg font-black text-slate-800">{{ metrics.totalCount }}</span>
        </div>
        <div class="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-100 shadow-sm text-center flex flex-col justify-center">
          <span class="text-[10px] text-emerald-600 font-bold mb-1">{{ role === 'counter' || role === 'customs' ? 'ارسال شده' : 'تایید شده' }}</span>
          <span class="text-lg font-black text-emerald-700">{{ metrics.completedCount }}</span>
        </div>
        <div class="bg-amber-50/80 p-3 rounded-2xl border border-amber-100 shadow-sm text-center flex flex-col justify-center">
          <span class="text-[10px] text-amber-600 font-bold mb-1">باقیمانده</span>
          <span class="text-lg font-black text-amber-700">{{ metrics.remainingCount }}</span>
        </div>
      </div>

      <!-- Sticky Glassmorphism Omni-Search & Filters Bar -->
      <div class="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pt-2 pb-3 mb-4 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-slate-200/60 transition-all">
        
        <!-- Case 1: Contextual Multi-Select Bar -->
        <div 
          *ngIf="selectedCount > 0"
          class="flex items-center justify-between gap-2 p-2 mb-3 bg-slate-900 text-white rounded-2xl shadow-md animate-in fade-in zoom-in-95 duration-150 border border-slate-800"
        >
          <!-- Right: Cancel & Count -->
          <div class="flex items-center gap-2 pr-1">
            <button 
              (click)="clearSelections.emit()" 
              type="button"
              title="لغو انتخاب‌ها"
              class="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div class="flex items-center gap-1.5 font-bold text-xs">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{{ selectedCount }} مورد انتخاب شد</span>
            </div>
          </div>

          <!-- Left: Actions Slot / Buttons -->
          <div class="flex items-center gap-1.5 pl-1">
            <button 
              (click)="toggleAll.emit()" 
              type="button"
              title="انتخاب همه اقلام فیلتر شده"
              class="px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              <span class="hidden sm:inline">انتخاب همه</span>
            </button>
            
            <ng-content select="[slot=bulk-actions]"></ng-content>
          </div>
        </div>

        <!-- Case 2: Omni-Search Bar (When NO items selected) -->
        <div *ngIf="selectedCount === 0" class="relative mb-3">
          <svg class="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>

          <input 
            type="text" 
            [ngModel]="searchQuery"
            (ngModelChange)="searchQueryChange.emit($event)"
            [placeholder]="searchPlaceholder"
            class="w-full bg-white border border-slate-200/90 rounded-2xl pr-10 pl-24 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
          >

          <button 
            *ngIf="searchQuery" 
            (click)="clearSearch.emit()" 
            class="absolute left-11 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            title="پاک کردن جستجو"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <button 
            *ngIf="showCameraScan"
            (click)="triggerCameraScan.emit()" 
            class="absolute left-2 top-2 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors shadow-sm flex items-center gap-1"
            title="اسکن با دوربین"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </button>
        </div>

        <!-- Status & Date Filters Row -->
        <div class="flex flex-col gap-2.5">
          <!-- Status Chips -->
          <div class="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            <!-- Pending -->
            <button 
              (click)="onStatusChange('pending')" 
              [ngClass]="activeStatus === 'pending' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border border-slate-200/80'" 
              class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors shadow-sm flex items-center gap-1"
            >
              <span>{{ getStatusLabel('pending') }}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full" [ngClass]="activeStatus === 'pending' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'">
                {{ statusCounts.pending }}
              </span>
            </button>

            <!-- Recount -->
            <button 
              *ngIf="statusCounts.recount > 0 || activeStatus === 'recount'"
              (click)="onStatusChange('recount')" 
              [ngClass]="activeStatus === 'recount' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border border-slate-200/80'" 
              class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors shadow-sm flex items-center gap-1 animate-in fade-in duration-150"
            >
              <span>{{ getStatusLabel('recount') }}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full" [ngClass]="activeStatus === 'recount' ? 'bg-rose-400 text-white' : 'bg-rose-50 text-rose-700'">
                {{ statusCounts.recount }}
              </span>
            </button>

            <!-- Initial / Ready -->
            <button 
              *ngIf="statusCounts.initial > 0 || activeStatus === 'initial'"
              (click)="onStatusChange('initial')" 
              [ngClass]="activeStatus === 'initial' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border border-indigo-200/80'" 
              class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors shadow-sm flex items-center gap-1 animate-in fade-in duration-150"
            >
              <span>{{ getStatusLabel('initial') }}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full" [ngClass]="activeStatus === 'initial' ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-700'">
                {{ statusCounts.initial }}
              </span>
            </button>

            <!-- Completed -->
            <button 
              (click)="onStatusChange('completed')" 
              [ngClass]="activeStatus === 'completed' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border border-slate-200/80'" 
              class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors shadow-sm flex items-center gap-1"
            >
              <span>{{ getStatusLabel('completed') }}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full" [ngClass]="activeStatus === 'completed' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700'">
                {{ statusCounts.completed }}
              </span>
            </button>

            <!-- All -->
            <button 
              (click)="onStatusChange('all')" 
              [ngClass]="activeStatus === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border border-slate-200/80'" 
              class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors shadow-sm flex items-center gap-1"
            >
              <span>{{ getStatusLabel('all') }}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full" [ngClass]="activeStatus === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'">
                {{ statusCounts.all }}
              </span>
            </button>
          </div>

          <!-- Date Filters & Sort Row -->
          <div class="flex items-center justify-between gap-2 relative">
            <div class="flex gap-1.5 items-center overflow-x-auto scrollbar-hide flex-1 py-0.5">
              <button 
                *ngFor="let dateKey of dateKeys"
                (click)="onDateChange(dateKey)" 
                [ngClass]="activeDate === dateKey ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50/70 text-indigo-700 border-indigo-100'" 
                class="px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors border"
              >
                {{ dateLabels[dateKey] }}
              </button>
            </div>

            <!-- Custom Slot for Sort/Extra filters -->
            <ng-content select="[slot=sort-controls]"></ng-content>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CartableHeaderComponent {
  @Input() role: 'counter' | 'customs' | 'supervisor' | 'manager' = 'counter';
  @Input() showDomainSwitcher = false;
  @Input() activeDomain: CartableDomain = 'counting';
  @Output() domainChange = new EventEmitter<CartableDomain>();

  @Input() activeTab: CartableWorkflowTab = 'my-tasks';
  @Input() poolCount = 0;
  @Output() tabChange = new EventEmitter<CartableWorkflowTab>();

  @Input() metrics?: CartableMetrics;

  @Input() selectedCount = 0;
  @Output() clearSelections = new EventEmitter<void>();
  @Output() toggleAll = new EventEmitter<void>();

  @Input() searchQuery = '';
  @Input() searchPlaceholder = 'جستجو یا اسکن بارکد (کد، شرح، لوکیشن)...';
  @Input() showCameraScan = true;
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() clearSearch = new EventEmitter<void>();
  @Output() triggerCameraScan = new EventEmitter<void>();

  @Input() activeStatus: CartableStatusFilter = 'pending';
  @Input() statusCounts: CartableStatusCounts = { all: 0, pending: 0, recount: 0, initial: 0, completed: 0 };
  @Output() statusChange = new EventEmitter<CartableStatusFilter>();

  @Input() activeDate: CartableDateFilter = 'all';
  @Output() dateChange = new EventEmitter<CartableDateFilter>();

  readonly tabLabels = CARTABLE_TAB_LABELS;
  readonly dateLabels = CARTABLE_DATE_LABELS;
  readonly dateKeys: CartableDateFilter[] = ['all', 'today', 'yesterday', 'week'];

  getStatusLabel(status: CartableStatusFilter): string {
    if (this.role === 'supervisor' || this.role === 'manager') {
      return CARTABLE_STATUS_SUPERVISOR_LABELS[status];
    }
    return CARTABLE_STATUS_LABELS[status];
  }

  onDomainChange(domain: CartableDomain) {
    this.domainChange.emit(domain);
  }

  onTabChange(tab: CartableWorkflowTab) {
    this.tabChange.emit(tab);
  }

  onStatusChange(status: CartableStatusFilter) {
    this.statusChange.emit(status);
  }

  onDateChange(date: CartableDateFilter) {
    this.dateChange.emit(date);
  }
}
