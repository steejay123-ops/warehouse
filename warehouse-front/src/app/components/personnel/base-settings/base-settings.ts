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
  yearlySettings: PayrollYearlySettings | null = null;
  projects: FinancialProject[] = [];
  selectedProjectId: number | null = null;

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
      if (params['project_id']) {
        this.selectedProjectId = Number(params['project_id']);
      }
      this.loadYearlySettings();
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
    this.loadYearlySettings();
  }

  onYearChange(): void {
    this.updateQueryParams();
    this.loadYearlySettings();
  }

  onProjectChange(projId: any): void {
    this.selectedProjectId = projId ? Number(projId) : null;
    this.updateQueryParams();
    this.loadYearlySettings();
  }

  private updateQueryParams(): void {
    const qp: any = {
      tab: this.activeTab,
      year: this.fiscalYear
    };
    if (this.selectedProjectId) {
      qp.project_id = this.selectedProjectId;
    } else {
      qp.project_id = null;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: qp,
      queryParamsHandling: 'merge'
    });
  }

  loadYearlySettings(): void {
    this.isLoading = true;
    this.api.getYearlySettings(this.fiscalYear, this.selectedProjectId).subscribe({
      next: (res: any) => {
        this.yearlySettings = res;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.toast.show('error', 'خطا در بارگذاری تنظیمات پایه سالانه');
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
        this.isLoading = false;
        this.toast.show('success', `تنظیمات اختصاصی برای پروژه «${cloned.project_name || ''}» با موفقیت ایجاد شد.`);
        this.cdr.detectChanges();
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
    this.api.updateYearlySettings(this.fiscalYear, this.yearlySettings).subscribe({
      next: () => {
        this.isSaving = false;
        this.toast.show('success', `تنظیمات سال مالی ${this.fiscalYear} با موفقیت ذخیره شد.`);
        this.cdr.detectChanges();
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
}
