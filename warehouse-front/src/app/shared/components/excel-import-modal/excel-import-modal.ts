import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ImportResult } from '../../../core/http/accounts-http.service';

@Component({
  selector: 'app-excel-import-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './excel-import-modal.html',
  styleUrl: './excel-import-modal.css'
})
export class ExcelImportModal {
  @Input() title = 'آپلود فایل اکسل';
  @Input() templateDownloadFn!: () => void;
  @Input() importFn!: (file: File) => Observable<ImportResult>;
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<ImportResult>();

  selectedFile: File | null = null;
  isDragging = false;
  isUploading = false;
  uploadProgress = 0;

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

    if (!file.name.endsWith('.xlsx')) {
      this.fileError = 'فقط فایل‌های با فرمت xlsx پشتیبانی می‌شوند.';
      this.selectedFile = null;
      this.cdr.detectChanges();
      return;
    }

    this.selectedFile = file;
    this.cdr.detectChanges();
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  removeFile() {
    this.selectedFile = null;
    this.result = null;
    this.fileError = null;
    this.cdr.detectChanges();
  }

  startUpload() {
    if (!this.selectedFile || !this.importFn) return;

    this.isUploading = true;
    this.uploadProgress = 0;
    this.result = null;

    // Simulate progress while waiting for response
    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += Math.random() * 15;
        this.cdr.detectChanges();
      }
    }, 200);

    this.importFn(this.selectedFile).subscribe({
      next: (res) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;
        this.isUploading = false;
        this.result = res;
        this.imported.emit(res);
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearInterval(progressInterval);
        this.isUploading = false;
        this.uploadProgress = 0;

        if (err.error && err.error.errors) {
          this.result = err.error;
        } else {
          this.fileError = 'خطا در آپلود فایل. لطفاً دوباره تلاش کنید.';
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
}
