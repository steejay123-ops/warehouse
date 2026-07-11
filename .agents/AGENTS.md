# Documentation Rules

Whenever you are in Planning Mode and need to create or update implementation plans, tasks, or walkthroughs, you MUST follow these documentation rules:

1. **Project Documents Folder:** Create and maintain a directory named `Documents` in the root of the project.
2. **Feature-Specific Subfolders:** For every new feature or plan, create a specific subfolder inside `Documents` named after the topic (e.g., `Documents/Inventory_Counting_Workflow`).
3. **Feature-Specific Files:** Inside this subfolder, create three files with specific names:
   - `implementation_plan_[topic].md`
   - `task_[topic].md`
   - `walkthrough_[topic].md`
4. **Master Logs:** In the root of the `Documents` directory, maintain three master files (`implementation_plan.md`, `task.md`, and `walkthrough.md`). Append the contents or a detailed summary/link of the new feature-specific files to these master files so they act as a continuous, aggregated log of the entire project's lifecycle.
5. **UI Compatibility:** You must STILL update the system's default artifact files in your `brain/<conversation-id>` directory exactly as required by the `<planning_mode_artifacts>` system prompt, so the UI widgets continue to function normally.
6. **RTL Formatting:** Since the documentation is in Persian, wrap the entire content of every markdown document (except system-critical metadata) inside `<div dir="rtl" align="right">` and `</div>`. For GitHub alerts (e.g. `> [!IMPORTANT]`), since they can break RTL inheritance, you MUST also wrap the text inside the alert with `<div dir="rtl" align="right">...</div>`. 
7. **Task Files RTL:** For `task.md` checklists, the IDE widget might sometimes align checkboxes to the left if English text is placed first. Always use `<div dir="rtl" align="right">` and try to write the checklist items entirely in Persian, putting English terms in parentheses at the end to ensure the text flows completely right-to-left.
