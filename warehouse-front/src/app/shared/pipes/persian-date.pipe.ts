import { Pipe, PipeTransform } from '@angular/core';

/**
 * تبدیل تاریخ ISO به تاریخ شمسی خوانا
 *
 * استفاده:
 *   {{ record.created_at | persianDate }}
 *   {{ record.created_at | persianDate:'short' }}
 *   {{ record.created_at | persianDate:'long' }}
 */
@Pipe({
  name: 'persianDate',
  standalone: true,
})
export class PersianDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, format: 'short' | 'medium' | 'long' = 'medium'): string {
    if (!value) return '—';

    try {
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) return String(value);

      const options: Intl.DateTimeFormatOptions = this.getOptions(format);
      return new Intl.DateTimeFormat('fa-IR', options).format(date);
    } catch {
      return String(value);
    }
  }

  private getOptions(format: string): Intl.DateTimeFormatOptions {
    switch (format) {
      case 'short':
        return { year: 'numeric', month: '2-digit', day: '2-digit' };
      case 'long':
        return { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' };
      case 'medium':
      default:
        return { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    }
  }
}
