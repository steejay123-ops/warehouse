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
  selector: 'app-supervisor-invoices-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supervisor-invoices.html',
  styleUrl: './supervisor-invoices.css'
})
export class SupervisorInvoicesHubComponent implements OnInit, OnDestroy {
  // Subtabs navigation
  activeSubTab: 'pending' | 'approved' | 'all' = 'pending';

  // Section Management (Guardian G1: Section Isolation)
  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections = false;

  // Search & Filter
  searchQuery = '';
  fiscalYear = '1405';

  // State & Indicators
  isLoading = false;
  items: any[] = [];

  // Counters
  statusCounters = {
    pending: 0,
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
      if (params['tab'] && ['pending', 'approved', 'all'].includes(params['tab'])) {
        this.activeSubTab = params['tab'];
      }
      if (params['section_id']) {
        this.selectedSectionId = Number(params['section_id']);
      }
      if (params['q']) {
        this.searchQuery = params['q'];
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
              this.fetchInvoices();
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.fetchInvoices();
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
    this.fetchInvoices();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
    this.fetchInvoices();
  }

  switchSubTab(tab: 'pending' | 'approved' | 'all'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
    this.fetchInvoices();
  }

  syncUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeSubTab,
        section_id: this.selectedSectionId || null,
        q: this.searchQuery ? this.searchQuery : null
      },
      queryParamsHandling: 'merge'
    });
  }

  fetchInvoices(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.statusCounters = {
        pending: this.items.filter(x => x.status === 'pending_supervisor').length,
        approved: this.items.filter(x => x.status === 'approved' || x.status === 'pending_accountant').length,
        all: this.items.length
      };
      this.cdr.detectChanges();
    }, 200);
  }

  approveSingle(item: any): void {
    this.toast.success(`فاکتور شماره ${item.invoice_number || ''} تایید و به کارتابل حسابداری ارسال شد.`);
  }

  rejectSingle(item: any): void {
    this.toast.warning(`فاکتور شماره ${item.invoice_number || ''} جهت اصلاح بازگردانده شد.`);
  }

  exportExcel(): void {
    this.toast.info('در حال تولید فایل اکسل فاکتورها...');
  }

  importExcel(): void {
    this.toast.info('قالب اکسل فاکتورها بارگیری شد.');
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.syncUrlParams();
  }
}
