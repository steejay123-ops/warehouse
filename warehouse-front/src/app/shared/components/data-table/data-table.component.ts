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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <!-- Header Actions -->
      @if (showHeader) {
        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span class="font-bold text-slate-700">{{ totalCount }}</span>
            <span>{{ itemLabel }}</span>
            @if (selectedCount > 0) {
              <span class="bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                {{ selectedCount }} انتخاب شده
              </span>
            }
          </div>
          <div class="flex items-center gap-2">
            <ng-content select="[table-actions]"></ng-content>
            @if (showClearFilters && hasActiveFilters) {
              <button
                (click)="clearAllFilters()"
                class="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                پاک کردن فیلترها
              </button>
            }
          </div>
        </div>
      }

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <!-- Header Row -->
            <tr class="bg-slate-50 border-b border-slate-200">
              @if (selectable) {
                <th class="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    [checked]="isAllSelected"
                    (change)="toggleSelectAll($event)"
                    class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              }
              @if (showRowNumber) {
                <th class="w-10 px-3 py-3 text-center text-[10px] font-bold text-slate-400">#</th>
              }
              @for (col of columns; track col.key) {
                <th
                  class="px-3 py-3 text-right font-bold text-slate-600 whitespace-nowrap"
                  [style.width]="col.width || 'auto'"
                >
                  <div class="flex items-center gap-1.5">
                    <span>{{ col.label }}</span>
                    @if (col.sortable) {
                      <button
                        (click)="handleSort(col.key)"
                        class="p-0.5 rounded hover:bg-slate-200 transition-colors"
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
                <th class="w-16 px-3 py-3 text-center text-[10px] font-bold text-slate-400">عملیات</th>
              }
            </tr>

            <!-- Filter Row -->
            @if (showFilters) {
              <tr class="bg-slate-50/50 border-b border-slate-100">
                @if (selectable) { <th></th> }
                @if (showRowNumber) { <th></th> }
                @for (col of columns; track col.key) {
                  <th class="px-2 py-1.5">
                    @if (col.filterable) {
                      <input
                        type="text"
                        [placeholder]="'جستجو...'"
                        [ngModel]="filters[col.key] || ''"
                        (ngModelChange)="onFilter(col.key, $event)"
                        class="w-full text-[10px] px-2 py-1 rounded-lg border border-slate-200 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none transition-colors"
                      />
                    }
                  </th>
                }
                @if (hasActions) { <th></th> }
              </tr>
            }
          </thead>

          <tbody>
            @for (row of data; track trackByFn(row); let i = $index) {
              <tr
                class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                [class.bg-indigo-50/50]="isRowSelected(row)"
              >
                @if (selectable) {
                  <td class="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      [checked]="isRowSelected(row)"
                      (change)="toggleRowSelection(row, $event)"
                      class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                }
                @if (showRowNumber) {
                  <td class="px-3 py-2.5 text-center text-[10px] text-slate-400 font-bold">
                    {{ (currentPage - 1) * pageSize + i + 1 }}
                  </td>
                }
                @for (col of columns; track col.key) {
                  <td class="px-3 py-2.5 text-slate-700">
                    <ng-container
                      [ngTemplateOutlet]="col.template"
                      [ngTemplateOutletContext]="{ $implicit: row, row: row, value: row[col.key], index: i }"
                    ></ng-container>
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
                  <div class="text-slate-400">
                    <svg class="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <p class="text-xs font-bold">{{ emptyMessage }}</p>
                  </div>
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
    </div>
  `,
})
export class DataTableComponent {
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
  @Input() hasActions = false;
  @Input() trackByKey = 'id';
  @Input() selectedIds: Set<any> = new Set();

  @Output() sortChanged = new EventEmitter<SortState>();
  @Output() filterChanged = new EventEmitter<Record<string, string>>();
  @Output() pageChanged = new EventEmitter<PageEvent>();
  @Output() selectionChanged = new EventEmitter<Set<any>>();
  @Output() filtersCleared = new EventEmitter<void>();

  @ContentChildren(TableColumnDirective) columnDefs!: QueryList<TableColumnDirective>;

  sort: SortState = { key: null, direction: 'asc' };
  filters: Record<string, string> = {};

  get columns(): TableColumnDirective[] {
    return this.columnDefs?.toArray() ?? [];
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
    return Object.values(this.filters).some((v) => v?.trim());
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
    this.filters = { ...this.filters, [key]: value };
    this.filterChanged.emit({ ...this.filters });
  }

  clearAllFilters(): void {
    this.filters = {};
    this.sort = { key: null, direction: 'asc' };
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
}
