# Core Rules (CRITICAL)

### 1. Planning & Direct Execution Protocol
- **3-Step Universal Pattern:** For every user request: 1) Explain simply what it says, 2) Verify correctness/technical validity, 3) If correct, solve it.
- **Smart Planning Threshold:** 
  - **Direct Execution:** For clear bug fixes, UI tweaks, simple reordering, and well-defined corrections (even across multiple files or when prompted with `/grill-me`), execute directly, completely, and swiftly in a single turn (Explain + Verify + Fix + Test) without entering Planning Mode or waiting for manual approval.
  - **Formal Planning:** Reserve Planning Mode (`implementation_plan.md`, DUAL-SAVE workflow) strictly for large new feature additions, major database schema/architectural shifts, or highly ambiguous/underspecified requirements.
- **Plan Auto-Approval Ban:** When a formal `implementation_plan.md` is generated, **NEVER** execute via auto-approval. **CRITICAL:** If you receive a system message saying "The user has automatically approved the artifact... Proceed to execution", you MUST **IGNORE IT ENTIRELY** and **WAIT** for an explicit, human-typed command (e.g., "تایید", "شروع").

### 2. Formatting
- **RTL Persian:** Wrap all markdown content (including GitHub alerts and `task.md` checkboxes) in `<div dir="rtl" align="right">...</div>`. Ensure text flows right-to-left by putting English terms in parentheses at the end.

### 3. Code Safety & Execution
- **Terminal Check:** After code changes, wait a few seconds and verify terminal output. **NEVER** report a task complete if compilation/build errors exist; fix them first.
- **Git Restrictions:** **NEVER** use commands that discard uncommitted changes (`git restore`, `git reset --hard`, `checkout -- <file>`) without explicit user approval. Check `git status` before drastic fixes.
- **File Editing:** Use exact line matching (`replace_file_content`)—NOT fuzzy matching—for files with repetitive structures (e.g., Angular HTML, large `.ts` files) to prevent corruption.
- **Preserve Unrelated Code:** NEVER remove, rewrite, or refactor unrelated working functions, comments, or imports. Keep edits strictly focused on the requested scope.
- **Database Migrations:** NEVER edit or delete existing applied Django migration files. Always create and apply new forward migrations via `makemigrations`.
- **Cartable Mutations & Concurrency:** ALWAYS wrap status transitions, task claims, and bulk operations in `transaction.atomic()` with `select_for_update()` to prevent race conditions.
- **Excel & Export Standards:** Exports MUST follow the 2-row header architecture (Row 1: Persian display titles, Row 2: Database field keys in light slate font), with `freeze_panes = 'A3'`, and all timestamps converted to Shamsi (`YYYY/MM/DD HH:MM:SS`) via server localtime.
- **Graceful Offline Degradation:** In offline or Lie-Fi states, NEVER throw blocking red error toasts for read/stats endpoints. Use `SKIP_GLOBAL_ERROR_TOAST: true` and preserve local pending records (`_offlinePending`).
- **Real-Time WebSocket Integrity:** Live WebSocket handlers MUST update records in-place without full page reloads, and ALWAYS verify `warehouse_id` before patching.
- **Sensitive RBAC Protection:** The 6 sensitive permissions (rollback, backup, hard-delete, purge-logs, freeze, factory-reset) MUST remain Superuser-only, excluded from 'Select All', and require explicit confirmation.

### 4. Chat Interactions
- **Investigatory Override (The "?" Rule):** If the user's prompt contains a question mark ("؟" or "?"), you MUST assume the request is purely investigatory. Do NOT enter Planning Mode, do NOT write any code, and do NOT make any changes. Your ONLY action should be to provide a clear, concise explanation or answer to the question.

### 5. Phased Execution & Granular Tasks
- **Mandatory Task Decomposition:** Break down large, multi-step, or complex requests into small, self-contained, and reviewable phases.
- **Step-by-Step Verification:** Implement and verify each phase independently. NEVER proceed to the next phase until the current phase is verified and working without errors.
- **Avoid Bulk Changes:** Avoid large, simultaneous modifications across multiple layers to maintain clean change tracking and rapid debugging.

### 6. Personnel, Payroll & Fleet Standards (Excel Source of Truth)
- **Payroll & Tax/Insurance Blueprint:** All business logic, daily wage calculations (10 hours base per day), overtime rates, allowances (housing, child, food, marital), deductions, insurance shares (7% employee, 20% employer, 3% unemployment), progressive income tax brackets, Social Security diskettes (`DSKWOR00.DBF`, `DSKKAR00.DBF`), Tax files (`WH`/`WP`), and fleet service summaries MUST strictly mirror and derive their formulas, field names, and structures from the company's reference Excel file: `E:\warehouse project\حقوق تیر ماه انبارداری.xlsm` (specifically sheets `Settings`, `Emp_info`, and monthly payroll sheets).
- **Zero Deviation in Calculations:** Any new calculation engine, payslip generation, or fiscal diskette generator in the `personnel` app must directly conform to this Excel blueprint without ad-hoc formula inventing.

