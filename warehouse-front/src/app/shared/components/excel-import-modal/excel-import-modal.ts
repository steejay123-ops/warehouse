import { Component, Input, Output, EventEmitter, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ImportResult } from '../../../core/http/accounts-http.service';

@Component({
  selector: 'app-excel-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './excel-import-modal.html',
  styleUrl: './excel-import-modal.css'
})
export class ExcelImportModal {
  @Input() title = 'آپلود فایل اکسل';
  @Input() templateDownloadFn!: () => void;
  @Input() importFn!: (file: File, updateExisting: boolean, dryRun?: boolean) => Observable<ImportResult>;
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<ImportResult>();

  step: 'select' | 'preview' | 'result' = 'select';
  selectedFile: File | null = null;
  updateExisting = false;
  isDragging = false;
  isAnalyzing = false;
  isUploading = false;
  uploadProgress = 0;

  previewResult: ImportResult | null = null;
  result: ImportResult | null = null;
  fileError: string | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileSelection(input.files[0]);
    }
  }

  handleFileSelection(file: File) {
    this.fileError = null;
    this.result = null;
    this.previewResult = null;

    if (!file.name.endsWith('.xlsx')) {
      this.fileError = 'فقط فایل‌های با فرمت xlsx پشتیبانی می‌شوند.';
      this.selectedFile = null;
      this.step = 'select';
      this.cdr.detectChanges();
      return;
    }

    this.selectedFile = file;
    this.runValidation(file);
  }

  runValidation(file: File) {
    if (!this.importFn) return;
    this.isAnalyzing = true;
    this.fileError = null;
    this.cdr.detectChanges();

    this.importFn(file, this.updateExisting, true).subscribe({
      next: (res) => {
        this.isAnalyzing = false;
        this.previewResult = res;
        this.step = 'preview';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isAnalyzing = false;
        if (err.error && err.error.errors) {
          this.previewResult = err.error;
          this.step = 'preview';
        } else {
          this.fileError = err.error?.message || 'خطا در خوانش و اعتبارسنجی اولیه فایل اکسل.';
          this.step = 'select';
        }
        this.cdr.detectChanges();
      }
    });
  }

  onUpdateExistingToggle() {
    if (this.selectedFile && this.step === 'preview') {
      this.runValidation(this.selectedFile);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  removeFile() {
    this.selectedFile = null;
    this.result = null;
    this.previewResult = null;
    this.fileError = null;
    this.step = 'select';
    this.isAnalyzing = false;
    this.isUploading = false;
    this.uploadProgress = 0;
    this.cdr.detectChanges();
  }

  commitUpload() {
    if (!this.selectedFile || !this.importFn || this.isUploading) return;

    this.isUploading = true;
    this.uploadProgress = 0;

    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += Math.random() * 15;
        this.cdr.detectChanges();
      }
    }, 150);

    this.importFn(this.selectedFile, this.updateExisting, false).subscribe({
      next: (res) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;
        this.isUploading = false;
        this.result = res;
        this.step = 'result';
        this.imported.emit(res);
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearInterval(progressInterval);
        this.isUploading = false;
        this.uploadProgress = 0;

        if (err.error && err.error.errors) {
          this.result = err.error;
          this.step = 'result';
        } else {
          this.fileError = 'خطا در ثبت نهایی فایل. لطفاً مجدداً تلاش کنید.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  downloadTemplate() {
    if (this.templateDownloadFn) {
      this.templateDownloadFn();
    }
  }

  close() {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    if (!this.isUploading && !this.isAnalyzing) {
      this.close();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (this.step === 'preview' && this.selectedFile && !this.isUploading) {
        event.preventDefault();
        this.commitUpload();
      }
    }
  }
}
