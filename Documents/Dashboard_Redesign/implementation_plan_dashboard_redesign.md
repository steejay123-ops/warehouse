# Dashboard Redesign Plan

Based on the engineering discussion, this plan outlines a comprehensive redesign of the warehouse dashboard to provide clear, actionable, and scalable insights. The new layout replaces simple progress bars with robust, purpose-built data visualizations.

> [!NOTE]
> This is a structural UI/UX redesign. The backend `/api/inventory/dashboard_stats/` endpoint already provides most of the required data (total items, daily counts, conflicts). We will leverage a charting library (e.g., ECharts or Chart.js) if available, or build pure CSS/HTML charts for the new layout.

## Proposed Changes

### 1. North Star: Overall Progress (Donut Chart)
- **Component**: Top of the dashboard.
- **Action**: Replace the current text-heavy overall progress section with a large circular/donut chart.
- **Metric**: `(overallStats.done / overallStats.total)`. Visually shows "Finished vs Remaining" for the entire warehouse.

### 2. Funnel Chart: Operational Pipeline
- **Component**: Middle section, taking up 1/3 of the width.
- **Action**: Implement a CSS-based or SVG-based Funnel Chart.
- **Metric**: 
  - Step 1: Counted (`overallStats.count` or similar)
  - Step 2: Documents Approved (`overallStats.docs_approved`)
  - Step 3: MT26 Fed (`overallStats.done`)
- **Purpose**: Instantly highlights bottlenecks (e.g., if step 1 is huge and step 2 is tiny, the docs team is the bottleneck).

### 3. Velocity Trend: 14-Day Performance with Target Line
- **Component**: Middle section, taking up 2/3 of the width.
- **Action**: Combine the current "Today", "Yesterday", "Last Week", and "Mini Weekly Chart" into a single robust Bar Chart.
- **Metric**: Daily `count`, `docs`, and `feed` values.
- **Target Line**: Add a dashed horizontal line representing the "Daily Target" (e.g., 1000 items). This gives the chart meaning without needing to scale to the absolute total warehouse size.

### 4. KPI Cards
- **Component**: Row below the overall progress.
- **Action**: Convert the daily progress bars into clean, numeric KPI cards (Today's Count, Yesterday's Count, Weekly Average) featuring a small percentage trend arrow (e.g., `▲ +15%`).

### 5. Action Center (Alerts)
- **Component**: Bottom section.
- **Action**: Convert raw anomaly counts (like `overallStats.conflicts`) into textual action alerts. (e.g., "⚠️ 45 items have counting conflicts").

## Open Questions for the User
- **Chart Library**: Do you have a preferred charting library already installed (e.g., `ngx-echarts`, `ng2-charts`/Chart.js), or should I implement these using pure CSS/SVG as done previously?
- **Daily Target**: What is a realistic default daily target for the velocity chart (e.g., 1000 items/day), or should this be a setting in the backend?
