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
  selector: 'app-supervisor-fleet-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supervisor-fleet.html',
  styleUrl: './supervisor-fleet.css'
})
export class SupervisorFleetHubComponent implements OnInit, OnDestroy {
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
  selectedDateShamsi = '';

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
      if (params['date']) {
        this.selectedDateShamsi = params['date'];
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
              this.fetchFleetData();
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.fetchFleetData();
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
    this.fetchFleetData();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
    this.fetchFleetData();
  }

  switchSubTab(tab: 'pending' | 'approved' | 'all'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
    this.fetchFleetData();
  }

  syncUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeSubTab,
        section_id: this.selectedSectionId || null,
        q: this.searchQuery ? this.searchQuery : null,
        date: this.selectedDateShamsi ? this.selectedDateShamsi : null
      },
      queryParamsHandling: 'merge'
    });
  }

  fetchFleetData(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.statusCounters = {
        pending: this.items.filter(x => x.status === 'pending_supervisor').length,
        approved: this.items.filter(x => x.status === 'approved' || x.status === 'manager_approved').length,
        all: this.items.length
      };
      this.cdr.detectChanges();
    }, 200);
  }

  approveSingle(item: any): void {
    this.toast.success(`کارکرد خودرو ${item.plate_number || ''} تایید شد.`);
  }

  rejectSingle(item: any): void {
    this.toast.warning(`کارکرد خودرو ${item.plate_number || ''} جهت اصلاح بازگردانده شد.`);
  }

  approveBatch(): void {
    this.toast.success('کلیه کارکردهای ناوگان در انتظار تایید شدند.');
  }

  exportExcel(): void {
    this.toast.info('در حال تولید فایل اکسل تاییدات ناوگان...');
  }

  importExcel(): void {
    this.toast.info('قالب اکسل بازبینی ناوگان آماده بارگیری است.');
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.syncUrlParams();
  }
}
