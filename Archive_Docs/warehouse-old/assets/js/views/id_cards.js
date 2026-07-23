// =========================================================================
// ====== VIEW: ID CARDS & GATE PASS (صدور کارت پرسنلی و گیت‌پاس) ======
// =========================================================================

let idCardSettings = {
  dataSource: 'db', 
  cardType: 'pvc-vertical', 
  expiryDays: 0,
  fields: { role: true, nationalCode: true, projects: true, qr: true, expiry: true }
};

function getIdCards() {
  const users = appState.users || [];
  
  return `
  <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 fade-in text-right pb-10">
    
    <!-- ستون تنظیمات (کنترل پنل) -->
    <div class="xl:col-span-5 space-y-5">
      
      <!-- ۱. منبع داده و آپلود -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-100 p-4">
          <h3 class="font-black text-slate-800 text-sm flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ۱. تغذیه اطلاعات پرسنلی و اعتبار
          </h3>
        </div>
        
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <label class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${idCardSettings.dataSource === 'db' ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300'}" onclick="toggleIdDataSource('db', this)">
              <input type="radio" name="id_source" checked class="mt-0.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
              <div>
                <span class="block text-xs font-bold ${idCardSettings.dataSource === 'db' ? 'text-indigo-900' : 'text-slate-700'}">دیتابیس سیستم</span>
                <span class="block text-[9px] text-slate-500 mt-1">پرسنل ثبت شده (${users.length} نفر)</span>
              </div>
            </label>
            
            <label class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${idCardSettings.dataSource === 'external' ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300'}" onclick="toggleIdDataSource('external', this)">
              <input type="radio" name="id_source" class="mt-0.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
              <div>
                <span class="block text-xs font-bold ${idCardSettings.dataSource === 'external' ? 'text-indigo-900' : 'text-slate-700'}">پیمانکار / فایل خارجی</span>
                <span class="block text-[9px] text-slate-500 mt-1">آپلود اکسل و عکس گروهی</span>
              </div>
            </label>
          </div>

          <!-- تنظیمات حالت دیتابیس (تاریخ انقضای سراسری) -->
          <div id="id-db-settings" class="mt-4 pt-4 border-t border-slate-100">
             <label class="block text-[11px] font-bold text-slate-600 mb-2">اعتبار گیت‌پاس (تعداد روز از امروز)</label>
             <input type="number" id="db_expiry_input" value="0" min="0" oninput="updateLiveExpiry(this.value)" placeholder="مثال: 45 (اگر 0 باشد: تا پایان پروژه)" class="w-full text-center px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-all">
             <p class="text-[9px] text-slate-400 mt-1.5 text-center">عدد ۰ معادل «تا پایان پروژه» محاسبه می‌شود.</p>
          </div>

          <!-- باکس آپلود فایل خارجی -->
          <div id="id-external-box" class="hidden space-y-3 mt-4 pt-4 border-t border-slate-100">
            <div class="flex gap-3">
              <button onclick="simulateIdExcelUpload()" class="flex-1 py-4 bg-slate-50 border border-slate-300 border-dashed rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex flex-col items-center gap-1.5">
                <span class="text-xl">📄</span> آپلود اکسل اسامی
              </button>
              <button class="flex-1 py-4 bg-slate-50 border border-slate-300 border-dashed rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors flex flex-col items-center gap-1.5">
                <span class="text-xl">🗂️</span> فایل ZIP تصاویر
              </button>
            </div>
            
            <!-- مپینگ فیلدهای اکسل -->
            <div id="id-mapping-section" class="hidden bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2">
              <p class="text-[10px] font-black text-indigo-700 mb-3 flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg> تخصیص ستون‌های فایل (Mapping)</p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[9px] font-bold text-slate-600 mb-1">نام و نام خانوادگی</label>
                  <select class="w-full px-2 py-1.5 text-[10px] rounded border border-slate-300 outline-none" id="map-id-name"></select>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-600 mb-1">کد ملی (National ID)</label>
                  <select class="w-full px-2 py-1.5 text-[10px] rounded border border-slate-300 outline-none" id="map-id-nid"></select>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-600 mb-1">سمت / نقش</label>
                  <select class="w-full px-2 py-1.5 text-[10px] rounded border border-slate-300 outline-none" id="map-id-role"></select>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-600 mb-1">اعتبار به روز (انقضا)</label>
                  <select class="w-full px-2 py-1.5 text-[10px] rounded border border-slate-300 outline-none" id="map-id-expiry"></select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ۲. نوع کارت و چیدمان -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-100 p-4">
          <h3 class="font-black text-slate-800 text-sm flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><circle cx="12" cy="11" r="3"/><path d="M17 18c0-2.2-2.2-4-5-4s-5 1.8-5 4"/></svg>
            ۲. قالب کارت و اطلاعات چاپی
          </h3>
        </div>
        
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-2">نوع کارت (Template)</label>
            <div class="grid grid-cols-2 gap-3">
              <button onclick="updateCardFormat('pvc-vertical', this)" class="card-format-btn border-2 border-indigo-500 bg-indigo-50 text-indigo-700 text-xs font-bold py-2.5 rounded-xl transition-all">کارت پرسنلی عمودی</button>
              <button onclick="updateCardFormat('badge-horizontal', this)" class="card-format-btn border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold py-2.5 rounded-xl transition-all">گیت‌پاس تردد افقی</button>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-4 space-y-3">
            <label class="block text-[11px] font-bold text-slate-500 mb-2">اطلاعات نمایشی روی کارت</label>
            ${renderIdCheckbox('role', 'عنوان شغلی / نقش سازمانی', true)}
            ${renderIdCheckbox('nationalCode', 'کد ملی (National ID)', true)}
            ${renderIdCheckbox('projects', 'زون‌های مجاز تردد (انبارها)', true)}
            ${renderIdCheckbox('expiry', 'چاپ تاریخ اعتبار (انقضا)', true)}
            ${renderIdCheckbox('qr', 'تولید هوشمند QR Code اصالت‌سنجی', true)}
          </div>
        </div>
      </div>
      
      <button onclick="executeCardPrint()" class="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex justify-center items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        ارسال به پرینتر (چیدمان خودکار در A4)
      </button>

    </div>

    <!-- ستون پیش‌نمایش زنده -->
    <div class="xl:col-span-7">
      <div class="bg-slate-100/80 rounded-3xl border-2 border-dashed border-slate-300 shadow-inner p-6 md:p-10 h-full flex flex-col relative min-h-[500px] overflow-hidden">
        
        <div class="flex items-center justify-between mb-8 z-20">
          <h3 class="font-black text-slate-700 text-sm">پیش‌نمایش زنده کارت (Live Preview)</h3>
          <span class="px-3 py-1 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold animate-pulse">ابعاد استاندارد 86×54</span>
        </div>
        
        <!-- بوم پیش‌نمایش مرکزی -->
        <div class="flex-1 flex items-center justify-center relative z-10" id="card-preview-canvas">
          ${renderVerticalPvcCard()}
        </div>
        
      </div>
    </div>
    
  </div>`;
}

// ------ محاسبه تاریخ انقضا ------
function calculateExpiryString(days) {
  const d = parseInt(days) || 0;
  if (d === 0) return 'تا پایان پروژه';
  const future = new Date();
  future.setDate(future.getDate() + d);
  return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(future);
}

// ------ رندر کارت‌ها ------

function renderVerticalPvcCard() {
  const activeUser = appState.users[0] || { firstName: 'سامان', lastName: 'تقوی سوق', nationalCode: '1280954310', projects: ['PRJ-01', 'PRJ-02'], avatar: 'س' };
  const role = appState.roles.find(r => r.id === activeUser.roleId) || { title: 'مدیریت کل', color: '#4f46e5' };
  const expiryText = calculateExpiryString(idCardSettings.expiryDays);
  
  return `
    <div id="live-card-preview" class="bg-white rounded-[16px] shadow-2xl overflow-hidden transition-all duration-300 w-[240px] h-[380px] border border-slate-200 relative flex flex-col ring-8 ring-white ring-opacity-40" style="aspect-ratio: 54/86;">
      
      <!-- هدر و لوگو با فونت وزیر -->
      <div class="h-24 w-full flex flex-col items-center justify-start pt-3 text-white relative overflow-hidden" style="background: linear-gradient(135deg, ${role.color}, #1e293b)">
        <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 12px 12px;"></div>
        <div class="relative z-10 flex flex-col items-center">
          <span class="text-xl font-black font-vazir tracking-widest text-white/95 drop-shadow-md">فارس عــالیش</span>
          <span class="text-[7px] font-bold tracking-widest opacity-80 mt-0.5">FARS AALISH CO. - REG: 420</span>
        </div>
      </div>

      <!-- عکس پرسنلی (با حاشیه امن از متن بالا) -->
      <div class="flex justify-center -mt-8 relative z-20">
        <div class="w-20 h-24 bg-slate-50 rounded-xl border-4 border-white shadow-md flex items-center justify-center text-4xl font-black text-slate-300 overflow-hidden bg-cover bg-center">
          ${activeUser.avatar}
        </div>
      </div>

      <!-- اطلاعات هویتی -->
      <div class="flex-1 flex flex-col items-center px-4 pt-2 pb-4 text-center">
        <h2 class="font-black font-vazir text-slate-800 text-lg leading-tight w-full truncate">${activeUser.firstName} ${activeUser.lastName}</h2>
        
        <div id="prev-id-role" class="mt-1 w-full">
          <span class="text-[10px] font-bold font-vazir px-2 py-0.5 rounded-full inline-block truncate max-w-full" style="background: ${role.color}15; color: ${role.color}; border: 1px solid ${role.color}40;">${role.title}</span>
        </div>

        <div class="w-full mt-auto space-y-1.5 border-t border-slate-100 pt-2.5">
          <div id="prev-id-nationalCode" class="flex justify-between items-center text-[10px]">
            <span class="text-slate-400 font-semibold">کد ملی:</span>
            <span class="font-mono font-bold text-slate-700">${activeUser.nationalCode}</span>
          </div>
          <div id="prev-id-projects" class="flex justify-between items-center text-[10px]">
            <span class="text-slate-400 font-semibold">تردد مجاز:</span>
            <span class="font-mono font-bold text-indigo-600 truncate max-w-[120px]">${activeUser.projects.join(', ')}</span>
          </div>
        </div>
      </div>

      <!-- فوتر و QR -->
      <div class="h-16 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-3">
        <div class="text-[8px] font-bold text-slate-400 text-right leading-tight flex-1">
          <p>کارت شناسایی پرسنلی</p>
          <p id="prev-id-expiry" class="mt-0.5 text-slate-600">اعتبار: <span class="card-expiry-text font-bold text-slate-800">${expiryText}</span></p>
        </div>
        <div id="prev-id-qr" class="w-10 h-10 shrink-0 ml-1">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjMWUxZTFlIiBkPSJNMTAgMTBoMjB2MjBIMTB6TTMwIDEwaDIwdjIwSDMwek01MCAxMGgyMHYyMEg1MHpNNzAgMTBoMjB2MjBINzB6TTEwIDMwaDIwdjIwSDEwek0zMCAzMGgyMHYyMEgzMHpNNTAgMzBoMjB2MjBINTB6TTcwIDMwaDIwdjIwSDcwek0xMCA1MGgyMHYyMEgxMHpNMzAgNTBoMjB2MjBIMzB6TTUwIDUwaDIwdjIwSDUwek03MCA1MGgyMHYyMEg3MHpNMTAgNzBoMjB2MjBIMTB6TTMwIDcwaDIwdjIwSDMwek01MCA3MGgyMHYyMEg1MHpNNzAgNzBoMjB2MjBINzB6IiBvcGFjaXR5PSIuMSIvPjxwYXRoIGZpbGw9IiMxZTFlMWUiIGQ9Ik0xMCAxMGgzMHYzMEgxMHptNSA1aDIwdjIwSDE1em0zNSA1aDEwdjEwSDUwem0xNS0xMGgzMHYzMEg2MHptNSA1aDIwdjIwSDY1ek0xMCA2MGgzMHYzMEgxMHptNSA1aDIwdjIwSDE1em0zNS0xMGgxMHYxMEg1MHptMTUtMTBoMTB2MTBINjV6bTAtMTVWMzBINTB2MTBoMTV2MTVoMTVWNDBoLTE1em0xNSAzNWgxMHYxMEg4MHptLTE1IDEwaDEwdjEwSDY1em0tMTUgMGgxMHYxMEg1MHoiLz48cGF0aCBmaWxsPSIjMWUxZTFlIiBkPSJNMjAgMjBoMTB2MTBIMjB6TTY1IDIwaDEwdjEwSDY1ek0yMCA3MGgxMHYxMEgyMHpNNDAgNDBoMTB2MTBINDB6TTQ1IDY1aDEwdjEwSDQ1eiIvPjwvc3ZnPg==" class="w-full h-full opacity-80 mix-blend-multiply" alt="QR">
        </div>
      </div>
    </div>
  `;
}

function renderHorizontalBadgeCard() {
  const activeUser = appState.users[0] || { firstName: 'سامان', lastName: 'تقوی سوق', nationalCode: '1280954310', projects: ['PRJ-01', 'PRJ-02'] };
  const role = appState.roles.find(r => r.id === activeUser.roleId) || { title: 'مدیریت کل', color: '#4f46e5' };
  const expiryText = calculateExpiryString(idCardSettings.expiryDays);

  return `
    <div id="live-card-preview" class="bg-white rounded-[16px] shadow-2xl overflow-hidden transition-all duration-300 w-[380px] h-[240px] border border-slate-200 relative flex ring-8 ring-white ring-opacity-40" style="aspect-ratio: 86/54;">
      
      <!-- نوار رنگی حراست -->
      <div class="w-7 h-full flex items-center justify-center writing-vertical rotate-180 text-white text-[9px] font-bold tracking-widest" style="background: ${role.color}; writing-mode: vertical-rl;">
        GATE PASS · PERMIT
      </div>

      <div class="flex-1 flex flex-col p-3 px-4">
        
        <!-- هدر شرکت با فونت وزیر -->
        <div class="flex justify-between items-start border-b border-slate-100 pb-2 mb-2">
          <div class="flex flex-col">
            <span class="text-lg font-black font-vazir text-slate-800 tracking-wider">فارس عــالیش</span>
            <span class="text-[7px] font-bold text-slate-400 tracking-widest mt-0.5">FARS AALISH - GATE PASS</span>
          </div>
          <div id="prev-id-qr" class="w-10 h-10">
            <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjMWUxZTFlIiBkPSJNMTAgMTBoMjB2MjBIMTB6TTMwIDEwaDIwdjIwSDMwek01MCAxMGgyMHYyMEg1MHpNNzAgMTBoMjB2MjBINzB6TTEwIDMwaDIwdjIwSDEwek0zMCAzMGgyMHYyMEgzMHpNNTAgMzBoMjB2MjBINTB6TTcwIDMwaDIwdjIwSDcwek0xMCA1MGgyMHYyMEgxMHpNMzAgNTBoMjB2MjBIMzB6TTUwIDUwaDIwdjIwSDUwek03MCA1MGgyMHYyMEg3MHpNMTAgNzBoMjB2MjBIMTB6TTMwIDcwaDIwdjIwSDMwek01MCA3MGgyMHYyMEg1MHpNNzAgNzBoMjB2MjBINzB6IiBvcGFjaXR5PSIuMSIvPjxwYXRoIGZpbGw9IiMxZTFlMWUiIGQ9Ik0xMCAxMGgzMHYzMEgxMHptNSA1aDIwdjIwSDE1em0zNSA1aDEwdjEwSDUwem0xNS0xMGgzMHYzMEg2MHptNSA1aDIwdjIwSDY1ek0xMCA2MGgzMHYzMEgxMHptNSA1aDIwdjIwSDE1em0zNS0xMGgxMHYxMEg1MHptMTUtMTBoMTB2MTBINjV6bTAtMTVWMzBINTB2MTBoMTV2MTVoMTVWNDBoLTE1em0xNSAzNWgxMHYxMEg4MHptLTE1IDEwaDEwdjEwSDY1em0tMTUgMGgxMHYxMEg1MHoiLz48cGF0aCBmaWxsPSIjMWUxZTFlIiBkPSJNMjAgMjBoMTB2MTBIMjB6TTY1IDIwaDEwdjEwSDY1ek0yMCA3MGgxMHYxMEgyMHpNNDAgNDBoMTB2MTBINDB6TTQ1IDY1aDEwdjEwSDQ1eiIvPjwvc3ZnPg==" class="w-full h-full opacity-70 mix-blend-multiply" alt="QR">
          </div>
        </div>

        <!-- اطلاعات هویتی و عکس -->
        <div class="flex-1 flex text-right gap-4">
          <div class="flex-1 flex flex-col justify-between py-1">
            <div>
              <p class="text-[9px] text-slate-400 font-bold mb-0.5">نام و نام خانوادگی:</p>
              <h2 class="font-black font-vazir text-slate-800 text-base">${activeUser.firstName} ${activeUser.lastName}</h2>
            </div>
            <div id="prev-id-role">
              <p class="text-[9px] text-slate-400 font-bold mb-0.5">مسئولیت / واحد:</p>
              <p class="font-bold font-vazir text-sm" style="color: ${role.color};">${role.title}</p>
            </div>
            <div id="prev-id-projects">
              <p class="text-[9px] text-slate-400 font-bold mb-0.5">مجوز تردد در سایت‌ها:</p>
              <p class="font-mono font-bold text-xs text-slate-700">${activeUser.projects.join(' - ')}</p>
            </div>
          </div>
          
          <div class="w-16 h-20 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0 self-start mt-2">
            <span class="text-[8px] text-slate-400 font-bold text-center leading-tight">محل<br>عکس</span>
          </div>
        </div>
        
        <!-- فوتر (NID + Expiry) -->
        <div class="mt-auto pt-1.5 border-t border-slate-100 flex items-center justify-between mb-1">
           <div id="prev-id-expiry" class="text-[9px] text-slate-500 font-bold">
              اعتبار: <span class="card-expiry-text font-black text-slate-700">${expiryText}</span>
           </div>
           <div id="prev-id-nationalCode" class="text-left">
              <span class="text-[9px] text-slate-400 font-bold">NID: </span>
              <span class="font-mono font-black text-slate-700 text-[11px]">${activeUser.nationalCode}</span>
           </div>
        </div>

      </div>
    </div>
  `;
}

// ------ Helper Functions ------

function renderIdCheckbox(id, label, isChecked) {
  return `
    <label class="flex items-center gap-2 cursor-pointer group">
      <input type="checkbox" id="id-chk-${id}" onchange="toggleIdPreviewField('${id}')" ${isChecked ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-0 cursor-pointer">
      <span class="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">${label}</span>
    </label>
  `;
}

window.updateLiveExpiry = function(days) {
  idCardSettings.expiryDays = days;
  const expiryStr = calculateExpiryString(days);
  document.querySelectorAll('.card-expiry-text').forEach(el => el.textContent = expiryStr);
}

window.toggleIdDataSource = function(type, el) {
  idCardSettings.dataSource = type;
  document.querySelectorAll('input[name="id_source"]').forEach(rb => {
    const parent = rb.closest('label');
    parent.classList.remove('border-indigo-500', 'bg-indigo-50/50');
    parent.classList.add('border-slate-200');
    parent.querySelector('span').classList.remove('text-indigo-900');
    parent.querySelector('span').classList.add('text-slate-700');
  });
  
  el.classList.remove('border-slate-200');
  el.classList.add('border-indigo-500', 'bg-indigo-50/50');
  el.querySelector('span').classList.remove('text-slate-700');
  el.querySelector('span').classList.add('text-indigo-900');

  const externalBox = document.getElementById('id-external-box');
  const dbSettings = document.getElementById('id-db-settings');
  
  if (type === 'external') {
    externalBox.classList.remove('hidden');
    dbSettings.classList.add('hidden');
  } else {
    externalBox.classList.add('hidden');
    dbSettings.classList.remove('hidden');
  }
}

window.simulateIdExcelUpload = function() {
  showToast('info', 'در حال پردازش هدرهای فایل اکسل پرسنل...');
  setTimeout(() => {
    const headers = ['نام و نام خانوادگی', 'کد ملی', 'نقش/سمت', 'اعتبار (روز)'];
    const optionsHtml = `<option value="">-- انتخاب ستون --</option>` + headers.map((h, i) => `<option value="${i}">${h}</option>`).join('');
    
    document.getElementById('map-id-name').innerHTML = optionsHtml;
    document.getElementById('map-id-nid').innerHTML = optionsHtml;
    document.getElementById('map-id-role').innerHTML = optionsHtml;
    document.getElementById('map-id-expiry').innerHTML = optionsHtml;
    
    document.getElementById('id-mapping-section').classList.remove('hidden');
    showToast('success', 'فایل با موفقیت پارس شد. ستون‌ها را تخصیص دهید.');
  }, 800);
}

window.updateCardFormat = function(format, btnElement) {
  idCardSettings.cardType = format;
  
  document.querySelectorAll('.card-format-btn').forEach(btn => {
    btn.className = 'card-format-btn border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold py-2.5 rounded-xl transition-all';
  });
  
  btnElement.className = 'card-format-btn border-2 border-indigo-500 bg-indigo-50 text-indigo-700 text-xs font-bold py-2.5 rounded-xl transition-all';
  
  const canvas = document.getElementById('card-preview-canvas');
  if (format === 'badge-horizontal') {
    canvas.innerHTML = renderHorizontalBadgeCard();
  } else {
    canvas.innerHTML = renderVerticalPvcCard();
  }
  
  // حفظ وضعیت چک‌باکس‌ها در رندر جدید
  Object.keys(idCardSettings.fields).forEach(key => toggleIdPreviewField(key, true));
}

window.toggleIdPreviewField = function(field, forceSync = false) {
  const checkbox = document.getElementById(`id-chk-${field}`);
  if (!forceSync) idCardSettings.fields[field] = checkbox.checked;
  
  const isChecked = idCardSettings.fields[field];
  const element = document.getElementById(`prev-id-${field}`);
  
  if (element) {
    if (isChecked) element.classList.remove('hidden');
    else element.classList.add('hidden');
  }
  
  const previewBox = document.getElementById('live-card-preview');
  if (previewBox && !forceSync) {
    previewBox.classList.add('ring-indigo-300', 'scale-[1.02]');
    setTimeout(() => previewBox.classList.remove('ring-indigo-300', 'scale-[1.02]'), 200);
  }
}

window.executeCardPrint = function() {
  showToast('info', 'در حال پردازش گرید خودکار جهت تولید شیت‌های A4...');
  setTimeout(() => {
    showModal('دستور چاپ صادر شد', 'کارت‌های شناسایی بر اساس ابعاد استاندارد، به صورت خودکار در قالب شیت‌های A4 سازمان‌دهی و به درایور پرینتر ارسال شدند.', 'success');
  }, 1200);
}