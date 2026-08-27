import { Component, OnInit, OnDestroy, computed, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter, Subscription } from 'rxjs';
import { SwUpdate } from '@angular/service-worker';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/stores/auth.store';
import { StateService } from '../../services/state.service';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { WarehouseHttpService } from '../../core/http/warehouse-http.service';
import { NetworkStatusService, ConnectionState } from '../../core/services/network-status.service';
import { OfflineSyncService } from '../../core/services/offline-sync.service';
import { SyncErrorEntry } from '../../core/services/offline-db';
import { ConfigApiService } from '../../core/api/config-api.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { DeepSyncModalComponent } from '../../shared/components/deep-sync-modal/deep-sync-modal.component';
import { AvatarCropperModal } from '../../shared/components/avatar-cropper-modal/avatar-cropper-modal';
import { AccountsHttpService } from '../../core/http/accounts-http.service';
import { NavigationHistoryService } from '../../core/services/navigation-history.service';
import { OfflinePendingBadgeComponent } from '../../shared/components/offline-pending-badge/offline-pending-badge.component';
import { ChatDrawerComponent } from '../communications/chat-drawer/chat-drawer.component';
import { CommunicationService } from '../../core/services/communication.service';
import { WebSocketService } from '../../core/http/websocket.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, FormsModule, RouterOutlet, DeepSyncModalComponent, AvatarCropperModal, OfflinePendingBadgeComponent, ChatDrawerComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout implements OnInit, OnDestroy {
  public commService = inject(CommunicationService);
  public wsService = inject(WebSocketService);

  currentTitle = 'داشبورد مانیتورینگ';
  isUserMenuOpen = false;
  isShortcutsHelpOpen = false;
  shortcutsSearchQuery = '';
  shortcutsActiveCategory: string = 'all';
  isDesktopSidebarCollapsed = localStorage.getItem('desktopSidebarCollapsed') === 'true';

  shortcutsCategories = [
    { id: 'all', label: 'همه کلیدها', count: 20 },
    { id: 'global', label: 'عمومی و منو', count: 5 },
    { id: 'counting', label: 'انبارگردانی و اسکنر', count: 5 },
    { id: 'table', label: 'جدول اطلاعات و فرم‌ها', count: 5 },
    { id: 'design', label: 'طراحی لیبل و کارت', count: 5 },
  ];

  allShortcuts = [
    // Global & Navigation
    {
      category: 'global',
      categoryLabel: 'عمومی',
      categoryColor: 'indigo',
      title: 'صفحه قبل (Back)',
      description: 'بازگشت به صفحه قبلی در تاریخچه ناوبری',
      keys: ['Alt', '→'],
      altKeys: null,
    },
    {
      category: 'global',
      categoryLabel: 'عمومی',
      categoryColor: 'indigo',
      title: 'صفحه بعد (Forward)',
      description: 'حرکت به صفحه بعدی در تاریخچه ناوبری',
      keys: ['Alt', '←'],
      altKeys: null,
    },
    {
      category: 'global',
      categoryLabel: 'عمومی',
      categoryColor: 'indigo',
      title: 'جمع / باز کردن منو',
      description: 'تغییر وضعیت نمایش نوار کناری (Sidebar)',
      keys: ['Ctrl', 'B'],
      altKeys: null,
    },
    {
      category: 'global',
      categoryLabel: 'عمومی',
      categoryColor: 'indigo',
      title: 'بستن پنجره / انصراف',
      description: 'بستن تمام مودال‌ها، پنجره‌ها و منوهای باز',
      keys: ['Esc'],
      altKeys: null,
    },
    {
      category: 'global',
      categoryLabel: 'عمومی',
      categoryColor: 'indigo',
      title: 'راهنمای کلیدها',
      description: 'نمایش پنجره راهنمای کلیدهای میانبر',
      keys: ['Shift', '?'],
      altKeys: ['F1'],
    },

    // Counting & Scanner
    {
      category: 'counting',
      categoryLabel: 'انبارگردانی',
      categoryColor: 'emerald',
      title: 'ثبت فوری شمارش',
      description: 'ثبت مقدار وارد شده در کادر و ذخیره پیش‌نویس',
      keys: ['Enter'],
      altKeys: ['Ctrl', 'Enter'],
    },
    {
      category: 'counting',
      categoryLabel: 'انبارگردانی',
      categoryColor: 'emerald',
      title: 'فوکوس روی بارکدخوان',
      description: 'انتقال سریع مکان‌نما به کادر اسکنر بارکد',
      keys: ['F2'],
      altKeys: ['Alt', 'B'],
    },
    {
      category: 'counting',
      categoryLabel: 'انبارگردانی',
      categoryColor: 'emerald',
      title: 'تب تسک‌های من',
      description: 'سوئیچ سریع به فهرست کالاهای تخصیص‌یافته',
      keys: ['Alt', '1'],
      altKeys: null,
    },
    {
      category: 'counting',
      categoryLabel: 'انبارگردانی',
      categoryColor: 'emerald',
      title: 'تب مخزن کالاها',
      description: 'سوئیچ سریع به فهرست مخزن آزاد کالاها',
      keys: ['Alt', '2'],
      altKeys: null,
    },
    {
      category: 'counting',
      categoryLabel: 'انبارگردانی',
      categoryColor: 'emerald',
      title: 'تایید سریع کالاها (Approve)',
      description: 'تایید کالاهای انتخاب‌شده در کارتابل سرپرست و مدیر',
      keys: ['A'],
      altKeys: null,
    },

    // Table & Dialogs
    {
      category: 'table',
      categoryLabel: 'جدول اطلاعات',
      categoryColor: 'blue',
      title: 'ذخیره تغییرات جدول',
      description: 'ثبت و اعمال نهایی تمامی ویرایش‌های انجام‌شده در سلول‌ها',
      keys: ['Ctrl', 'S'],
      altKeys: null,
    },
    {
      category: 'table',
      categoryLabel: 'جدول اطلاعات',
      categoryColor: 'blue',
      title: 'لغو آخرین تغییر (Undo)',
      description: 'بازگردانی آخرین ویرایش سلول جدول به مقدار قبل',
      keys: ['Ctrl', 'Z'],
      altKeys: null,
    },
    {
      category: 'table',
      categoryLabel: 'جدول اطلاعات',
      categoryColor: 'blue',
      title: 'تکرار تغییر (Redo)',
      description: 'اعمال مجدد تغییری که لغو شده بود',
      keys: ['Ctrl', 'Y'],
      altKeys: null,
    },
    {
      category: 'table',
      categoryLabel: 'جدول اطلاعات',
      categoryColor: 'blue',
      title: 'انتخاب همه سطرها',
      description: 'انتخاب یا لغو انتخاب تمامی ردیف‌های جدول',
      keys: ['Ctrl', 'A'],
      altKeys: null,
    },
    {
      category: 'table',
      categoryLabel: 'دیالوگ‌ها',
      categoryColor: 'blue',
      title: 'تایید در دیالوگ‌ها',
      description: 'تایید عملیات در پنجره‌های حذف، خروج و پیام‌ها',
      keys: ['Enter'],
      altKeys: null,
    },

    // Design & Canvas
    {
      category: 'design',
      categoryLabel: 'طراحی',
      categoryColor: 'purple',
      title: 'جابجایی دقیق المان (Nudge)',
      description: 'حرکت دادن المان روی بوم به اندازه ۱ میلی‌متر',
      keys: ['↑', '↓', '←', '→'],
      altKeys: null,
    },
    {
      category: 'design',
      categoryLabel: 'طراحی',
      categoryColor: 'purple',
      title: 'جابجایی سریع المان',
      description: 'حرکت دادن سریع المان روی بوم به اندازه ۵ میلی‌متر',
      keys: ['Shift', '↑↓←→'],
      altKeys: null,
    },
    {
      category: 'design',
      categoryLabel: 'طراحی',
      categoryColor: 'purple',
      title: 'کپی و جایگذاری المان',
      description: 'تکثیر و کپی کردن المان انتخاب‌شده روی بوم',
      keys: ['Ctrl', 'C'],
      altKeys: ['Ctrl', 'V'],
    },
    {
      category: 'design',
      categoryLabel: 'کارت پرسنلی',
      categoryColor: 'purple',
      title: 'چرخش سه‌بعدی کارت',
      description: 'چرخش کارت بین نمای رو (Front) و پشت (Back)',
      keys: ['Space'],
      altKeys: ['F'],
    },
    {
      category: 'design',
      categoryLabel: 'چاپ',
      categoryColor: 'purple',
      title: 'چاپ شیت / کارت',
      description: 'ارسال مستقیم شیت آماده یا کارت به پرینتر',
      keys: ['Ctrl', 'P'],
      altKeys: null,
    },
  ];

  get filteredShortcuts() {
    return this.allShortcuts.filter(item => {
      const matchCat = this.shortcutsActiveCategory === 'all' || item.category === this.shortcutsActiveCategory;
      if (!matchCat) return false;
      if (!this.shortcutsSearchQuery.trim()) return true;
      const q = this.shortcutsSearchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        item.keys.some(k => k.toLowerCase().includes(q)) ||
        (item.altKeys && item.altKeys.some((k: string) => k.toLowerCase().includes(q)))
      );
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isInsideInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Escape: close shortcuts modal, user menu, sync errors
    if (event.key === 'Escape') {
      if (this.isShortcutsHelpOpen) {
        event.preventDefault();
        this.isShortcutsHelpOpen = false;
        this.cdr.detectChanges();
        return;
      }
      if (this.isUserMenuOpen) {
        event.preventDefault();
        this.isUserMenuOpen = false;
        this.cdr.detectChanges();
        return;
      }
      if (this.isSyncErrorsOpen) {
        event.preventDefault();
        this.isSyncErrorsOpen = false;
        this.cdr.detectChanges();
        return;
      }
    }

    // Ctrl+B: Toggle desktop sidebar
    if ((event.ctrlKey || event.metaKey) && (event.key === 'b' || event.key === 'B')) {
      event.preventDefault();
      this.toggleDesktopSidebar();
      return;
    }

    // Shift + ? or F1: Show Shortcuts Cheatsheet Modal
    if (!isInsideInput) {
      if (event.key === '?' || event.key === '؟' || event.key === 'F1') {
        event.preventDefault();
        this.toggleShortcutsHelp();
      }
    }
  }

  toggleShortcutsHelp() {
    this.isShortcutsHelpOpen = !this.isShortcutsHelpOpen;
    this.cdr.detectChanges();
  }

  toggleChatDrawer() {
    const nextState = !this.commService.isChatDrawerOpen();
    this.commService.isChatDrawerOpen.set(nextState);
    if (nextState) {
      this.commService.hasNewIncomingPulse.set(false);
      const active = this.commService.activeConversation$.value;
      if (active) {
        this.commService.markAsRead(active.id);
      }
    } else {
      this.commService.closeActiveConversation();
    }
    this.cdr.detectChanges();
  }

  // ─── Offline / Sync UI ───
  /** وضعیت سه‌حالته اتصال: online | server-unreachable | offline */
  connectionState: ConnectionState = 'online';
  isOffline = false;
  isSyncing = false;
  pendingCount = 0;
  syncErrorCount = 0;
  syncErrors: SyncErrorEntry[] = [];
  isSyncErrorsOpen = false;
  lastSyncTime: number | null = null;
  syncSuccessMessage: string | null = null;
  pullProgress: { current: number, total: number | null, bytes: number } | null = null;
  isPulling = false;
  deepUpdateState: {
    isActive: boolean;
    mode: 'current' | 'all';
    totalWarehouses: number;
    currentIndex: number;
    currentWarehouseName: string;
  } | null = null;
  private syncSuccessTimer: any = null;
  isDeepSyncModalOpen = false;
  deepSyncWarehouses: {id: number; name: string}[] = [];
  deepSyncPreselectId: number | null = null;
  private baseTitle = document.title;
  private offlineSubs: Subscription[] = [];

  toggleDesktopSidebar() {
    this.isDesktopSidebarCollapsed = !this.isDesktopSidebarCollapsed;
    localStorage.setItem('desktopSidebarCollapsed', String(this.isDesktopSidebarCollapsed));
    this.cdr.detectChanges();
  }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    this.cdr.detectChanges();
  }

  closeUserMenu() {
    this.isUserMenuOpen = false;
    this.cdr.detectChanges();
  }

  private swUpdate = inject(SwUpdate);
  isCheckingAppUpdate = false;

  /**
   * بروزرسانی دستی نسخه برنامه (فرانت‌اند / PWA)
   * استعلام آنی از سرویس‌ورکر، فعال‌سازی فوری نسخه و رفرش تمیز صفحه
   */
  async onManualAppUpdate() {
    if (this.isCheckingAppUpdate) return;
    this.isCheckingAppUpdate = true;
    this.cdr.detectChanges();

    try {
      this.toast.show('info', 'در حال استعلام آخرین نسخه برنامه از سرور...');

      if (this.swUpdate.isEnabled) {
        const updateFound = await this.swUpdate.checkForUpdate();
        if (updateFound) {
          this.toast.show('success', 'نسخه جدید دریافت شد! در حال بارگذاری مجدد...');
          await this.swUpdate.activateUpdate();
          setTimeout(() => {
            window.location.reload();
          }, 600);
          return;
        }
      }

      // بروزرسانی دستی ثبتی‌های سرویس‌ورکر مرورگر در صورت وجود
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      }

      this.toast.show('success', 'برنامه به آخرین نسخه بروزرسانی شد.');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err: any) {
      console.error('Manual app update failed', err);
      this.toast.show('error', 'خطا در بررسی بروزرسانی: ' + (err?.message || 'سرور پاسخگو نیست'));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } finally {
      this.isCheckingAppUpdate = false;
      this.cdr.detectChanges();
    }
  }

  isAvatarModalOpen = false;
  isSavingAvatar = false;

  openAvatarModal() {
    this.isAvatarModalOpen = true;
    this.closeUserMenu();
  }

  onSaveAvatar(blob: Blob) {
    this.isSavingAvatar = true;
    this.accountsService.updateMyAvatar(blob).subscribe({
      next: (res) => {
        this.isSavingAvatar = false;
        this.isAvatarModalOpen = false;
        this.auth.updateUserAvatar(res.avatar);
        this.toast.show('success', 'تصویر پروفایل شما با موفقیت بروزرسانی شد.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingAvatar = false;
        const msg = err.error?.error || 'خطا در بارگذاری تصویر پروفایل';
        this.toast.show('error', msg);
        this.cdr.detectChanges();
      }
    });
  }

  onRemoveAvatar() {
    this.isSavingAvatar = true;
    this.accountsService.deleteMyAvatar().subscribe({
      next: () => {
        this.isSavingAvatar = false;
        this.isAvatarModalOpen = false;
        this.auth.updateUserAvatar(null);
        this.toast.show('success', 'تصویر پروفایل حذف شد.');
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSavingAvatar = false;
        this.toast.show('error', 'خطا در حذف تصویر پروفایل');
        this.cdr.detectChanges();
      }
    });
  }

  /** لیست پروژه‌ها از StateService خوانده می‌شود */

  private rawIcons: any = {
    grid:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    archive:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    badge: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><circle cx="12" cy="11" r="3"></circle><path d="M17 18c0-2.2-2.2-4-5-4s-5 1.8-5 4"></path></svg>`,
    users:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    'file-text':`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    tag:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    folder:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    'upload-cloud':`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
    settings:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    clipboard:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    printer: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
    'check-circle': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    'alert-triangle': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    'check-square': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    database: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    activity: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
    'bar-chart-2': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    truck: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`
  };

  icons: any = {};

  private SYSTEM_NAV_ITEMS: any[] = [
    {id:'dashboard', label:'داشبورد مانیتورینگ کلی', icon:'grid', permission: 'view_sys_dashboard'},
    {id:'personnel', label:'پرسنل و ناوگان', icon:'truck', permission: 'view_sys_personnel'},
    {id:'users', label:'کاربران و نقش ها', icon:'users', permission: 'view_sys_users'},
    {id:'projects', label:'انبارها', icon:'archive', permission: 'view_sys_projects'},
    {id:'counter', label:'کارتابل انبارگردان', icon:'clipboard', permission: 'view_sys_counter'},
    {id:'customs', label:'کارتابل مالی', icon:'folder', permission: 'view_wh_customs'},
    {id:'supervisor', label:'کارتابل سرپرست', icon:'check-square', permission: 'view_sys_supervisor'},
    {id:'manager-review', label:'بررسی نهایی مدیر', icon:'check-circle', permission: 'view_sys_manager_review'},
    {id:'count-tracking', label:'پیگیری وضعیت شمارش', icon:'activity', permission: 'view_sys_manager_review'},
    {id:'audit', label:'رهگیری تغییرات', icon:'file-text', permission: 'view_wh_audit'},
    {id:'reports', label:'گزارش‌ساز', icon:'bar-chart-2', permission: 'view_sys_reports'},
    {id:'settings', label:'تنظیمات سیستم', icon:'settings', permission: 'view_sys_settings'}
  ];

  private WAREHOUSE_NAV_ITEMS: any[] = [
    {id:'dashboard', label:'داشبورد انبار', icon:'grid', permission: 'view_wh_dashboard'},
    {id:'attendance', label:'کارکرد و ناوگان انبار', icon:'truck', permission: 'view_wh_attendance'},
    {id:'docs', label:'مدیریت کالا', icon:'upload-cloud', permission: 'view_wh_docs'},
    {id:'dispatch', label:'تخصیص کالا', icon:'clipboard', permission: 'view_wh_dispatch'},
    {id:'counter', label:'کارتابل انبارگردان', icon:'clipboard', permission: 'view_sys_counter'},
    {id:'customs', label:'کارتابل مالی', icon:'folder', permission: 'view_wh_customs'},
    {id:'supervisor', label:'کارتابل سرپرست', icon:'check-square', permission: 'view_sys_supervisor'},
    {id:'manager-review', label:'بررسی نهایی مدیر', icon:'check-circle', permission: 'view_sys_manager_review'},
    {id:'count-tracking', label:'پیگیری وضعیت شمارش', icon:'activity', permission: 'view_sys_manager_review'},

    {id:'feeding', label:'مدیریت و تغذیه MT26/49 (به‌زودی)', icon:'database', permission: 'view_wh_feeding'},
    {id:'audit', label:'رهگیری تغییرات', icon:'file-text', permission: 'view_wh_audit'},
    {id:'reports', label:'گزارش‌ساز', icon:'bar-chart-2', permission: 'view_sys_reports'},
    {id:'wh-settings', label:'تنظیمات انبار', icon:'settings', permission: 'view_wh_settings'}
  ];

  constructor(
    public auth: AuthService,
    public store: AuthStore,
    public state: StateService,
    private confirmDialog: ConfirmDialogService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private whService: WarehouseHttpService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private configApi: ConfigApiService,
    private accountsService: AccountsHttpService,
    public navHistory: NavigationHistoryService
  ) {
    // Sanitize icons
    for (const k in this.rawIcons) {
      this.icons[k] = this.sanitizer.bypassSecurityTrustHtml(this.rawIcons[k]);
    }

    // Track current tab from URL
    const initialClean = (this.router.url || '').split('?')[0];
    const initialTab = initialClean.split('/')[1] || 'dashboard';
    this.store.setCurrentTab(initialTab);
    this.updateTitle(initialTab);

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      const cleanUrl = (e.urlAfterRedirects || e.url || '').split('?')[0];
      const tab = cleanUrl.split('/')[1] || 'dashboard';
      this.store.setCurrentTab(tab);
      this.updateTitle(tab);
    });
  }

  private handleWarehousesLoaded(data: any[]): void {
    const warehouseList = Array.isArray(data) ? data : [];
    this.state.appState.projects = warehouseList;
    this.deepSyncWarehouses = warehouseList;

    // خودترمیمی انبار فعال در صورتی که انبار قبلی حذف یا نامعتبر شده باشد
    this.store.sanitizeActiveWarehouse(warehouseList);
    this.state.appState.activeWarehouseId = this.store.activeWarehouseId() as any;

    this.cdr.markForCheck();
  }

  ngOnInit() {
    // دریافت لیست انبارها از بک‌اند (با خودترمیمی آنی در صورت حذف یا نامعتبر شدن انبار فعال)
    this.whService.getAll().subscribe({
      next: (data) => {
        this.handleWarehousesLoaded(data);

        // راه‌اندازی سراسری وب‌سوکت پیام‌رسان و بارگذاری پیام‌های خوانده‌نشده
        const initWhId = this.store.activeWarehouseId() === 'ALL' ? undefined : Number(this.store.activeWarehouseId());
        this.commService.ensureConnected(initWhId);
        this.commService.loadConversations(initWhId);
        this.commService.requestNotificationPermission();
      }
    });

    // ─── Subscribe to offline/sync observables ───
    const network = NetworkStatusService.getInstance();
    const syncService = OfflineSyncService.getInstance();

    // شنود پاسخ‌های پس‌زمینه SWR برای به‌روزرسانی زنده لیست انبارها بدون نیاز به رفرش
    this.offlineSubs.push(
      syncService.liveDataUpdates$.subscribe(({ url, data }) => {
        if (url && (url.includes('/warehouses/') || url.includes('/api/warehouses/'))) {
          if (Array.isArray(data)) {
            this.handleWarehousesLoaded(data);
          }
        }
      })
    );

    // نشست‌های طولانی ممکن است روزها باز بمانند و تنظیمات ادمین را از دست بدهند
    this.configApi.getPublicConfig().subscribe({
      next: (config) => syncService.applyRemoteConfig(config),
      error: () => {},
    });

    this.offlineSubs.push(
      network.state$.subscribe((state) => {
        this.connectionState = state;
        const wasOffline = this.isOffline;
        // «آفلاین» از دید کاربر یعنی «سرور در دسترس نیست» —
        // چه اینترنت قطع باشد چه سرور خاموش
        this.isOffline = state !== 'online';
        document.title = this.isOffline ? `📴 آفلاین — ${this.baseTitle}` : this.baseTitle;

        // اگر از حالت آفلاین به آنلاین برگشتیم: استعلام سبک پس‌زمینه برای جبران تغییرات زمان قطعی
        if (wasOffline && state === 'online') {
          console.log('[Layout] 🌐 اتصال مجدد شبکه — استعلام سبک پس‌زمینه...');
          this.whService.getAll().subscribe({
            next: (data) => this.handleWarehousesLoaded(data),
            error: () => {}
          });
        }
        this.cdr.detectChanges();
      })
    );

    // خودترمیمی و اعلان شفاف به کاربر هنگام رد شدن درخواست از صف همگام‌سازی
    this.offlineSubs.push(
      syncService.rejected$.subscribe((err) => {
        const reason = err.serverMessage || 'تداخل یا خطای اعتبارسنجی سرور';
        this.toast.show(
          'warning',
          `تغییر شما به دلیل «${reason}» توسط سرور رد شد و داده‌ها به آخرین نسخه سرور بازگردانی شدند.`
        );
        // استعلام تازه برای اطمینان از همگامی کامل نما
        this.whService.getAll().subscribe({
          next: (data) => this.handleWarehousesLoaded(data),
          error: () => {}
        });
      })
    );

    // شنود رویدادهای زنده تغییرات انبار از طریق وب‌سوکت برای همگام‌سازی بلادرنگ همه کلاینت‌ها
    this.offlineSubs.push(
      this.wsService.notifications$.subscribe(async (data: any) => {
        if (data && (data.event === 'warehouse_mutation' || data.type === 'warehouse_mutation')) {
          console.log('[Layout] 🔔 دریافت رویداد تغییرات انبار از وب‌سوکت:', data);
          await syncService.invalidateCache(`${environment.apiUrl}/warehouses/`);
          this.whService.getAll().subscribe({
            next: (warehouses) => {
              this.handleWarehousesLoaded(warehouses);
              if (data.action === 'DELETE' && String(data.warehouse_id) === String(this.store.activeWarehouseId())) {
                this.toast.show(
                  'warning',
                  `انبار «${data.warehouse_name || ''}» توسط مدیر حذف شد؛ انبار فعال شما به‌روزرسانی شد.`
                );
              } else if (data.action === 'TOGGLE_FREEZE' && String(data.warehouse_id) === String(this.store.activeWarehouseId())) {
                this.toast.show(
                  'info',
                  `وضعیت فعالیت انبار «${data.warehouse_name || ''}» به‌روزرسانی شد.`
                );
              }
            }
          });
        }
      })
    );

    // بازخورد همگام‌سازی خودکار (وقتی کاربر دکمه‌ای نزده و اتصال خودش برگشته)
    this.offlineSubs.push(
      syncService.syncOutcome$.subscribe((outcome) => {
        if (outcome.status !== 'completed') return;
        this.syncSuccessMessage = `${outcome.synced} مورد با موفقیت به سرور ارسال شد.`;
        clearTimeout(this.syncSuccessTimer);
        this.syncSuccessTimer = setTimeout(() => {
          this.syncSuccessMessage = null;
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      })
    );

    this.offlineSubs.push(
      syncService.isSyncing$.subscribe((syncing) => {
        this.isSyncing = syncing;
        this.cdr.detectChanges();
      })
    );

    this.offlineSubs.push(
      syncService.pendingCount$.subscribe((count) => {
        this.pendingCount = count;
        this.cdr.detectChanges();
      })
    );

    this.offlineSubs.push(
      syncService.errorCount$.subscribe((count) => {
        this.syncErrorCount = count;
        this.cdr.detectChanges();
      })
    );

    this.offlineSubs.push(
      syncService.lastSyncTime$.subscribe((time) => {
        this.lastSyncTime = time;
        this.cdr.detectChanges();
      })
    );

    this.offlineSubs.push(
      syncService.pullProgress$.subscribe((progress: any) => {
        this.pullProgress = progress;
        this.cdr.detectChanges();
      })
    );

    this.offlineSubs.push(
      syncService.isPulling$.subscribe((pulling: boolean) => {
        this.isPulling = pulling;
        this.cdr.detectChanges();
      })
    );

    this.offlineSubs.push(
      syncService.deepUpdateState$.subscribe((state) => {
        this.deepUpdateState = state;
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy() {
    this.offlineSubs.forEach((s) => s.unsubscribe());
    clearTimeout(this.syncSuccessTimer);
    document.title = this.baseTitle;
  }

  // ─── Sync Actions ───

  /**
   * همگام‌سازی دستی
   *
   * قانون: «شکست» فقط وقتی اعلام می‌شود که واقعاً به سرور وصل شده باشیم.
   * وقتی آفلاین هستیم، هیچ تلاشی انجام نمی‌شود و فقط به کاربر
   * اطلاع می‌دهیم که اینترنتش را بررسی کند.
   */
  async onForceSync() {
    const syncService = OfflineSyncService.getInstance();
    const outcome = await syncService.forceSync();

    switch (outcome.status) {
      case 'offline':
        this.toast.show(
          'warning',
          'اینترنت شما وصل نیست. لطفاً اتصال خود را بررسی کنید. داده‌های شما محفوظ است و به‌محض برقراری اتصال ارسال می‌شود.'
        );
        break;

      case 'server-unreachable':
        this.toast.show(
          'warning',
          outcome.synced > 0
            ? `${outcome.synced} مورد ارسال شد، اما ارتباط با سرور قطع شد. بقیه موارد محفوظ است و بعداً ارسال می‌شود.`
            : 'سرور در حال حاضر در دسترس نیست. داده‌های شما محفوظ است و به‌صورت خودکار دوباره تلاش می‌شود.'
        );
        break;

      case 'auth-required':
        this.toast.show(
          'warning',
          'نشست شما منقضی شده است. لطفاً دوباره وارد شوید تا داده‌ها ارسال شوند.'
        );
        break;

      case 'nothing-to-sync':
        this.toast.show('info', 'همه چیز به‌روز است — موردی برای ارسال وجود ندارد.');
        break;

      // 'completed' عمداً اینجا نیست — بنر سبز در layout آن را نشان می‌دهد
      // (هم برای همگام‌سازی دستی هم خودکار) تا پیام دوتایی نشود.

      case 'partial':
        if (outcome.rejected > 0) {
          this.toast.show(
            'error',
            `${outcome.synced} مورد ارسال شد، ${outcome.rejected} مورد توسط سرور رد شد — به صندوق خطاها مراجعه کنید.`
          );
        } else {
          this.toast.show(
            'warning',
            `${outcome.synced} مورد ارسال شد، ${outcome.remaining} مورد باقی ماند و دوباره تلاش می‌شود.`
          );
        }
        break;
    }
  }

  /**
   * بروزرسانی عمیق (Full Resync)
   * برای پاکسازی رکوردهای روح (Ghosts) و دریافت مجدد کل اطلاعات
   */
  async onDeepUpdate() {
    if (this.isSyncing) return;

    if (this.isOffline) {
      this.toast.show('error', 'برای بروزرسانی عمیق باید به اینترنت متصل باشید.');
      return;
    }

    // گارد وجود تغییرات ارسال نشده در صف
    if (this.pendingCount > 0) {
      this.toast.show('error', 'ابتدا باید تغییرات ذخیره‌نشده خود را همگام‌سازی (Sync) کنید تا از دست نروند.');
      return;
    }

    const currentId = this.store.activeWarehouseId();
    this.deepSyncWarehouses = this.state.appState.projects || [];
    this.deepSyncPreselectId = currentId && currentId !== 'ALL' ? Number(currentId) : null;
    this.isDeepSyncModalOpen = true;
    this.cdr.detectChanges();

    // اعتبارسنجی مجدد و رفرش زنده انبارها پیش از آغاز بروزرسانی عمیق
    this.whService.getAll().subscribe({
      next: (data) => {
        this.handleWarehousesLoaded(data);
        this.deepSyncWarehouses = data || [];
        const refreshedId = this.store.activeWarehouseId();
        this.deepSyncPreselectId = refreshedId && refreshedId !== 'ALL' ? Number(refreshedId) : null;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  async startDeepSync(warehouseIds: number[]) {
    this.isDeepSyncModalOpen = false;
    
    try {
      this.isSyncing = true;
      this.cdr.detectChanges();
      
      const syncService = OfflineSyncService.getInstance();
      
      // Pass the warehouse list so the service can get names
      const warehousesMap: Record<number, string> = {};
      this.deepSyncWarehouses.forEach(w => warehousesMap[w.id] = w.name);
      
      const summaries = await syncService.performDeepUpdate(warehouseIds, warehousesMap);
      
      let totalRecords = 0;
      let totalBytes = 0;
      let tableRows = '';
      
      summaries.forEach(s => {
        totalRecords += s.records;
        totalBytes += s.bytes;
        tableRows += `
          <tr class="border-b border-slate-200 last:border-0">
            <td class="py-2 px-2 text-right">${s.warehouseName}</td>
            <td class="py-2 px-2 text-center" dir="ltr">${s.records.toLocaleString()}</td>
            <td class="py-2 px-2 text-left" dir="ltr">${(s.bytes / 1024).toFixed(1)} KB</td>
          </tr>
        `;
      });
      
      const htmlContent = `
        <div class="mt-4 bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
          <table class="w-full text-xs">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="py-2 px-2 text-right">انبار</th>
                <th class="py-2 px-2 text-center">رکوردها</th>
                <th class="py-2 px-2 text-left">حجم</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
            <tfoot class="bg-slate-200/50 font-bold text-slate-800 border-t border-slate-200">
              <tr>
                <td class="py-2 px-2 text-right">جمع کل</td>
                <td class="py-2 px-2 text-center" dir="ltr">${totalRecords.toLocaleString()}</td>
                <td class="py-2 px-2 text-left" dir="ltr">${(totalBytes / 1024).toFixed(1)} KB</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;

      await this.confirmDialog.open({
        title: 'گزارش بروزرسانی عمیق',
        message: 'دریافت اطلاعات با موفقیت به پایان رسید. جزئیات به شرح زیر است:' + htmlContent,
        confirmText: 'تایید',
        showCancel: false,
        type: 'info'
      });
      
      window.location.reload();
    } catch (err: any) {
      console.error('[DeepUpdate] Error:', err);
      this.toast.show('error', 'خطا در بروزرسانی عمیق: ' + (err.message || 'خطای ناشناخته'));
    } finally {
      this.isSyncing = false;
      this.cdr.detectChanges();
    }
  }

  openSyncErrorsFromBadge() {
    this.isSyncErrorsOpen = true;
    this.loadSyncErrors();
    this.cdr.detectChanges();
  }

  toggleSyncErrors(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.isSyncErrorsOpen = !this.isSyncErrorsOpen;
    if (this.isSyncErrorsOpen) {
      this.loadSyncErrors();
    }
    this.cdr.detectChanges();
  }

  closeSyncErrors() {
    this.isSyncErrorsOpen = false;
    this.cdr.detectChanges();
  }

  async loadSyncErrors() {
    const syncService = OfflineSyncService.getInstance();
    this.syncErrors = await syncService.getErrors();
    this.cdr.detectChanges();
  }

  async dismissSyncError(id: number) {
    const syncService = OfflineSyncService.getInstance();
    await syncService.dismissError(id);
    this.syncErrors = this.syncErrors.filter((e) => e.id !== id);
    this.cdr.detectChanges();
  }

  /** بازگرداندن درخواست ردشده به صف و پردازش فوری (اصلاح ۶ — باز شدن صف مسدود) */
  async retrySyncError(id: number) {
    const syncService = OfflineSyncService.getInstance();
    await syncService.retryError(id);
    this.syncErrors = this.syncErrors.filter((e) => e.id !== id);
    this.toast.show('info', 'درخواست به صف ارسال برگشت و دوباره تلاش می‌شود.');
    this.cdr.detectChanges();
  }

  /** باز/بستن نمایش payload یک خطا */
  expandedErrorId: number | null = null;
  toggleErrorPayload(id: number) {
    this.expandedErrorId = this.expandedErrorId === id ? null : id;
    this.cdr.detectChanges();
  }

  /** نمایش خوانای بدنهٔ درخواست ردشده — دادهٔ کاربر که سرور نپذیرفت */
  formatErrorPayload(body: any): { key: string; value: string }[] {
    if (!body || typeof body !== 'object') return [];
    return Object.entries(body)
      .filter(([k]) => !k.startsWith('_'))
      .slice(0, 12)
      .map(([k, v]) => ({
        key: k,
        value: v === null || v === undefined ? '—'
          : typeof v === 'object' ? JSON.stringify(v).slice(0, 120)
          : String(v).slice(0, 120),
      }));
  }

  async dismissAllSyncErrors() {
    const syncService = OfflineSyncService.getInstance();
    await syncService.dismissAllErrors();
    this.syncErrors = [];
    this.isSyncErrorsOpen = false;
    this.cdr.detectChanges();
  }

  formatSyncTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  }

  /** ──── Sidebar ──── */
  readonly navItems = computed(() => {
    const userPerms = this.auth.userPermissions();
    const isAdmin = userPerms.includes('admin_all');
    
    let items = this.store.isWarehouseContext() ? this.WAREHOUSE_NAV_ITEMS : this.SYSTEM_NAV_ITEMS;
    
    // Filter items based on permissions
    return items.filter(item => {
      if (isAdmin) return true;
      if (item.id === 'audit') {
        return userPerms.includes('view_wh_audit') || userPerms.includes('perm_sys_logs');
      }
      if (item.id === 'count-tracking') {
        return userPerms.includes('view_sys_manager_review') ||
               userPerms.includes('view_sys_supervisor') ||
               userPerms.includes('view_sys_dashboard') ||
               userPerms.includes('perm_inventory_finalize') ||
               userPerms.includes('view_wh_stocktaking') ||
               userPerms.includes('can_act_as_manager') ||
               userPerms.includes('can_act_as_supervisor');
      }
      return userPerms.includes(item.permission);
    });
  });
  
  get isSidebarOpen() { return this.store.isSidebarOpen(); }
  get currentTab() { return this.store.currentTab(); }
  get userAvatar() { return this.auth.userAvatar(); }
  get userName() { return this.auth.userName(); }
  get userRole() { return this.auth.userRoleTitles()[0] || ''; }

  openSidebar() { this.store.openSidebar(); }
  closeSidebar() { this.store.closeSidebar(); }

  switchTab(tabId: string) {
    this.closeSidebar();
    this.router.navigate(['/' + tabId]);
  }

  /** ──── Warehouse Selector ──── */
  get warehouseSwitcherValue() { return this.store.activeWarehouseId(); }

  get currentWarehouse() {
    const activeId = this.store.activeWarehouseId();
    return this.state.appState.projects.find((x: any) => x.id === Number(activeId));
  }

  onWarehouseChanged(id: number | string | null): void {
    this.store.setActiveWarehouse(id);
    this.state.appState.activeWarehouseId = id as any;
  }

  exitWarehouseMode(fromSidebarSwitch = false) {
    if (fromSidebarSwitch) {
      this.store.setLastWarehouseTab(this.currentTab);
      this.store.setIsSwitchingWarehouse(true);
    } else {
      this.store.setIsSwitchingWarehouse(false);
    }
    this.store.setWarehouseContext(false);
    this.router.navigate(['/projects']);
  }

  get progressStats() {
    const isWh = this.store.isWarehouseContext();
    const projects = this.state.appState.projects || [];
    
    let total = 0;
    let counted = 0;
    
    if (isWh) {
      const activeId = this.store.activeWarehouseId();
      const current = projects.find((x: any) => x.id === Number(activeId));
      if (current) {
        total = current.total_quantity || 0;
        counted = current.counted_quantity || 0;
      }
    } else {
      total = projects.reduce((sum: number, p: any) => sum + (p.total_quantity || 0), 0);
      counted = projects.reduce((sum: number, p: any) => sum + (p.counted_quantity || 0), 0);
    }
    
    const percent = total > 0 ? Math.round((counted / total) * 100) : 0;
    
    let colorClass = 'bg-indigo-600';
    if (percent === 100) colorClass = 'bg-emerald-500';
    else if (percent > 70) colorClass = 'bg-blue-500';
    else if (percent > 30) colorClass = 'bg-indigo-500';
    else if (percent > 0) colorClass = 'bg-amber-500';
    else colorClass = 'bg-slate-400';
    
    return {
      total,
      counted,
      percent,
      colorClass,
      label: isWh ? 'پیشرفت انبار:' : 'پیشرفت کل پروژه:',
      tooltip: `شمارش شده: ${counted} از ${total} ردیف`
    };
  }

  /** ──── Logout & Settings ──── */
  goToChangePassword() {
    this.closeSidebar();
    this.router.navigate(['/change-password']);
  }

  async logout() {
    // هشدار جدی وقتی تغییرات ارسال‌نشده در صف است — دادهٔ کاربر نباید بی‌خبر رها شود.
    // (Dexie در logout پاک نمی‌شود؛ پس از ورود مجددِ همان کاربر، صف ارسال می‌شود.)
    if (this.pendingCount > 0) {
      const confirmed = await this.confirmDialog.open({
        title: 'تغییرات ارسال‌نشده دارید!',
        message: `${this.pendingCount} تغییر هنوز به سرور ارسال نشده است. اگر خارج شوید، این تغییرات تا ورود مجدد شما روی همین دستگاه معلق می‌مانند و از دستگاه دیگری در دسترس نیستند. پیشنهاد می‌شود اول همگام‌سازی کنید.`,
        confirmText: 'با این حال خارج شو',
        cancelText: 'انصراف (پیشنهادی)',
        type: 'danger',
      });
      if (!confirmed) return;
      this.auth.logout();
      return;
    }

    const confirmed = await this.confirmDialog.open({
      title: 'خروج از حساب',
      message: 'آیا مطمئنید می‌خواهید از حساب کاربری خارج شوید؟',
      confirmText: 'بله، خروج',
      cancelText: 'انصراف',
      type: 'warning',
    });
    if (confirmed) {
      this.auth.logout();
    }
  }

  /** ──── Private ──── */
  private updateTitle(tab: string) {
    const titles: any = {
      dashboard: 'داشبورد مانیتورینگ',
      projects: 'انبارها',
      dispatch: 'تخصیص کالا',
      users: 'کاربران و نقش‌ها',
      tasks: 'وظایف و اسناد',
      labels: 'لیبل‌زن هوشمند',
      docs: 'انبار',
      'id-cards': 'صدور کارت پرسنلی و گیت‌پاس',
      feeding: 'مدیریت و تغذیه MT26/49 (به‌زودی)',
      settings: 'تنظیمات',
      counter: 'کارتابل انبارگردان',
      customs: 'کارتابل مالی',
      supervisor: 'کارتابل سرپرست شمارش',
      'manager-review': 'بررسی نهایی رکوردها',
      'label-designer': 'طراحی و کانفیگ لیبل/QR',
      audit: 'رهگیری تغییرات',
      'wh-settings': 'تنظیمات انبار',
      'count-tracking': 'پیگیری وضعیت شمارش',
      reports: 'گزارش‌ساز پویا',
      personnel: 'مدیریت پرسنل و ناوگان',
      attendance: 'ثبت کارکرد و ناوگان انبار'
    };
    this.currentTitle = titles[tab] || tab;
  }
}
