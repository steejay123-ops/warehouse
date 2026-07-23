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

  getHeight(val: number): string {
    return Math.max((val / this.overallMax) * 100, 4) + '%';
  }
}
