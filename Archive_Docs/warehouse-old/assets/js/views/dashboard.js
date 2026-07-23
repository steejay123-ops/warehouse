// =========================================================================
// ====== VIEW: DASHBOARD (داشبورد مدیریتی و مانیتورینگ پیشرفت) ======
// =========================================================================

function getDashboard() {
  const activeWh = appState.projects.find(p => p.id === appState.activeWarehouseId) || appState.projects[0];

  // بارگذاری نمودار میله‌ای بلافاصله پس از رندر شدن پوسته اصلی
  setTimeout(() => renderMiniChart(), 50);

  return `
  <div class="space-y-5 fade-in text-right" dir="rtl">
    
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-sm font-black text-slate-800">داشبورد مانیتورینگ پروژه (نسخه ۷)</h2>
        <p class="text-[11px] text-slate-400 mt-0.5">نمای کلی پیشرفت فازهای انبارگردانی، شمارش کور و تغذیه MT26/MT49</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      
      <div onclick="refreshSingleCard(this)" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:shadow-md active:scale-[0.98] relative group">
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span class="text-xs font-black text-slate-700">عملکرد امروز (جاری)</span>
          </div>
          <span class="text-xl font-black text-blue-600">842</span>
        </div>
        <div class="space-y-3.5">
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">شمارش شده (تیم اجرا)</span>
              <span class="font-bold text-slate-700">415</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-blue-500 h-full rounded-full" style="width: 50%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">تایید مدارک (گمرکی/مالی)</span>
              <span class="font-bold text-slate-700">280</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-amber-500 h-full rounded-full" style="width: 35%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">تغذیه نهایی (MT26/MT49)</span>
              <span class="font-bold text-slate-700">147</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-emerald-500 h-full rounded-full" style="width: 22%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-slate-400"></span>
            <span class="text-xs font-black text-slate-700">عملکرد دیروز (بسته شده)</span>
          </div>
          <span class="text-xl font-black text-slate-700">1,245</span>
        </div>
        <div class="space-y-3.5">
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">شمارش شده (تیم اجرا)</span>
              <span class="font-bold text-slate-700">850</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-blue-500 h-full rounded-full" style="width: 68%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">تایید مدارک (گمرکی/مالی)</span>
              <span class="font-bold text-slate-700">310</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-amber-500 h-full rounded-full" style="width: 25%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">تغذیه نهایی (MT26/MT49)</span>
              <span class="font-bold text-slate-700">85</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-emerald-500 h-full rounded-full" style="width: 12%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-slate-400"></span>
            <span class="text-xs font-black text-slate-700">هفته گذشته (بسته شده)</span>
          </div>
          <span class="text-xl font-black text-slate-700">8,930</span>
        </div>
        <div class="space-y-3.5">
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">شمارش شده (تیم اجرا)</span>
              <span class="font-bold text-slate-700">5,120</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-blue-500 h-full rounded-full" style="width: 58%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">تایید مدارک (گمرکی/مالی)</span>
              <span class="font-bold text-slate-700">2,450</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-amber-500 h-full rounded-full" style="width: 28%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-1">
              <span class="text-slate-500">تغذیه نهایی (MT26/MT49)</span>
              <span class="font-bold text-slate-700">1,360</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-emerald-500 h-full rounded-full" style="width: 16%"></div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      
      <div onclick="refreshSingleCard(this)" class="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col cursor-pointer transition-all hover:shadow-md active:scale-[0.98] relative group">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h4 class="text-xs font-black text-slate-800">نمودار پیشرفت فازها در ۷ روز اخیر</h4>
            <p class="text-[10px] text-slate-400 mt-0.5">روند روزانه تحلیل رکوردهای شمارش شده و داده‌های نهایی</p>
          </div>
          
          <div class="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
            <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-blue-500"></span><span>شمارش (کو)</span></div>
            <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-amber-500"></span><span>تایید مدارک</span></div>
            <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-emerald-500"></span><span>تغذیه (MT26)</span></div>
          </div>
        </div>
        
        <div class="flex-1 flex items-end justify-between gap-1 pt-4 min-h-[220px]" id="mini-weekly-chart"></div>
      </div>

      <div onclick="refreshSingleCard(this)" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:shadow-md active:scale-[0.98] relative group">
        <div class="mb-4">
          <h4 class="text-xs font-black text-slate-800">وضعیت کلی تیم‌ها (پیشرفت کل)</h4>
        </div>
        
        <div class="space-y-4 flex-1 flex flex-col justify-center">
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[11px] font-black text-blue-600 shrink-0">۱</div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-slate-500">کل رکوردهای تخصیص یافته</span>
                <span class="font-black text-slate-800">198,540</span>
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[11px] font-black text-indigo-600 shrink-0">۲</div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-slate-500">لیبل‌های چاپ شده (QR)</span>
                <span class="font-black text-slate-800">142,000</span>
              </div>
              <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-indigo-600 h-full rounded-full" style="width: 71%"></div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="w-6 h-6 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-[11px] font-black text-amber-600 shrink-0">۳</div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-slate-500">مغایرت‌های کشف شده</span>
                <span class="font-black text-amber-600">8,450</span>
              </div>
              <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-amber-500 h-full rounded-full" style="width: 15%"></div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[11px] font-black text-emerald-600 shrink-0">۴</div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-slate-500">پایان‌یافته و تغذیه شده</span>
                <span class="font-black text-emerald-600">65,200</span>
              </div>
              <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-emerald-500 h-full rounded-full" style="width: 33%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>`;
}

// ------ تابع رندر کلاستر چارت ------
function renderMiniChart() {
  const chartContainer = document.getElementById('mini-weekly-chart');
  if (!chartContainer) return;

  const weeklyData = [
    { day: 'شنبه', count: 450, docs: 320, feed: 200 },
    { day: 'یکشنبه', count: 490, docs: 340, feed: 210 },
    { day: 'دوشنبه', count: 590, docs: 410, feed: 290 },
    { day: 'سه‌شنبه', count: 390, docs: 280, feed: 190 },
    { day: 'چهارشنبه', count: 680, docs: 510, feed: 380 },
    { day: 'پنجشنبه', count: 420, docs: 310, feed: 220 },
    { day: 'جمعه', count: 180, docs: 120, feed: 90 }
  ];

  const overallMax = 750; 

  let chartHTML = '';
  weeklyData.forEach(item => {
    const countHeight = Math.max((item.count / overallMax) * 100, 4);
    const docsHeight = Math.max((item.docs / overallMax) * 100, 4);
    const feedHeight = Math.max((item.feed / overallMax) * 100, 4);

    chartHTML += `
      <div class="flex flex-col items-center flex-1 h-full justify-end group/col relative z-10">
        <div class="absolute -top-14 opacity-0 group-hover/col:opacity-100 transition-opacity bg-slate-800 border border-slate-700 text-white text-[10px] p-2 rounded-xl shadow-lg pointer-events-none z-20 flex flex-col gap-0.5 whitespace-nowrap">
          <span class="text-blue-400 font-bold">شمارش: ${item.count}</span>
          <span class="text-amber-400 font-bold">مدارک: ${item.docs}</span>
          <span class="text-emerald-400 font-bold">تغذیه: ${item.feed}</span>
        </div>
        
        <div class="flex items-end justify-center gap-[3px] w-full h-36 px-1">
          <div class="w-2.5 sm:w-3.5 bg-blue-500 rounded-t-sm transition-all duration-300 group-hover/col:brightness-110" style="height: ${countHeight}%"></div>
          <div class="w-2.5 sm:w-3.5 bg-amber-500 rounded-t-sm transition-all duration-300 group-hover/col:brightness-110" style="height: ${docsHeight}%"></div>
          <div class="w-2.5 sm:w-3.5 bg-emerald-500 rounded-t-sm transition-all duration-300 group-hover/col:brightness-110" style="height: ${feedHeight}%"></div>
        </div>
        <span class="text-[10px] font-bold text-slate-400 mt-2 group-hover/col:text-slate-800 transition-colors">${item.day}</span>
      </div>
    `;
  });
  
  chartContainer.innerHTML = chartHTML;
}

// ------ تابع سیستم جهت مدیریت مکانیزم لودینگ موضعی اجزای داشبورد ------
function refreshSingleCard(cardElement) {
  if (cardElement.classList.contains('pointer-events-none')) return;
  cardElement.classList.add('pointer-events-none');

  let overlay = cardElement.querySelector('.card-update-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'card-update-overlay absolute inset-0 backdrop-blur-[1px] bg-white/80 flex flex-col items-center justify-center z-50 transition-opacity duration-300 opacity-0 rounded-2xl';
    overlay.innerHTML = `
      <svg class="animate-spin h-6 w-6 text-blue-600 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    `;
    cardElement.appendChild(overlay);
  }

  setTimeout(() => overlay.classList.remove('opacity-0'), 10);
  setTimeout(() => {
    overlay.classList.add('opacity-0');
    setTimeout(() => cardElement.classList.remove('pointer-events-none'), 300);
  }, 800);
}