import { Component, Injectable, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// ══════════════════════════════════════════════════
//  Toast Service — Signal-based (جایگزین DOM manipulation)
// ══════════════════════════════════════════════════

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly _toasts = signal<ToastItem[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(type: ToastType, message: string, durationMs = 4000): void {
    const id = this.nextId++;
    this._toasts.update((list) => [...list, { id, type, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  success(message: string): void { this.show('success', message); }
  error(message: string): void { this.show('error', message); }
  warning(message: string): void { this.show('warning', message); }
  info(message: string): void { this.show('info', message); }
}

// ══════════════════════════════════════════════════
//  Toast Component — نمایش Toast‌ها
// ══════════════════════════════════════════════════

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] flex flex-col gap-2 max-w-sm w-full px-4" id="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg text-xs font-bold"
          [ngClass]="toastClasses[toast.type]"
          (click)="toastService.dismiss(toast.id)"
          role="alert"
        >
          <span class="shrink-0" [innerHTML]="toastIcons[toast.type]"></span>
          <p class="flex-1 leading-relaxed">{{ toast.message }}</p>
          <button class="shrink-0 opacity-60 hover:opacity-100 transition-opacity" aria-label="بستن">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast {
      animation: toastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    @keyframes toastSlideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `],
})
export class ToastContainerComponent {
  constructor(public toastService: ToastService) {}

  toastClasses: Record<ToastType, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  };

  toastIcons: Record<ToastType, string> = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };
}
