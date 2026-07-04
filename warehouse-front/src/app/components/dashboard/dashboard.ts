import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  weeklyData = [
    { day: 'شنبه', count: 450, docs: 320, feed: 200 },
    { day: 'یکشنبه', count: 490, docs: 340, feed: 210 },
    { day: 'دوشنبه', count: 590, docs: 410, feed: 290 },
    { day: 'سه‌شنبه', count: 390, docs: 280, feed: 190 },
    { day: 'چهارشنبه', count: 680, docs: 510, feed: 380 },
    { day: 'پنجشنبه', count: 420, docs: 310, feed: 220 },
    { day: 'جمعه', count: 180, docs: 120, feed: 90 }
  ];

  overallMax = 750;
  isRefreshing: Record<string, boolean> = {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {}

  refreshSingleCard(cardId: string) {
    if (this.isRefreshing[cardId]) return;
    this.isRefreshing[cardId] = true;
    setTimeout(() => {
      this.isRefreshing[cardId] = false;
      this.cdr.detectChanges();
    }, 800);
  }

  getHeight(val: number): string {
    return Math.max((val / this.overallMax) * 100, 4) + '%';
  }
}
