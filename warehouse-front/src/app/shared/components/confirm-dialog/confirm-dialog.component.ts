import { Component, Injectable, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// ══════════════════════════════════════════════════
//  ConfirmDialog Service — جایگزین confirm() مرورگر
// ══════════════════════════════════════════════════

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  extraText?: string;
  type?: 'danger' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _config = signal<ConfirmDialogConfig | null>(null);
  private resolveRef: ((result: boolean | string) => void) | null = null;

  readonly config = this._config.asReadonly();
  readonly isOpen = () => this._config() !== null;

  /**
   * نمایش دیالوگ تایید — Promise برمی‌گرداند
   *
   * const confirmed = await this.confirm.open({
   *   title: 'حذف نقش',
   *   message: 'آیا مطمئنید؟',
   *   type: 'danger'
   * });
   */
  open(config: ConfirmDialogConfig): Promise<boolean | string> {
    this._config.set({
      confirmText: 'تایید',
      cancelText: 'انصراف',
      type: 'warning',
      ...config,
    });
    return new Promise((resolve) => {
      this.resolveRef = resolve;
    });
  }

  confirm(): void {
    this.resolveRef?.(true);
    this.close();
  }

  cancel(): void {
    this.resolveRef?.(false);
    this.close();
  }

  extra(): void {
    this.resolveRef?.('extra');
    this.close();
  }

  private close(): void {
    this._config.set(null);
    this.resolveRef = null;
  }
}

// ══════════════════════════════════════════════════
//  ConfirmDialog Component
// ══════════════════════════════════════════════════

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (dialog.isOpen()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="dialog.cancel()"></div>
        <div class="confirm-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <!-- Icon -->
          <div class="pt-6 flex justify-center">
            <div
              class="w-14 h-14 rounded-full flex items-center justify-center"
              [ngClass]="iconBgClass"
            >
              <span [innerHTML]="icon"></span>
            </div>
          </div>

          <!-- Content -->
          <div class="px-6 pt-4 pb-2 text-center">
            <h3 class="text-sm font-black text-slate-800 mb-2">{{ config()?.title }}</h3>
            <p class="text-xs text-slate-500 leading-relaxed" [innerHTML]="config()?.message"></p>
          </div>

          <!-- Actions -->
          <div class="px-6 pb-6 pt-4 flex flex-col sm:flex-row items-center gap-2">
            <button
              (click)="dialog.cancel()"
              class="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              {{ config()?.cancelText }}
            </button>
            
            @if (config()?.extraText) {
              <button
                (click)="dialog.extra()"
                class="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                {{ config()?.extraText }}
              </button>
            }

            <button
              (click)="dialog.confirm()"
              class="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-colors"
              [ngClass]="confirmBtnClass"
            >
              {{ config()?.confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-panel {
      animation: confirmIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes confirmIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
  `],
})
export class ConfirmDialogComponent {
  constructor(public dialog: ConfirmDialogService) {}

  get config() { return this.dialog.config; }

  get iconBgClass(): string {
    const type = this.config()?.type ?? 'warning';
    return {
      danger: 'bg-rose-100 text-rose-500',
      warning: 'bg-amber-100 text-amber-500',
      info: 'bg-blue-100 text-blue-500',
    }[type];
  }

  get confirmBtnClass(): string {
    const type = this.config()?.type ?? 'warning';
    return {
      danger: 'bg-rose-500 hover:bg-rose-600',
      warning: 'bg-amber-500 hover:bg-amber-600',
      info: 'bg-blue-500 hover:bg-blue-600',
    }[type];
  }

  get icon(): string {
    const type = this.config()?.type ?? 'warning';
    const icons: Record<string, string> = {
      danger: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };
    return icons[type];
  }
}
