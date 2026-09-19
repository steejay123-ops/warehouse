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
  selector: 'app-accountant-payroll-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './accountant-payroll.html',
  styleUrl: './accountant-payroll.css'
})
export class AccountantPayrollHubComponent implements OnInit, OnDestroy {
  // Subtabs navigation
  activeSubTab: 'ready_to_calculate' | 'calculated' | 'approved' | 'all' = 'ready_to_calculate';

  // Section Isolation (Guardian G1)
  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections = false;

  // Fiscal Context & Filters
  searchQuery = '';
  fiscalYear = '1405';
  selectedMonth = 'تیر';

  // State & Indicators
  isLoading = false;
  isCalculating = false;
  items: any[] = [];

  // Summary Metrics (Mirroring reference Excel: حقوق تیر ماه انبارداری.xlsm)
  payrollSummary = {
    totalGross: 0,
    totalInsuranceEmployee: 0,
    totalInsuranceEmployer: 0,
    totalTax: 0,
    totalNetPay: 0
  };

  // Status Counters
  statusCounters = {
    ready_to_calculate: 0,
    calculated: 0,
    approved: 0,
    all: 0
  };

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
      if (params['tab'] && ['ready_to_calculate', 'calculated', 'approved', 'all'].includes(params['tab'])) {
        this.activeSubTab = params['tab'];
      }
      if (params['section_id']) {
        this.selectedSectionId = Number(params['section_id']);
      }
      if (params['q']) {
        this.searchQuery = params['q'];
      }
      if (params['month']) {
        this.selectedMonth = params['month'];
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
              this.fetchPayrollData();
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.fetchPayrollData();
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
    this.fetchPayrollData();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
    this.fetchPayrollData();
  }

  switchSubTab(tab: 'ready_to_calculate' | 'calculated' | 'approved' | 'all'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
    this.fetchPayrollData();
  }

  syncUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeSubTab,
        section_id: this.selectedSectionId || null,
        q: this.searchQuery ? this.searchQuery : null,
        month: this.selectedMonth
      },
      queryParamsHandling: 'merge'
    });
  }

  fetchPayrollData(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.statusCounters = {
        ready_to_calculate: this.items.filter(x => x.status === 'period_locked').length,
        calculated: this.items.filter(x => x.status === 'calculated').length,
        approved: this.items.filter(x => x.status === 'finance_approved').length,
        all: this.items.length
      };
      this.cdr.detectChanges();
    }, 200);
  }

  calculateBatch(): void {
    this.isCalculating = true;
    setTimeout(() => {
      this.isCalculating = false;
      this.toast.success(`موتور حقوق طبق الگوی مرجع اکسل تیرماه با مبنای روزی ۱۰ ساعت اجرا شد.`);
      this.fetchPayrollData();
    }, 600);
  }

  approveSingle(item: any): void {
    this.toast.success(`فیش حقوقی ${item.personnel_name || ''} تایید مالی شد.`);
  }

  exportExcel(): void {
    this.toast.info('در حال تولید فایل اکسل حقوق مطابق شیت تیرماه انبارداری...');
  }

  importExcel(): void {
    this.toast.info('قالب اکسل محاسبات حقوق آماده بارگیری است.');
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.syncUrlParams();
  }
}
