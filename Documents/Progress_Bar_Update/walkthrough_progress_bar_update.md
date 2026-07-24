# Walkthrough: Dynamic Progress Bar

## Overview
This walkthrough summarizes the UI updates implemented to make the monitoring dashboard's progress bar dynamic. 

## Technical Details

### Backend
- No changes required. The `WarehouseSerializer` already computed `total_quantity` and `counted_quantity` fields and provided them via `/api/warehouses/`.

### Frontend
- **layout.ts:** Added a new getter `progressStats`.
  - Retrieves current state from `AuthStore` and `StateService`.
  - Distinguishes between Global Dashboard (`isWarehouseContext == false`) and Warehouse-Specific views (`isWarehouseContext == true`).
  - Aggregates or retrieves counts accordingly.
  - Dynamically computes a percentage, a CSS color class, a label, and a tooltip.
- **layout.html:**
  - Replaced the hardcoded '38%' values with Angular bindings to `progressStats.percent`.
  - Applied `[ngClass]="progressStats.colorClass"` for dynamic coloring.
  - Set a `[title]` attribute on the wrapper div for hover tooltips.
  - Used `{{progressStats.label}}` to change the text from "پیشرفت کل پروژه:" to "پیشرفت انبار:".

## Result
The progress bar now accurately reflects real-time counting completion ratios while providing granular feedback (via tooltips) and aesthetic status indicators (via color classes).
