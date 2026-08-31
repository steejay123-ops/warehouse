import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StateService } from '../../../services/state.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../services/toast.service';
import { PersonnelApiService } from '../../../core/api/personnel-api.service';
import { PayrollYearlySettings } from '../../../core/models/personnel.model';

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
    return p.includes('perm_settings_personnel') || p.includes('admin_all');
  }

  ngOnInit(): void {
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
  }

  onYearChange(): void {
    this.updateQueryParams();
    this.loadYearlySettings();
  }

  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeTab,
        year: this.fiscalYear
      },
      queryParamsHandling: 'merge'
    });
  }

  loadYearlySettings(): void {
    this.isLoading = true;
    this.api.getYearlySettings(this.fiscalYear).subscribe({
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
