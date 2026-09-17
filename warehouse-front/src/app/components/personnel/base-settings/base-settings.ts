import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StateService } from '../../../services/state.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../services/toast.service';
import { PersonnelApiService } from '../../../core/api/personnel-api.service';
import { PayrollYearlySettings, FinancialProject } from '../../../core/models/personnel.model';

@Component({
  selector: 'app-base-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './base-settings.html',
  styleUrl: './base-settings.css'
})
export class BaseSettings implements OnInit, OnDestroy {
  // 6 Dedicated Top Tabs:
  // 'grades' | 'labor' | 'attendance_window' | 'dsk' | 'tax' | 'bank'
  activeTab: 'grades' | 'labor' | 'attendance_window' | 'dsk' | 'tax' | 'bank' = 'grades';

  fiscalYear = '1405';
  availableYears: string[] = ['1405'];
  yearlySettings: PayrollYearlySettings | null = null;
  projects: FinancialProject[] = [];
  selectedProjectId: number | null = null;

  // نسخه‌های احکام در طول سال (شروع از فروردین یا اصلاحیه میانه سال)
  versions: any[] = [];
  selectedVersionId: number | null = null;

  // مودال ثبت نسخه جدید در میانه سال
  showCreateVersionModal = false;
  newVersionEffectiveFrom = '1405/07';
  newVersionTitle = 'اصلاحیه احکام و دستمزد نیمه دوم سال';
  isCreatingVersion = false;

  // مودال ایجاد سال مالی جدید
  showCreateYearModal = false;
  newFiscalYear = '';
  newYearSourceYear = '1405';
  isCreatingYear = false;

  isLoading = false;
  isSaving = false;

  private querySub!: Subscription;

  constructor(
    public auth: AuthService,
    public state: StateService,
    private api: PersonnelApiService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  get canManageSettings(): boolean {
    const p = this.auth.userPermissions();
    return p.includes('perm_settings_personnel') || p.includes('admin_all') || !!this.auth.user()?.is_superuser;
  }

  get isCurrentSettingSpecificToProject(): boolean {
    return !!(this.selectedProjectId && this.yearlySettings?.project === this.selectedProjectId);
  }

  ngOnInit(): void {
    // بارگذاری لیست سال‌های مالی تعریف‌شده
    this.loadAvailableYears();

    // بارگذاری لیست پروژه‌ها جهت سلکتور دامنه تنظیمات
    this.api.getFinancialProjects().subscribe({
      next: (projs) => {
        this.projects = projs;
        this.cdr.detectChanges();
      }
    });

    this.querySub = this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        const t = params['tab'];
        if (['grades', 'labor', 'attendance_window', 'dsk', 'tax', 'bank'].includes(t)) {
          this.activeTab = t;
        } else if (t === 'payroll_settings') {
          this.activeTab = 'grades';
        } else if (t === 'calendar_attendance') {
          this.activeTab = 'attendance_window';
        } else if (t === 'system_settings') {
          this.activeTab = 'dsk';
        }
      }
      if (params['year']) {
        this.fiscalYear = params['year'];
      }
      const rawPid = params['project_id'];
      if (rawPid !== undefined && rawPid !== null && rawPid !== '' && rawPid !== 'null' && rawPid !== 'undefined') {
        const num = Number(rawPid);
        this.selectedProjectId = !isNaN(num) ? num : null;
      } else {
        this.selectedProjectId = null;
      }
      const rawVid = params['version_id'];
      if (rawVid !== undefined && rawVid !== null && rawVid !== '' && rawVid !== 'null' && rawVid !== 'undefined') {
        const num = Number(rawVid);
        this.selectedVersionId = !isNaN(num) ? num : null;
      } else {
        this.selectedVersionId = null;
      }
      this.loadVersionsAndSettings();
    });
  }

  ngOnDestroy(): void {
    if (this.querySub) {
      this.querySub.unsubscribe();
    }
  }

  setTab(tab: 'grades' | 'labor' | 'attendance_window' | 'dsk' | 'tax' | 'bank'): void {
    this.activeTab = tab;
    this.updateQueryParams();
  }

  onYearChange(year: any): void {
    if (year) {
      this.fiscalYear = String(year);
      this.selectedVersionId = null;
      this.updateQueryParams();
      this.loadVersionsAndSettings();
    }
  }

  onProjectChange(projId: any): void {
    const num = projId !== null && projId !== undefined && projId !== '' ? Number(projId) : null;
    this.selectedProjectId = num !== null && !isNaN(num) ? num : null;
    this.selectedVersionId = null;
    this.updateQueryParams();
    this.loadVersionsAndSettings();
  }

  onVersionChange(vId: any): void {
    const num = vId !== null && vId !== undefined && vId !== '' ? Number(vId) : null;
    this.selectedVersionId = num !== null && !isNaN(num) ? num : null;
    this.updateQueryParams();
    this.loadYearlySettings();
  }

  private updateQueryParams(): void {
    const qp: Record<string, any> = {
      tab: this.activeTab,
      year: this.fiscalYear
    };
    if (this.selectedProjectId !== null && this.selectedProjectId !== undefined) {
      qp['project_id'] = this.selectedProjectId;
    }
    if (this.selectedVersionId !== null && this.selectedVersionId !== undefined) {
      qp['version_id'] = this.selectedVersionId;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: qp
    });
  }

  loadVersionsAndSettings(): void {
    this.api.getSettingsVersions(this.fiscalYear, this.selectedProjectId).subscribe({
      next: (vers) => {
        this.versions = vers || [];
        if (this.selectedVersionId && !this.versions.some(v => v.id === this.selectedVersionId)) {
          this.selectedVersionId = null;
        }
        if (!this.selectedVersionId && this.versions.length > 0) {
          const activeV = this.versions.find(v => v.is_active) || this.versions[0];
          this.selectedVersionId = activeV.id;
        }
        this.loadYearlySettings();
      },
      error: () => {
        this.loadYearlySettings();
      }
    });
  }

  loadYearlySettings(): void {
    this.isLoading = true;
    this.api.getYearlySettings(this.fiscalYear, this.selectedProjectId, this.selectedVersionId).subscribe({
      next: (res: any) => {
        this.yearlySettings = res;
        if (res && res.id && !this.selectedVersionId) {
          this.selectedVersionId = res.id;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.toast.show('error', 'خطا در بارگذاری تنظیمات پایه');
        this.cdr.detectChanges();
      }
    });
  }

  openCreateVersionModal(): void {
    this.newVersionEffectiveFrom = `${this.fiscalYear}/07`;
    this.newVersionTitle = `اصلاحیه احکام و دستمزد میانه سال ${this.fiscalYear}`;
    this.showCreateVersionModal = true;
    this.cdr.detectChanges();
  }

  closeCreateVersionModal(): void {
    this.showCreateVersionModal = false;
    this.cdr.detectChanges();
  }

  submitCreateVersion(): void {
    if (!this.newVersionEffectiveFrom) {
      this.toast.show('warning', 'تعیین ماه شروع اجرا (مثلاً 1405/07) الزامی است.');
      return;
    }
    this.isCreatingVersion = true;
    this.api.createSettingsVersion({
      year: this.fiscalYear,
      effective_from: this.newVersionEffectiveFrom,
      version_title: this.newVersionTitle,
      project_id: this.selectedProjectId,
      source_setting_id: this.yearlySettings?.id
    }).subscribe({
      next: (created) => {
        this.isCreatingVersion = false;
        this.showCreateVersionModal = false;
        this.toast.show('success', `نسخه جدید احکام («${created.version_title || created.effective_from}») با موفقیت ثبت شد.`);
        this.selectedVersionId = created.id;
        this.updateQueryParams();
        this.loadVersionsAndSettings();
      },
      error: (err) => {
        this.isCreatingVersion = false;
        this.toast.show('error', err?.error?.error || 'خطا در ثبت نسخه جدید احکام');
        this.cdr.detectChanges();
      }
    });
  }

  cloneForSelectedProject(): void {
    if (!this.selectedProjectId) return;
    this.isLoading = true;
    this.api.cloneSettingsForProject(this.selectedProjectId, this.fiscalYear).subscribe({
      next: (cloned) => {
        this.yearlySettings = cloned;
        this.selectedVersionId = cloned.id;
        this.isLoading = false;
        this.toast.show('success', `تنظیمات اختصاصی برای پروژه «${cloned.project_name || ''}» با موفقیت ایجاد شد.`);
        this.loadVersionsAndSettings();
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.show('error', err?.error?.error || 'خطا در کپی تنظیمات برای پروژه');
        this.cdr.detectChanges();
      }
    });
  }

  saveYearlySettings(): void {
    if (!this.yearlySettings) return;
    this.isSaving = true;

    // ثبت سال مالی انتخابی در آبجکت تنظیمات
    this.yearlySettings.fiscal_year = this.fiscalYear;

    // اگر کاربر در دامنه یک پروژه مشخص است و هنوز رکورد مستقل برای پروژه ایجاد نشده،
    // ابتدا نسخه پروژه را ایجاد و تغییرات کاربر را مستقیماً روی آن ذخیره می‌کنیم تا به وضعیت قبل بازنگردد.
    if (this.selectedProjectId && !this.isCurrentSettingSpecificToProject) {
      const modifiedSettings = JSON.parse(JSON.stringify(this.yearlySettings));
      this.api.cloneSettingsForProject(this.selectedProjectId, this.fiscalYear).subscribe({
        next: (cloned) => {
          const payload = {
            ...modifiedSettings,
            id: cloned.id,
            project: this.selectedProjectId,
            fiscal_year: this.fiscalYear
          };
          this.api.updateYearlySettings(this.fiscalYear, payload).subscribe({
            next: (res: any) => {
              this.isSaving = false;
              this.yearlySettings = res?.settings || payload;
              this.selectedVersionId = cloned.id;
              this.toast.show('success', `تنظیمات اختصاصی پروژه با موفقیت ذخیره شد.`);
              this.updateQueryParams();
              this.loadVersionsAndSettings();
            },
            error: (err: any) => {
              this.isSaving = false;
              this.toast.show('error', err?.error?.error || 'خطا در ذخیره تنظیمات اختصاصی پروژه');
              this.cdr.detectChanges();
            }
          });
        },
        error: (err: any) => {
          this.isSaving = false;
          this.toast.show('error', err?.error?.error || 'خطا در ایجاد رکورد اختصاصی پروژه');
          this.cdr.detectChanges();
        }
      });
      return;
    }

    this.api.updateYearlySettings(this.fiscalYear, this.yearlySettings).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res?.settings) {
          this.yearlySettings = res.settings;
        }
        this.toast.show('success', `تنظیمات نسخه «${this.yearlySettings?.version_title || this.yearlySettings?.effective_from || this.fiscalYear}» با موفقیت ذخیره شد.`);
        this.loadVersionsAndSettings();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.toast.show('error', err?.error?.error || 'خطا در ذخیره تنظیمات پایه');
        this.cdr.detectChanges();
      }
    });
  }

  setAttendanceWindowPreset(pastDays: number, futureDays: number): void {
    if (!this.yearlySettings) return;
    this.yearlySettings.attendance_edit_past_days = pastDays;
    this.yearlySettings.attendance_edit_future_days = futureDays;
    this.toast.show('info', `الگوی انتخابی: ${pastDays} روز قبل، ${futureDays} روز بعد`);
    this.cdr.detectChanges();
  }

  loadAvailableYears(targetYear?: string): void {
    if (targetYear && !this.availableYears.includes(targetYear)) {
      this.availableYears = [targetYear, ...this.availableYears];
      this.fiscalYear = targetYear;
    }
    this.api.getAvailableFiscalYears().subscribe({
      next: (res) => {
        if (res && res.years && res.years.length > 0) {
          const list = [...res.years];
          if (targetYear && !list.includes(targetYear)) {
            list.unshift(targetYear);
          }
          this.availableYears = list;
          if (targetYear && this.availableYears.includes(targetYear)) {
            this.fiscalYear = targetYear;
          } else if (!this.availableYears.includes(this.fiscalYear)) {
            this.fiscalYear = this.availableYears[0];
          }
        }
        this.cdr.detectChanges();
      },
      error: () => {
        if (!this.availableYears.includes('1405')) {
          this.availableYears = ['1405'];
        }
      }
    });
  }

  openCreateYearModal(): void {
    const currentNum = parseInt(this.fiscalYear, 10);
    this.newFiscalYear = !isNaN(currentNum) ? String(currentNum + 1) : '';
    this.newYearSourceYear = this.fiscalYear || (this.availableYears[0] || '1405');
    this.showCreateYearModal = true;
    this.cdr.detectChanges();
  }

  closeCreateYearModal(): void {
    this.showCreateYearModal = false;
    this.cdr.detectChanges();
  }

  submitCreateYear(): void {
    const trimmed = (this.newFiscalYear || '').trim();
    if (!trimmed || trimmed.length !== 4 || !/^\d{4}$/.test(trimmed)) {
      this.toast.show('warning', 'لطفاً یک سال مالی معتبر ۴ رقمی (مثلاً ۱۴۰۶) وارد کنید.');
      return;
    }
    if (this.availableYears.includes(trimmed)) {
      this.toast.show('warning', `سال مالی ${trimmed} قبلاً در سیستم ایجاد شده است.`);
      return;
    }
    this.isCreatingYear = true;
    this.api.createFiscalYear({
      year: trimmed,
      source_year: this.newYearSourceYear,
      project_id: this.selectedProjectId
    }).subscribe({
      next: (created) => {
        this.isCreatingYear = false;
        this.showCreateYearModal = false;
        this.toast.show('success', `سال مالی جدید (${trimmed}) با موفقیت ایجاد و فعال شد.`);
        this.availableYears = [trimmed, ...this.availableYears.filter(y => y !== trimmed)];
        this.fiscalYear = trimmed;
        this.selectedVersionId = created.id;
        this.updateQueryParams();
        this.loadAvailableYears(trimmed);
        this.loadVersionsAndSettings();
      },
      error: (err) => {
        this.isCreatingYear = false;
        this.toast.show('error', err?.error?.error || 'خطا در ایجاد سال مالی جدید');
        this.cdr.detectChanges();
      }
    });
  }
}
