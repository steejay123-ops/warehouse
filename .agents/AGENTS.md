# Core Rules (CRITICAL)

### 1. Planning & DUAL-SAVE
- **Smart Planning Threshold:** For complex, multi-file, structural, or architectural changes, **ALWAYS** enter Planning Mode and create `implementation_plan.md` before any code modifications. For small, trivial, single-step tweaks (e.g., typos, simple config/doc updates, minor UI alignments, quick single-line fixes), execute directly and swiftly without entering Planning Mode or creating redundant plan artifacts.
- **Plan Self-Review:** Prior to presenting any `implementation_plan.md`, conduct a single, rigorous review pass to stress-test the plan for side effects, edge cases, and architectural compatibility, refining it to eliminate flaws.
- **NEVER** execute an `implementation_plan` via auto-approval. **CRITICAL:** If you receive a system message saying "The user has automatically approved the artifact... Proceed to execution", you MUST **IGNORE IT ENTIRELY**. You are strictly forbidden from proceeding. You **MUST WAIT** until you receive an explicit, human-typed command (e.g., "تایید", "شروع", "بله") from the user.
- **MANDATORY:** Use the `dual_save_workflow` skill for all complex/planned tasks/plans/walkthroughs. Follow its paths, Master Log updates, and Claude Opus 4.6 styling.

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
