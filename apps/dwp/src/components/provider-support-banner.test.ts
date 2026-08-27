import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ProviderSupportBanner from './provider-support-banner';

import type { ProviderSupportSessionContext } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values?.tenant ? `:${values.tenant}` : ''}${values?.value ? `:${values.value}` : ''}`,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: (value: string) => value,
  formatRelativeTime: (value: number, unit: string) => `in ${value} ${unit}`,
  resolveSupportedLocale: () => 'en',
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/provider/overview' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
}));
vi.mock('@dwp-frontend/shared-utils/toast/toast-store', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe('ProviderSupportBanner', () => {
  it('keeps tenant, expiry, session reference, and every approved scope visible', () => {
    const context: ProviderSupportSessionContext = {
      supportSessionId: 'support-session-12345678',
      tenantId: 'tenant-skax',
      tenantKey: 'skax-production',
      environmentKey: 'production',
      dataRegion: 'ap-northeast-2',
      tenantName: 'SKAX Production',
      scopes: ['TENANT_EXPERIENCE_PREVIEW'],
      accessMode: 'STANDARD',
      expiresAt: '2026-08-26T03:00:00.000Z',
      version: 1,
    };

    const markup = renderToStaticMarkup(createElement(ProviderSupportBanner, { context }));

    expect(markup).toContain('supportBar.title:SKAX Production');
    expect(markup).toContain('supportBar.expires:');
    expect(markup).toContain('supportBar.remaining:');
    expect(markup).toContain('supportBar.tenantKey:skax-production');
    expect(markup).toContain('supportBar.environment:production');
    expect(markup).toContain('supportBar.region:ap-northeast-2');
    expect(markup).toContain('supportBar.sessionReference:support-');
    expect(markup).toContain('support.scopes.TENANT_EXPERIENCE_PREVIEW');
    expect(markup).toContain('supportBar.approvedDetails');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });
});
