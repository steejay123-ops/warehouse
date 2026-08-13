import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-smart-delete-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './smart-delete-modal.html',
  styleUrl: './smart-delete-modal.css'
})
export class SmartDeleteModalComponent implements OnInit, OnDestroy {
  @Input() title: string = 'حذف موجودیت';
  @Input() entityName: string = '';
  @Input() deleteImpactUrl: string = '';
  @Input() isSubmitting: boolean = false;
  @Input() errorMessage: string = '';

  @Output() softDelete = new EventEmitter<void>();
  @Output() hardDelete = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  activeTab: 'soft' | 'hard' = 'soft';
  
  isLoadingImpact = false;
  impactData: any[] = [];
  totalAffected = 0;
  
  countdown = 3;
  timerInterval: any;
  confirmationText = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    if (this.deleteImpactUrl) {
      this.fetchImpact();
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  switchTab(tab: 'soft' | 'hard') {
    this.activeTab = tab;
    if (tab === 'hard' && this.countdown > 0 && !this.timerInterval) {
      this.startCountdown();
    }
  }

  fetchImpact() {
    this.isLoadingImpact = true;
    this.http.get<any>(this.deleteImpactUrl).subscribe({
      next: (res) => {
        this.impactData = res.impact || [];
        this.totalAffected = res.total_affected || 0;
        this.isLoadingImpact = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingImpact = false;
        this.cdr.detectChanges();
      }
    });
  }

  startCountdown() {
    this.timerInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.timerInterval);
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  get isHardDeleteEnabled(): boolean {
    return this.countdown <= 0 && this.confirmationText.trim() === 'حذف';
  }

  onSoftDelete() {
    this.softDelete.emit();
  }

  onHardDelete() {
    if (this.isHardDeleteEnabled) {
      this.hardDelete.emit();
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
