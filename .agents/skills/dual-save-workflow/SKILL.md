---
name: dual_save_workflow
description: Executing the mandatory DUAL-SAVE workflow for planning and documenting project changes, including folder structures and Claude Opus 4.6 styling.
---

# DUAL-SAVE WORKFLOW
Whenever you are in Planning Mode and need to create or update implementation plans, tasks, or walkthroughs, you MUST execute a DUAL-SAVE WORKFLOW.

1. **System Requirement (UI Compatibility):** You MUST create and update the system's default artifact files in your `brain/<conversation-id>` directory using the `write_to_file` tool and `ArtifactMetadata`. This is mandatory for the IDE's UI widgets to function.
2. **Project Requirement (The `Documents` Folder):** You MUST SIMULTANEOUSLY save and maintain these documents in the project's root `Documents` directory. 
   - **Step A:** Create a specific subfolder inside `Documents` named after the current feature/topic (e.g., `Documents/Inventory_Counting/`).
   - **Step B:** Create the three files inside that subfolder: `implementation_plan_[topic].md`, `task_[topic].md`, and `walkthrough_[topic].md`.
   - **Step C:** Append the contents or a detailed summary of these new files to the Master Logs located in the root of the `Documents` directory (`Documents/implementation_plan.md`, `Documents/task.md`, and `Documents/walkthrough.md`).

## Claude Opus 4.6 Style Reporting & Artifacts
When writing artifacts (`task.md`, `walkthrough.md`, `implementation_plan.md`) and when giving status updates in the chat, you MUST emulate the highly structured and readable style of Claude Opus 4.6.
- Extensive use of **Markdown tables** to present file changes, task priorities, and summaries.
- Logical structuring with clear, numbered sections and subheadings.
- Smart usage of **GitHub Alerts** (`> [!TIP]`, `> [!IMPORTANT]`, `> [!NOTE]`) for architecture notes, questions, and warnings.
- Providing step-by-step, transparent, and detailed reporting in the chat.
- Maintaining RTL wrapping (`<div dir="rtl" align="right">`) flawlessly even inside alerts.
