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

/**
 * ورودی اسکنر بارکد پیشرفته (موتور کراپ هوشمند کادر هدف + مانیتورینگ زنده)
 *
 * قابلیت‌ها:
 * - موتور پردازش پیوسته کادر هدف (Precision Viewfinder Engine): استخراج متمرکز فریم از کادر هدف روی کانواس بهینه‌شده
 * - دیکود هم‌زمان با دو موتور: BarcodeDetector بومی روی کانواس + BrowserQRCodeReader اختصاصی ZXing با TRY_HARDER
 * - حل قطعی مشکل عدم خوانده شدن در گوشی‌های مختلف و کدهای فوق‌العاده متراکم و فشرده
 * - پنل عیب‌یابی تعاملی (Diagnostic HUD) با دکمه کپی لاگ
 * - کنترل سخت‌افزاری چراغ‌قوه (Torch) و زوم سخت‌افزاری (1x, 2x)
 */
@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="!headless" class="flex items-center gap-2">
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
          class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
        <!-- آیکون بارکد -->
        <svg class="absolute left-3 top-3 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/>
        </svg>
      </div>

      <!-- دکمه کیبورد دستی (موبایل) -->
      <button
        type="button"
        (click)="toggleManualKeyboard()"
        [disabled]="disabled"
        class="p-2.5 rounded-xl transition-colors shadow-sm shrink-0"
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
        class="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm shrink-0"
        title="اسکن با دوربین"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
    </div>

    <!-- Overlay دوربین پیشرفته -->
    <div
      *ngIf="cameraOpen"
      class="fixed inset-0 z-[100] bg-black flex flex-col select-none"
      style="height: 100dvh;"
      dir="rtl"
    >
      <!-- هدر کنترل‌های دوربین -->
      <div
        class="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent"
        style="padding-top: calc(0.75rem + env(safe-area-inset-top));"
      >
        <div class="flex items-center gap-2">
          <!-- دکمه چراغ‌قوه (Torch) -->
          <button
            *ngIf="torchAvailable"
            type="button"
            (click)="toggleTorch()"
            class="p-2.5 rounded-full transition-all flex items-center justify-center shadow-md backdrop-blur-md"
            [ngClass]="torchActive ? 'bg-amber-400 text-slate-900 shadow-amber-400/30' : 'bg-white/20 text-white hover:bg-white/30'"
            title="روشن/خاموش کردن چراغ‌قوه"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </button>

          <!-- دکمه‌های زوم سریع -->
          <div *ngIf="zoomAvailable && maxZoom >= 2" class="flex items-center bg-white/20 backdrop-blur-md rounded-full p-1 border border-white/10">
            <button
              type="button"
              (click)="setZoom(1)"
              class="px-2.5 py-1 text-xs font-bold rounded-full transition-colors"
              [ngClass]="currentZoom <= 1.2 ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white'"
            >
              1X
            </button>
            <button
              type="button"
              (click)="setZoom(2)"
              class="px-2.5 py-1 text-xs font-bold rounded-full transition-colors"
              [ngClass]="currentZoom > 1.2 ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white'"
            >
              2X
            </button>
          </div>

          <!-- دکمه دیباگ HUD -->
          <button
            type="button"
            (click)="toggleDebugHud()"
            class="px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all backdrop-blur-md border shadow-md flex items-center gap-1.5"
            [ngClass]="showDebugHud ? 'bg-emerald-500/90 text-white border-emerald-400 shadow-emerald-500/30' : 'bg-white/20 text-white/90 border-white/20 hover:bg-white/30'"
          >
            <span class="w-2 h-2 rounded-full" [ngClass]="showDebugHud ? 'bg-white animate-ping' : 'bg-emerald-400'"></span>
            دیباگ HUD
          </button>
        </div>

        <!-- دکمه ضربدر بستن بالا -->
        <button
          type="button"
          (click)="closeCamera()"
          class="p-2.5 bg-white/20 text-white hover:bg-white/30 rounded-full transition-all backdrop-blur-md shadow-md"
          title="بستن"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- استریم ویدیو -->
      <video
        #video
        autoplay
        playsinline
        muted
        class="flex-1 w-full h-full object-cover min-h-0"
      ></video>

      <!-- کادر راهنمای هوشمند اسکنر با گوشه‌های هدف‌یاب -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-indigo-400/70 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
          <!-- گوشه‌های برجسته هدف‌یاب -->
          <div class="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
          <div class="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
          <div class="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
          <div class="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-2xl"></div>

          <!-- خط نشانگر لیزری پویا -->
          <div class="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse"></div>
        </div>
      </div>

      <!-- پنل مانیتورینگ و دیباگ زنده (HUD) -->
      <div
        *ngIf="showDebugHud"
        class="absolute top-16 inset-x-3 z-30 bg-slate-950/90 text-white rounded-2xl p-3 border border-emerald-500/40 backdrop-blur-xl shadow-2xl text-[11px] font-mono select-text"
        dir="ltr"
      >
        <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
          <span class="font-bold text-emerald-400 flex items-center gap-1">
            <span>🔬 Precision Crop Scanner HUD</span>
          </span>
          <button
            type="button"
            (click)="copyDiagnosticReport()"
            class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow transition-all active:scale-95 flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>کپی گزارش دیباگ</span>
          </button>
        </div>

        <div class="grid grid-cols-2 gap-x-2 gap-y-1">
          <div><span class="text-slate-400">Stream:</span> <span class="text-amber-300 font-bold">{{ debugInfo.videoRes }}</span></div>
          <div><span class="text-slate-400">Crop Area:</span> <span class="text-emerald-300 font-bold">{{ debugInfo.cropRes }}</span></div>
          <div><span class="text-slate-400">Native Pass:</span> <span class="text-sky-300">{{ debugInfo.nativeFrames }} frames</span></div>
          <div><span class="text-slate-400">ZXing Pass:</span> <span class="text-purple-300">{{ debugInfo.zxingFrames }} frames</span></div>
          <div><span class="text-slate-400">Focus:</span> <span class="text-slate-300">{{ debugInfo.focusMode }}</span></div>
          <div><span class="text-slate-400">FPS:</span> <span class="text-emerald-400 font-bold">{{ debugInfo.fps }}</span></div>
        </div>

        <div class="mt-2 pt-2 border-t border-white/10 text-[10px]">
          <div><span class="text-slate-400">Native Status:</span> <span class="text-sky-300 truncate inline-block max-w-[240px]">{{ debugInfo.lastNativeStatus }}</span></div>
          <div><span class="text-slate-400">ZXing Status:</span> <span class="text-purple-300 truncate inline-block max-w-[240px]">{{ debugInfo.lastZxingStatus }}</span></div>
        </div>
      </div>

      <!-- فوتر و راهنمای اسکن -->
      <div
        class="absolute bottom-0 inset-x-0 flex flex-col items-center gap-3 pb-6 px-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
        style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));"
      >
        <p class="text-white/90 text-xs font-semibold bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
          کد دوبعدی (QR / DataMatrix) را مقابل کادر بگیرید
        </p>
        <button
          type="button"
          (click)="closeCamera()"
          class="bg-white hover:bg-slate-100 text-slate-900 px-8 py-3 rounded-2xl text-sm font-bold shadow-xl transition-all active:scale-95"
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
  /** حالت بدون اینپوت (فقط برای راه‌اندازی دوربین و هندل کردن اسکن‌ها) */
  @Input() headless = false;
  /** بازه نادیده‌گرفتن اسکن تکراری (میلی‌ثانیه) */
  @Input() duplicateWindowMs = 2000;

  /** کد نرمال‌شده اسکن/تایپ‌شده */
  @Output() scanned = new EventEmitter<string>();

  @ViewChild('scanInput') scanInput?: ElementRef<HTMLInputElement>;
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  value = '';
  cameraOpen = false;
  manualKeyboard = false;
  showDebugHud = false; // پیش‌فرض بسته برای داشتن محیط کاربری تمیز

  // وضعیت‌های سخت‌افزاری دوربین
  torchAvailable = false;
  torchActive = false;
  zoomAvailable = false;
  minZoom = 1;
  maxZoom = 1;
  currentZoom = 1;

  // اطلاعات مانیتورینگ زنده (Debug Info)
  debugInfo = {
    videoRes: '0x0',
    cropRes: '0x0',
    readyState: 0,
    nativeSupported: false,
    nativeFormats: [] as string[],
    nativeFrames: 0,
    lastNativeStatus: 'Waiting...',
    zxingFrames: 0,
    lastZxingStatus: 'Initializing...',
    trackLabel: '',
    focusMode: 'N/A',
    zoomRange: '1x',
    fps: 0,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };

  private lastCode = '';
  private lastAt = 0;

  // منابع دوربین و حلقه پردازش کادر هدف
  private mediaStream: MediaStream | null = null;
  private scanLoopTimer: any = null;
  private cropCanvas: HTMLCanvasElement | null = null;
  private cropCtx: CanvasRenderingContext2D | null = null;

  // دیکودرهای پیش‌بارگذاری‌شده
  private nativeDetector: any = null;
  private zxingQrReader: any = null;
  private zxingMultiReader: any = null;
  private frameCounter = 0;
  private fpsTimer: any = null;

  /**
   * قیدهای اپتیمال تصویر: رزولوشن ۱۰۸۰p با سقف شناور ۲K (۱۴۴۰p)
   */
  private static readonly VIDEO_CONSTRAINTS: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920, max: 2560 },
      height: { ideal: 1080, max: 1440 },
    },
    audio: false,
  };

  constructor(private toast: ToastService, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (this.autofocus) this.focusInput();
  }

  ngOnDestroy(): void {
    this.closeCamera();
  }

  /** تبدیل ارقام فارسی/عربی به لاتین + حذف کاراکترهای اضافه */
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

  toggleDebugHud(): void {
    this.showDebugHud = !this.showDebugHud;
    this.cdr.detectChanges();
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
  //  موتور پردازش پیوسته کادر هدف (Precision Viewfinder Engine)
  // ════════════════════════════════════════════

  async openCamera(): Promise<void> {
    if (this.cameraOpen) return;
    this.cameraOpen = true;
    this.torchActive = false;
    this.currentZoom = 1;
    this.debugInfo.nativeFrames = 0;
    this.debugInfo.zxingFrames = 0;
    this.debugInfo.fps = 0;
    this.debugInfo.lastNativeStatus = 'Starting...';
    this.debugInfo.lastZxingStatus = 'Starting...';
    this.cdr.detectChanges();

    await Promise.resolve();

    const video = this.videoRef?.nativeElement;
    if (!video) {
      this.closeCamera();
      return;
    }

    try {
      // ۱. راه‌اندازی استریم ویدیو با رزولوشن ۱۰۸۰p
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(BarcodeScannerComponent.VIDEO_CONSTRAINTS);
      } catch (constraintErr) {
        console.warn('[BarcodeScanner] فال‌بک به قیدهای ساده دوربین:', constraintErr);
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      }

      await this.initCameraCapabilities(this.mediaStream);

      video.srcObject = this.mediaStream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      await video.play();

      // ۲. مقداردهی اولیه دیکودرها و کانواس کراپ
      await this.initDecoders();

      // ۳. راه‌اندازی حلقه اسکن فوق‌سریع کادر هدف
      this.startPrecisionScanLoop(video);
    } catch (err: any) {
      this.closeCamera();
      if (err?.name === 'NotAllowedError') {
        this.toast.error('دسترسی به دوربین رد شد. از تنظیمات مرورگر مجوز دوربین را فعال کنید');
      } else if (err?.name === 'NotFoundError') {
        this.toast.error('دوربینی روی این دستگاه یافت نشد');
      } else {
        console.error('[BarcodeScanner] خطای راه‌اندازی دوربین:', err);
        this.toast.error('خطا در راه‌اندازی دوربین');
      }
    }
  }

  closeCamera(): void {
    if (this.scanLoopTimer) {
      clearInterval(this.scanLoopTimer);
      this.scanLoopTimer = null;
    }
    if (this.fpsTimer) {
      clearInterval(this.fpsTimer);
      this.fpsTimer = null;
    }

    this.cropCanvas = null;
    this.cropCtx = null;
    this.nativeDetector = null;
    this.zxingQrReader = null;
    this.zxingMultiReader = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.mediaStream = null;
    }

    const video = this.videoRef?.nativeElement;
    if (video?.srcObject) {
      try {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      } catch {}
      video.srcObject = null;
    }

    this.cameraOpen = false;
    this.torchAvailable = false;
    this.torchActive = false;
    this.zoomAvailable = false;
    this.cdr.detectChanges();
  }

  private async initDecoders(): Promise<void> {
    // الف) آماده‌سازی BarcodeDetector بومی
    try {
      if ('BarcodeDetector' in window) {
        const supported: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
        this.debugInfo.nativeSupported = true;
        this.debugInfo.nativeFormats = supported;
        const formats = ['qr_code', 'data_matrix', 'aztec', 'pdf417', 'code_128', 'ean_13'].filter((f) =>
          supported.includes(f)
        );
        if (formats.length > 0) {
          this.nativeDetector = new (window as any).BarcodeDetector({ formats });
        }
      }
    } catch {
      this.debugInfo.nativeSupported = false;
    }

    // ب) آماده‌سازی موتورهای تخصصی ZXing با TRY_HARDER
    try {
      const [{ BrowserQRCodeReader, BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] =
        await Promise.all([import('@zxing/browser'), import('@zxing/library')]);

      const qrHints = new Map<any, any>();
      qrHints.set(DecodeHintType.TRY_HARDER, true);
      this.zxingQrReader = new BrowserQRCodeReader(qrHints);

      const multiHints = new Map<any, any>();
      multiHints.set(DecodeHintType.TRY_HARDER, true);
      multiHints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.AZTEC,
        BarcodeFormat.PDF_417,
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
      ]);
      this.zxingMultiReader = new BrowserMultiFormatReader(multiHints);
      this.debugInfo.lastZxingStatus = 'Engine Ready (TRY_HARDER Active)';
    } catch (e: any) {
      this.debugInfo.lastZxingStatus = `ZXing Load Error: ${e?.message || e}`;
    }

    // ج) ساخت بستر کانواس کراپ کادر هدف (رزولوشن متمرکز ۸۵۰×۸۵۰)
    this.cropCanvas = document.createElement('canvas');
    this.cropCanvas.width = 850;
    this.cropCanvas.height = 850;
    this.cropCtx = this.cropCanvas.getContext('2d', { willReadFrequently: true });
    this.debugInfo.cropRes = '850x850 (High-Density ROI)';
  }

  /** اجرای حلقه اسکن بلادرنگ روی کادر مرکزی ویدیو */
  private startPrecisionScanLoop(video: HTMLVideoElement): void {
    let busy = false;
    this.frameCounter = 0;

    // تایمر محاسبه FPS
    this.fpsTimer = setInterval(() => {
      this.debugInfo.fps = this.frameCounter;
      this.frameCounter = 0;
      if (video) {
        this.debugInfo.videoRes = `${video.videoWidth || 0}x${video.videoHeight || 0}`;
      }
      this.cdr.detectChanges();
    }, 1000);

    // حلقه اسکن با فرکانس بالا (هر ۶۰ میلی‌ثانیه)
    this.scanLoopTimer = setInterval(async () => {
      if (busy || !this.cameraOpen || video.readyState < 2 || !this.cropCanvas || !this.cropCtx) return;
      busy = true;
      this.frameCounter++;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw === 0 || vh === 0) {
        busy = false;
        return;
      }

      // محاسبه مختصات دقیق کادر مربع مرکزی
      // ۷۵٪ بعد کوچکتر تصویر (بزرگترین کادر هدف بدون نویز محیط)
      const cropSize = Math.round(Math.min(vw, vh) * 0.75);
      const sx = Math.round((vw - cropSize) / 2);
      const sy = Math.round((vh - cropSize) / 2);

      // استخراج کادر هدف و رسم با کیفیت بالا روی کانواس ۸۵۰×۸۵۰
      this.cropCtx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 850, 850);

      // ۱. پاس اول: موتور بومی BarcodeDetector روی کانواس کراپ‌شده
      if (this.nativeDetector) {
        this.debugInfo.nativeFrames++;
        try {
          const codes = await this.nativeDetector.detect(this.cropCanvas);
          if (codes.length > 0 && codes[0].rawValue && this.cameraOpen) {
            this.debugInfo.lastNativeStatus = `SUCCESS: ${codes[0].rawValue}`;
            this.onCameraDecoded(codes[0].rawValue);
            busy = false;
            return;
          } else {
            this.debugInfo.lastNativeStatus = 'Active Search';
          }
        } catch (e: any) {
          this.debugInfo.lastNativeStatus = `Native Err: ${e?.message || e}`;
        }
      }

      // ۲. پاس دوم: موتور تخصصی QR کد ZXing با الگوریتم HybridBinarizer
      if (this.zxingQrReader && this.cameraOpen) {
        this.debugInfo.zxingFrames++;
        try {
          const result = await this.zxingQrReader.decodeFromCanvas(this.cropCanvas);
          if (result && result.getText() && this.cameraOpen) {
            this.debugInfo.lastZxingStatus = `SUCCESS: ${result.getText()}`;
            this.onCameraDecoded(result.getText());
            busy = false;
            return;
          }
        } catch (e: any) {
          // در صورت عدم یافتن الگو در این فریم، خطا را نرمال کن
          this.debugInfo.lastZxingStatus = 'Searching (Refining Grid)';
        }
      }

      // ۳. پاس سوم (نوبتی): بررسی کدهای DataMatrix و بارکدهای خطی
      if (this.zxingMultiReader && this.frameCounter % 3 === 0 && this.cameraOpen) {
        try {
          const multiResult = await this.zxingMultiReader.decodeFromCanvas(this.cropCanvas);
          if (multiResult && multiResult.getText() && this.cameraOpen) {
            this.debugInfo.lastZxingStatus = `SUCCESS: ${multiResult.getText()}`;
            this.onCameraDecoded(multiResult.getText());
            busy = false;
            return;
          }
        } catch {}
      }

      busy = false;
    }, 60);
  }

  private onCameraDecoded(text: string): void {
    if (!this.cameraOpen) return;
    this.triggerScanFeedback();
    this.closeCamera();
    this.handleCode(text);
  }

  /** بازخورد هپتیک (لرزش ملایم) و بیپ صوتی آرام هنگام اسکن موفق */
  private triggerScanFeedback(): void {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40]);
      }
    } catch {}

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch {}
  }

  /** استخراج توانمندی‌های سخت‌افزاری دوربین (چراغ‌قوه، زوم و فوکوس پیوسته) */
  private async initCameraCapabilities(stream: MediaStream): Promise<void> {
    try {
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      this.debugInfo.trackLabel = track.label || 'Video Track';
      const caps: any = track.getCapabilities?.() || {};

      // ۱. فوکوس پیوسته و تراز نور
      const advancedConstraints: any = {};
      if (caps?.focusMode?.includes?.('continuous')) {
        advancedConstraints.focusMode = 'continuous';
        this.debugInfo.focusMode = 'continuous';
      } else {
        this.debugInfo.focusMode = caps?.focusMode?.[0] || 'auto';
      }
      if (caps?.exposureMode?.includes?.('continuous')) {
        advancedConstraints.exposureMode = 'continuous';
      }
      if (caps?.whiteBalanceMode?.includes?.('continuous')) {
        advancedConstraints.whiteBalanceMode = 'continuous';
      }
      if (Object.keys(advancedConstraints).length > 0) {
        try {
          await track.applyConstraints({ advanced: [advancedConstraints] });
        } catch {}
      }

      // ۲. شناسایی چراغ‌قوه (Torch)
      this.torchAvailable = Boolean(caps.torch);

      // ۳. شناسایی زوم سخت‌افزاری
      if (caps.zoom) {
        this.zoomAvailable = true;
        this.minZoom = caps.zoom.min || 1;
        this.maxZoom = caps.zoom.max || 1;
        this.currentZoom = track.getSettings?.()?.zoom || 1;
        this.debugInfo.zoomRange = `${this.minZoom}x - ${this.maxZoom}x`;
      }
      this.cdr.detectChanges();
    } catch {}
  }

  async toggleTorch(): Promise<void> {
    if (!this.torchAvailable) return;
    const track = this.mediaStream?.getVideoTracks()[0];
    if (!track) return;
    try {
      this.torchActive = !this.torchActive;
      await track.applyConstraints({ advanced: [{ torch: this.torchActive } as any] });
      this.cdr.detectChanges();
    } catch {
      this.torchActive = false;
      this.cdr.detectChanges();
    }
  }

  async setZoom(level: number): Promise<void> {
    if (!this.zoomAvailable) return;
    const track = this.mediaStream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const targetZoom = Math.min(Math.max(level, this.minZoom), this.maxZoom);
      this.currentZoom = targetZoom;
      await track.applyConstraints({ advanced: [{ zoom: targetZoom } as any] });
      this.cdr.detectChanges();
    } catch {}
  }

  /** کپی گزارش جامع دیاگنوستیک در کلیپ‌بورد جهت ارسال در چت */
  copyDiagnosticReport(): void {
    const report = `
=== BARCODE SCANNER DIAGNOSTIC REPORT ===
Timestamp: ${new Date().toISOString()}
Video Resolution: ${this.debugInfo.videoRes}
Crop Area: ${this.debugInfo.cropRes}
FPS: ${this.debugInfo.fps}
Track Label: ${this.debugInfo.trackLabel}
Focus Mode: ${this.debugInfo.focusMode}
Zoom: ${this.debugInfo.zoomRange} (Current: ${this.currentZoom}x)
Torch Available: ${this.torchAvailable}

Native BarcodeDetector:
- Supported: ${this.debugInfo.nativeSupported}
- Frames Processed: ${this.debugInfo.nativeFrames}
- Last Status: ${this.debugInfo.lastNativeStatus}

ZXing Engine:
- Frames Processed: ${this.debugInfo.zxingFrames}
- Last Status: ${this.debugInfo.lastZxingStatus}

User Agent: ${this.debugInfo.userAgent}
=========================================
`.trim();

    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(report).then(() => {
          this.toast.success('گزارش دیباگ کپی شد!');
        });
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = report;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.toast.success('گزارش دیباگ کپی شد!');
      }
    } catch {
      this.toast.error('خطا در کپی گزارش');
    }
  }
}
