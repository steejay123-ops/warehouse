import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemApiService } from '../../core/api/item-api.service';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  weeklyData: any[] = [];
  overallMax = 750;
  isRefreshing: Record<string, boolean> = {};

  todayStats: any = { count: 0, docs: 0, feed: 0 };
  yesterdayStats: any = { count: 0, docs: 0, feed: 0 };
  lastWeekStats: any = { count: 0, docs: 0, feed: 0 };
  overallStats: any = { total: 0, printed: 0, conflicts: 0, done: 0 };

  constructor(
    private cdr: ChangeDetectorRef,
    private itemApi: ItemApiService,
    public state: StateService
  ) {}

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    const projectId = this.state.appState.activeWarehouseId?.toString() || 'ALL';
    this.itemApi.getDashboardStats(projectId).subscribe((res: any) => {
      this.weeklyData = res.weekly_data;
      this.overallMax = res.overallMax || 10;
      this.todayStats = res.today;
      this.yesterdayStats = res.yesterday;
      this.lastWeekStats = res.last_week_totals;
      this.overallStats = res.overall;
      this.cdr.detectChanges();
    });
  }

  refreshSingleCard(cardId: string) {
    if (this.isRefreshing[cardId]) return;
    this.isRefreshing[cardId] = true;
    
    const projectId = this.state.appState.activeWarehouseId?.toString() || 'ALL';
    this.itemApi.getDashboardStats(projectId).subscribe((res: any) => {
      this.weeklyData = res.weekly_data;
      this.overallMax = res.overallMax || 10;
      this.todayStats = res.today;
      this.yesterdayStats = res.yesterday;
      this.lastWeekStats = res.last_week_totals;
      this.overallStats = res.overall;
      
      this.isRefreshing[cardId] = false;
      this.cdr.detectChanges();
    }, () => {
      this.isRefreshing[cardId] = false;
      this.cdr.detectChanges();
    });
  }

  dailyTarget = 1000; // Default daily target

  get totalCounted() {
    const isWh = this.state.appState.activeWarehouseId && this.state.appState.activeWarehouseId !== 'ALL';
    const projects = this.state.appState.projects || [];
    if (isWh) {
      const p = projects.find((x: any) => x.id === Number(this.state.appState.activeWarehouseId));
      return p ? p.counted_quantity : 0;
    }
    return projects.reduce((sum: number, p: any) => sum + (p.counted_quantity || 0), 0);
  }

  get totalPercent() {
    if (!this.overallStats.total) return 0;
    return Math.min(100, Math.round((this.totalCounted / this.overallStats.total) * 100));
  }

  get donutDashArray() {
    return `${this.totalPercent}, 100`;
  }

  get todayTrend() {
    const today = this.todayStats.count || 0;
    const yesterday = this.yesterdayStats.count || 0;
    if (yesterday === 0) return { val: 0, dir: 'up' };
    const diff = today - yesterday;
    return {
      val: Math.round(Math.abs(diff / yesterday) * 100),
      dir: diff >= 0 ? 'up' : 'down'
    };
  }

  getHeight(val: number): string {
    // Relative to a reasonable max or target to make the chart meaningful
    const max = Math.max(this.overallMax, this.dailyTarget);
    return Math.max((val / max) * 100, 2) + '%';
  }
}
