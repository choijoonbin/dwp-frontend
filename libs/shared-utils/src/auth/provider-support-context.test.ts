import { describe, expect, it } from 'vitest';

import {
  isProviderSupportSessionActive,
  providerSupportContextFingerprint,
  providerSupportContextRefetchInterval,
  resolveActiveProviderSupportContext,
} from './provider-support-context';

import type { ProviderSupportSessionContext } from '../api/provider-control-api';

const context: ProviderSupportSessionContext = {
  supportSessionId: 'support-session-12345678',
  tenantId: 'tenant-skax',
  tenantKey: 'skax-production',
  tenantName: 'SKAX Production',
  scopes: ['TENANT_EXPERIENCE_PREVIEW'],
  accessMode: 'STANDARD',
  expiresAt: '2026-08-26T12:00:00.000Z',
  version: 1,
};

describe('provider support context activity', () => {
  it('accepts only a context whose server expiry is still in the future', () => {
    expect(isProviderSupportSessionActive(context, Date.parse('2026-08-26T11:59:59.000Z'))).toBe(
      true
    );
    expect(isProviderSupportSessionActive(context, Date.parse(context.expiresAt))).toBe(false);
    expect(isProviderSupportSessionActive({ ...context, expiresAt: 'invalid' })).toBe(false);
    expect(isProviderSupportSessionActive(null)).toBe(false);
  });

  it('schedules the next context refresh at or shortly after expiry', () => {
    const now = Date.parse('2026-08-26T11:59:50.000Z');
    expect(providerSupportContextRefetchInterval(context, now)).toBe(10_025);
    expect(providerSupportContextRefetchInterval(context, now - 60_000)).toBe(30_000);
    expect(providerSupportContextRefetchInterval(null, now)).toBe(30_000);
  });

  it('drops stale data when refresh fails or the session expires', () => {
    const beforeExpiry = Date.parse('2026-08-26T11:59:59.000Z');
    expect(resolveActiveProviderSupportContext(context, false, beforeExpiry)).toBe(context);
    expect(resolveActiveProviderSupportContext(context, true, beforeExpiry)).toBeNull();
    expect(
      resolveActiveProviderSupportContext(context, false, Date.parse(context.expiresAt))
    ).toBeNull();
  });

  it('fingerprints every cache-sensitive authority field and sorts scopes', () => {
    const first = providerSupportContextFingerprint({
      ...context,
      scopes: ['TENANT_CONFIGURATION_READ', 'TENANT_EXPERIENCE_PREVIEW'],
    });
    const reordered = providerSupportContextFingerprint({
      ...context,
      scopes: ['TENANT_EXPERIENCE_PREVIEW', 'TENANT_CONFIGURATION_READ'],
    });

    expect(first).toBe(reordered);
    expect(providerSupportContextFingerprint({ ...context, version: 2 })).not.toBe(
      providerSupportContextFingerprint(context)
    );
    expect(
      providerSupportContextFingerprint({
        ...context,
        expiresAt: '2026-08-26T11:45:00.000Z',
      })
    ).not.toBe(providerSupportContextFingerprint(context));
    expect(providerSupportContextFingerprint(null)).toBe('none');
  });
});
