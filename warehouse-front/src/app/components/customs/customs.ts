import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarcodeScannerComponent } from '../../shared/components/barcode-scanner/barcode-scanner.component';

@Component({
  selector: 'app-customs',
  standalone: true,
  imports: [CommonModule, BarcodeScannerComponent],
  template: `
    <div class="h-full flex flex-col max-w-2xl mx-auto w-full p-4 md:p-6" dir="rtl">
      <header class="mb-4">
        <h1 class="text-lg font-black text-slate-800">کارتابل مالی</h1>
        <p class="text-xs text-slate-500 mt-1">کد کالا را با اسکنر یا دوربین وارد کنید</p>
      </header>

      <app-barcode-scanner
        class="block mb-4"
        [autofocus]="true"
        (scanned)="onScanned($event)"
      />

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <span class="text-[10px] text-slate-500 font-bold block mb-1">آخرین کد اسکن‌شده</span>
        <span class="text-lg font-black text-slate-800 font-mono block" dir="ltr">{{ lastCode || '—' }}</span>
      </div>

      <div class="flex-1 overflow-y-auto" *ngIf="scannedCodes.length > 1">
        <span class="text-[10px] text-slate-500 font-bold block mb-2">کدهای اخیر</span>
        <ul class="space-y-1">
          @for (code of scannedCodes; track $index) {
            <li class="bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono text-slate-600" dir="ltr">{{ code }}</li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class Customs {
  lastCode = '';
  scannedCodes: string[] = [];

  onScanned(code: string): void {
    this.lastCode = code;
    this.scannedCodes.unshift(code);
    if (this.scannedCodes.length > 20) this.scannedCodes.pop();
  }
}
