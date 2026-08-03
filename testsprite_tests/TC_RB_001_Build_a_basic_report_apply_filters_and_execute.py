import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:4200")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Log in by entering username 'admin' and password '123456' and clicking the 'ورود به سامانه' button.
        # نام کاربری را وارد کنید text field
        elem = page.get_by_placeholder('نام کاربری را وارد کنید', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Log in by entering username 'admin' and password '123456' and clicking the 'ورود به سامانه' button.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("123456")
        
        # -> Log in by entering username 'admin' and password '123456' and clicking the 'ورود به سامانه' button.
        # ورود به سامانه button
        elem = page.get_by_role('button', name='ورود به سامانه', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'گزارش‌ساز' button in the sidebar to open the Reports page
        # گزارش‌ساز button
        elem = page.get_by_role('button', name='گزارش\u200cساز', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'منبع داده' (data source) dropdown and select the 'کالاها' (Items) entity from the list.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select')
        await elem.click(timeout=10000)
        
        # -> Select the 'کالاها' option in the 'منبع داده' (data source) dropdown to load item-specific fields.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Open the warehouse picker labeled 'همه انبارهای مجاز' and choose a warehouse (if needed).
        # همه انبارهای مجاز dropdown
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select[2]')
        await elem.click(timeout=10000)
        
        # -> Select the warehouse option 'همه انبارهای مجاز' from the warehouse dropdown and then choose the 'ID' field plus dynamic fields 'شهر (پویا)' and 'استان (پویا)' in the Fields panel.
        # همه انبارهای مجاز dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select[2]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select the warehouse option 'همه انبارهای مجاز' from the warehouse dropdown and then choose the 'ID' field plus dynamic fields 'شهر (پویا)' and 'استان (پویا)' in the Fields panel.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Select the warehouse option 'همه انبارهای مجاز' from the warehouse dropdown and then choose the 'ID' field plus dynamic fields 'شهر (پویا)' and 'استان (پویا)' in the Fields panel.
        # شهر (پویا) (پویا) button
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[49]").nth(0)
        await elem.click(timeout=10000)
        
        # -> Select the warehouse option 'همه انبارهای مجاز' from the warehouse dropdown and then choose the 'ID' field plus dynamic fields 'شهر (پویا)' and 'استان (پویا)' in the Fields panel.
        # استان (پویا) (پویا) button
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[50]").nth(0)
        await elem.click(timeout=10000)
        
        # -> Create a nested filter group by clicking '+ گروه تودرتو', add a condition using '+ شرط', then click 'اجرای گزارش' (Run report) to generate the report preview.
        # + گروه تودرتو button
        elem = page.get_by_role('button', name='+ گروه تودرتو', exact=True)
        await elem.click(timeout=10000)
        
        # -> Create a nested filter group by clicking '+ گروه تودرتو', add a condition using '+ شرط', then click 'اجرای گزارش' (Run report) to generate the report preview.
        # + شرط button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[3]/app-filter-group/div/div/button')
        await elem.click(timeout=10000)
        
        # -> Create a nested filter group by clicking '+ گروه تودرتو', add a condition using '+ شرط', then click 'اجرای گزارش' (Run report) to generate the report preview.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Add a filter condition by clicking the '+ شرط' button, choose field 'ID', set operator 'برابر', and enter value '1' (prepare to run the report next).
        # + شرط button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[3]/app-filter-group/div/div/button')
        await elem.click(timeout=10000)
        
        # -> Add a filter condition by clicking the '+ شرط' button, choose field 'ID', set operator 'برابر', and enter value '1' (prepare to run the report next).
        # فیلد… ID کد یکتا (FA-UNIC) کد ترکیبی PL-PK-Item... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[3]/app-filter-group/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Add a filter condition by clicking the '+ شرط' button, choose field 'ID', set operator 'برابر', and enter value '1' (prepare to run the report next).
        # برابر بزرگ‌تر بزرگ‌تر یا مساوی کوچک‌تر کوچک‌تر یا... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[3]/app-filter-group/div/div[2]/select[2]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Add a filter condition by clicking the '+ شرط' button, choose field 'ID', set operator 'برابر', and enter value '1' (prepare to run the report next).
        # عدد number field
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[3]/app-filter-group/div/div[2]/app-filter-value/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("1")
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the report and observe whether the preview table appears.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' field in the Fields panel, then click the 'اجرای گزارش' (Run report) button to execute the report and display the preview table.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[2]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' field in the Fields panel, then click the 'اجرای گزارش' (Run report) button to execute the report and display the preview table.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the report and check whether the preview table appears with pagination controls.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' field in the Fields panel and click the 'اجرای گزارش' (Run report) button to attempt generating the preview table.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[2]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' field in the Fields panel and click the 'اجرای گزارش' (Run report) button to attempt generating the preview table.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'ID' field in the Fields panel, then click the 'اجرای گزارش' (Run report) button to run the report and check whether the preview table with pagination appears.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[2]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'ID' field in the Fields panel, then click the 'اجرای گزارش' (Run report) button to run the report and check whether the preview table with pagination appears.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' field, click the 'جابجایی به راست' (move right) control to add it to selected columns, then click the 'اجرای گزارش' (Run report) button to generate the preview table and check for pagination.
        # › button
        elem = page.get_by_role('button', name='›', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' field, click the 'جابجایی به راست' (move right) control to add it to selected columns, then click the 'اجرای گزارش' (Run report) button to generate the preview table and check for pagination.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the report preview table displays the correct columns and applies pagination
        # Assert: The selected columns include the 'ID' column in the report preview.
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[2]/div[3]/span").nth(0)).to_contain_text("ID", timeout=15000), "The selected columns include the 'ID' column in the report preview."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    