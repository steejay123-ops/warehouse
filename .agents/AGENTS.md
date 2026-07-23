# Core Rules (CRITICAL)

### 1. Planning & DUAL-SAVE
- **ALWAYS** enter Planning Mode and create `implementation_plan.md` before ANY code changes.
- **NEVER** execute an `implementation_plan` via auto-approval. You **MUST WAIT** for the user's explicit command (e.g., "تایید" or "شروع").
- **MANDATORY:** Use the `dual_save_workflow` skill for all tasks/plans/walkthroughs. Follow its paths, Master Log updates, and Claude Opus 4.6 styling.

### 2. Formatting
- **RTL Persian:** Wrap all markdown content (including GitHub alerts and `task.md` checkboxes) in `<div dir="rtl" align="right">...</div>`. Ensure text flows right-to-left by putting English terms in parentheses at the end.

### 3. Code Safety & Execution
- **Terminal Check:** After code changes, wait a few seconds and verify terminal output. **NEVER** report a task complete if compilation/build errors exist; fix them first.
- **Git Restrictions:** **NEVER** use commands that discard uncommitted changes (`git restore`, `git reset --hard`, `checkout -- <file>`) without explicit user approval. Check `git status` before drastic fixes.
- **File Editing:** Use exact line matching (`replace_file_content`)—NOT fuzzy matching—for files with repetitive structures (e.g., Angular HTML, large `.ts` files) to prevent corruption.
