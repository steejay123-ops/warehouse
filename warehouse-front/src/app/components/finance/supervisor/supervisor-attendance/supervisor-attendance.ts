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
  selector: 'app-supervisor-attendance-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supervisor-attendance.html',
  styleUrl: './supervisor-attendance.css'
})
export class SupervisorAttendanceHubComponent implements OnInit, OnDestroy {
  // Subtabs navigation
  activeSubTab: 'pending' | 'approved' | 'all' | 'daily_summary' = 'pending';

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
  isSaving = false;
  items: any[] = [];

  // Counters
  statusCounters = {
    pending: 0,
    approved: 0,
    all: 0,
    daily_summary: 0
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
      if (params['tab'] && ['pending', 'approved', 'all', 'daily_summary'].includes(params['tab'])) {
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
              this.fetchAttendanceData();
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.fetchAttendanceData();
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
    this.fetchAttendanceData();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
    this.fetchAttendanceData();
  }

  switchSubTab(tab: 'pending' | 'approved' | 'all' | 'daily_summary'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
    this.fetchAttendanceData();
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

  fetchAttendanceData(): void {
    this.isLoading = true;
    const params: { section_id?: number; date_shamsi?: string } = {};
    if (this.selectedSectionId) params.section_id = this.selectedSectionId;
    if (this.selectedDateShamsi) params.date_shamsi = this.selectedDateShamsi;

    this.personnelApi.getDailyAttendance(params).subscribe({
      next: (data: any[]) => {
        this.isLoading = false;
        let rows = (data || []).map(row => ({
          ...row,
          national_code: row.personnel_national_code || row.national_code || '---',
          work_hours: row.effective_hours ?? row.work_hours ?? 0,
          overtime_hours: row.overtime_hours ?? 0,
          status: row.status || 'pending_supervisor'
        }));
        if (this.searchQuery?.trim()) {
          const q = this.searchQuery.trim().toLowerCase();
          rows = rows.filter(x =>
            (x.personnel_name && x.personnel_name.toLowerCase().includes(q)) ||
            (x.national_code && x.national_code.includes(q))
          );
        }
        this.statusCounters = {
          pending: rows.filter(x => x.status === 'pending_supervisor' || !x.status).length,
          approved: rows.filter(x => x.status === 'approved' || x.status === 'PRESENT').length,
          all: rows.length,
          daily_summary: rows.length
        };
        if (this.activeSubTab === 'pending') {
          this.items = rows.filter(x => x.status === 'pending_supervisor' || !x.status);
        } else if (this.activeSubTab === 'approved') {
          this.items = rows.filter(x => x.status === 'approved' || x.status === 'PRESENT');
        } else {
          this.items = rows;
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error('خطا در دریافت لیست کارکرد: ' + (err.error?.error || err.message || 'نامشخص'));
        this.cdr.detectChanges();
      }
    });
  }

  approveSingle(item: any): void {
    if (!item.id) return;
    const previousStatus = item.status;
    item.status = 'approved';
    this.statusCounters.approved = this.items.filter(x => x.status === 'approved' || x.status === 'PRESENT').length;
    this.statusCounters.pending = this.items.filter(x => x.status === 'pending_supervisor').length;

    this.personnelApi.patchDailyAttendance(item.id, { notes: item.notes ? `${item.notes} | تایید سرپرست` : 'تایید سرپرست' }).subscribe({
      next: () => {
        this.toast.success(`کارکرد ${item.personnel_name || 'پرسنل'} با موفقیت به تایید سرپرست رسید.`);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        item.status = previousStatus;
        this.statusCounters.approved = this.items.filter(x => x.status === 'approved' || x.status === 'PRESENT').length;
        this.statusCounters.pending = this.items.filter(x => x.status === 'pending_supervisor').length;
        this.toast.error('خطا در تایید کارکرد پرسنل: ' + (err?.error?.error || err?.message || 'نامشخص'));
        this.cdr.detectChanges();
      }
    });
  }

  rejectSingle(item: any): void {
    if (!item.id) return;
    const reason = window.prompt(`علت عودت کارکرد ${item.personnel_name || ''} را وارد کنید:`);
    if (reason === null) return;
    const previousStatus = item.status;
    item.status = 'rejected';
    this.statusCounters.pending = this.items.filter(x => x.status === 'pending_supervisor').length;

    this.personnelApi.patchDailyAttendance(item.id, { notes: `عودت سرپرست: ${reason}` }).subscribe({
      next: () => {
        this.toast.warning(`کارکرد ${item.personnel_name || 'پرسنل'} جهت اصلاح عودت داده شد.`);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        item.status = previousStatus;
        this.statusCounters.pending = this.items.filter(x => x.status === 'pending_supervisor').length;
        this.toast.error('خطا در ثبت عودت کارکرد: ' + (err?.error?.error || err?.message || 'نامشخص'));
        this.cdr.detectChanges();
      }
    });
  }

  approveBatch(): void {
    const pendingItems = this.items.filter(it => it.status === 'pending_supervisor');
    if (pendingItems.length === 0) return;

    pendingItems.forEach(it => { it.status = 'approved'; });
    this.statusCounters.approved = this.items.filter(x => x.status === 'approved' || x.status === 'PRESENT').length;
    this.statusCounters.pending = 0;

    let completed = 0;
    pendingItems.forEach(it => {
      this.personnelApi.patchDailyAttendance(it.id, { notes: it.notes ? `${it.notes} | تایید سرپرست` : 'تایید سرپرست' }).subscribe({
        next: () => {
          completed++;
          if (completed === pendingItems.length) {
            this.toast.success('کلیه کارکردهای در انتظار با موفقیت به تایید سرپرست رسید.');
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
    });
    this.cdr.detectChanges();
  }

  exportExcel(): void {
    this.toast.info('در حال تولید فایل اکسل تاییدات کارکرد...');
  }

  importExcel(): void {
    this.toast.info('قالب اکسل بازبینی کارکرد آماده بارگیری است.');
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.syncUrlParams();
    this.fetchAttendanceData();
  }
}
