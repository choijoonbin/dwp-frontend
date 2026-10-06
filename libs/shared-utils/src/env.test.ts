import { afterEach, describe, expect, it, vi } from 'vitest';

async function notificationRuntimeEnabled(value?: string) {
  vi.resetModules();
  if (value === undefined) vi.unstubAllEnvs();
  else vi.stubEnv('VITE_PRODUCT_NOTIFICATION_RUNTIME', value);
  const environment = await import('./env');
  return environment.PRODUCT_NOTIFICATION_RUNTIME_ENABLED;
}

describe('product runtime environment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('keeps the notification runtime enabled by default', async () => {
    await expect(notificationRuntimeEnabled()).resolves.toBe(true);
  });

  it('disables notification runtime reads case-insensitively', async () => {
    await expect(notificationRuntimeEnabled('disabled')).resolves.toBe(false);
    await expect(notificationRuntimeEnabled('DISABLED')).resolves.toBe(false);
  });
});
