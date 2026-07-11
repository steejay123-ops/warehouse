import { Component, OnInit, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StateService } from '../../services/state.service';
import { ToastService, ModalComponent, ConfirmDialogService, StatusBadgeComponent } from '../../shared';
import { AuthStore } from '../../core/stores/auth.store';
import { WarehouseHttpService, Warehouse } from '../../core/http/warehouse-http.service';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './projects.html',
  styleUrl: './projects.css'
})
export class Projects implements OnInit {
  @ViewChild('addModal') addModal!: ModalComponent;
  addModalOpen = false;
  editModalOpen = false;
  templateModalOpen = false;

  searchQuery = '';
  statusFilter = 'all';
  openDropdownId: number | null = null;
  
  projects: Warehouse[] = [];

  // Edit Model
  editingProject: any = null;

  // Add Model
  newWh: Partial<Warehouse> = {
    code: '', name: '', project_name: '', type: '', location: '', gps_coordinates: '', phone_number: '',
    manager: null, is_active: true, capacity: null, parent_warehouse: null,
    description: '', operator_company: ''
  };

  private whService = inject(WarehouseHttpService);

  constructor(
    public state: StateService,
    private toast: ToastService,
    private confirm: ConfirmDialogService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public store: AuthStore
  ) {}

  ngOnInit() {
    this.store.setWarehouseContext(false);
    this.loadWarehouses();
  }

  loadWarehouses() {
    this.whService.getAll().subscribe({
      next: (data) => {
        this.projects = data;
        this.state.appState.projects = data as any;
        this.cdr.detectChanges();
      },
      error: (err) => this.toast.show('error', 'خطا در دریافت لیست انبارها')
    });
  }

  get filteredProjects() {
    return this.projects.filter((p) => {
      const pCode = p.code || '';
      const matchSearch = p.name.includes(this.searchQuery) || pCode.includes(this.searchQuery) || (p.location && p.location.includes(this.searchQuery));
      let matchStatus = true;
      if (this.statusFilter === 'active') matchStatus = p.is_active === true;
      if (this.statusFilter === 'inactive') matchStatus = p.is_active === false;
      return matchSearch && matchStatus;
    });
  }

  handleWarehouseSwitch(id: number) {
    this.store.setActiveWarehouse(id);
    this.state.appState.activeWarehouseId = id as any;
  }

  goToDispatch(id: number) {
    this.handleWarehouseSwitch(id);
    this.store.setWarehouseContext(true);
    const p = this.state.appState.projects.find((x: any) => x.id === id);
    if (p) {
      this.toast.info(`شما وارد محیط انبار «${p.name}» شدید`);
    }
    
    if (this.store.isSwitchingWarehouse()) {
      const nextTab = this.store.lastWarehouseTab() || 'dashboard';
      this.store.setIsSwitchingWarehouse(false);
      this.router.navigate(['/' + nextTab]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  toggleDropdown(event: Event, id: number) {
    event.stopPropagation();
    if (this.openDropdownId === id) this.openDropdownId = null;
    else this.openDropdownId = id;
    this.cdr.detectChanges();
  }

  closeDropdowns() {
    this.openDropdownId = null;
    this.cdr.detectChanges();
  }

  async archiveWarehouse(id: number) {
    this.closeDropdowns();
    const p = this.projects.find((proj) => proj.id === id);
    if (p) {
      const confirmed = await this.confirm.open({
        title: 'غیرفعال‌سازی انبار',
        message: `آیا از غیرفعال کردن انبار ${p.name} اطمینان دارید؟`,
        confirmText: 'غیرفعال شود',
        type: 'warning'
      });
      if (confirmed) {
        this.whService.toggleArchive(id).subscribe(() => {
          this.loadWarehouses();
          this.toast.show('warning', `انبار ${p.name} غیرفعال شد.`);
        });
      }
    }
  }

  async restoreWarehouse(id: number) {
    this.closeDropdowns();
    const p = this.projects.find((proj) => proj.id === id);
    if (p) {
      const confirmed = await this.confirm.open({
        title: 'فعال‌سازی انبار',
        message: `آیا می‌خواهید انبار ${p.name} را مجدداً فعال کنید؟`,
        confirmText: 'بله، فعال شود',
        type: 'info'
      });
      if (confirmed) {
        this.whService.toggleArchive(id).subscribe(() => {
           this.loadWarehouses();
           this.toast.show('success', `انبار ${p.name} با موفقیت فعال شد.`);
        });
      }
    }
  }

  openEditModal(id: number) {
    this.closeDropdowns();
    const p = this.projects.find((proj) => proj.id === id);
    if (p) {
      this.editingProject = JSON.parse(JSON.stringify(p));
      this.editModalOpen = true;
    }
  }

  saveWarehouseEdit() {
    this.whService.update(this.editingProject.id, this.editingProject).subscribe({
       next: () => {
         this.loadWarehouses();
         this.toast.show('success', 'تغییرات با موفقیت ذخیره شد.');
         this.editModalOpen = false;
       },
       error: () => this.toast.show('error', 'خطا در ویرایش انبار')
    });
  }

  openAddModal() {
    this.newWh = {
      code: '', name: '', project_name: '', type: '', location: '', gps_coordinates: '', phone_number: '',
      manager: null, is_active: true, capacity: null, parent_warehouse: null,
      description: '', operator_company: ''
    };
    this.addModalOpen = true;
  }

  saveNewWarehouse() {
    if(!this.newWh.name) {
      return this.toast.show('warning', 'وارد کردن نام انبار الزامی است');
    }
    
    // Convert empty string code to null to trigger auto-generation in backend
    const payload: any = { ...this.newWh };
    if (!payload.code || payload.code.trim() === '') {
      payload.code = null;
    }

    this.whService.create(payload).subscribe({
      next: (res) => {
        this.loadWarehouses();
        this.toast.show('success', 'انبار با موفقیت ایجاد شد');
        this.addModalOpen = false;
      },
      error: (err) => {
        this.toast.show('error', 'خطا در ایجاد انبار');
        console.error(err);
      }
    });
  }

  downloadTemplate() {
    const link = document.createElement('a');
    link.href = 'assets/template.xlsx';
    link.download = 'Warehouse_Template.xlsx';
    link.click();
  }

  goToDocs() {
    this.router.navigate(['/docs']);
  }
}
