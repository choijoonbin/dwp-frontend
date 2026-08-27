import { describe, expect, it, vi } from 'vitest';

import type { ProviderSupportSessionContext } from '@dwp-frontend/shared-utils';

import {
  cancelTenantDiagnosisWindow,
  completeTenantDiagnosisWindow,
  reserveTenantDiagnosisWindow,
  resolveTenantExperiencePreviewAccess,
  tenantDiagnosisLandingPath,
} from './provider-diagnosis-policy';

const context = (overrides: Partial<ProviderSupportSessionContext> = {}) => ({
  supportSessionId: 'support-1',
  tenantId: 'tenant-a',
  tenantKey: 'tenant-a-production',
  tenantName: 'Tenant A',
  scopes: ['TENANT_EXPERIENCE_PREVIEW'],
  accessMode: 'STANDARD' as const,
  expiresAt: '2026-08-26T03:00:00.000Z',
  version: 1,
  ...overrides,
});

describe('provider tenant diagnosis policy', () => {
  it('allows only a matching, unexpired session with explicit experience-preview scope', () => {
    expect(
      resolveTenantExperiencePreviewAccess(
        context(),
        'tenant-a',
        Date.parse('2026-08-26T02:30:00.000Z')
      ).state
    ).toBe('allowed');
    expect(
      resolveTenantExperiencePreviewAccess(
        context(),
        'tenant-b',
        Date.parse('2026-08-26T02:30:00Z')
      ).state
    ).toBe('wrong-tenant');
    expect(
      resolveTenantExperiencePreviewAccess(
        context(),
        'tenant-a',
        Date.parse('2026-08-26T03:00:00Z')
      ).state
    ).toBe('expired');
    expect(
      resolveTenantExperiencePreviewAccess(
        context({ scopes: ['TENANT_CONFIGURATION_READ'] }),
        'tenant-a',
        Date.parse('2026-08-26T02:30:00Z')
      ).state
    ).toBe('scope-denied');
    expect(
      resolveTenantExperiencePreviewAccess(
        context({ scopes: ['TENANT_EXPERIENCE_PREVIEW', 'TENANT_CONFIGURATION_READ'] }),
        'tenant-a',
        Date.parse('2026-08-26T02:30:00Z')
      ).state
    ).toBe('scope-denied');
  });

  it('routes only the dedicated preview scope to tenant experience and closes retired scopes', () => {
    expect(tenantDiagnosisLandingPath('tenant/a', ['TENANT_EXPERIENCE_PREVIEW'])).toBe(
      '/provider/tenants/tenant%2Fa/experience-preview'
    );
    expect(tenantDiagnosisLandingPath('tenant-a', ['TENANT_CONFIGURATION_READ'])).toBe(
      '/provider/support'
    );
    expect(tenantDiagnosisLandingPath('tenant-a', ['WORKFORCE_READ'])).toBe('/provider/support');
    expect(
      tenantDiagnosisLandingPath('tenant-a', [
        'TENANT_EXPERIENCE_PREVIEW',
        'TENANT_CONFIGURATION_WRITE',
      ])
    ).toBe('/provider/support');
  });

  it('reserves a blank isolated tab synchronously and navigates it only after activation', () => {
    const replace = vi.fn();
    const popup = {
      opener: {},
      closed: false,
      location: { replace },
      close: vi.fn(),
    } as unknown as Window;
    const openWindow = vi.fn(() => popup);
    const reservation = reserveTenantDiagnosisWindow(
      'tenant/a',
      ['TENANT_EXPERIENCE_PREVIEW'],
      openWindow
    );

    expect(openWindow).toHaveBeenCalledWith('about:blank', '_blank');
    expect(popup.opener).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(completeTenantDiagnosisWindow(reservation, vi.fn())).toBe('new-tab');
    expect(replace).toHaveBeenCalledWith('/provider/tenants/tenant%2Fa/experience-preview');
  });

  it('falls back to same-tab navigation when a popup is blocked', () => {
    const navigate = vi.fn();
    const reservation = reserveTenantDiagnosisWindow(
      'tenant-a',
      ['TENANT_EXPERIENCE_PREVIEW'],
      vi.fn(() => null)
    );

    expect(completeTenantDiagnosisWindow(reservation, navigate)).toBe('same-tab');
    expect(navigate).toHaveBeenCalledWith('/provider/tenants/tenant-a/experience-preview');
  });

  it('closes the reserved tab when activation fails', () => {
    const popup = {
      opener: null,
      closed: false,
      location: { replace: vi.fn() },
      close: vi.fn(),
    } as unknown as Window;
    const reservation = reserveTenantDiagnosisWindow(
      'tenant-a',
      ['TENANT_EXPERIENCE_PREVIEW'],
      vi.fn(() => popup)
    );

    cancelTenantDiagnosisWindow(reservation);

    expect(popup.close).toHaveBeenCalledOnce();
  });
});
