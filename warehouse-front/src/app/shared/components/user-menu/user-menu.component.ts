import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/stores/auth.store';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import { OfflineSyncService } from '../../../core/services/offline-sync.service';
import { AccountsHttpService } from '../../../core/http/accounts-http.service';
import { WarehouseHttpService } from '../../../core/http/warehouse-http.service';
import { StateService } from '../../../services/state.service';
import { ModuleRegistryService } from '../../../core/modules/module-registry.service';
import { ToastService } from '../toast/toast.component';
import { ConfirmDialogService } from '../confirm-dialog/confirm-dialog.component';
import { AvatarCropperModal } from '../avatar-cropper-modal/avatar-cropper-modal';
import { DeepSyncModalComponent } from '../deep-sync-modal/deep-sync-modal.component';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AvatarCropperModal,
    DeepSyncModalComponent
  ],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css'
})
export class UserMenuComponent implements OnInit, OnDestroy {
  @Input() theme: 'indigo' | 'cyan' = 'indigo';

  public auth = inject(AuthService);
  private store = inject(AuthStore);
  private state = inject(StateService);
  private accountsService = inject(AccountsHttpService);
  private whService = inject(WarehouseHttpService);
  private moduleRegistry = inject(ModuleRegistryService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private swUpdate = inject(SwUpdate);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  public isUserMenuOpen = false;
  public isAvatarModalOpen = false;
  public isSavingAvatar = false;
  public isCheckingAppUpdate = false;

  public isOffline = false;
  public isSyncing = false;
  public pendingCount = 0;
  public isDeepSyncModalOpen = false;
  public deepSyncWarehouses: any[] = [];
  public deepSyncPreselectId: number | null = null;
  private subs: Subscription[] = [];

  // Shortcuts modal
  public isShortcutsHelpOpen = false;
  public shortcutsSearchQuery = '';
  public shortcutsActiveCategory = 'all';

  public shortcutsCategories = [
    { id: 'all', label: 'همه کلیدها', count: 20 },
    { id: 'global', label: 'عمومی و منو', count: 5 },
    { id: 'counting', label: 'انبارگردانی و اسکنر', count: 5 },
    { id: 'table', label: 'جدول اطلاعات و فرم‌ها', count: 5 },
    { id: 'design', label: 'طراحی لیبل و کارت', count: 5 },
  ];

  public allShortcuts = [
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
      categoryLabel: 'کپی و جایگذاری المان',
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

  public get filteredShortcuts() {
    return this.allShortcuts.filter(item => {
      const matchCat = this.shortcutsActiveCategory === 'all' || item.category === this.shortcutsActiveCategory;
      if (!matchCat) return false;
      if (!this.shortcutsSearchQuery.trim()) return true;
      const q = this.shortcutsSearchQuery.toLowerCase().trim();
      return (
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.categoryLabel && item.categoryLabel.toLowerCase().includes(q)) ||
        item.keys.some(k => k.toLowerCase().includes(q)) ||
        (item.altKeys && item.altKeys.some(k => k.toLowerCase().includes(q)))
      );
    });
  }

  public get userAvatar(): string {
    return this.auth.userAvatar();
  }

  public get userName(): string {
    return this.auth.userName();
  }

  public get userRole(): string {
    return this.auth.userRoleTitles()[0] || 'کاربر سیستم';
  }

  ngOnInit(): void {
    const network = NetworkStatusService.getInstance();
    const syncService = OfflineSyncService.getInstance();

    this.subs.push(
      network.state$.subscribe((state) => {
        this.isOffline = state !== 'online';
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
      syncService.isSyncing$.subscribe((syncing) => {
        this.isSyncing = syncing;
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
      syncService.pendingCount$.subscribe((count) => {
        this.pendingCount = count;
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  public toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    this.cdr.detectChanges();
  }

  public closeUserMenu(): void {
    this.isUserMenuOpen = false;
    this.cdr.detectChanges();
  }

  public openAvatarModal(): void {
    this.isAvatarModalOpen = true;
    this.closeUserMenu();
  }

  public onSaveAvatar(blob: Blob): void {
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

  public onRemoveAvatar(): void {
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

  public async onManualAppUpdate(): Promise<void> {
    const network = NetworkStatusService.getInstance();
    if (!network.isBrowserOnline || network.isServerUnreachable) {
      this.toast.show(
        'warning',
        'سامانه در حالت آفلاین / عدم دسترسی به سرور است. امکان دریافت بروزرسانی در این وضعیت وجود ندارد.'
      );
      return;
    }

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

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      }

      this.toast.show('success', 'شما در حال استفاده از آخرین نسخه برنامه هستید.');
    } catch (err: any) {
      console.warn('Manual app update failed', err);
      const errMsg = String(err?.message || err || '');

      if (
        errMsg.includes('530') ||
        errMsg.includes('502') ||
        errMsg.includes('503') ||
        errMsg.includes('504') ||
        errMsg.includes('Failed to update a ServiceWorker') ||
        errMsg.includes('bad HTTP response code') ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('NetworkError')
      ) {
        network.reportServerUnreachable();
        this.toast.show(
          'warning',
          'سرور اصلی در دسترس نیست (کد ۵۳۰ یا خطای شبکه). نسخه محلی برنامه فعال و پایدار است.'
        );
      } else {
        this.toast.show('error', 'عدم امکان بررسی نسخه جدید: ' + (err?.message || 'سرور پاسخگو نیست'));
      }
    } finally {
      this.isCheckingAppUpdate = false;
      this.cdr.detectChanges();
    }
  }

  public async onDeepUpdate(): Promise<void> {
    if (this.isSyncing) return;

    if (this.isOffline) {
      this.toast.show('error', 'برای بروزرسانی عمیق باید به اینترنت متصل باشید.');
      return;
    }

    if (this.pendingCount > 0) {
      this.toast.show('error', 'ابتدا باید تغییرات ذخیره‌نشده خود را همگام‌سازی (Sync) کنید تا از دست نروند.');
      return;
    }

    const currentId = this.store.activeWarehouseId();
    this.deepSyncWarehouses = this.state.appState.projects || [];
    this.deepSyncPreselectId = currentId && currentId !== 'ALL' ? Number(currentId) : null;
    this.isDeepSyncModalOpen = true;
    this.cdr.detectChanges();

    if (this.moduleRegistry.isModuleInstalled('warehouse')) {
      this.whService.getAll().subscribe({
        next: (data) => {
          this.deepSyncWarehouses = data || [];
          const refreshedId = this.store.activeWarehouseId();
          this.deepSyncPreselectId = refreshedId && refreshedId !== 'ALL' ? Number(refreshedId) : null;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    }
  }

  public async startDeepSync(warehouseIds: number[]): Promise<void> {
    this.isDeepSyncModalOpen = false;
    
    try {
      this.isSyncing = true;
      this.cdr.detectChanges();
      
      const syncService = OfflineSyncService.getInstance();
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
      console.error('Deep update error:', err);
      this.toast.show('error', 'خطا در بروزرسانی عمیق: ' + (err.message || 'مشکل ناشناخته'));
    } finally {
      this.isSyncing = false;
      this.cdr.detectChanges();
    }
  }

  public toggleShortcutsHelp(): void {
    this.isShortcutsHelpOpen = !this.isShortcutsHelpOpen;
    this.cdr.detectChanges();
  }

  @HostListener('window:keydown', ['$event'])
  public handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === '?' && event.shiftKey) {
      event.preventDefault();
      this.toggleShortcutsHelp();
    } else if (event.key === 'Escape') {
      if (this.isShortcutsHelpOpen) {
        this.isShortcutsHelpOpen = false;
        this.cdr.detectChanges();
      }
      if (this.isUserMenuOpen) {
        this.isUserMenuOpen = false;
        this.cdr.detectChanges();
      }
    }
  }

  public goToChangePassword(): void {
    this.router.navigate(['/app/change-password']);
  }

  public goToLauncher(): void {
    this.router.navigate(['/app/launcher']);
  }

  public logout(): void {
    this.auth.logout();
  }
}
