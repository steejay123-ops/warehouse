import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { DynamicFieldApiService } from '../../core/api';
import { DynamicFieldDefinition } from '../../core/models';

@Component({
  selector: 'app-dynamic-fields',
  imports: [CommonModule, FormsModule],
  templateUrl: './dynamic-fields.html'
})
export class DynamicFields implements OnInit {
  fields: DynamicFieldDefinition[] = [];
  isLoading = false;
  
  newField: Partial<DynamicFieldDefinition> = {
    name: '',
    label: '',
    field_type: 'text',
    default_value: '',
    is_required: false,
    is_active: true
  };

  editingFieldId: number | null = null;
  editFieldData: Partial<DynamicFieldDefinition> = {};

  constructor(
    public state: StateService,
    private toast: ToastService,
    private fieldApi: DynamicFieldApiService
  ) {}

  ngOnInit() {
    this.loadFields();
  }

  loadFields() {
    const whId = this.state.appState.activeWarehouseId;
    if (!whId) return;
    
    this.isLoading = true;
    this.fieldApi.getFields(whId).subscribe({
      next: (res: any) => {
        this.fields = res.results || res;
        this.isLoading = false;
      },
      error: (err) => {
        this.toast.show('error', 'خطا در دریافت لیست فیلدها');
        this.isLoading = false;
      }
    });
  }

  addField() {
    if (!this.newField.name || !this.newField.label) {
      this.toast.show('error', 'نام و عنوان فیلد الزامی است');
      return;
    }
    
    this.newField.warehouse = this.state.appState.activeWarehouseId;
    
    this.isLoading = true;
    this.fieldApi.createField(this.newField).subscribe({
      next: (res) => {
        this.toast.show('success', 'فیلد با موفقیت اضافه شد');
        this.fields.push(res);
        this.newField = { name: '', label: '', field_type: 'text', default_value: '', is_required: false, is_active: true };
        this.isLoading = false;
      },
      error: (err) => {
        this.toast.show('error', 'خطا در ثبت فیلد (احتمالاً نام سیستمی تکراری است)');
        this.isLoading = false;
      }
    });
  }

  startEdit(field: DynamicFieldDefinition) {
    this.editingFieldId = field.id!;
    this.editFieldData = { ...field };
  }

  cancelEdit() {
    this.editingFieldId = null;
    this.editFieldData = {};
  }

  saveEdit() {
    if (!this.editFieldData.name || !this.editFieldData.label) {
      this.toast.show('error', 'نام و عنوان فیلد الزامی است');
      return;
    }

    this.isLoading = true;
    this.fieldApi.updateField(this.editingFieldId!, this.editFieldData).subscribe({
      next: (res) => {
        this.toast.show('success', 'فیلد با موفقیت ویرایش شد. در صورت تغییر نام سیستمی، دیتای کالاها نیز بروزرسانی می‌شود.');
        const index = this.fields.findIndex(f => f.id === this.editingFieldId);
        if (index > -1) {
          this.fields[index] = res;
        }
        this.cancelEdit();
        this.isLoading = false;
      },
      error: (err) => {
        this.toast.show('error', 'خطا در ویرایش فیلد');
        this.isLoading = false;
      }
    });
  }

  toggleFieldStatus(field: DynamicFieldDefinition) {
    this.fieldApi.updateField(field.id!, { is_active: !field.is_active }).subscribe({
      next: (res) => {
        field.is_active = res.is_active;
        this.toast.show('success', 'وضعیت فیلد بروزرسانی شد');
      },
      error: () => {
        field.is_active = !field.is_active; // revert
        this.toast.show('error', 'خطا در بروزرسانی');
      }
    });
  }

  deleteField(field: DynamicFieldDefinition) {
    if (confirm(`آیا از حذف فیلد "${field.label}" اطمینان دارید؟ داده‌های ثبت شده برای این فیلد در کالاها مخفی خواهند شد.`)) {
      this.fieldApi.deleteField(field.id!).subscribe({
        next: () => {
          this.fields = this.fields.filter(f => f.id !== field.id);
          this.toast.show('success', 'فیلد حذف شد');
        },
        error: () => this.toast.show('error', 'خطا در حذف فیلد')
      });
    }
  }
}
