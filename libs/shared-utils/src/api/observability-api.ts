import { axiosInstance } from '../axios-instance';
import type { components } from '@dwp-frontend/api-contracts';

export type WebVitalMetric = components['schemas']['platform_WebVitalRequest'];

export async function reportWebVital(metric: WebVitalMetric): Promise<void> {
  await axiosInstance.post<void, WebVitalMetric>(
    '/api/platform/v1/observability/web-vitals',
    metric,
    { keepalive: true, timeoutMs: 2_000 }
  );
}
