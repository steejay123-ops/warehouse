import {
  Component,
  Input,
  Output,
  EventEmitter,
  ContentChildren,
  QueryList,
  TemplateRef,
  Directive,
  ContentChild,
  OnInit,
  OnDestroy,
  HostListener,
  ViewChildren,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { NgPersianDatepickerModule } from 'ng-persian-datepicker';

// ══════════════════════════════════════════════════
//  Column Definition Directive
// ══════════════════════════════════════════════════

@Directive({
  selector: '[appTableCol]',
  standalone: true,
})
export class TableColumnDirective {
  @Input('appTableCol') key = '';
  @Input() label = '';
  @Input() sortable = true;
  @Input() filterable = true;
  @Input() width = '';
  @Input() filterType: 'text' | 'checkbox' | 'checkbox_text' | 'date' | 'range' = 'text';
  @Input() filterOptions: {label: string, value: string}[] = [];
  
  // Inline editing properties
  @Input() editable = false;
  @Input() inputType = 'text';

  constructor(public template: TemplateRef<unknown>) {}
}

// ══════════════════════════════════════════════════
//  DataTable Component
// ══════════════════════════════════════════════════

export interface SortState {
  key: string | null;
  direction: 'asc' | 'desc';
}

export interface PageEvent {
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgPersianDatepickerModule],
  template: `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <!-- Header Actions -->
      @if (showHeader) {
        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-4">
            <!-- Global Search -->
            <div class="relative flex items-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="absolute right-2.5 text-slate-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" [value]="globalSearch" (input)="onGlobalSearch($event)" placeholder="جستجو (کد، شرح، PO، PL، PK، تگ)..." title="جستجو در فیلدهای: کد یکتا، کد ترکیبی، شرح کالا، سفارش خرید (PO)، پکینگ لیست (PL)، پکیج (PK) و تگ" class="w-72 text-xs py-1.5 pl-2 pr-8 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none placeholder:text-slate-400 transition-shadow">
              @if (isLoading) {
                <svg class="animate-spin absolute left-2.5 w-3.5 h-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              }
            </div>

            <ng-content select="[table-actions]"></ng-content>

            <div class="flex items-center gap-1.5 text-xs text-slate-500 border-r border-slate-200 pr-4">
              <span class="font-bold text-slate-700">{{ totalCount }}</span>
              <span>{{ itemLabel }}</span>
              @if (selectedCount > 0) {
                <span class="bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full font-bold text-[10px] mr-1">
                  {{ selectedCount }} انتخاب شده
                </span>
              }
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Zoom Controls -->
            <div class="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <button (click)="zoomOut()" title="کوچک‌نمایی (Zoom Out)" class="px-2 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <button (click)="resetZoom()" title="اندازه اصلی (100%)" class="px-2 py-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border-x border-slate-100 min-w-[36px] text-center">
                {{ (zoomScale * 100) | number:'1.0-0' }}%
              </button>
              <button (click)="zoomIn()" title="بزرگ‌نمایی (Zoom In)" class="px-2 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
            </div>

            @if (showColumnToggle) {
              <div class="relative">
                <button (click)="isColumnToggleOpen = !isColumnToggleOpen" class="text-[10px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors bg-white border border-slate-200 px-2 py-1.5 rounded-lg shadow-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  انتخاب ستون‌ها
                </button>
                @if (isColumnToggleOpen) {
                  <!-- Backdrop to close dropdown on outside click -->
                  <div class="fixed inset-0 z-[45]" (click)="isColumnToggleOpen = false"></div>
                  <div class="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-xl z-50 p-2 text-right">
                    <div class="text-[10px] font-black text-slate-400 mb-2 px-1 border-b border-slate-100 pb-2">مدیریت نمایش ستون‌ها</div>
                    <label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer border-b border-slate-100 mb-1">
                      <input type="checkbox" [checked]="visibleColumns?.length === allColumns.length" (change)="toggleAllColumns($event)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                      <span class="text-xs font-bold text-slate-800">انتخاب همه / هیچ‌کدام</span>
                    </label>
                    <div class="max-h-[60vh] overflow-y-auto space-y-1">
                      @for (col of allColumns; track col.key) {
                        <label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                          <input type="checkbox" [checked]="isColumnVisible(col.key)" (change)="toggleColumnVisibility(col.key)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                          <span class="text-xs font-bold text-slate-700">{{ col.label }}</span>
                        </label>
                      }
                    </div>
                  </div>
                }
              </div>
            }
            @if (showClearFilters && hasActiveFilters) {
              <button
                (click)="clearAllFilters()"
                class="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors bg-rose-50 px-2 py-1.5 rounded-lg"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                پاک کردن فیلترها
              </button>
            }

            <!-- Update Button -->
            @if (editHistory.length > 0) {
              <div class="relative flex items-center gap-1 bg-indigo-50 border border-indigo-100 rounded-lg overflow-hidden ml-2 transition-all p-1">
                <button (click)="undo()" [disabled]="historyIndex < 0" title="بازگشت تغییرات (Ctrl+Z)" class="flex items-center justify-center p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 text-indigo-700 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
                </button>
                <button (click)="redo()" [disabled]="historyIndex >= editHistory.length - 1" title="اعمال مجدد (Ctrl+Y)" class="flex items-center justify-center p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 text-indigo-700 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path></svg>
                </button>
                <div class="w-px h-5 bg-indigo-200 mx-0.5"></div>
                <button (click)="showConfirm()" [disabled]="pendingChanges.size === 0" class="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-indigo-700 bg-white rounded-md shadow-sm border border-indigo-100 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  ذخیره تغییرات ({{pendingChanges.size}})
                </button>
                <button (click)="showRevertConfirm()" title="لغو تغییرات" class="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-rose-700 bg-white rounded-md shadow-sm border border-rose-100 hover:bg-rose-50 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9h13a5 5 0 0 1 0 10H7"/><polyline points="7 5 3 9 7 13"/></svg>
                  لغو تغییرات
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Table -->
      <div class="overflow-auto max-h-[60vh] relative border-b border-slate-200">
        <table class="w-full text-xs" [style.zoom]="zoomScale">
          <thead class="sticky top-0 z-10 bg-white shadow-sm">
            <tr>
              @if (selectable) {
                <th class="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    [checked]="isAllSelected"
                    (change)="toggleSelectAll($event)"
                    class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
              }
              @if (showRowNumber) {
                <th class="px-3 py-3 w-12 text-center font-bold text-slate-600">ردیف</th>
              }
              @for (col of columns; track col.key; let idx = $index) {
                <th
                  draggable="true"
                  (dragstart)="onDragStart($event, idx)"
                  (dragover)="onDragOver($event, idx)"
                  (drop)="onDrop($event, idx)"
                  (dragend)="onDragEnd()"
                  class="px-3 py-3 text-right font-bold text-slate-600 whitespace-nowrap group relative cursor-grab active:cursor-grabbing"
                  [class.opacity-50]="draggedColumnIndex === idx"
                  [class.border-r-2]="dragOverColumnIndex === idx && dragOverColumnIndex > draggedColumnIndex"
                  [class.border-l-2]="dragOverColumnIndex === idx && dragOverColumnIndex < draggedColumnIndex"
                  [class.border-indigo-500]="dragOverColumnIndex === idx"
                  [style.width]="col.width || 'auto'"
                >
                  <div class="flex items-center gap-1.5 bg-white pointer-events-none">
                    <span>{{ col.label }}</span>
                    @if (showColumnToggle) {
                      <button
                        (click)="toggleColumnVisibility(col.key); $event.stopPropagation()"
                        class="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 mr-auto pointer-events-auto"
                        title="مخفی کردن ستون"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    }
                    @if (col.sortable) {
                      <button
                        (click)="handleSort(col.key); $event.stopPropagation()"
                        class="p-0.5 rounded hover:bg-slate-200 transition-colors pointer-events-auto"
                        [class.text-indigo-600]="sort.key === col.key"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          @if (sort.key === col.key && sort.direction === 'desc') {
                            <polyline points="6 15 12 9 18 15"/>
                          } @else {
                            <polyline points="6 9 12 15 18 9"/>
                          }
                        </svg>
                      </button>
                    }
                  </div>
                </th>
              }
              @if (hasActions) {
                <th class="px-3 py-3 text-center font-bold text-slate-600 whitespace-nowrap">عملیات</th>
              }
            </tr>
            @if (showFilters) {
              <tr class="bg-slate-50/50">
                @if (selectable) { <th class="border-t border-slate-100"></th> }
                @if (showRowNumber) { <th class="border-t border-slate-100"></th> }
                
                @for (col of columns; track col.key) {
                  <th class="px-3 py-2 border-t border-slate-100">
                    <div class="flex items-center gap-1">
                      @if (col.filterType === 'checkbox' || col.filterType === 'checkbox_text') {
                        <div class="relative text-right" [class.w-full]="col.filterType === 'checkbox'" [class.flex-1]="col.filterType === 'checkbox_text'">
                          <button (click)="toggleFilterDropdown(col.key)" class="w-full text-[10px] px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:border-indigo-400 flex items-center justify-between text-slate-500">
                            <span>{{ hasFilter(col.key) ? 'فیلتر فعال' : (col.filterType === 'checkbox_text' ? 'انتخاب' : 'همه موارد') }}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          </button>
                          @if (activeFilterDropdown === col.key) {
                            <div class="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-xl z-[60] p-2 text-right flex flex-col gap-1 max-h-48 overflow-y-auto">
                              @for (opt of col.filterOptions; track opt.value) {
                                <label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                  <input type="checkbox" [checked]="isFilterOptionSelected(col.key, opt.value)" (change)="toggleFilterOption(col.key, opt.value)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                                  <span class="text-xs font-bold text-slate-700">{{ opt.label }}</span>
                                </label>
                              }
                            </div>
                            <div class="fixed inset-0 z-[55]" (click)="activeFilterDropdown = null"></div>
                          }
                        </div>
                      }
                      
                      @if (col.filterType === 'date') {
                        <div class="relative text-right w-full">
                          <button (click)="toggleFilterDropdown(col.key)" class="w-full text-[10px] px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:border-indigo-400 flex items-center justify-between text-slate-500">
                            <span>{{ filters[col.key] || 'همه زمان‌ها' }}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          </button>
                          @if (activeFilterDropdown === col.key) {
                            <div class="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-xl z-[60] p-2 text-right flex flex-col gap-1">
                              @if (!showCustomDateRange) {
                                @for (opt of dateFilterOptions; track opt.value) {
                                  <button (click)="applyDateFilter(col.key, opt.value, opt.label)" class="text-[10px] text-right font-bold px-2 py-1.5 rounded hover:bg-slate-50" [class.text-indigo-600]="filters[col.key] === opt.label" [class.text-slate-700]="filters[col.key] !== opt.label">{{opt.label}}</button>
                                }
                              } @else {
                                <div class="text-[10px] font-bold text-slate-600 mb-1">از تاریخ:</div>
                                <ng-persian-datepicker [dateInitValue]="false" (dateOnSelect)="customDateStart = $event.gregorian">
                                  <input type="text" [formControl]="customDateStartControl" class="w-full text-[10px] px-2 py-1 rounded border border-slate-200 focus:border-indigo-400 outline-none mb-1" placeholder="انتخاب تاریخ">
                                </ng-persian-datepicker>
                                <div class="text-[10px] font-bold text-slate-600 mb-1">تا تاریخ:</div>
                                <ng-persian-datepicker [dateInitValue]="false" (dateOnSelect)="customDateEnd = $event.gregorian">
                                  <input type="text" [formControl]="customDateEndControl" class="w-full text-[10px] px-2 py-1 rounded border border-slate-200 focus:border-indigo-400 outline-none mb-2" placeholder="انتخاب تاریخ">
                                </ng-persian-datepicker>
                                <div class="flex items-center gap-1">
                                  <button (click)="applyCustomDateRange(col.key)" class="flex-1 bg-indigo-600 text-white text-[10px] font-bold py-1 rounded hover:bg-indigo-700">اعمال</button>
                                  <button (click)="showCustomDateRange = false" class="flex-1 bg-slate-100 text-slate-600 text-[10px] font-bold py-1 rounded hover:bg-slate-200">بازگشت</button>
                                </div>
                              }
                            </div>
                            <div class="fixed inset-0 z-[55]" (click)="activeFilterDropdown = null; showCustomDateRange = false"></div>
                          }
                        </div>
                      }
                      
                      @if (col.filterType === 'range') {
                        <div class="relative text-right w-full">
                          <button (click)="toggleFilterDropdown(col.key)" class="w-full text-[10px] px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:border-indigo-400 flex items-center justify-between text-slate-500">
                            <span>{{ filters[col.key] || 'همه مقادیر' }}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          </button>
                          @if (activeFilterDropdown === col.key) {
                            <div class="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-xl z-[60] p-2 text-right flex flex-col gap-1">
                              <div class="text-[10px] font-bold text-slate-600 mb-1">از مقدار:</div>
                              <input type="number" [(ngModel)]="customRangeStart" class="w-full text-[10px] px-2 py-1 rounded border border-slate-200 focus:border-indigo-400 outline-none mb-1">
                              <div class="text-[10px] font-bold text-slate-600 mb-1">تا مقدار:</div>
                              <input type="number" [(ngModel)]="customRangeEnd" class="w-full text-[10px] px-2 py-1 rounded border border-slate-200 focus:border-indigo-400 outline-none mb-2">
                              <div class="flex items-center gap-1">
                                <button (click)="applyCustomRange(col.key)" class="flex-1 bg-indigo-600 text-white text-[10px] font-bold py-1 rounded hover:bg-indigo-700">اعمال</button>
                                <button (click)="clearCustomRange(col.key)" class="flex-1 bg-slate-100 text-slate-600 text-[10px] font-bold py-1 rounded hover:bg-slate-200">پاک کردن</button>
                              </div>
                            </div>
                            <div class="fixed inset-0 z-[55]" (click)="activeFilterDropdown = null"></div>
                          }
                        </div>
                      }
                      
                      @if (!col.filterType || col.filterType === 'text' || col.filterType === 'checkbox_text') {
                        <input
                          type="text"
                          class="text-[10px] px-2 py-1 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none placeholder:text-slate-300"
                          [class.w-full]="!col.filterType || col.filterType === 'text'"
                          [class.flex-[2]]="col.filterType === 'checkbox_text'"
                          [class.w-0]="col.filterType === 'checkbox_text'"
                          placeholder="جستجو..."
                          [value]="col.filterType === 'checkbox_text' ? (filters[col.key + '_search'] || '') : (filters[col.key] || '')"
                          (input)="onFilter(col.filterType === 'checkbox_text' ? col.key + '_search' : col.key, $any($event.target).value)"
                        />
                      }
                    </div>
                  </th>
                }
                
                @if (hasActions) { <th class="border-t border-slate-100"></th> }
              </tr>
            }
          </thead>

          <tbody class="divide-y divide-slate-100 bg-white">
            @for (row of data; track trackByFn(row); let i = $index) {
              <tr
                class="hover:bg-indigo-50/30 transition-colors group"
                [class.bg-indigo-50/50]="isRowSelected(row)"
              >
                @if (selectable) {
                  <td class="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      [checked]="isRowSelected(row)"
                      (change)="toggleRowSelection(row, $event)"
                      class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                }
                @if (showRowNumber) {
                  <td class="px-3 py-2.5 text-center text-[10px] text-slate-400 font-bold">
                    {{ (currentPage - 1) * pageSize + i + 1 }}
                  </td>
                }
                @for (col of columns; track col.key) {
                  <td class="px-3 py-2.5 text-slate-700 relative group/cell" [class.bg-yellow-50]="pendingChanges.has(row)">
                    @if (col.editable) {
                      @if (isEditing(row, col.key)) {
                        <input
                          #editInput
                          [type]="col.inputType"
                          [value]="getCellValue(row, col.key)"
                          (blur)="onEditCommit(row, col.key, editInput.value)"
                          (keydown)="handleKeyDown($event, row, col.key, editInput)"
                          class="editing-cell-input w-full min-w-[80px] text-xs px-2 py-1 rounded border border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none bg-white shadow-sm"
                        />
                      } @else {
                        <div (click)="startEditing(row, col.key, $event)" class="cursor-text hover:bg-indigo-50/50 p-1 -m-1 rounded transition-colors border border-transparent hover:border-indigo-100 flex items-center min-h-[28px]" title="کلیک برای ویرایش سریع">
                          <ng-container
                            [ngTemplateOutlet]="col.template"
                            [ngTemplateOutletContext]="{ $implicit: row, row: row, value: row[col.key], index: i }"
                          ></ng-container>
                        </div>
                      }
                    } @else {
                      <ng-container
                        [ngTemplateOutlet]="col.template"
                        [ngTemplateOutletContext]="{ $implicit: row, row: row, value: row[col.key], index: i }"
                      ></ng-container>
                    }
                  </td>
                }
                @if (hasActions) {
                  <td class="px-3 py-2.5 text-center">
                    <ng-content select="[table-row-actions]"></ng-content>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="totalColumns" class="px-6 py-12 text-center">
                  @if (isLoading) {
                    <div class="text-slate-400 flex flex-col items-center justify-center">
                      <svg class="animate-spin mb-3 text-indigo-500" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      <p class="text-xs font-bold">در حال بارگذاری...</p>
                    </div>
                  } @else {
                    <div class="text-slate-400">
                      <svg class="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                      </svg>
                      <p class="text-xs font-bold">{{ emptyMessage }}</p>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      @if (showPagination && totalCount > pageSize) {
        <div class="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <div class="text-[10px] text-slate-500">
            نمایش {{ startIndex }}–{{ endIndex }} از {{ totalCount }}
          </div>
          <div class="flex items-center gap-1">
            <button
              (click)="goToPage(currentPage - 1)"
              [disabled]="currentPage === 1"
              class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            @for (p of visiblePages; track p) {
              <button
                (click)="goToPage(p)"
                class="w-7 h-7 rounded-lg text-[10px] font-bold transition-colors"
                [ngClass]="p === currentPage ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
              >
                {{ p }}
              </button>
            }
            <button
              (click)="goToPage(currentPage + 1)"
              [disabled]="currentPage === totalPages"
              class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          </div>
        </div>
      }

      <!-- Confirmation Modal -->
      @if (isConfirming) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" (click)="cancelUpdate()"></div>
          
          <!-- Modal Content -->
          <div class="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-[90%] max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div class="p-5 text-center">
              <div class="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              </div>
              <h3 class="text-base font-black text-slate-800 mb-2">ذخیره تغییرات؟</h3>
              <p class="text-xs text-slate-500 leading-relaxed font-medium">شما تغییراتی در {{pendingChanges.size}} رکورد ایجاد کرده‌اید. آیا مایل به ذخیره این تغییرات در سیستم هستید؟</p>
            </div>
            
            <div class="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button (click)="confirmUpdate()" class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex justify-center items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                تایید
              </button>
              <button (click)="cancelUpdate()" class="flex-1 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors">
                لغو
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Revert Confirmation Modal -->
      @if (isRevertConfirming) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center">
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" (click)="cancelRevert()"></div>
          
          <div class="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-[90%] max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div class="p-5 text-center">
              <div class="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </div>
              <h3 class="text-base font-black text-slate-800 mb-2">لغو تغییرات؟</h3>
              <p class="text-xs text-slate-500 leading-relaxed font-medium">آیا از لغو تمام تغییرات خود مطمئن هستید؟ این کار غیرقابل بازگشت است.</p>
            </div>
            
            <div class="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button (click)="confirmRevertAll()" class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex justify-center items-center gap-2">
                تایید
              </button>
              <button (click)="cancelRevert()" class="flex-1 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors">
                لغو
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class DataTableComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() data: any[] = [];
  @Input() totalCount = 0;
  @Input() pageSize = 20;
  @Input() currentPage = 1;
  @Input() itemLabel = 'مورد';
  @Input() emptyMessage = 'موردی یافت نشد';
  @Input() selectable = false;
  @Input() showRowNumber = false;
  @Input() showHeader = true;
  @Input() showFilters = true;
  @Input() showPagination = true;
  @Input() showClearFilters = true;
  @Input() showColumnToggle = false;
  @Input() hasActions = false;
  @Input() trackByKey = 'id';
  @Input() selectedIds: Set<any> = new Set();
  @Input() visibleColumns: string[] | null = null; // If null, all columns are visible
  @Input() filters: Record<string, string> = {};
  @Input() isLoading = false;
  @Input() globalSearch: string = '';

  @Output() sortChanged = new EventEmitter<SortState>();
  @Output() filterChanged = new EventEmitter<Record<string, string>>();
  @Output() searchChanged = new EventEmitter<string>();
  @Output() pageChanged = new EventEmitter<PageEvent>();
  @Output() selectionChanged = new EventEmitter<Set<any>>();
  @Output() filtersCleared = new EventEmitter<void>();
  @Output() visibleColumnsChanged = new EventEmitter<string[]>();
  @Output() bulkUpdate = new EventEmitter<any[]>();

  @ContentChildren(TableColumnDirective) columnDefs!: QueryList<TableColumnDirective>;
  @ViewChildren('editInput') editInputs!: QueryList<ElementRef>;

  sort: SortState = { key: null, direction: 'asc' };
  isColumnToggleOpen = false;
  activeFilterDropdown: string | null = null;
  showCustomDateRange: boolean = false;
  customDateStart: string = '';
  customDateEnd: string = '';
  customDateStartControl = new FormControl('');
  customDateEndControl = new FormControl('');
  customRangeStart: number | null = null;
  customRangeEnd: number | null = null;

  private filterTimeout: any;

  // Zoom feature
  zoomScale: number = 1.0;

  // Drag and drop feature
  draggedColumnIndex = -1;
  dragOverColumnIndex = -1;

  // Inline editing history & state
  editHistory: { row: any; field: string; oldVal: any; newVal: any }[] = [];
  historyIndex = -1;
  pendingChanges = new Set<any>(); 
  editingCell: { row: any; field: string; value?: any } | null = null;
  isConfirming = false;
  isRevertConfirming = false;
  isCancelling = false;
  moveToAfterCommit: { rowDelta: number, colDelta: number } | null = null;
  selectAllOnFocus = false;

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      if (event.code === 'KeyZ' && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if (event.code === 'KeyY' || (event.code === 'KeyZ' && event.shiftKey)) {
        event.preventDefault();
        this.redo();
      }
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    if (this.pendingChanges.size > 0) {
      $event.returnValue = true;
    }
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.editInputs.changes.subscribe((inputs: QueryList<ElementRef>) => {
      if (inputs.length > 0) {
        setTimeout(() => {
          const input = inputs.first.nativeElement as HTMLInputElement;
          input.focus();
          
          if (this.selectAllOnFocus) {
            input.select();
            this.selectAllOnFocus = false;
          } else if (input.type === 'text' && this.lastClickOffset !== -1) {
            const safeOffset = Math.min(this.lastClickOffset, input.value.length);
            input.setSelectionRange(safeOffset, safeOffset);
          }
        }, 10);
      }
    });
  }

  ngOnDestroy() {
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }
  }

  zoomIn() {
    this.zoomScale = Math.min(this.zoomScale + 0.1, 2.0);
  }

  zoomOut() {
    this.zoomScale = Math.max(this.zoomScale - 0.1, 0.5);
  }

  resetZoom() {
    this.zoomScale = 1.0;
  }

  onDragStart(event: DragEvent, index: number) {
    this.draggedColumnIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault(); // Necessary to allow dropping
    this.dragOverColumnIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    if (this.draggedColumnIndex > -1 && this.draggedColumnIndex !== index) {
      const cols = [...this.columns];
      const draggedCol = cols[this.draggedColumnIndex];
      
      if (!this.visibleColumns) {
        this.visibleColumns = this.allColumns.map(c => c.key);
      }
      
      const draggedKey = draggedCol.key;
      const targetKey = cols[index].key;
      
      const currentKeys = [...this.visibleColumns];
      const fromIdx = currentKeys.indexOf(draggedKey);
      const toIdx = currentKeys.indexOf(targetKey);
      
      if (fromIdx > -1 && toIdx > -1) {
        currentKeys.splice(fromIdx, 1);
        currentKeys.splice(toIdx, 0, draggedKey);
        this.visibleColumns = currentKeys;
        this.visibleColumnsChanged.emit(this.visibleColumns);
      }
    }
    this.draggedColumnIndex = -1;
    this.dragOverColumnIndex = -1;
  }

  onDragEnd() {
    this.draggedColumnIndex = -1;
    this.dragOverColumnIndex = -1;
  }

  onGlobalSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }
    this.filterTimeout = setTimeout(() => {
      this.searchChanged.emit(value);
    }, 400);
  }

  applyCustomRange(key: string) {
    if (this.customRangeStart !== null || this.customRangeEnd !== null) {
      let label = '';
      if (this.customRangeStart !== null && this.customRangeEnd !== null) {
        label = `از ${this.customRangeStart} تا ${this.customRangeEnd}`;
      } else if (this.customRangeStart !== null) {
        label = `بیشتر از ${this.customRangeStart}`;
      } else if (this.customRangeEnd !== null) {
        label = `کمتر از ${this.customRangeEnd}`;
      }
      this.filters = { ...this.filters, [key]: label };
      
      if (this.customRangeStart !== null) {
        this.filters[key + '_min'] = this.customRangeStart.toString();
      } else {
        delete this.filters[key + '_min'];
      }
      if (this.customRangeEnd !== null) {
        this.filters[key + '_max'] = this.customRangeEnd.toString();
      } else {
        delete this.filters[key + '_max'];
      }
      this.filterChanged.emit({ ...this.filters });
    }
    this.activeFilterDropdown = null;
  }

  clearCustomRange(key: string) {
    const newFilters = { ...this.filters };
    delete newFilters[key];
    delete newFilters[key + '_min'];
    delete newFilters[key + '_max'];
    this.filters = newFilters;
    this.customRangeStart = null;
    this.customRangeEnd = null;
    this.activeFilterDropdown = null;
    this.filterChanged.emit({ ...this.filters });
  }

  dateFilterOptions = [
    { label: 'همه زمان‌ها', value: '' },
    { label: 'یک ساعت قبل', value: '1h' },
    { label: 'سه ساعت قبل', value: '3h' },
    { label: 'شش ساعت قبل', value: '6h' },
    { label: 'امروز', value: 'today' },
    { label: 'دیروز', value: 'yesterday' },
    { label: 'یک هفته قبل', value: '1w' },
    { label: 'انتخاب بازه', value: 'custom' }
  ];

  toggleFilterDropdown(key: string) {
    if (this.activeFilterDropdown === key) {
      this.activeFilterDropdown = null;
      this.showCustomDateRange = false;
    } else {
      this.activeFilterDropdown = key;
      this.showCustomDateRange = false;
    }
  }

  hasFilter(key: string): boolean {
    const val = this.filters[key];
    return typeof val === 'string' ? val.trim().length > 0 : !!val;
  }

  isFilterOptionSelected(key: string, value: string): boolean {
    const current = this.filters[key];
    if (!current) return false;
    return current.split(',').includes(value);
  }

  toggleFilterOption(key: string, value: string): void {
    const current = this.filters[key];
    let selected = current ? current.split(',') : [];
    if (selected.includes(value)) {
      selected = selected.filter(v => v !== value);
    } else {
      selected.push(value);
    }
    
    if (selected.length > 0) {
      this.filters = { ...this.filters, [key]: selected.join(',') };
    } else {
      const newFilters = { ...this.filters };
      delete newFilters[key];
      this.filters = newFilters;
    }
    this.filterChanged.emit({ ...this.filters });
  }

  applyCustomDateRange(key: string) {
    if (this.customDateStart || this.customDateEnd) {
      let label = 'بازه انتخابی';
      this.filters = { ...this.filters, [key]: label };
      if (this.customDateStart) {
        this.filters[key + '_after'] = new Date(this.customDateStart).toISOString();
      } else {
        delete this.filters[key + '_after'];
      }
      if (this.customDateEnd) {
        const end = new Date(this.customDateEnd);
        end.setHours(23, 59, 59, 999);
        this.filters[key + '_before'] = end.toISOString();
      } else {
        delete this.filters[key + '_before'];
      }
      this.filterChanged.emit({ ...this.filters });
    }
    this.activeFilterDropdown = null;
    this.showCustomDateRange = false;
  }

  applyDateFilter(key: string, value: string, label: string) {
    if (value === 'custom') {
      this.showCustomDateRange = true;
      return;
    }
    
    if (!value) {
      const newFilters = { ...this.filters };
      delete newFilters[key];
      delete newFilters[key + '_after'];
      delete newFilters[key + '_before'];
      this.filters = newFilters;
      this.customDateStartControl.setValue('');
      this.customDateEndControl.setValue('');
      this.customDateStart = '';
      this.customDateEnd = '';
    } else {
      this.filters = { ...this.filters, [key]: label };
      const now = new Date();
      let afterDate = new Date();
      let beforeDate: Date | null = null;

      if (value === '1h') {
        afterDate.setHours(now.getHours() - 1);
      } else if (value === '3h') {
        afterDate.setHours(now.getHours() - 3);
      } else if (value === '6h') {
        afterDate.setHours(now.getHours() - 6);
      } else if (value === 'today') {
        afterDate.setHours(0, 0, 0, 0);
      } else if (value === 'yesterday') {
        afterDate.setDate(now.getDate() - 1);
        afterDate.setHours(0, 0, 0, 0);
        beforeDate = new Date(now);
        beforeDate.setHours(0, 0, 0, 0);
      } else if (value === '1w') {
        afterDate.setDate(now.getDate() - 7);
      }

      this.filters[key + '_after'] = afterDate.toISOString();
      if (beforeDate) {
        this.filters[key + '_before'] = beforeDate.toISOString();
      } else {
        delete this.filters[key + '_before'];
      }
    }
    this.activeFilterDropdown = null;
    this.showCustomDateRange = false;
    this.filterChanged.emit({ ...this.filters });
  }

  get allColumns(): TableColumnDirective[] {
    return this.columnDefs?.toArray() ?? [];
  }

  get columns(): TableColumnDirective[] {
    const all = this.allColumns;
    if (!this.visibleColumns) return all;
    return this.visibleColumns
      .map(key => all.find(c => c.key === key))
      .filter((c): c is TableColumnDirective => c !== undefined);
  }

  isColumnVisible(key: string): boolean {
    if (!this.visibleColumns) return true;
    return this.visibleColumns.includes(key);
  }

  toggleColumnVisibility(key: string): void {
    if (!this.visibleColumns) {
      this.visibleColumns = this.allColumns.map(c => c.key);
    }
    const idx = this.visibleColumns.indexOf(key);
    if (idx >= 0) {
      this.visibleColumns.splice(idx, 1);
    } else {
      this.visibleColumns.push(key);
    }
    this.visibleColumnsChanged.emit([...this.visibleColumns]);
  }

  toggleAllColumns(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.visibleColumns = this.allColumns.map(c => c.key);
    } else {
      this.visibleColumns = [];
    }
    this.visibleColumnsChanged.emit([...this.visibleColumns]);
  }

  get totalColumns(): number {
    let count = this.columns.length;
    if (this.selectable) count++;
    if (this.showRowNumber) count++;
    if (this.hasActions) count++;
    return count;
  }

  get isAllSelected(): boolean {
    return this.data.length > 0 && this.data.every((row) => this.selectedIds.has(row[this.trackByKey]));
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get hasActiveFilters(): boolean {
    if (!this.filters) return false;
    return Object.values(this.filters).some((v) => {
      return typeof v === 'string' ? v.trim().length > 0 : !!v;
    });
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.pageSize) || 1;
  }

  get startIndex(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalCount);
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  trackByFn = (row: any) => row[this.trackByKey];

  handleSort(key: string): void {
    if (this.sort.key === key) {
      this.sort = { key, direction: this.sort.direction === 'asc' ? 'desc' : 'asc' };
    } else {
      this.sort = { key, direction: 'asc' };
    }
    this.sortChanged.emit({ ...this.sort });
  }

  onFilter(key: string, value: string): void {
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }
    this.filters = { ...this.filters, [key]: value };
    this.filterTimeout = setTimeout(() => {
      this.filterChanged.emit({ ...this.filters });
    }, 400);
  }

  clearAllFilters(): void {
    this.filters = {};
    this.sort = { key: null, direction: 'asc' };
    this.customDateStartControl.setValue('');
    this.customDateEndControl.setValue('');
    this.customDateStart = '';
    this.customDateEnd = '';
    this.filtersCleared.emit();
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const newSet = new Set(this.selectedIds);
    if (checked) {
      this.data.forEach((row) => newSet.add(row[this.trackByKey]));
    } else {
      this.data.forEach((row) => newSet.delete(row[this.trackByKey]));
    }
    this.selectedIds = newSet;
    this.selectionChanged.emit(newSet);
  }

  toggleRowSelection(row: any, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const newSet = new Set(this.selectedIds);
    if (checked) {
      newSet.add(row[this.trackByKey]);
    } else {
      newSet.delete(row[this.trackByKey]);
    }
    this.selectedIds = newSet;
    this.selectionChanged.emit(newSet);
  }

  isRowSelected(row: any): boolean {
    return this.selectedIds.has(row[this.trackByKey]);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.pageChanged.emit({ page, pageSize: this.pageSize });
  }

  // ══════════════════════════════════════════════════
  //  Inline Editing & History
  // ══════════════════════════════════════════════════

  isEditing(row: any, field: string): boolean {
    if (!this.editingCell) return false;
    return this.editingCell.row === row && this.editingCell.field === field;
  }

  private lastClickOffset = -1;

  startEditing(row: any, field: string, event?: MouseEvent) {
    this.editingCell = { row, field };
    
    this.lastClickOffset = -1;
    if (event) {
      if ((document as any).caretRangeFromPoint) {
        const range = (document as any).caretRangeFromPoint(event.clientX, event.clientY);
        if (range) this.lastClickOffset = range.startOffset;
      } else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(event.clientX, event.clientY);
        if (pos) this.lastClickOffset = pos.offset;
      }
    }
  }

  cancelEditing() {
    this.isCancelling = true;
    this.editingCell = null;
    setTimeout(() => this.isCancelling = false, 100);
  }

  handleKeyDown(event: KeyboardEvent, row: any, field: string, input: HTMLInputElement) {
    if (event.key === 'Escape') {
      this.cancelEditing();
      return;
    }
    
    let rowDelta = 0;
    let colDelta = 0;

    if (event.key === 'Enter') {
      rowDelta = event.shiftKey ? -1 : 1;
    } else if (event.key === 'ArrowDown') {
      rowDelta = 1;
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      rowDelta = -1;
      event.preventDefault();
    } else if (event.key === 'Tab') {
      colDelta = event.shiftKey ? -1 : 1;
      event.preventDefault();
    }

    if (rowDelta !== 0 || colDelta !== 0) {
      this.moveToAfterCommit = { rowDelta, colDelta };
      input.blur();
    }
  }

  moveFocus(currentRow: any, currentField: string, rowDelta: number, colDelta: number) {
    let rowIdx = this.data.findIndex(r => r === currentRow);
    if (rowIdx === -1) return;

    const editableCols = this.columns.filter(c => c.editable && this.isColumnVisible(c.key));
    if (editableCols.length === 0) return;

    let colIdx = editableCols.findIndex(c => c.key === currentField);
    if (colIdx === -1) colIdx = 0;

    if (colDelta !== 0) {
      colIdx += colDelta;
      if (colIdx >= editableCols.length) {
        colIdx = 0;
        rowIdx += 1;
      } else if (colIdx < 0) {
        colIdx = editableCols.length - 1;
        rowIdx -= 1;
      }
    } else if (rowDelta !== 0) {
      rowIdx += rowDelta;
    }

    if (rowIdx < 0 || rowIdx >= this.data.length) return;

    const nextRow = this.data[rowIdx];
    const nextField = editableCols[colIdx].key;

    this.selectAllOnFocus = true;
    this.startEditing(nextRow, nextField);
  }

  onEditCommit(row: any, field: string, newVal: any) {
    if (this.isCancelling) return;
    
    if (this.editingCell && this.editingCell.row === row && this.editingCell.field === field) {
      this.editingCell = null;
    }
    
    this.onCellChange(row, field, newVal);

    if (this.moveToAfterCommit) {
      const move = this.moveToAfterCommit;
      this.moveToAfterCommit = null;
      this.moveFocus(row, field, move.rowDelta, move.colDelta);
    }
  }

  getTrackByKey(row: any): string {
    return row[this.trackByKey]?.toString() || JSON.stringify(row);
  }

  getCellValue(row: any, field: string) {
    return row[field];
  }

  onCellChange(row: any, field: string, newVal: any) {
    const oldVal = row[field];
    if (oldVal == newVal) return;
    
    if (this.historyIndex < this.editHistory.length - 1) {
      this.editHistory = this.editHistory.slice(0, this.historyIndex + 1);
    }
    
    this.editHistory.push({ row, field, oldVal, newVal });
    this.historyIndex++;
    
    this.applyEdit(row, field, newVal);
  }

  private applyEdit(row: any, field: string, value: any) {
    row[field] = value;
    this.pendingChanges.add(row);
  }

  undo() {
    if (this.historyIndex >= 0) {
      const edit = this.editHistory[this.historyIndex];
      this.applyEdit(edit.row, edit.field, edit.oldVal);
      this.historyIndex--;
      
      if (this.historyIndex === -1) {
        this.pendingChanges.clear();
        this.isConfirming = false;
      }
    }
  }

  redo() {
    if (this.historyIndex < this.editHistory.length - 1) {
      this.historyIndex++;
      const edit = this.editHistory[this.historyIndex];
      this.applyEdit(edit.row, edit.field, edit.newVal);
    }
  }

  showConfirm() {
    this.isConfirming = true;
  }

  cancelUpdate() {
    this.isConfirming = false;
  }

  revertAll() {
    while (this.historyIndex >= 0) {
      this.undo();
    }
    this.editHistory = [];
    this.historyIndex = -1;
    this.pendingChanges.clear();
    this.isConfirming = false;
    this.isRevertConfirming = false;
  }

  showRevertConfirm() {
    this.isRevertConfirming = true;
  }

  cancelRevert() {
    this.isRevertConfirming = false;
  }

  confirmRevertAll() {
    this.revertAll();
  }

  confirmUpdate() {
    const changedRows = Array.from(this.pendingChanges);
    this.bulkUpdate.emit(changedRows);
    this.isConfirming = false;
    this.pendingChanges.clear();
    this.editHistory = [];
    this.historyIndex = -1;
  }
}
