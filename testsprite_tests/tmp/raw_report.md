
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** warehouse project
- **Date:** 2026-07-31
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Sign in and reach the dashboard
- **Test Code:** [TC001_Sign_in_and_reach_the_dashboard.py](./TC001_Sign_in_and_reach_the_dashboard.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/f736c118-568d-4e47-9bd6-47028c996db1/69a5283f-a55d-42ff-9714-aa0ea28088d2
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Block unauthenticated access to protected routes
- **Test Code:** [TC002_Block_unauthenticated_access_to_protected_routes.py](./TC002_Block_unauthenticated_access_to_protected_routes.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/f736c118-568d-4e47-9bd6-47028c996db1/6e49bb6e-f3d2-45c4-b7cc-9faf0cc0f000
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Edit a dispatch record and keep the changes visible
- **Test Code:** [TC003_Edit_a_dispatch_record_and_keep_the_changes_visible.py](./TC003_Edit_a_dispatch_record_and_keep_the_changes_visible.py)
- **Test Error:** TEST BLOCKED

The test could not be run — no dispatch records are available to open and edit.

Observations:
- The dispatch inbox shows the empty-state message: 'هیچ کالایی برای شمارش وجود ندارد.'
- The 'تسک‌های من' tab displays no dispatch rows or items to select for editing
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/f736c118-568d-4e47-9bd6-47028c996db1/bd5cf4a5-949b-4af3-b391-696f0e72f58e
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 View dashboard metrics after signing in
- **Test Code:** [TC004_View_dashboard_metrics_after_signing_in.py](./TC004_View_dashboard_metrics_after_signing_in.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/f736c118-568d-4e47-9bd6-47028c996db1/5d9f0c7c-fb12-4509-97bd-33c56f0a25f0
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Open dispatch from the signed-in area
- **Test Code:** [TC005_Open_dispatch_from_the_signed_in_area.py](./TC005_Open_dispatch_from_the_signed_in_area.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/f736c118-568d-4e47-9bd6-47028c996db1/63d5f9a0-a0d0-49c7-bd87-4a993878b9bd
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Move across projects and users after signing in
- **Test Code:** [TC006_Move_across_projects_and_users_after_signing_in.py](./TC006_Move_across_projects_and_users_after_signing_in.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/f736c118-568d-4e47-9bd6-47028c996db1/f3f0634e-f767-4468-b407-32e5dc0c8c3a
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Open projects and users from the dashboard
- **Test Code:** [TC007_Open_projects_and_users_from_the_dashboard.py](./TC007_Open_projects_and_users_from_the_dashboard.py)
- **Test Error:** TEST FAILURE

The Projects navigation item is missing from the sidebar, so the Projects page cannot be reached from the dashboard.

Observations:
- The sidebar displays navigation items such as 'داشبورد مانیتورینگ کلی', 'کاربران و نقش ها', and 'انبارها', but no 'پروژه' or 'پروژه‌ها' link is present.
- The Users page ('کاربران و نقش‌ها') is accessible and visible after login; occurrences of the word 'پروژه' appear only inside user role badges (e.g., 'مدیریت پروژه') and are not navigation links.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/f736c118-568d-4e47-9bd6-47028c996db1/5be6077f-a0e2-42d3-a48d-385dbf3ac2e7
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 See required-field validation on login
- **Test Code:** [TC008_See_required_field_validation_on_login.py](./TC008_See_required_field_validation_on_login.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/f736c118-568d-4e47-9bd6-47028c996db1/3243d3ad-fe7b-43ac-aa31-5fce1d73a12a
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **75.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---