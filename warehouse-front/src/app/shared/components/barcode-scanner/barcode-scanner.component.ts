import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../toast/toast.component';
import type { IScannerControls } from '@zxing/browser';

/**
 * ورودی اسکنر بارکد — پشتیبانی از بارکدخوان سخت‌افزاری (keyboard-wedge) و دوربین
 *
 * استفاده:
 *   <app-barcode-scanner
 *     [autofocus]="true"
 *     (scanned)="onScanned($event)"
 *   />
 *
 * - ورودی متنی با inputmode="none" → اسکنر سخت‌افزاری تایپ می‌کند ولی کیبورد لمسی باز نمی‌شود؛
 *   دکمه کیبورد کنار فیلد برای ورود دستی (بارکد مخدوش) inputmode را به text تغییر می‌دهد.
 * - دوربین: اول BarcodeDetector بومی (اگر qr_code را پشتیبانی کند)، وگرنه lazy-import از zxing/browser‌@
 */
@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex items-center gap-2">
      <!-- ورودی اسکن -->
      <div class="relative flex-1">
        <input
          #scanInput
          type="text"
          [(ngModel)]="value"
          (keydown.enter)="onEnter($event)"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [attr.inputmode]="manualKeyboard ? 'text' : 'none'"
          dir="ltr"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-3 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
        <!-- آیکون بارکد -->
        <svg class="absolute left-3 top-3.5 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/>
        </svg>
      </div>

      <!-- دکمه کیبورد دستی (موبایل) -->
      <button
        type="button"
        (click)="toggleManualKeyboard()"
        [disabled]="disabled"
        class="p-3 rounded-xl transition-colors shadow-sm shrink-0"
        [ngClass]="manualKeyboard ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
        title="ورود دستی کد (باز شدن کیبورد)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>
        </svg>
      </button>

      <!-- دکمه دوربین -->
      <button
        type="button"
        (click)="openCamera()"
        [disabled]="disabled || cameraOpen"
        class="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm shrink-0"
        title="اسکن با دوربین"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
    </div>

    <!-- Overlay دوربین -->
    <div
      *ngIf="cameraOpen"
      class="fixed inset-0 z-[100] bg-black flex flex-col"
      style="height: 100dvh;"
      dir="rtl"
    >
      <video #video autoplay playsinline muted class="flex-1 w-full object-cover min-h-0"></video>

      <!-- کادر راهنما -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-56 h-56 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"></div>
      </div>

      <div
        class="absolute bottom-0 inset-x-0 flex flex-col items-center gap-3 pb-4"
        style="padding-bottom: calc(1rem + env(safe-area-inset-bottom));"
      >
        <p class="text-white/90 text-xs font-bold bg-black/50 px-4 py-2 rounded-xl">
          QR کد روی برچسب کالا را مقابل دوربین بگیرید
        </p>
        <button
          type="button"
          (click)="closeCamera()"
          class="bg-white text-slate-800 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg"
        >
          بستن دوربین
        </button>
      </div>
    </div>
  `,
})
export class BarcodeScannerComponent implements AfterViewInit, OnDestroy {
  @Input() placeholder = 'اسکن بارکد یا ورود کد کالا...';
  @Input() autofocus = false;
  @Input() disabled = false;
  /** بازه نادیده‌گرفتن اسکن تکراری (میلی‌ثانیه) */
  @Input() duplicateWindowMs = 2000;

  /** کد نرمال‌شده اسکن/تایپ‌شده */
  @Output() scanned = new EventEmitter<string>();

  @ViewChild('scanInput') scanInput?: ElementRef<HTMLInputElement>;
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  value = '';
  cameraOpen = false;
  manualKeyboard = false;

  private lastCode = '';
  private lastAt = 0;

  // منابع دوربین
  private mediaStream: MediaStream | null = null;
  private detectTimer: any = null;
  private zxingControls: IScannerControls | null = null;

  constructor(private toast: ToastService, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (this.autofocus) this.focusInput();
  }

  ngOnDestroy(): void {
    this.closeCamera();
  }

  /** تبدیل ارقام فارسی/عربی به لاتین + حذف CR/LF/Tab و فاصله‌های اضافه */
  static normalize(raw: string): string {
    let s = (raw || '').replace(/[\r\n\t]/g, ' ');
    s = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    s = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    return s.replace(/\s+/g, ' ').trim();
  }

  focusInput(): void {
    setTimeout(() => this.scanInput?.nativeElement?.focus(), 0);
  }

  toggleManualKeyboard(): void {
    this.manualKeyboard = !this.manualKeyboard;
    this.focusInput();
  }

  onEnter(event: Event): void {
    event.preventDefault();
    this.handleCode(this.value);
    this.value = '';
    this.focusInput();
  }

  private handleCode(raw: string): void {
    const code = BarcodeScannerComponent.normalize(raw);
    if (!code) return;

    const now = Date.now();
    if (code === this.lastCode && now - this.lastAt < this.duplicateWindowMs) return;
    this.lastCode = code;
    this.lastAt = now;

    this.scanned.emit(code);
  }

  // ════════════════════════════════════════════
  //  دوربین
  // ════════════════════════════════════════════

  async openCamera(): Promise<void> {
    if (this.cameraOpen) return;
    this.cameraOpen = true;
    this.cdr.detectChanges();

    // یک microtask صبر می‌کنیم تا Angular view query را پس از *ngIf آپدیت کند
    await Promise.resolve();

    const video = this.videoRef?.nativeElement;
    if (!video) {
      this.closeCamera();
      return;
    }

    try {
      if (await this.nativeDetectorSupported()) {
        await this.startNativeDetector(video);
      } else {
        await this.startZxing(video);
      }
    } catch (err: any) {
      this.closeCamera();
      if (err?.name === 'NotAllowedError') {
        this.toast.error('دسترسی به دوربین رد شد. از تنظیمات مرورگر مجوز دوربین را فعال کنید');
      } else if (err?.name === 'NotFoundError') {
        this.toast.error('دوربینی روی این دستگاه یافت نشد');
      } else {
        console.error('[BarcodeScanner] خطای دوربین:', err);
        this.toast.error('خطا در راه‌اندازی دوربین');
      }
    }
  }

  closeCamera(): void {
    if (this.detectTimer) {
      clearInterval(this.detectTimer);
      this.detectTimer = null;
    }
    // بستن حلقه decode کتابخانه zxing (توقف trackها به تنهایی کافی نیست)
    this.zxingControls?.stop();
    this.zxingControls = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    // zxing خودش stream می‌سازد؛ srcObject ویدیو را هم پاک کن
    const video = this.videoRef?.nativeElement;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    this.cameraOpen = false;
    this.cdr.detectChanges();
  }

  private onCameraDecoded(text: string): void {
    this.closeCamera();
    this.handleCode(text);
  }

  private async nativeDetectorSupported(): Promise<boolean> {
    try {
      if (!('BarcodeDetector' in window)) return false;
      const formats: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
      return formats.includes('qr_code');
    } catch {
      return false;
    }
  }

  /**
   * قیدهای دوربین: رزولوشن بالا برای QRهای متراکم (پیش‌فرض مرورگر 640×480 است
   * و ماژول‌های ریز حل نمی‌شوند) — مرورگر خودش به بیشینه توان سخت‌افزار محدود می‌کند.
   */
  private static readonly VIDEO_CONSTRAINTS: MediaTrackConstraints = {
    facingMode: 'environment',
    width: { ideal: 2560 },
    height: { ideal: 1440 },
  };

  /** فوکوس پیوسته (اگر دستگاه پشتیبانی کند) — برای وضوح ماژول‌های ریز */
  private async applyContinuousFocus(stream: MediaStream): Promise<void> {
    try {
      const track = stream.getVideoTracks()[0];
      const caps: any = track?.getCapabilities?.();
      if (caps?.focusMode?.includes?.('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
      }
    } catch {
      /* اختیاری — اگر پشتیبانی نشد مهم نیست */
    }
  }

  private async startNativeDetector(video: HTMLVideoElement): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: BarcodeScannerComponent.VIDEO_CONSTRAINTS,
      audio: false,
    });
    await this.applyContinuousFocus(this.mediaStream);
    video.srcObject = this.mediaStream;
    await video.play();

    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    let busy = false;
    this.detectTimer = setInterval(async () => {
      if (busy || !this.cameraOpen || video.readyState < 2) return;
      busy = true;
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0 && codes[0].rawValue) {
          this.onCameraDecoded(codes[0].rawValue);
        }
      } catch {
        /* فریم خراب — ادامه بده */
      } finally {
        busy = false;
      }
    }, 200);
  }

  private async startZxing(video: HTMLVideoElement): Promise<void> {
    const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);
    // TRY_HARDER: تلاش بیشتر برای کدهای متراکم/کج به قیمت CPU بیشتر
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserQRCodeReader(hints);
    this.zxingControls = await reader.decodeFromConstraints(
      { video: BarcodeScannerComponent.VIDEO_CONSTRAINTS, audio: false },
      video,
      (result) => {
        if (result && this.cameraOpen) {
          this.onCameraDecoded(result.getText());
        }
      }
    );
    if (video.srcObject) {
      await this.applyContinuousFocus(video.srcObject as MediaStream);
    }
  }
}
