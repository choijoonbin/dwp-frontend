import { describe, expect, it, vi } from 'vitest';

import english from '../locales/en/display.json';
import korean from '../locales/ko/display.json';
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

  it('maps emitted authentication audit actions to exact labels in both supported locales', () => {
    expect(displayDictionaryKey('authentication.login.succeeded')).toBe(
      'AUTHENTICATION_LOGIN_SUCCEEDED'
    );
    expect(displayDictionaryKey('authentication.session.created')).toBe(
      'AUTHENTICATION_SESSION_CREATED'
    );
    expect(english.auditActions.AUTHENTICATION_LOGIN_SUCCEEDED).toBe('Login succeeded');
    expect(english.auditActions.AUTHENTICATION_SESSION_CREATED).toBe(
      'Authentication session created'
    );
    expect(korean.auditActions.AUTHENTICATION_LOGIN_SUCCEEDED).toBe('로그인 성공');
    expect(korean.auditActions.AUTHENTICATION_SESSION_CREATED).toBe('인증 세션 생성');
  });

  it('covers Provider support control migration evidence in both supported locales', () => {
    expect(english.auditActions.PROVIDER_SUPPORT_ACTIVATION_ENABLED_BY_DB_CONTROL).toBeTruthy();
    expect(
      english.auditActions.PROVIDER_SUPPORT_CONTAINMENT_V51_ADMIN_AUTHORITY_RETIRED
    ).toBeTruthy();
    expect(english.targetTypes.SUPPORT_CONTROL).toBeTruthy();
    expect(english.targetTypes.SYSTEM_PRINCIPAL).toBeTruthy();
    expect(korean.auditActions.PROVIDER_SUPPORT_ACTIVATION_ENABLED_BY_DB_CONTROL).toBeTruthy();
    expect(
      korean.auditActions.PROVIDER_SUPPORT_CONTAINMENT_V51_ADMIN_AUTHORITY_RETIRED
    ).toBeTruthy();
    expect(korean.targetTypes.SUPPORT_CONTROL).toBeTruthy();
    expect(korean.targetTypes.SYSTEM_PRINCIPAL).toBeTruthy();
  });
});
