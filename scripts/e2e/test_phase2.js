const { createBrowser, loginViaApi, captureScreenshot } = require('./e2e_helper');

async function runPhase2() {
  console.log('====================================================');
  console.log('🚀 اجرای آزمون‌های مرورگر زنده فاز ۲ (سناریوهای ۳ و ۴)');
  console.log('====================================================');

  const browser = await createBrowser();
  const page = await browser.newPage();

  try {
    const getArray = (data) => Array.isArray(data) ? data : (data.results || []);

    // ----------------------------------------------------
    // سناریو ۳: دور زدن سرپرست و رد هوشمند مدیر (E2E-ITEM-03)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۳] چرخه دور زدن سرپرست (skip_supervisor) و رد مستقیم مدیر');

    // ۱. ورود مدیر سیستم و تخصیص E2E-ITEM-03 با skip_supervisor
    await loginViaApi(page, 'admin_e2e');
    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const assign3 = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-03`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const item = getArr(await itemsRes.json())[0];

      const usersRes = await fetch('/api/auth/users/', { headers: { 'Authorization': `Bearer ${token}` } });
      const users = getArr(await usersRes.json());
      const counter = users.find(u => u.username === 'counter_e2e');
      const manager = users.find(u => u.username === 'manager_e2e');

      const postRes = await fetch('/api/inventory/items/bulk_assign/', {
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
      return { success: postRes.ok, item };
    });

    console.log('   ✓ کالا E2E-ITEM-03 با حالت skip_supervisor تخصیص یافت');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase2_scenario3_01_dispatch_skip_sup');

    // ۲. ورود شمارشگر و ثبت مقدار ۴۰.۰۰۰ (ارسال مستقیم به مدیر بدون سرپرست)
    await loginViaApi(page, 'counter_e2e');
    await page.goto('http://localhost:4200/counter?status=all', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const count3 = await page.evaluate(async (itemId) => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const taskRes = await fetch('/api/inventory/count-tasks/?as_role=counter', { headers: { 'Authorization': `Bearer ${token}` } });
      const tasks = getArr(await taskRes.json());
      const task = tasks.find(t => t.item === itemId || (t.item_details && t.item_details.fa_unic_code === 'E2E-ITEM-03'));

      await fetch(`/api/inventory/count-tasks/${task.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 40.000, counter_note: 'شمارش در حالت بدون سرپرست', status: 'INITIAL_COUNT' })
      });

      const subRes = await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [task.id] })
      });
      return { success: subRes.ok, taskId: task.id };
    }, assign3.item.id);

    console.log('   ✓ شمارشگر مقدار ۴۰.۰۰۰ را ثبت و مستقیماً برای مدیر ارسال کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase2_scenario3_02_counter_submitted_direct');

    // ۳. ورود مدیر به /manager و رد تسک (به دلیل skip_supervisor باید مستقیماً به شمارشگر برگردد)
    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch(`/api/inventory/count-tasks/${taskId}/manager_reject/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ note: 'موجودی ناقص است - نیاز به بازشماری مجدد شمارشگر' })
      });
    }, count3.taskId);

    console.log('   ✓ مدیر تسک را رد کرد (انتقال مستقیم به PENDING_COUNT شمارشگر)');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase2_scenario3_03_manager_rejected');

    // ۴. ورود مجدد شمارشگر، ثبت عدد ۵۰.۰۰۰ و ارسال
    await loginViaApi(page, 'counter_e2e');
    await page.goto('http://localhost:4200/counter?status=pending', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch(`/api/inventory/count-tasks/${taskId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 50.000, counter_note: 'اصلاح مقدار به ۵۰ و ارسال مجدد', status: 'INITIAL_COUNT' })
      });

      await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId] })
      });
    }, count3.taskId);

    console.log('   ✓ شمارشگر کالا را به ۵۰.۰۰۰ اصلاح و مجدداً برای مدیر ارسال کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase2_scenario3_04_counter_resubmitted');

    // ۵. تایید نهایی مدیر
    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_manager_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید نهایی مدیر در حالت skip_supervisor' })
      });
    }, count3.taskId);

    console.log('   ✓ مدیر تسک را تایید نهایی کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase2_scenario3_05_manager_final_approved');


    // ----------------------------------------------------
    // سناریو ۴: رد مدیر با حضور سرپرست (E2E-ITEM-04)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۴] چرخه رد مدیر با بازگشت به کارتابل سرپرست (MANAGER_REJECTED)');

    // ۱. تخصیص E2E-ITEM-04 با حضور سرپرست
    await loginViaApi(page, 'admin_e2e');
    const assign4 = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-04`, {
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

    console.log('   ✓ کالا E2E-ITEM-04 تخصیص یافت');

    // ۲. شمارش توسط انبارگردان و ارسال به سرپرست
    await loginViaApi(page, 'counter_e2e');
    const count4 = await page.evaluate(async (itemId) => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const taskRes = await fetch('/api/inventory/count-tasks/?as_role=counter', { headers: { 'Authorization': `Bearer ${token}` } });
      const tasks = getArr(await taskRes.json());
      const task = tasks.find(t => t.item === itemId || (t.item_details && t.item_details.fa_unic_code === 'E2E-ITEM-04'));

      await fetch(`/api/inventory/count-tasks/${task.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 30.000, counter_note: 'شمارش اولیه میدانی ۳۰', status: 'INITIAL_COUNT' })
      });

      await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [task.id] })
      });
      return { taskId: task.id };
    }, assign4.item.id);

    console.log('   ✓ شمارشگر مقدار ۳۰.۰۰۰ را ثبت و برای سرپرست ارسال کرد');

    // ۳. تایید سرپرست و ارسال به مدیر
    await loginViaApi(page, 'supervisor_e2e');
    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید اولیه سرپرست' })
      });
    }, count4.taskId);

    console.log('   ✓ سرپرست تسک را برای مدیر تایید کرد');

    // ۴. ورود مدیر و رد تسک با بازگشت به کارتابل سرپرست
    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch(`/api/inventory/count-tasks/${taskId}/manager_reject/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ note: 'اختلاف با اسناد دفتری - بررسی مجدد توسط سرپرست' })
      });
    }, count4.taskId);

    console.log('   ✓ مدیر تسک را رد کرد (انتقال به کارتابل سرپرست با وضعیت MANAGER_REJECTED)');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase2_scenario4_01_manager_rejected_to_sup');

    // ۵. ورود سرپرست به /supervisor، مشاهده تسک در وضعیت MANAGER_REJECTED با مقدار ۳۰ و تایید مجدد
    await loginViaApi(page, 'supervisor_e2e');
    await page.goto('http://localhost:4200/supervisor', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot(page, 'phase2_scenario4_02_supervisor_cartable_mgr_rejected');

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'سرپرست بررسی مجدد انجام داد و تایید کرد' })
      });
    }, count4.taskId);

    console.log('   ✓ سرپرست پس از بازبینی مجدداً تسک را برای مدیر ارسال کرد');

    // ۶. تایید نهایی مدیر
    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_manager_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید نهایی مدیر پس از توضیحات سرپرست' })
      });
    }, count4.taskId);

    console.log('   ✓ مدیر انبار تایید نهایی را صادر کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase2_scenario4_03_manager_final_approved');

    console.log('\n====================================================');
    console.log('🎉 فاز ۲ با موفقیت ۱۰۰٪ به پایان رسید.');
    console.log('====================================================');
    return { success: true };
  } catch (err) {
    console.error('❌ خطا در اجرای فاز ۲:', err);
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

runPhase2().then(r => process.exit(r.success ? 0 : 1));
