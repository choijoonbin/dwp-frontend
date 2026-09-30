// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TenantDataGovernanceEvidence,
  TenantProviderDomainEvidence,
} from './tenant-owner-projection-evidence';

import type {
  TenantProviderDataGovernanceProjection,
  TenantProviderDomainProjection,
} from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  domains: vi.fn(),
  governance: vi.fn(),
  permission: vi.fn((_resource: string, _action: string) => true),
  loaded: true,
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getTenantProviderDomains: mocks.domains,
  getTenantProviderDataGovernance: mocks.governance,
  usePermissions: () => ({ hasPermission: mocks.permission, isLoaded: mocks.loaded }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({ formatDate: (value: string) => value }));

const domains: TenantProviderDomainProjection = {
  ownerService: 'provider-control-plane',
  observationState: 'LIVE_OWNER_READ',
  observedAt: '2026-09-29T02:00:00Z',
  sourceLastChangedAt: '2026-09-29T01:59:00Z',
  coverageState: 'CURRENT_TENANT_NON_REVOKED_DOMAINS',
  exclusions: ['DNS_CHALLENGE_SECRET', 'DNS_VERIFICATION_RECORD_VALUE'],
  domains: [
    {
      domainId: '10000000-0000-0000-0000-000000000001',
      domainName: 'customer.example',
      domainType: 'LOGIN',
      verificationMethod: 'DNS_TXT',
      verificationState: 'VERIFIED',
      primaryDomain: true,
      verifiedAt: '2026-09-29T01:00:00Z',
      lastCheckedAt: '2026-09-29T01:50:00Z',
      sourceChangedAt: '2026-09-29T01:59:00Z',
      evidenceFreshnessState: 'RECORDED_AT',
      version: 3,
    },
  ],
};

const governance: TenantProviderDataGovernanceProjection = {
  ownerService: 'provider-control-plane',
  observationState: 'LIVE_OWNER_READ',
  observedAt: '2026-09-29T02:00:00Z',
  sourceLastChangedAt: '2026-09-29T01:58:00Z',
  coverageState: 'GLOBAL_POLICIES_AND_CURRENT_TENANT_LIFECYCLE_EVALUATIONS',
  exclusions: [
    'TENANT_SCOPED_HOLD_OWNER_NOT_CONNECTED',
    'EXTERNAL_SHARING_OWNER_NOT_CONNECTED',
    'PHYSICAL_RETENTION_OR_DELETION_EXECUTION_NOT_OBSERVED',
  ],
  policies: [
    {
      policyType: 'RETENTION',
      ownerService: 'provider-data-governance',
      coverage: 'GLOBAL',
      revisionNumber: 2,
      effectiveState: 'ACTIVE',
      retentionDays: 90,
      sourceChangedAt: '2026-09-29T01:58:00Z',
      freshnessState: 'CURRENT_OWNER_REVISION',
      evidenceState: 'IMPACT_FINGERPRINT_RECORDED',
      impactFingerprint: 'a'.repeat(64),
      sourceVersion: 5,
    },
  ],
  tenantLifecycleHoldObservations: [
    {
      lifecycleRequestId: '20000000-0000-0000-0000-000000000001',
      requestedAction: 'PURGE',
      lifecycleState: 'BLOCKED_BY_HOLD',
      holdEvaluationState: 'ACTIVE_GLOBAL_LEGAL_HOLD',
      executionState: 'OWNER_HANDOFF_REQUIRED',
      evidenceReferenceCount: 2,
      evidenceState: 'REFERENCES_REDACTED',
      freshnessState: 'RECORDED_AT',
      sourceChangedAt: '2026-09-29T01:57:00Z',
      sourceVersion: 4,
    },
  ],
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function flush() {
  for (let index = 0; index < 3; index += 1) {
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
  }
}

async function render(component: 'domains' | 'governance') {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          component === 'domains' ? TenantProviderDomainEvidence : TenantDataGovernanceEvidence
        )
      )
    );
  });
  await flush();
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.loaded = true;
  mocks.permission.mockReset().mockReturnValue(true);
  mocks.domains.mockReset().mockResolvedValue(domains);
  mocks.governance.mockReset().mockResolvedValue(governance);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

describe('tenant provider owner evidence', () => {
  it('does not call the domain owner without the exact resource permission', async () => {
    mocks.permission.mockReturnValue(false);
    await render('domains');
    expect(mocks.permission).toHaveBeenCalledWith('ADMIN.IDENTITY_PROVISIONING', 'VIEW');
    expect(mocks.domains).not.toHaveBeenCalled();
    expect(container.textContent).toContain('permissions.domains');
  });

  it('renders the current tenant domain state without challenge material', async () => {
    await render('domains');
    expect(mocks.domains).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(container.textContent).toContain('customer.example');
    expect(container.textContent).toContain('states.VERIFIED');
    expect(container.textContent).not.toContain('DNS_CHALLENGE_SECRET');
    expect(container.textContent).not.toContain('DNS_VERIFICATION_RECORD_VALUE');
  });

  it('renders redacted owner evidence and explicit external coverage boundaries', async () => {
    await render('governance');
    expect(mocks.permission).toHaveBeenCalledWith('ADMIN.AUDIT_VIEW', 'VIEW');
    expect(mocks.governance).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(container.textContent).toContain('policyTypes.RETENTION');
    expect(container.textContent).toContain('aaaaaaaaaaaa…');
    expect(container.textContent).not.toContain('a'.repeat(64));
    expect(container.textContent).toContain('exclusions.EXTERNAL_SHARING_OWNER_NOT_CONNECTED');
    expect(container.textContent).toContain(
      'exclusions.PHYSICAL_RETENTION_OR_DELETION_EXECUTION_NOT_OBSERVED'
    );
  });
});
