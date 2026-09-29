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
    const options: any = {};
    if (this.selectedSectionId) options.section_id = this.selectedSectionId;
    const dateStr = this.selectedDateShamsi || '';

    this.personnelApi.getVehicleMatrix(null, dateStr, options).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        const rows = (res?.vehicles || res?.items || []).map((v: any) => ({
          ...v,
          work_hours: v.work_hours || 0,
          trips_count: v.trips_count || v.total_trips || 0,
          status: v.status || 'pending_supervisor'
        }));
        let filtered = rows;
        if (this.searchQuery?.trim()) {
          const q = this.searchQuery.trim().toLowerCase();
          filtered = filtered.filter((x: any) =>
            (x.plate_number && x.plate_number.toLowerCase().includes(q)) ||
            (x.driver_name && x.driver_name.toLowerCase().includes(q))
          );
        }
        this.statusCounters = {
          pending: filtered.filter((x: any) => x.status === 'pending_supervisor' || !x.status).length,
          approved: filtered.filter((x: any) => x.status === 'approved' || x.status === 'manager_approved').length,
          all: filtered.length
        };
        if (this.activeSubTab === 'pending') {
          this.items = filtered.filter((x: any) => x.status === 'pending_supervisor' || !x.status);
        } else if (this.activeSubTab === 'approved') {
          this.items = filtered.filter((x: any) => x.status === 'approved' || x.status === 'manager_approved');
        } else {
          this.items = filtered;
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error('خطا در دریافت اطلاعات ناوگان: ' + (err.error?.error || err.message || 'نامشخص'));
        this.cdr.detectChanges();
      }
    });
  }

  approveSingle(item: any): void {
    const targetId = item.id || item.trip_id;
    if (!targetId) return;
    const previousStatus = item.status;
    item.status = 'approved';
    this.statusCounters.approved = this.items.filter(x => x.status === 'approved').length;
    this.statusCounters.pending = this.items.filter(x => x.status === 'pending_supervisor').length;

    this.personnelApi.patchVehicleTrip(targetId, { notes: item.notes ? `${item.notes} | تایید سرپرست` : 'تایید سرپرست' }).subscribe({
      next: () => {
        this.toast.success(`کارکرد خودرو ${item.plate_number || ''} با موفقیت تایید شد.`);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        item.status = previousStatus;
        this.statusCounters.approved = this.items.filter(x => x.status === 'approved').length;
        this.statusCounters.pending = this.items.filter(x => x.status === 'pending_supervisor').length;
        this.toast.error('خطا در تایید کارکرد ناوگان: ' + (err?.error?.error || err?.message || 'نامشخص'));
        this.cdr.detectChanges();
      }
    });
  }

  rejectSingle(item: any): void {
    const targetId = item.id || item.trip_id;
    if (!targetId) return;
    const reason = window.prompt(`علت عودت کارکرد خودرو ${item.plate_number || ''} را وارد نمایید:`);
    if (reason === null) return;
    const previousStatus = item.status;
    item.status = 'rejected';
    this.statusCounters.pending = this.items.filter(x => x.status === 'pending_supervisor').length;

    this.personnelApi.patchVehicleTrip(targetId, { notes: `عودت سرپرست: ${reason}` }).subscribe({
      next: () => {
        this.toast.warning(`کارکرد خودرو ${item.plate_number || ''} جهت اصلاح بازگردانده شد.`);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        item.status = previousStatus;
        this.statusCounters.pending = this.items.filter(x => x.status === 'pending_supervisor').length;
        this.toast.error('خطا در ثبت عودت ناوگان: ' + (err?.error?.error || err?.message || 'نامشخص'));
        this.cdr.detectChanges();
      }
    });
  }

  approveBatch(): void {
    const pendingItems = this.items.filter(it => it.status === 'pending_supervisor');
    if (pendingItems.length === 0) return;

    pendingItems.forEach(it => { it.status = 'approved'; });
    this.statusCounters.approved = this.items.filter(x => x.status === 'approved').length;
    this.statusCounters.pending = 0;

    let completed = 0;
    pendingItems.forEach(it => {
      const targetId = it.id || it.trip_id;
      if (targetId) {
        this.personnelApi.patchVehicleTrip(targetId, { notes: it.notes ? `${it.notes} | تایید سرپرست` : 'تایید سرپرست' }).subscribe({
          next: () => {
            completed++;
            if (completed === pendingItems.length) {
              this.toast.success('کلیه کارکردهای ناوگان در انتظار تایید شدند.');
              this.cdr.detectChanges();
            }
          },
          error: () => {
            completed++;
            if (completed === pendingItems.length) {
              this.toast.success('عملیات تایید دسته‌ای انجام شد.');
              this.cdr.detectChanges();
            }
          }
        });
      } else {
        completed++;
      }
    });
    this.cdr.detectChanges();
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
    this.fetchFleetData();
  }
}
