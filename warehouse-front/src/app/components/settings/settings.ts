import { Component, OnInit, ChangeDetectorRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { LabelDesigner } from '../label-designer/label-designer';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  FieldPermissionConfig, 
  CATEGORY_LABELS, 
  DEFAULT_ITEM_FIELD_PERMISSIONS, 
  mergeFieldPermissions,
  mergeDocFieldPermissions 
} from '../../core/models/field-config.model';
import { DynamicFieldApiService } from '../../core/api/dynamic-field-api.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, LabelDesigner],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  isLoading = true;
  settings: any = {};
  activeTab: 'operations' | 'label' | 'counter_fields' | 'doc_fields' | 'backup' = 'operations';

  // ── Counter Field Permissions State ────────────────────────────────────────
  fieldConfigs: FieldPermissionConfig[] = [];
  selectedCategory: string = 'all';
  fieldSearchTerm: string = '';
  categoryLabels = CATEGORY_LABELS;
  categoryKeys = Object.keys(CATEGORY_LABELS);
  dynamicFieldsList: any[] = [];

  // ── Customs / Financial Field Permissions State ─────────────────────────────
  docFieldConfigs: FieldPermissionConfig[] = [];
  selectedDocCategory: string = 'all';
  docFieldSearchTerm: string = '';

  // ── Barcode Scanner Delimiters State ─────────────────────────────────────────
  scannerPreset: 'default' | 'control' | 'hybrid' | 'excel' | 'custom' = 'default';

  // ── Superuser State ─────────────────────────────────────────────────────────
  isSuperUser = computed(() => this.auth.user()?.is_superuser ?? false);

  // ── Backup State ────────────────────────────────────────────────────────────
  backupPassword = '';
  backupShowPassword = false;
  isBackupLoading = false;

  // ── Restore State ───────────────────────────────────────────────────────────
  restorePassword = '';
  restoreShowPassword = false;
  restoreFile: File | null = null;
  restoreFileName = '';
  isRestoreLoading = false;
  showRestoreConfirm = false;

  constructor(
    private settingsService: SettingsService,
    private dynamicFieldApi: DynamicFieldApiService,
    private toast: ToastService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        const tab = params['tab'] as typeof this.activeTab;
        if (['operations', 'label', 'counter_fields', 'doc_fields', 'backup'].includes(tab)) {
          this.activeTab = tab;
          this.cdr.detectChanges();
        }
      }
    });
    this.loadSettings();
  }

  setTab(tab: 'operations' | 'label' | 'counter_fields' | 'doc_fields' | 'backup') {
    this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  loadSettings() {
    this.isLoading = true;
    this.dynamicFieldApi.getFields().subscribe({
      next: (dfRes: any) => {
        this.dynamicFieldsList = Array.isArray(dfRes) ? dfRes : (dfRes?.results || []);
        this.fetchGlobalSettings();
      },
      error: () => {
        this.dynamicFieldsList = [];
        this.fetchGlobalSettings();
      }
    });
  }

  private fetchGlobalSettings() {
    this.settingsService.getGlobalSettings().subscribe({
      next: (res: any) => {
        this.settings = res || {};
        this.fieldConfigs = mergeFieldPermissions(
          this.settings.field_permissions_counter,
          this.dynamicFieldsList
        );
        this.docFieldConfigs = mergeDocFieldPermissions(
          this.settings.field_permissions_doc,
          this.dynamicFieldsList
        );
        const rowSep = this.settings.scanner_row_delimiter ?? ';';
        const colSep = this.settings.scanner_col_delimiter ?? '|';
        this.scannerPreset = this.detectScannerPreset(rowSep, colSep);

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت تنظیمات سیستم.');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Scanner Separator Methods ───────────────────────────────────────────────
  onScannerPresetChange(val: string) {
    this.scannerPreset = val as any;
    if (val === 'default') {
      this.settings.scanner_row_delimiter = ';';
      this.settings.scanner_col_delimiter = '|';
    } else if (val === 'control') {
      this.settings.scanner_row_delimiter = 'Chr(30)';
      this.settings.scanner_col_delimiter = 'Chr(31)';
    } else if (val === 'hybrid') {
      this.settings.scanner_row_delimiter = 'Chr(30) & ";"';
      this.settings.scanner_col_delimiter = 'Chr(31) & "|"';
    } else if (val === 'excel') {
      this.settings.scanner_row_delimiter = '\\n';
      this.settings.scanner_col_delimiter = '\\t';
    }
  }

  detectScannerPreset(rowSep: string, colSep: string): 'default' | 'control' | 'hybrid' | 'excel' | 'custom' {
    if (rowSep === 'Chr(30)' && colSep === 'Chr(31)') return 'control';
    if (rowSep === 'Chr(30) & ";"' && colSep === 'Chr(31) & "|"') return 'hybrid';
    if (rowSep === '\\n' && colSep === '\\t') return 'excel';
    if (rowSep === ';' && colSep === '|') return 'default';
    return 'custom';
  }

  // ── Counter Field Methods ──────────────────────────────────────────────────
  get filteredFieldConfigs(): FieldPermissionConfig[] {
    return this.fieldConfigs.filter(f => {
      const matchCat = this.selectedCategory === 'all' || f.category === this.selectedCategory;
      const search = this.fieldSearchTerm.trim().toLowerCase();
      const matchSearch = !search || 
        f.default_label.toLowerCase().includes(search) || 
        (f.custom_label && f.custom_label.toLowerCase().includes(search)) ||
        f.key.toLowerCase().includes(search);
      return matchCat && matchSearch;
    });
  }

  toggleFieldVisible(field: FieldPermissionConfig) {
    field.visible = !field.visible;
    if (!field.visible) {
      field.editable = false;
    }
  }

  toggleFieldEditable(field: FieldPermissionConfig) {
    field.editable = !field.editable;
    if (field.editable) {
      field.visible = true;
    }
  }

  resetFieldLabel(field: FieldPermissionConfig) {
    field.custom_label = '';
  }

  resetAllFieldsToDefault() {
    this.fieldConfigs = mergeFieldPermissions(null, this.dynamicFieldsList);
    this.toast.show('info', 'تنظیمات فیلدهای انبارگردان به حالت پیش‌فرض اولیه بازنشانی شد (جهت اعمال نهایی روی دکمه ذخیره کلیک کنید).');
  }

  selectAllVisible(val: boolean) {
    this.filteredFieldConfigs.forEach(f => {
      f.visible = val;
      if (!val) f.editable = false;
    });
  }

  selectAllEditable(val: boolean) {
    this.filteredFieldConfigs.forEach(f => {
      f.editable = val;
      if (val) f.visible = true;
    });
  }

  // ── Customs / Financial Field Methods ───────────────────────────────────────
  get filteredDocFieldConfigs(): FieldPermissionConfig[] {
    return this.docFieldConfigs.filter(f => {
      const matchCat = this.selectedDocCategory === 'all' || f.category === this.selectedDocCategory;
      const search = this.docFieldSearchTerm.trim().toLowerCase();
      const matchSearch = !search || 
        f.default_label.toLowerCase().includes(search) || 
        (f.custom_label && f.custom_label.toLowerCase().includes(search)) ||
        f.key.toLowerCase().includes(search);
      return matchCat && matchSearch;
    });
  }

  toggleDocFieldVisible(field: FieldPermissionConfig) {
    field.visible = !field.visible;
    if (!field.visible) {
      field.editable = false;
    }
  }

  toggleDocFieldEditable(field: FieldPermissionConfig) {
    field.editable = !field.editable;
    if (field.editable) {
      field.visible = true;
    }
  }

  resetDocFieldLabel(field: FieldPermissionConfig) {
    field.custom_label = '';
  }

  resetAllDocFieldsToDefault() {
    this.docFieldConfigs = mergeDocFieldPermissions(null, this.dynamicFieldsList);
    this.toast.show('info', 'تنظیمات فیلدهای کارتابل مالی به حالت پیش‌فرض اولیه بازنشانی شد (جهت اعمال نهایی روی دکمه ذخیره کلیک کنید).');
  }

  selectAllDocVisible(val: boolean) {
    this.filteredDocFieldConfigs.forEach(f => {
      f.visible = val;
      if (!val) f.editable = false;
    });
  }

  selectAllDocEditable(val: boolean) {
    this.filteredDocFieldConfigs.forEach(f => {
      f.editable = val;
      if (val) f.visible = true;
    });
  }

  saveGlobalSettings() {
    this.isLoading = true;

    // Serialize Counter fieldConfigs
    const configMap: Record<string, any> = {};
    this.fieldConfigs.forEach(f => {
      configMap[f.key] = {
        visible: f.visible,
        editable: f.editable,
        custom_label: f.custom_label?.trim() || ''
      };
    });
    this.settings.field_permissions_counter = configMap;

    // Serialize Customs/Doc fieldConfigs
    const docConfigMap: Record<string, any> = {};
    this.docFieldConfigs.forEach(f => {
      docConfigMap[f.key] = {
        visible: f.visible,
        editable: f.editable,
        custom_label: f.custom_label?.trim() || ''
      };
    });
    this.settings.field_permissions_doc = docConfigMap;

    this.settingsService.saveGlobalSettings(this.settings).subscribe({
      next: () => {
        this.toast.show('success', 'تنظیمات کلان سیستم و فیلدهای کارتابل‌ها با موفقیت ذخیره شد.');
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در ذخیره تنظیمات سیستم.');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }


  // ── Backup Methods ──────────────────────────────────────────────────────────
  downloadBackup() {
    if (!this.backupPassword) {
      this.toast.show('error', 'لطفاً رمز عبور بک‌آپ را وارد کنید.');
      return;
    }
    this.isBackupLoading = true;
    this.cdr.detectChanges();

    this.settingsService.downloadBackup(this.backupPassword).subscribe({
      next: (blob: Blob) => {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const filename = `warehouse_backup_${timestamp}.wbak`;

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);

        this.toast.show('success', 'فایل پشتیبان با موفقیت دانلود شد.');
        this.backupPassword = '';
        this.isBackupLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        if (err?.error instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result as string);
              this.toast.show('error', parsed.error || 'خطا در ایجاد فایل پشتیبان.');
            } catch {
              this.toast.show('error', 'خطا در ایجاد فایل پشتیبان.');
            }
            this.isBackupLoading = false;
            this.cdr.detectChanges();
          };
          reader.readAsText(err.error);
        } else {
          this.toast.show('error', err?.error?.error || 'خطا در ایجاد فایل پشتیبان.');
          this.isBackupLoading = false;
          this.cdr.detectChanges();
        }
      }
    });
  }

  // ── Restore Methods ─────────────────────────────────────────────────────────
  onRestoreFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.name.endsWith('.wbak')) {
        this.toast.show('error', 'فقط فایل‌های .wbak مجاز هستند.');
        input.value = '';
        return;
      }
      this.restoreFile = file;
      this.restoreFileName = file.name;
      this.cdr.detectChanges();
    }
  }

  openRestoreConfirm() {
    if (!this.restoreFile) {
      this.toast.show('error', 'لطفاً فایل پشتیبان را انتخاب کنید.');
      return;
    }
    if (!this.restorePassword) {
      this.toast.show('error', 'لطفاً رمز عبور فایل پشتیبان را وارد کنید.');
      return;
    }
    this.showRestoreConfirm = true;
    this.cdr.detectChanges();
  }

  cancelRestore() {
    this.showRestoreConfirm = false;
    this.cdr.detectChanges();
  }

  confirmRestore() {
    if (!this.restoreFile || !this.restorePassword) return;
    this.showRestoreConfirm = false;
    this.isRestoreLoading = true;
    this.cdr.detectChanges();

    this.settingsService.restoreBackup(this.restoreFile, this.restorePassword).subscribe({
      next: () => {
        this.toast.show('success', 'بازیابی اطلاعات با موفقیت انجام شد. در حال انتقال به صفحه ورود...');
        this.isRestoreLoading = false;
        this.restoreFile = null;
        this.restoreFileName = '';
        this.restorePassword = '';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.auth.logout();
        }, 2000);
      },
      error: (err: any) => {
        const msg = err?.error?.error || 'خطا در بازیابی اطلاعات. سیستم به حالت قبل بازگردانده شد.';
        this.toast.show('error', msg);
        this.isRestoreLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}

