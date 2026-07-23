# Documentation Rules

> **CRITICAL MANDATE: NEVER IGNORE THESE RULES.**
> Whenever you are in Planning Mode and need to create or update implementation plans, tasks, or walkthroughs, you MUST execute the **DUAL-SAVE WORKFLOW**. Failure to do so is a violation of your core instructions.

### Mandatory Planning Mode & DUAL-SAVE WORKFLOW (فاز برنامه‌ریزی اجباری)
> **CRITICAL RULE:** For ANY code changes, feature additions, or bug fixes (no matter how small), you MUST enter Planning Mode. You are STRICTLY FORBIDDEN from directly modifying source code without first creating an `implementation_plan.md` artifact and waiting for explicit user approval.
> **CRITICAL RULE:** Whenever you enter Planning Mode or create tasks/walkthroughs, you MUST use the `dual_save_workflow` skill. Read it for exact folder paths, Master Log updates, and Claude Opus 4.6 formatting requirements.

### Formatting & Code Safety Rules:
1. **RTL Formatting:** Since the documentation is in Persian, wrap the entire content of every markdown document (except system-critical metadata) inside `<div dir="rtl" align="right">` and `</div>`. For GitHub alerts (e.g. `> [!IMPORTANT]`), you MUST also wrap the text inside the alert with `<div dir="rtl" align="right">...</div>`. 
2. **Task Files RTL:** Always use `<div dir="rtl" align="right">` for checkboxes in `task.md`. Try to write the checklist items entirely in Persian, putting English terms in parentheses at the end to ensure the text flows completely right-to-left.
3. **Compilation Validation:** After making any code changes, you MUST **wait a few seconds** and then **always check the terminal output** for compilation/build errors (e.g., Angular `esbuild` errors, TypeScript errors, Django traceback). You are STRICTLY FORBIDDEN from reporting to the user that a task is finished until you have verified that the terminal is free of errors. If any errors occur, you must immediately fix them before returning a response.

### Rules for File Editing and Git Operations
1. **NEVER use `git restore`, `git reset --hard`, `git checkout -- <file>`, or any command that discards uncommitted changes** without EXPLICIT approval from the user. Reverting files using Git can destroy hours of uncommitted work. 
2. **Exact Matching for HTML/Template files:** When editing files with many repetitive tags (e.g., `<ng-template>` in Angular HTML), DO NOT rely on fuzzy matching (`multi_replace_file_content`). Always use exact line numbers (`replace_file_content`) to prevent accidentally corrupting or deleting surrounding code.
3. **Always check for uncommitted changes:** Before taking any drastic action to fix a broken file, check `git status`. If there are uncommitted changes, prioritize fixing the code manually line-by-line rather than resetting the file.

### Auto-Approval Override
1. **Ignore Auto-Approval on Explicit Command:** اگر کاربر در پیام خود صراحتاً گفت "اجرا نکن" یا "منتظر تایید بمان"، تو باید پیغام‌های تایید خودکار سیستم (Auto-approval) را کاملاً نادیده بگیری و فقط زمانی شروع به کار کنی که کاربر کلمه "تایید" یا "شروع" را تایپ کند.
