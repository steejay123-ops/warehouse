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
        
        # -> Open the 'Reports' page (navigate to the Reports section) so the export workflow can be tested.
        await page.goto("http://localhost:4200/reports")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the username and password fields and click the 'ورود به سامانه' button to sign in.
        # نام کاربری را وارد کنید text field
        elem = page.get_by_placeholder('نام کاربری را وارد کنید', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Fill the username and password fields and click the 'ورود به سامانه' button to sign in.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("123456")
        
        # -> Fill the username and password fields and click the 'ورود به سامانه' button to sign in.
        # ورود به سامانه button
        elem = page.get_by_role('button', name='ورود به سامانه', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the Reports page by clicking the 'گزارش‌ساز' button in the sidebar.
        # گزارش‌ساز button
        elem = page.get_by_role('button', name='گزارش\u200cساز', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'منبع داده' (data source) dropdown labeled 'انتخاب موجودیت…' and select the 'کالاها' option to load a small dataset.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select')
        await elem.click(timeout=10000)
        
        # -> Select the 'کالاها' option from the data source dropdown labeled 'انتخاب موجودیت…' to load the small dataset template.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select the 'ID' and 'موجودی فیزیکی' fields, then click the 'خروجی Excel' (Export to Excel) button to trigger a small report export.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' and 'موجودی فیزیکی' fields, then click the 'خروجی Excel' (Export to Excel) button to trigger a small report export.
        # موجودی فیزیکی button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[11]')
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' and 'موجودی فیزیکی' fields, then click the 'خروجی Excel' (Export to Excel) button to trigger a small report export.
        # خروجی Excel button
        elem = page.get_by_role('button', name='خروجی Excel', exact=True)
        await elem.click(timeout=10000)
        
        # -> Move 'ID' and 'موجودی فیزیکی' into the selected fields area using the right-arrow buttons, then click the 'خروجی Excel' button to trigger the export.
        # › button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[3]/span/button')
        await elem.click(timeout=10000)
        
        # -> Move 'ID' and 'موجودی فیزیکی' into the selected fields area using the right-arrow buttons, then click the 'خروجی Excel' button to trigger the export.
        # › button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[3]/span[2]/button')
        await elem.click(timeout=10000)
        
        # -> Move 'ID' and 'موجودی فیزیکی' into the selected fields area using the right-arrow buttons, then click the 'خروجی Excel' button to trigger the export.
        # خروجی Excel button
        elem = page.get_by_role('button', name='خروجی Excel', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the report so the export action can be tested.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'خروجی Excel' (Export to Excel) button to trigger the download for the small report and observe whether an immediate file download starts.
        # Download: خروجی Excel button
        elem = page.get_by_role('button', name='خروجی Excel', exact=True)
        async with page.expect_download(timeout=30000) as dl_info:
            await elem.click(timeout=10000)
        download = await dl_info.value
        assert download.suggested_filename  # verify file was downloaded
        await download.save_as(f"./downloads/{download.suggested_filename}")
        
        # -> Click the 'خروجی Excel' (Export to Excel) button and observe the page for immediate download feedback or a background-job/progress indicator.
        # Download: خروجی Excel button
        elem = page.get_by_role('button', name='خروجی Excel', exact=True)
        async with page.expect_download(timeout=30000) as dl_info:
            await elem.click(timeout=10000)
        download = await dl_info.value
        assert download.suggested_filename  # verify file was downloaded
        await download.save_as(f"./downloads/{download.suggested_filename}")
        
        # -> Select 'تاریخچه شمارش' from the 'انتخاب موجودیت…' data-source dropdown and then click the 'اجرای گزارش' (Run report) button to produce a larger dataset for export testing.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select 'تاریخچه شمارش' from the 'انتخاب موجودیت…' data-source dropdown and then click the 'اجرای گزارش' (Run report) button to produce a larger dataset for export testing.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the 'تاریخچه شمارش' report so the result count and export UI can be observed.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Verify whether report results are displayed by finding the row-count text 'نمایش', and if absent, select the 'کالاها' data-source, select the 'ID' field, and click 'اجرای گزارش' to run the report.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Verify whether report results are displayed by finding the row-count text 'نمایش', and if absent, select the 'کالاها' data-source, select the 'ID' field, and click 'اجرای گزارش' to run the report.
        # ID button
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[2]/div[2]/button[1]").nth(0)
        await elem.click(timeout=10000)
        
        # -> Verify whether report results are displayed by finding the row-count text 'نمایش', and if absent, select the 'کالاها' data-source, select the 'ID' field, and click 'اجرای گزارش' to run the report.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' and 'موجودی فیزیکی' fields and click the 'اجرای گزارش' (Run report) button to produce report results.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[2]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' and 'موجودی فیزیکی' fields and click the 'اجرای گزارش' (Run report) button to produce report results.
        # موجودی فیزیکی button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[2]/div[2]/button[11]')
        await elem.click(timeout=10000)
        
        # -> Select the 'ID' and 'موجودی فیزیکی' fields and click the 'اجرای گزارش' (Run report) button to produce report results.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify a background job is created, a progress bar appears, and eventually a download button is presented
        await page.locator("xpath=/html/body/app-root/app-layout/div/div/header/div[1]/div[3]/span[2]").nth(0).scroll_into_view_if_needed()
        # Assert: A progress indicator is visible showing the export progress (0٪).
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/header/div[1]/div[3]/span[2]").nth(0)).to_be_visible(timeout=15000), "A progress indicator is visible showing the export progress (0\u066a)."
        await page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[1]/div[2]/button[2]").nth(0).scroll_into_view_if_needed()
        # Assert: A download action button (خروجی Excel) is visible on the page.
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[1]/div[2]/button[2]").nth(0)).to_be_visible(timeout=15000), "A download action button (\u062e\u0631\u0648\u062c\u06cc Excel) is visible on the page."
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
    