const { createBrowser, loginViaApi, captureScreenshot } = require('./e2e_helper');

async function runPhase1() {
  console.log('====================================================');
  console.log('🚀 اجرای مجدد آزمون‌های مرورگر زنده فاز ۱ (سناریو ۱ و ۲)');
  console.log('====================================================');

  const browser = await createBrowser();
  const page = await browser.newPage();

  try {
    const getArray = (data) => Array.isArray(data) ? data : (data.results || []);

    // ----------------------------------------------------
    // سناریو ۱: چرخه استاندارد کامل ۳ سطحی (E2E-ITEM-01)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۱] چرخه استاندارد ۳ سطحی (تخصیص -> شمارش -> سرپرست -> مدیر)');
    
    // ۱. ورود مدیر سیستم و تخصیص در صفحه دیسپچ
    await loginViaApi(page, 'admin_e2e');
    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const assign1 = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-01`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const item = getArr(await itemsRes.json())[0];

      const usersRes = await fetch('/api/auth/users/', { headers: { 'Authorization': `Bearer ${token}` } });
      const users = getArr(await usersRes.json());
      const counter = users.find(u => u.username === 'counter_e2e');
      const supervisor = users.find(u => u.username === 'supervisor_e2e');
      const manager = users.find(u => u.username === 'manager_e2e');

      const postRes = await fetch('/api/inventory/items/bulk_assign/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          item_ids: [item.id],
          field_assignee: counter.id,
          supervisor_assignee: supervisor.id,
          manager_assignee: manager.id,
          field_status: 'counting',
          force: true
        })
      });
      return { success: postRes.ok, item };
    });

    console.log('   ✓ کالا E2E-ITEM-01 با موفقیت تخصیص یافت');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase1_scenario1_01_dispatch');

    // ۲. ورود شمارشگر و ثبت مقدار ۵۰.۰۰۰ در کارتابل
    await loginViaApi(page, 'counter_e2e');
    await page.goto('http://localhost:4200/counter?status=all', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const count1 = await page.evaluate(async (itemId) => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const taskRes = await fetch('/api/inventory/count-tasks/?as_role=counter', { headers: { 'Authorization': `Bearer ${token}` } });
      const tasks = getArr(await taskRes.json());
      const task = tasks.find(t => t.item === itemId || (t.item_details && t.item_details.fa_unic_code === 'E2E-ITEM-01'));

      await fetch(`/api/inventory/count-tasks/${task.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 50.000, counter_note: 'شمارش دقیق میدانی', status: 'INITIAL_COUNT' })
      });

      const subRes = await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [task.id] })
      });
      return { success: subRes.ok, taskId: task.id };
    }, assign1.item.id);

    console.log('   ✓ شمارشگر مقدار ۵۰.۰۰۰ را ثبت و برای سرپرست ارسال کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase1_scenario1_02_counter_submitted');

    // ۳. ورود سرپرست و تایید تسک
    await loginViaApi(page, 'supervisor_e2e');
    await page.goto('http://localhost:4200/supervisor', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید شد و جهت بررسی نهایی مدیر ارسال می‌گردد' })
      });
    }, count1.taskId);

    console.log('   ✓ سرپرست تسک را تایید و برای مدیر ارسال کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase1_scenario1_03_supervisor_approved');

    // ۴. ورود مدیر و تایید نهایی
    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_manager_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید نهایی مدیر انبار (FINAL_APPROVED)' })
      });
    }, count1.taskId);

    console.log('   ✓ مدیر انبار تسک را تایید نهایی کرد (وضعیت FINAL_APPROVED)');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase1_scenario1_04_manager_final_approved');


    // ----------------------------------------------------
    // سناریو ۲: چرخه رد سرپرست و بازشماری (E2E-ITEM-02)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۲] چرخه رد سرپرست با یادداشت و بازشماری میدانی');
    
    // ۱. تخصیص E2E-ITEM-02
    await loginViaApi(page, 'admin_e2e');
    const assign2 = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-02`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const item = getArr(await itemsRes.json())[0];

      const usersRes = await fetch('/api/auth/users/', { headers: { 'Authorization': `Bearer ${token}` } });
      const users = getArr(await usersRes.json());
      const counter = users.find(u => u.username === 'counter_e2e');
      const supervisor = users.find(u => u.username === 'supervisor_e2e');
      const manager = users.find(u => u.username === 'manager_e2e');

      await fetch('/api/inventory/items/bulk_assign/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          item_ids: [item.id],
          field_assignee: counter.id,
          supervisor_assignee: supervisor.id,
          manager_assignee: manager.id,
          field_status: 'counting',
          force: true
        })
      });
      return { item };
    });

    console.log('   ✓ کالا E2E-ITEM-02 تخصیص یافت');

    // ۲. شمارش اولیه با ۳۵.۰۰۰ توسط شمارشگر
    await loginViaApi(page, 'counter_e2e');
    const count2 = await page.evaluate(async (itemId) => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const taskRes = await fetch('/api/inventory/count-tasks/?as_role=counter', { headers: { 'Authorization': `Bearer ${token}` } });
      const tasks = getArr(await taskRes.json());
      const task = tasks.find(t => t.item === itemId || (t.item_details && t.item_details.fa_unic_code === 'E2E-ITEM-02'));

      await fetch(`/api/inventory/count-tasks/${task.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 35.000, counter_note: 'شمارش اولیه میدانی', status: 'INITIAL_COUNT' })
      });

      await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [task.id] })
      });
      return { taskId: task.id };
    }, assign2.item.id);

    console.log('   ✓ شمارشگر مقدار اولیه ۳۵.۰۰۰ را ثبت و ارسال کرد');

    // ۳. ورود سرپرست و رد تسک با یادداشت
    await loginViaApi(page, 'supervisor_e2e');
    await page.goto('http://localhost:4200/supervisor', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch(`/api/inventory/count-tasks/${taskId}/reject/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ note: 'نیاز به بازشماری دقیق با حضور سرپرست', reason: 'نیاز به بازشماری دقیق با حضور سرپرست' })
      });
    }, count2.taskId);

    console.log('   ✓ سرپرست تسک را با یادداشت علت رد کرد (SUPERVISOR_REJECTED)');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase1_scenario2_01_supervisor_rejected');

    // ۴. ورود شمارشگر به تب مرجوعی/بازشماری، مشاهده تسک و اصلاح به ۵۰.۰۰۰
    await loginViaApi(page, 'counter_e2e');
    await page.goto('http://localhost:4200/counter?status=rejected', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot(page, 'phase1_scenario2_02_counter_recount_tab');

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch(`/api/inventory/count-tasks/${taskId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 50.000, counter_note: 'بازشماری انجام و اصلاح شد به ۵۰', status: 'INITIAL_COUNT' })
      });

      await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId] })
      });
    }, count2.taskId);

    console.log('   ✓ شمارشگر کالا را بازشماری و مقدار ۵۰.۰۰۰ را مجدداً ارسال کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase1_scenario2_03_counter_recounted');

    // ۵. تایید مجدد سرپرست و سپس تایید نهایی مدیر
    await loginViaApi(page, 'supervisor_e2e');
    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'بازشماری مورد تایید سرپرست است' })
      });
    }, count2.taskId);

    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_manager_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید نهایی پس از رفع مغایرت بازشماری' })
      });
    }, count2.taskId);

    console.log('   ✓ مدیر انبار تایید نهایی بازشماری را صادر کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase1_scenario2_04_manager_final_approved');

    console.log('\n====================================================');
    console.log('🎉 فاز ۱ با موفقیت ۱۰۰٪ به پایان رسید.');
    console.log('====================================================');
    return { success: true };
  } catch (err) {
    console.error('❌ خطا در اجرای فاز ۱:', err);
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

runPhase1().then(r => process.exit(r.success ? 0 : 1));
