import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { ItemApiService } from '../../core/api';

@Component({
  selector: 'app-feeding',
  imports: [CommonModule, FormsModule],
  templateUrl: './feeding.html',
  styleUrl: './feeding.css'
})
export class Feeding implements OnInit {
  selectedFile: File | null = null;
  isUploading = false;

  constructor(
    public state: StateService, 
    private toast: ToastService,
    private itemApi: ItemApiService
  ) {}

  ngOnInit() {}

  get activeWh() {
    return this.state.appState.projects.find((p: any) => p.id === this.state.appState.activeWarehouseId) || this.state.appState.projects[0];
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        this.toast.show('error', 'فرمت فایل نامعتبر است. لطفاً فایل اکسل (.xlsx) انتخاب کنید.');
        this.selectedFile = null;
        event.target.value = ''; // clear input
        return;
      }
      this.selectedFile = file;
    }
  }

  downloadTemplate() {
    const link = document.createElement('a');
    link.href = 'assets/template.xlsx';
    link.download = 'Warehouse_Template.xlsx';
    link.click();
  }

  uploadExcel() {
    if (!this.selectedFile) {
      this.toast.show('warning', 'لطفاً ابتدا فایل اکسل را انتخاب کنید.');
      return;
    }

    if (!this.state.appState.activeWarehouseId) {
      this.toast.show('error', 'هیچ انباری انتخاب نشده است.');
      return;
    }

    this.isUploading = true;
    this.itemApi.bulkImport(this.selectedFile, this.state.appState.activeWarehouseId, 'ignore', '').subscribe({
      next: (response) => {
        this.isUploading = false;
        this.selectedFile = null;
        this.toast.show('success', `اطلاعات با موفقیت پردازش شد. (جدید: ${response.created} ، بروزرسانی: ${response.updated})`);
        // We could also reload items here
      },
      error: (err) => {
        this.isUploading = false;
        console.error(err);
        this.toast.show('error', 'خطا در آپلود فایل. ' + (err.error?.error || ''));
      }
    });
  }
}
