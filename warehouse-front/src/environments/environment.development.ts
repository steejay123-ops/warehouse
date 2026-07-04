/**
 * Environment — Development
 * هنگام اجرای ng serve استفاده می‌شود
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  /** مدت زمان اعتبار access token به میلی‌ثانیه (۱۵ دقیقه) */
  accessTokenLifetime: 15 * 60 * 1000,
  /** استفاده از mock data بجای API واقعی — فعلاً true تا بک‌اند آماده شود */
  useMockData: false,
};
