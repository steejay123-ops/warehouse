import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-placeholders',
  imports: [CommonModule],
  template: `
    <div class="p-8 text-center text-slate-500 font-bold fade-in" dir="rtl">
      این بخش در دست توسعه است...
    </div>
  `
})
export class Placeholders {}
