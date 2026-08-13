import { describe, expect, it, vi } from 'vitest';

import {
  displayDictionaryKey,
  humanizeDisplayCode,
  resolveDisplayCode,
} from './display-dictionary';

import type { TFunction } from 'i18next';

function translator(values: Record<string, string>): TFunction<'display'> {
  return ((key: string, options?: { defaultValue?: string }) =>
    values[key] ?? options?.defaultValue ?? key) as TFunction<'display'>;
}

describe('display dictionary', () => {
  it('normalizes external code formats into one catalog key', () => {
    expect(displayDictionaryKey('provider.support-session.revoked')).toBe(
      'PROVIDER_SUPPORT_SESSION_REVOKED'
    );
    expect(displayDictionaryKey('pendingApproval')).toBe('PENDING_APPROVAL');
  });

  it('resolves a registered display label', () => {
    const t = translator({
      'states.ACTIVE': 'Active',
      empty: '-',
      unmapped: 'Unmapped value',
    });
    expect(resolveDisplayCode(t, 'states', 'ACTIVE')).toBe('Active');
  });

  it('never leaks an unmapped raw code into the user-facing fallback', () => {
    vi.stubEnv('DEV', false);
    const t = translator({ empty: '-', unmapped: 'Unmapped value' });
    expect(resolveDisplayCode(t, 'auditActions', 'secret.internal-action')).toBe('Unmapped value');
    vi.unstubAllEnvs();
  });

  it('keeps a humanizer for evidence descriptions without treating it as a translation', () => {
    expect(humanizeDisplayCode('provider.support-session.revoked')).toBe(
      'Provider support session revoked'
    );
  });
});
