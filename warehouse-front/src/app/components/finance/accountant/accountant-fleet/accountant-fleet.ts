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
  selector: 'app-accountant-fleet-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './accountant-fleet.html',
  styleUrl: './accountant-fleet.css'
})
export class AccountantFleetHubComponent implements OnInit, OnDestroy {
  activeSubTab: 'pending_settlement' | 'settled' | 'all' = 'pending_settlement';

  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections = false;

  searchQuery = '';
  fiscalYear = '1405';
  selectedMonth = 'تیر';

  isLoading = false;
  items: any[] = [];

  statusCounters = {
    pending_settlement: 0,
    settled: 0,
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
      if (params['tab'] && ['pending_settlement', 'settled', 'all'].includes(params['tab'])) {
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
              this.fetchFleetSettlements();
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.fetchFleetSettlements();
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
    this.fetchFleetSettlements();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
    this.fetchFleetSettlements();
  }

  switchSubTab(tab: 'pending_settlement' | 'settled' | 'all'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
    this.fetchFleetSettlements();
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

  fetchFleetSettlements(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.statusCounters = {
        pending_settlement: this.items.filter(x => x.status === 'pending_settlement').length,
        settled: this.items.filter(x => x.status === 'settled').length,
        all: this.items.length
      };
      this.cdr.detectChanges();
    }, 200);
  }

  settleSingle(item: any): void {
    this.toast.success(`صورت‌وضعیت خودرو ${item.plate_number || ''} تایید و به کارتابل خزانه‌داری ارسال شد.`);
  }

  exportExcel(): void {
    this.toast.info('در حال تولید فایل اکسل صورت‌وضعیت ناوگان...');
  }

  importExcel(): void {
    this.toast.info('قالب اکسل تسویه‌حساب ناوگان آماده بارگیری است.');
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.syncUrlParams();
  }
}
