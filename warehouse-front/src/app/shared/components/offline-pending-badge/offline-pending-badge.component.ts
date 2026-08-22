import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkStatusService, ConnectionState } from '../../../core/services/network-status.service';
import { OfflineSyncService } from '../../../core/services/offline-sync.service';
import { Subscription } from 'rxjs';

/**
 * نشانگر پویای وضعیت شبکه و صف همگام‌سازی (Offline Pending & Network Sync Badge)
 *
 * حالت‌ها:
 * • mode="inline" → برای سطرهای جدول (فشرده، غیرتعاملی، نشان‌دهنده رکورد آفلاین)
 * • mode="header" → برای هدر سراسری و هدر صفحات (پویا، نمایش وضعیت آنلاین/آفلاین/صف + پاپ‌آپ تعاملی با کلیک)
 */
@Component({
  selector: 'app-offline-pending-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Inline Mode (مخصوص سطرهای جدول) -->
    <ng-container *ngIf="mode === 'inline'">
      <span
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-sky-200 bg-sky-50 text-sky-700 text-[9px] font-bold whitespace-nowrap align-middle"
        title="این مورد هنوز به سرور ارسال نشده است. به‌محض برقراری اتصال، خودکار همگام‌سازی می‌شود."
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M18.5 19H9a7 7 0 0 1-1.87-13.75"></path>
          <path d="M10.71 5.05A6 6 0 0 1 20 10h.5a4.5 4.5 0 0 1 2.62 8.16"></path>
        </svg>
        در انتظار ارسال
      </span>
    </ng-container>

    <!-- Header Mode (مخصوص نوار ابزار هدر صفحات و هدر سراسری) -->
    <div *ngIf="mode === 'header'" class="relative inline-block text-right select-none" dir="rtl">
      <!-- Status Pill Button -->
      <button
        type="button"
        (click)="togglePopover($event)"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 active:scale-95 whitespace-nowrap"
        [ngClass]="pillClasses"
        [title]="tooltipText"
      >
        <!-- Connected / Synced -->
        <ng-container *ngIf="networkState === 'online' && !isSyncing && pendingCount === 0">
          <span class="text-emerald-700 font-bold">متصل</span>
          <span class="relative flex h-2 w-2 mr-0.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </ng-container>

        <!-- Syncing in progress -->
        <ng-container *ngIf="isSyncing">
          <svg class="animate-spin text-sky-600" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
          <span class="text-sky-800">در حال ارسال ({{ pendingCount }})</span>
        </ng-container>

        <!-- Offline or Pending in queue -->
        <ng-container *ngIf="!isSyncing && (networkState !== 'online' || pendingCount > 0)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-amber-600">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M18.5 19H9a7 7 0 0 1-1.87-13.75"></path>
            <path d="M10.71 5.05A6 6 0 0 1 20 10h.5a4.5 4.5 0 0 1 2.62 8.16"></path>
          </svg>
          <span *ngIf="networkState !== 'online' && pendingCount === 0" class="text-amber-800">آفلاین</span>
          <span *ngIf="pendingCount > 0" class="text-amber-800">در انتظار ارسال ({{ pendingCount }})</span>
        </ng-container>
      </button>

      <!-- Interactive Popover Card -->
      <div
        *ngIf="isPopoverOpen"
        class="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200/90 shadow-xl z-50 overflow-hidden text-right fade-in"
        (click)="$event.stopPropagation()"
      >
        <!-- Popover Header -->
        <div class="p-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full" [ngClass]="statusDotClass"></div>
            <span class="text-xs font-black text-slate-800">وضعیت اتصال و همگام‌سازی</span>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg border" [ngClass]="badgeStatusClass">
            {{ statusLabel }}
          </span>
        </div>

        <!-- Popover Body -->
        <div class="p-3.5 space-y-3 text-xs">
          <!-- Connection Detail -->
          <div class="flex items-center justify-between py-1 border-b border-slate-100/80">
            <span class="text-slate-500 font-medium">وضعیت سرور:</span>
            <span class="font-bold" [ngClass]="serverStatusClass">{{ serverStatusText }}</span>
          </div>

          <!-- Pending Queue Detail -->
          <div class="flex items-center justify-between py-1 border-b border-slate-100/80">
            <span class="text-slate-500 font-medium">صف ارسال محلی:</span>
            <span class="font-bold" [class.text-amber-600]="pendingCount > 0" [class.text-emerald-600]="pendingCount === 0">
              {{ pendingCount > 0 ? (pendingCount + ' رکورد در انتظار ارسال') : 'همگام و بدون صف' }}
            </span>
          </div>

          <!-- Last Sync Detail -->
          <div class="flex items-center justify-between py-1 border-b border-slate-100/80">
            <span class="text-slate-500 font-medium">آخرین همگام‌سازی:</span>
            <span class="font-bold text-slate-700">{{ formattedLastSync }}</span>
          </div>

          <!-- Errors if any (Clickable & Responsive Navigation to Sync Inbox) -->
          <div
            *ngIf="errorCount > 0"
            (click)="onOpenSyncInbox($event)"
            class="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs active:scale-98 select-none"
            title="کلیک برای مشاهده و مدیریت خطاها در صندوق همگام‌سازی"
          >
            <div class="flex items-center gap-1.5 min-w-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span class="truncate">{{ errorCount }} خطا در صف ارسال</span>
            </div>
            <div class="flex items-center gap-1 text-[10px] text-rose-600 font-extrabold shrink-0 bg-white/70 px-2 py-0.5 rounded-md border border-rose-200/60">
              <span>مشاهده صندوق</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </div>
          </div>

          <!-- Action Button: Manual Sync Now -->
          <button
            type="button"
            (click)="onManualSync()"
            [disabled]="isSyncing || networkState !== 'online'"
            class="w-full mt-1 py-2 px-3 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 cursor-pointer"
            [ngClass]="networkState === 'online' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [class.animate-spin]="isSyncing">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>{{ isSyncing ? 'در حال ارسال داده‌ها...' : 'همگام‌سازی دستی اکنون' }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fade-in {
      animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class OfflinePendingBadgeComponent implements OnInit, OnDestroy {
  /**
   * حالت نمایش:
   * 'inline' → تگ فشرده برای جداول
   * 'header' → نشانگر پویا و تعاملی برای هدر
   */
  @Input() mode: 'header' | 'inline' = 'inline';
  @Output() openSyncInbox = new EventEmitter<void>();

  networkState: ConnectionState = 'online';
  isSyncing = false;
  pendingCount = 0;
  lastSyncTime: number | null = null;
  errorCount = 0;

  isPopoverOpen = false;

  private network = NetworkStatusService.getInstance();
  private sync = OfflineSyncService.getInstance();
  private subs: Subscription[] = [];

  constructor(private elementRef: ElementRef, private cdr: ChangeDetectorRef) {}

  onOpenSyncInbox(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isPopoverOpen = false;
    this.cdr.markForCheck();
    this.openSyncInbox.emit();
  }

  ngOnInit(): void {
    if (this.mode === 'header') {
      this.networkState = this.network.state;
      this.subs.push(
        this.network.state$.subscribe((state) => {
          this.networkState = state;
          this.cdr.markForCheck();
        })
      );

      this.subs.push(
        this.sync.isSyncing$.subscribe((syncing) => {
          this.isSyncing = syncing;
          this.cdr.markForCheck();
        })
      );

      this.subs.push(
        this.sync.pendingCount$.subscribe((count) => {
          this.pendingCount = count;
          this.cdr.markForCheck();
        })
      );

      this.subs.push(
        this.sync.lastSyncTime$.subscribe((time) => {
          this.lastSyncTime = time;
          this.cdr.markForCheck();
        })
      );

      this.subs.push(
        this.sync.errorCount$.subscribe((errors) => {
          this.errorCount = errors;
          this.cdr.markForCheck();
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isPopoverOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isPopoverOpen = false;
      this.cdr.markForCheck();
    }
  }

  togglePopover(event: MouseEvent): void {
    event.stopPropagation();
    this.isPopoverOpen = !this.isPopoverOpen;
  }

  async onManualSync(): Promise<void> {
    if (this.isSyncing || this.networkState !== 'online') return;
    try {
      await this.sync.forceSync();
    } catch (e) {
      console.error('[SyncBadge] Manual sync error:', e);
    }
    this.cdr.markForCheck();
  }

  get pillClasses(): Record<string, boolean> {
    if (this.networkState === 'online' && !this.isSyncing && this.pendingCount === 0) {
      return {
        'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100': true,
      };
    }
    if (this.isSyncing) {
      return {
        'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100': true,
      };
    }
    return {
      'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100': true,
    };
  }

  get tooltipText(): string {
    if (this.networkState === 'online' && !this.isSyncing && this.pendingCount === 0) {
      return 'اتصال برقرار است و تمام داده‌ها همگام هستند (برای جزئیات کلیک کنید)';
    }
    if (this.isSyncing) {
      return `در حال ارسال ${this.pendingCount} مورد به سرور...`;
    }
    if (this.networkState !== 'online') {
      return `آفلاین - ${this.pendingCount} مورد در صف ارسال محلی (برای جزئیات کلیک کنید)`;
    }
    return `${this.pendingCount} مورد در صف ارسال (برای جزئیات کلیک کنید)`;
  }

  get statusDotClass(): Record<string, boolean> {
    return {
      'bg-emerald-500': this.networkState === 'online',
      'bg-amber-500': this.networkState === 'server-unreachable',
      'bg-rose-500': this.networkState === 'offline',
    };
  }

  get statusLabel(): string {
    if (this.networkState === 'online') return 'آنلاین و فعال';
    if (this.networkState === 'server-unreachable') return 'عدم پاسخ سرور';
    return 'آفلاین';
  }

  get badgeStatusClass(): Record<string, boolean> {
    if (this.networkState === 'online') {
      return { 'bg-emerald-50 text-emerald-700 border-emerald-200': true };
    }
    if (this.networkState === 'server-unreachable') {
      return { 'bg-amber-50 text-amber-700 border-amber-200': true };
    }
    return { 'bg-rose-50 text-rose-700 border-rose-200': true };
  }

  get serverStatusText(): string {
    if (this.networkState === 'online') return 'در دسترس و متصل';
    if (this.networkState === 'server-unreachable') return 'قطع موقت سرور';
    return 'قطع ارتباط کامل';
  }

  get serverStatusClass(): Record<string, boolean> {
    return {
      'text-emerald-600': this.networkState === 'online',
      'text-amber-600': this.networkState === 'server-unreachable',
      'text-rose-600': this.networkState === 'offline',
    };
  }

  get formattedLastSync(): string {
    if (!this.lastSyncTime) return 'هنوز ثبت نشده';
    try {
      const d = new Date(this.lastSyncTime);
      return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'لحظاتی قبل';
    }
  }
}
