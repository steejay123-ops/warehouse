# Documentation Rules

> **CRITICAL MANDATE: NEVER IGNORE THESE RULES.**
> Whenever you are in Planning Mode and need to create or update implementation plans, tasks, or walkthroughs, you MUST execute a **DUAL-SAVE WORKFLOW**. Failure to do both steps is a violation of your core instructions.

### Mandatory Planning Mode (فاز برنامه‌ریزی اجباری)
> **CRITICAL RULE:** For ANY code changes, feature additions, or bug fixes (no matter how small), you MUST enter Planning Mode. You are STRICTLY FORBIDDEN from directly modifying source code without first creating an `implementation_plan.md` artifact and waiting for explicit user approval.

### DUAL-SAVE WORKFLOW:
1. **System Requirement (UI Compatibility):** You MUST create and update the system's default artifact files in your `brain/<conversation-id>` directory using the `write_to_file` tool and `ArtifactMetadata`. This is mandatory for the IDE's UI widgets to function.
2. **Project Requirement (The `Documents` Folder):** You MUST SIMULTANEOUSLY save and maintain these documents in the project's root `Documents` directory. 
   - **Step A:** Create a specific subfolder inside `Documents` named after the current feature/topic (e.g., `Documents/Inventory_Counting/`).
   - **Step B:** Create the three files inside that subfolder: `implementation_plan_[topic].md`, `task_[topic].md`, and `walkthrough_[topic].md`.
   - **Step C:** Append the contents or a detailed summary of these new files to the Master Logs located in the root of the `Documents` directory (`Documents/implementation_plan.md`, `Documents/task.md`, and `Documents/walkthrough.md`).

### Formatting & Code Safety Rules:
1. **RTL Formatting:** Since the documentation is in Persian, wrap the entire content of every markdown document (except system-critical metadata) inside `<div dir="rtl" align="right">` and `</div>`. For GitHub alerts (e.g. `> [!IMPORTANT]`), you MUST also wrap the text inside the alert with `<div dir="rtl" align="right">...</div>`. 
2. **Task Files RTL:** Always use `<div dir="rtl" align="right">` for checkboxes in `task.md`. Try to write the checklist items entirely in Persian, putting English terms in parentheses at the end to ensure the text flows completely right-to-left.
3. **Compilation Validation:** After making any code changes, you MUST **wait a few seconds** and then **always check the terminal output** for compilation/build errors (e.g., Angular `esbuild` errors, TypeScript errors, Django traceback). You are STRICTLY FORBIDDEN from reporting to the user that a task is finished until you have verified that the terminal is free of errors. If any errors occur, you must immediately fix them before returning a response.

### Rules for File Editing and Git Operations
1. **NEVER use `git restore`, `git reset --hard`, `git checkout -- <file>`, or any command that discards uncommitted changes** without EXPLICIT approval from the user. Reverting files using Git can destroy hours of uncommitted work. 
2. **Exact Matching for HTML/Template files:** When editing files with many repetitive tags (e.g., `<ng-template>` in Angular HTML), DO NOT rely on fuzzy matching (`multi_replace_file_content`). Always use exact line numbers (`replace_file_content`) to prevent accidentally corrupting or deleting surrounding code.
3. **Always check for uncommitted changes:** Before taking any drastic action to fix a broken file, check `git status`. If there are uncommitted changes, prioritize fixing the code manually line-by-line rather than resetting the file.
