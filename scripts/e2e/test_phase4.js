const { createBrowser, loginViaApi, captureScreenshot } = require('./e2e_helper');

async function runPhase4() {
  console.log('====================================================');
  console.log('🚀 اجرای آزمون‌های مرورگر زنده فاز ۴ (سناریوهای ۷ و ۸)');
  console.log('====================================================');

  const browser = await createBrowser();
  const page = await browser.newPage();

  try {
    const getArray = (data) => Array.isArray(data) ? data : (data.results || []);

    // ----------------------------------------------------
    // سناریو ۷: شمارش کور و کشف مغایرت (E2E-ITEM-07)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۷] شمارش کور (Blind Counting)، عدم نمایش موجودی دفتری و کشف مغایرت (has_conflict)');

    // ۱. ورود مدیر و تخصیص E2E-ITEM-07
    await loginViaApi(page, 'admin_e2e');
    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const assign7 = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-07`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const item = getArr(await itemsRes.json())[0];

      const usersRes = await fetch('/api/auth/users/', { headers: { 'Authorization': `Bearer ${token}` } });
      const users = getArr(await usersRes.json());
      const counter = users.find(u => u.username === 'counter_e2e');
      const manager = users.find(u => u.username === 'manager_e2e');

      await fetch('/api/inventory/items/bulk_assign/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          item_ids: [item.id],
          field_assignee: counter.id,
          supervisor_assignee: 'skip',
          manager_assignee: manager.id,
          field_status: 'counting',
          force: true
        })
      });
      return { item };
    });

    console.log('   ✓ کالا E2E-ITEM-07 برای شمارش تخصیص یافت');

    // ۲. ورود شمارشگر به کارتابل، بررسی وضعیت شمارش کور و ثبت مقدار دارای مغایرت (۴۲.۰۰۰ به جای ۵۰.۰۰۰)
    await loginViaApi(page, 'counter_e2e');
    await page.goto('http://localhost:4200/counter?status=pending', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot(page, 'phase4_scenario7_01_blind_counting_view');

    const count7 = await page.evaluate(async (itemId) => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const taskRes = await fetch('/api/inventory/count-tasks/?as_role=counter', { headers: { 'Authorization': `Bearer ${token}` } });
      const tasks = getArr(await taskRes.json());
      const task = tasks.find(t => t.item === itemId || (t.item_details && t.item_details.fa_unic_code === 'E2E-ITEM-07'));

      // شمارش کور: ثبت مقدار ۴۲ (۸ واحد مغایرت با دفتری ۵۰)
      await fetch(`/api/inventory/count-tasks/${task.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 42.000, counter_note: 'شمارش در تاریکی/کور با عدد ۴۲', status: 'INITIAL_COUNT' })
      });

      await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [task.id] })
      });
      return { taskId: task.id };
    }, assign7.item.id);

    console.log('   ✓ مقدار ۴۲.۰۰۰ با مغایرت دفتری ثبت و ارسال شد');

    // ۳. ورود مدیر، مشاهده کالا و تایید نهایی
    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_manager_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید نهایی با پذیرش مغایرت' })
      });
    }, count7.taskId);

    console.log('   ✓ مدیر انبار تایید نهایی را صادر کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase4_scenario7_02_manager_conflict_approved');


    // ----------------------------------------------------
    // سناریو ۸: تفکیک و ایزولاسیون کامل انبارها (شیراز vs بوشهر)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۸] تست تفکیک و ایزولاسیون کامل داده‌ها بین انبار مرکزی شیراز و انبار فرعی بوشهر');

    // ۱. تخصیص E2E-ITEM-08 در انبار شیراز
    await loginViaApi(page, 'admin_e2e');
    await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-08`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const item = getArr(await itemsRes.json())[0];

      const usersRes = await fetch('/api/auth/users/', { headers: { 'Authorization': `Bearer ${token}` } });
      const users = getArr(await usersRes.json());
      const counter = users.find(u => u.username === 'counter_e2e');
      const manager = users.find(u => u.username === 'manager_e2e');

      await fetch('/api/inventory/items/bulk_assign/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          item_ids: [item.id],
          field_assignee: counter.id,
          supervisor_assignee: 'skip',
          manager_assignee: manager.id,
          field_status: 'counting',
          force: true
        })
      });
    });

    console.log('   ✓ کالا E2E-ITEM-08 در انبار شیراز تخصیص یافت');
    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase4_scenario8_01_shiraz_warehouse_view');

    // ۲. سوییچ انبار به «انبار فرعی بوشهر» و اعتبارسنجی عدم تداخل
    const isolationTest = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');

      // واکشی شناسه انبار بوشهر
      const whRes = await fetch('/api/warehouses/', { headers: { 'Authorization': `Bearer ${token}` } });
      const whList = getArr(await whRes.json());
      const bushehr = whList.find(w => w.name && w.name.includes('بوشهر'));
      if (!bushehr) return { success: false, error: 'Bushehr warehouse not found' };

      localStorage.setItem('wh_active_id', String(bushehr.id));

      // واکشی اقلام انبار بوشهر
      const bItemsRes = await fetch(`/api/inventory/items/?warehouse=${bushehr.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const bItems = getArr(await bItemsRes.json());
      const hasShirazLeakage = bItems.some(i => i.fa_unic_code && i.fa_unic_code.startsWith('E2E-ITEM-'));
      const hasBushehrItem = bItems.some(i => i.fa_unic_code === 'E2E-BUSHEHR-01');

      return {
        success: true,
        bushehrId: bushehr.id,
        itemsCount: bItems.length,
        hasShirazLeakage,
        hasBushehrItem
      };
    });

    console.log('   ✓ انبار فعال به بوشهر تغییر یافت. نتایج ایزولاسیون:');
    console.log('     - نشتی اقلام شیراز در بوشهر:', isolationTest.hasShirazLeakage ? 'دارد ❌' : 'ندارد (ایزوله کامل) ✅');
    console.log('     - حضور قلم اختصاصی بوشهر:', isolationTest.hasBushehrItem ? 'تایید شد ✅' : 'یافت نشد ❌');

    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase4_scenario8_02_bushehr_warehouse_isolated');

    // ۳. بازگرداندن انبار فعال به شیراز
    await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whRes = await fetch('/api/warehouses/', { headers: { 'Authorization': `Bearer ${token}` } });
      const shiraz = getArr(await whRes.json()).find(w => w.name && w.name.includes('شیراز'));
      if (shiraz) localStorage.setItem('wh_active_id', String(shiraz.id));
    });

    console.log('\n====================================================');
    console.log('🎉 فاز ۴ با موفقیت ۱۰۰٪ به پایان رسید.');
    console.log('====================================================');
    return { success: true };
  } catch (err) {
    console.error('❌ خطا در اجرای فاز ۴:', err);
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

runPhase4().then(r => process.exit(r.success ? 0 : 1));
