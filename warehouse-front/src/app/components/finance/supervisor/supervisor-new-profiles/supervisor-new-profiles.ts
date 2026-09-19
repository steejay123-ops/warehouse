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
  selector: 'app-supervisor-new-profiles-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supervisor-new-profiles.html',
  styleUrl: './supervisor-new-profiles.css'
})
export class SupervisorNewProfilesHubComponent implements OnInit, OnDestroy {
  activeSubTab: 'personnel' | 'vehicles' | 'all' = 'personnel';

  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections = false;

  searchQuery = '';
  isLoading = false;
  personnelItems: any[] = [];
  vehicleItems: any[] = [];

  statusCounters = {
    personnel: 0,
    vehicles: 0,
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
      if (params['tab'] && ['personnel', 'vehicles', 'all'].includes(params['tab'])) {
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
              this.fetchProfiles();
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.fetchProfiles();
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
    this.fetchProfiles();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
    this.fetchProfiles();
  }

  switchSubTab(tab: 'personnel' | 'vehicles' | 'all'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
    this.fetchProfiles();
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

  fetchProfiles(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.statusCounters = {
        personnel: this.personnelItems.length,
        vehicles: this.vehicleItems.length,
        all: this.personnelItems.length + this.vehicleItems.length
      };
      this.cdr.detectChanges();
    }, 200);
  }

  approvePersonnel(item: any): void {
    this.toast.success(`پرسنل ${item.first_name} ${item.last_name} تایید و پرونده فعال شد.`);
  }

  rejectPersonnel(item: any): void {
    this.toast.warning(`پرونده پرسنل ${item.first_name} ${item.last_name} جهت اصلاح مدارک عودت شد.`);
  }

  approveVehicle(item: any): void {
    this.toast.success(`خودرو ${item.plate_number} تایید و به ناوگان فعال اضافه شد.`);
  }

  rejectVehicle(item: any): void {
    this.toast.warning(`پرونده خودرو ${item.plate_number} عودت گردید.`);
  }

  exportExcel(): void {
    this.toast.info('در حال تولید فایل اکسل پیش‌نویس‌ها...');
  }

  importExcel(): void {
    this.toast.info('قالب اکسل پرونده‌ها آماده بارگیری است.');
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.syncUrlParams();
  }
}
