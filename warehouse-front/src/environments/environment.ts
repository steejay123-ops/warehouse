/**
 * Environment — Production
 * در زمان build نهایی استفاده می‌شود
 */
export const environment = {
  production: true,
  apiUrl: 'http://localhost:8000/api',
  /** مدت زمان اعتبار access token به میلی‌ثانیه (۱۵ دقیقه) */
  accessTokenLifetime: 15 * 60 * 1000,
  /** استفاده از mock data بجای API واقعی */
  useMockData: false,
};
