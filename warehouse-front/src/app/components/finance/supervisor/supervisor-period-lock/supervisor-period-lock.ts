import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { StateService } from '../../../../services/state.service';
import { ToastService } from '../../../../shared/components/toast/toast.component';
import { PersonnelApiService } from '../../../../core/api/personnel-api.service';
import { ProjectSection } from '../../../../core/models/personnel.model';

@Component({
  selector: 'app-supervisor-period-lock-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supervisor-period-lock.html',
  styleUrl: './supervisor-period-lock.css'
})
export class SupervisorPeriodLockHubComponent implements OnInit, OnDestroy {
  activeSubTab: 'active_period' | 'locked_periods' | 'anomalies' = 'active_period';

  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections = false;

  fiscalYear = '1405';
  selectedMonth = 'تیر';
  isLoading = false;
  isLocking = false;

  currentPeriodSummary = {
    total_personnel: 0,
    total_work_hours: 0,
    total_overtime_hours: 0,
    pending_approvals: 0,
    is_locked: false
  };

  lockedPeriods: any[] = [];
  anomalies: any[] = [];

  private routeSub?: Subscription;

  constructor(
    public auth: AuthService,
    public state: StateService,
    private toast: ToastService,
    private personnelApi: PersonnelApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['tab'] && ['active_period', 'locked_periods', 'anomalies'].includes(params['tab'])) {
        this.activeSubTab = params['tab'];
      }
      if (params['section_id']) {
        this.selectedSectionId = Number(params['section_id']);
      }
    });

    this.loadSections();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  loadSections(): void {
    this.isLoadingSections = true;
    this.personnelApi.getMySections().subscribe({
      next: (sections: ProjectSection[]) => {
        this.mySections = sections || [];
        if (this.mySections.length === 0) {
          this.personnelApi.getProjectSections({ is_active: true }).subscribe({
            next: (allSecs: ProjectSection[]) => {
              this.mySections = allSecs || [];
              this.pickDefaultSection();
            },
            error: () => {
              this.isLoadingSections = false;
              this.fetchPeriodData();
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.fetchPeriodData();
      }
    });
  }

  private pickDefaultSection(): void {
    if (this.mySections.length > 0) {
      if (!this.selectedSectionId || !this.mySections.some(s => s.id === this.selectedSectionId)) {
        this.selectedSectionId = this.mySections[0]?.id ?? null;
      }
      this.selectedSection = this.mySections.find(s => s.id === this.selectedSectionId) || null;
    }
    this.isLoadingSections = false;
    this.fetchPeriodData();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
    this.fetchPeriodData();
  }

  switchSubTab(tab: 'active_period' | 'locked_periods' | 'anomalies'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
    this.fetchPeriodData();
  }

  syncUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeSubTab,
        section_id: this.selectedSectionId || null
      },
      queryParamsHandling: 'merge'
    });
  }

  fetchPeriodData(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 200);
  }

  lockAndSubmitPeriod(): void {
    if (this.currentPeriodSummary.pending_approvals > 0) {
      this.toast.error('ابتدا کلیه کارکردهای در انتظار تایید را نهایی کنید.');
      return;
    }
    this.isLocking = true;
    setTimeout(() => {
      this.isLocking = false;
      this.currentPeriodSummary.is_locked = true;
      this.toast.success(`دوره کارکرد ${this.selectedMonth} ماه ${this.fiscalYear} با موفقیت قفل و به کارتابل حسابداری ارسال شد.`);
      this.cdr.detectChanges();
    }, 500);
  }

  exportExcel(): void {
    this.toast.info('در حال صدور فایل اکسل خلاصه ماهانه کارگاه...');
  }

  importExcel(): void {
    this.toast.info('قالب گزارش تجمیعی ماهانه آماده است.');
  }
}
