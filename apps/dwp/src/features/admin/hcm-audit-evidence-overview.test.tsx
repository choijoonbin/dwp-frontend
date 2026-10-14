// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { AuditOverview } from './audit-overview';
import {
  GENERIC_AUDIT_QUERY_KEY,
  HCM_AUDIT_QUERY_KEY,
  HCM_AUDIT_SAFE_RETURN_PATH,
  resolveAuditOverviewProfile,
  resolveHcmAuditFocus,
} from './hcm-audit-evidence-overview';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  genericOverview: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  listHcmAuditEvidence: mocks.list,
  getHcmAuditEvidence: mocks.detail,
  getAuditOverview: mocks.genericOverview,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: (value: string) => value,
  formatNumber: (value: number) => String(value),
}));
vi.mock('../../components/use-system-code-options', () => ({
  useSystemCodeOptions: <T extends string>(_key: string, fallback: readonly T[]) => fallback,
}));

const EVENT_ID = '10000000-0000-4000-8000-000000000001';
const evidence = {
  eventId: EVENT_ID,
  occurredAt: '2026-10-14T04:20:00Z',
  category: 'ADMIN_CHANGE' as const,
  action: 'WORKER.UPDATED',
  outcome: 'SUCCESS' as const,
  severity: 'INFO' as const,
  actorType: 'USER' as const,
  sourceService: 'people',
  sourceModule: 'hris.people.worker',
  aggregateType: 'WORKER',
  aggregateRevision: 7,
  effectiveCapability: 'HCM.WORKER.UPDATE',
  purposeCode: 'HR_OPERATIONS',
  authorizationDecisionRef: 'decision:42',
  scopeRevision: 3,
  fieldPolicyRevision: 5,
  approvalReceiptId: null,
  reasonCode: null,
  beforeDigest: 'a'.repeat(64),
  afterDigest: 'b'.repeat(64),
  evidenceDigest: 'c'.repeat(64),
  classification: 'CONFIDENTIAL' as const,
  retentionClass: 'EXTENDED' as const,
  causationId: '20000000-0000-4000-8000-000000000002',
  correlationId: '30000000-0000-4000-8000-000000000003',
  recordHash: 'd'.repeat(64),
};
const page = {
  items: [evidence],
  size: 1,
  snapshotAt: '2026-10-14T04:21:00Z',
  nextCursor: null,
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function flush() {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
  }
}

function TestSurface() {
  const location = useLocation();
  return (
    <>
      <AuditOverview />
      <output data-testid="current-location">
        {location.pathname}
        {location.search}
      </output>
    </>
  );
}

async function renderAt(path: string) {
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(QueryClientProvider, { client }, createElement(TestSurface))
      )
    );
  });
  await flush();
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.list.mockReset().mockResolvedValue(page);
  mocks.detail.mockReset().mockResolvedValue(evidence);
  mocks.genericOverview.mockReset();
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

describe('HCM audit overview profile', () => {
  it('treats one exact product value as presentation context only and rejects ambiguity', () => {
    expect(resolveAuditOverviewProfile(new URLSearchParams())).toBe('GENERIC');
    expect(resolveAuditOverviewProfile(new URLSearchParams('tab=overview'))).toBe('GENERIC');
    expect(resolveAuditOverviewProfile(new URLSearchParams('product=HCM'))).toBe('HCM');
    expect(resolveAuditOverviewProfile(new URLSearchParams('product=hcm'))).toBe('INVALID');
    expect(resolveAuditOverviewProfile(new URLSearchParams('product=PAY'))).toBe('INVALID');
    expect(resolveAuditOverviewProfile(new URLSearchParams('Product=HCM'), 'Product=HCM')).toBe(
      'INVALID'
    );
    expect(
      resolveAuditOverviewProfile(new URLSearchParams('product%5B%5D=HCM'), 'product%5B%5D=HCM')
    ).toBe('INVALID');
    expect(
      resolveAuditOverviewProfile(new URLSearchParams('product%00=HCM'), 'product%00=HCM')
    ).toBe('INVALID');
    expect(resolveAuditOverviewProfile(new URLSearchParams('product'), 'product')).toBe('INVALID');
    expect(resolveAuditOverviewProfile(new URLSearchParams('product=HCM&product=HCM'))).toBe(
      'INVALID'
    );
    expect(
      resolveAuditOverviewProfile(new URLSearchParams('product=%48%43%4D'), 'product=%48%43%4D')
    ).toBe('INVALID');

    expect(resolveHcmAuditFocus(new URLSearchParams())).toEqual({ kind: 'NONE' });
    expect(resolveHcmAuditFocus(new URLSearchParams(`focus=${EVENT_ID}`))).toEqual({
      kind: 'VALID',
      eventId: EVENT_ID,
    });
    expect(resolveHcmAuditFocus(new URLSearchParams('focus=not-a-uuid'))).toEqual({
      kind: 'INVALID',
    });
  });

  it('purges preseeded generic audit cache before HCM evidence can render', async () => {
    client.setQueryData([...GENERIC_AUDIT_QUERY_KEY, 'overview', 'D7'], {
      sensitiveMetric: 'GENERIC-PRESEEDED-SECRET',
    });

    await renderAt('/admin/governance/audit-overview?product=HCM&tab=overview');

    expect(client.getQueryCache().findAll({ queryKey: GENERIC_AUDIT_QUERY_KEY })).toHaveLength(0);
    expect(container.textContent).not.toContain('GENERIC-PRESEEDED-SECRET');
    expect(mocks.genericOverview).not.toHaveBeenCalled();
  });

  it('loads only the HCM minimized list and exposes the fixed safe HRIS return', async () => {
    await renderAt('/admin/governance/audit-overview?product=HCM&tab=overview');

    expect(mocks.list).toHaveBeenCalledOnce();
    expect(mocks.list.mock.calls[0]?.[0]).toMatchObject({ window: 'D7', size: 25 });
    expect(mocks.genericOverview).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(container.textContent).toContain('auditControl.hcmEvidence.title');
    expect(container.textContent).toContain('WORKER.UPDATED');
    expect(container.textContent).not.toContain('auditControl.overview.commandPosture');
    expect(
      container.querySelector<HTMLAnchorElement>(`a[href="${HCM_AUDIT_SAFE_RETURN_PATH}"]`)
    ).not.toBeNull();
  });

  it('loads focus through the minimized detail client without generic investigation calls', async () => {
    await renderAt(`/admin/governance/audit-overview?product=HCM&tab=overview&focus=${EVENT_ID}`);

    expect(mocks.list).toHaveBeenCalledOnce();
    expect(mocks.detail).toHaveBeenCalledWith(EVENT_ID, expect.any(AbortSignal));
    expect(mocks.genericOverview).not.toHaveBeenCalled();
    expect(container.textContent).toContain('auditControl.hcmEvidence.detailTitle');
    expect(container.textContent).toContain('HCM.WORKER.UPDATE');
    expect(container.textContent).not.toContain('auditControl.overview.openWorkbench');
  });

  it('blocks malformed product and focus values before unsafe requests', async () => {
    await renderAt('/admin/governance/audit-overview?product=HCM&product=HCM&focus=not-a-uuid');

    expect(container.querySelector('[data-testid="hcm-audit-invalid-context"]')).not.toBeNull();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.genericOverview).not.toHaveBeenCalled();
  });

  it('blocks an encoded product selector instead of canonicalizing it into an HCM request', async () => {
    await renderAt('/admin/governance/audit-overview?product=%48%43%4D');

    expect(container.querySelector('[data-testid="hcm-audit-invalid-context"]')).not.toBeNull();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.genericOverview).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown value', 'product=PAY'],
    ['case-variant key', 'Product=HCM'],
    ['malformed key', 'product%5B%5D=HCM'],
  ])('fails closed and purges both caches for a %s product selector', async (_label, selector) => {
    client.setQueryData([...GENERIC_AUDIT_QUERY_KEY, 'overview', 'D7'], {
      sensitiveMetric: 'GENERIC-PRESEEDED-SECRET',
    });
    client.setQueryData([...HCM_AUDIT_QUERY_KEY, 'detail', EVENT_ID], evidence);

    await renderAt(`/admin/governance/audit-overview?${selector}&tab=overview`);

    expect(container.querySelector('[data-testid="hcm-audit-invalid-context"]')).not.toBeNull();
    expect(client.getQueryCache().findAll({ queryKey: GENERIC_AUDIT_QUERY_KEY })).toHaveLength(0);
    expect(client.getQueryCache().findAll({ queryKey: HCM_AUDIT_QUERY_KEY })).toHaveLength(0);
    expect(container.textContent).not.toContain('GENERIC-PRESEEDED-SECRET');
    expect(container.textContent).not.toContain('WORKER.UPDATED');
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.genericOverview).not.toHaveBeenCalled();
  });

  it.each([
    ['duplicate', `product=HCM&tab=events&tab=overview`],
    ['unsupported', 'product=HCM&tab=investigations'],
  ])('canonicalizes %s HCM tabs to one overview tab', async (_label, query) => {
    await renderAt(`/admin/governance/audit-overview?${query}`);

    const location = container.querySelector('[data-testid="current-location"]')?.textContent ?? '';
    const canonical = new URL(location, 'https://dwp.invalid');
    expect(canonical.searchParams.getAll('product')).toEqual(['HCM']);
    expect(canonical.searchParams.getAll('tab')).toEqual(['overview']);
    expect(mocks.genericOverview).not.toHaveBeenCalled();
  });

  it('does not send a malformed focus to the detail endpoint', async () => {
    await renderAt('/admin/governance/audit-overview?product=HCM&tab=overview&focus=not-a-uuid');

    expect(mocks.list).toHaveBeenCalledOnce();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(container.textContent).toContain('auditControl.hcmEvidence.errors.invalidFocus');
  });

  it('clears prior evidence after an authoritative denial and never falls back to generic data', async () => {
    mocks.list.mockResolvedValueOnce(page).mockRejectedValueOnce(new HttpError('denied', 403));
    await renderAt('/admin/governance/audit-overview?product=HCM&tab=overview');
    expect(container.textContent).toContain('WORKER.UPDATED');

    const refresh = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('auditControl.hcmEvidence.refresh')
    );
    expect(refresh).toBeDefined();
    await act(async () => refresh?.click());
    await flush();

    expect(container.textContent).toContain('auditControl.hcmEvidence.errors.denied');
    expect(container.textContent).not.toContain('WORKER.UPDATED');
    expect(client.getQueryCache().findAll({ queryKey: HCM_AUDIT_QUERY_KEY })).toHaveLength(0);
    expect(mocks.genericOverview).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 503])(
    'purges list and detail evidence when focused detail returns %s',
    async (status) => {
      mocks.detail.mockRejectedValue(new HttpError(`detail-${status}`, status));

      await renderAt(`/admin/governance/audit-overview?product=HCM&tab=overview&focus=${EVENT_ID}`);

      expect(mocks.list).toHaveBeenCalledOnce();
      expect(mocks.detail).toHaveBeenCalledOnce();
      expect(container.textContent).not.toContain('WORKER.UPDATED');
      expect(container.textContent).not.toContain('HCM.WORKER.UPDATE');
      expect(client.getQueryCache().findAll({ queryKey: HCM_AUDIT_QUERY_KEY })).toHaveLength(0);
      expect(mocks.genericOverview).not.toHaveBeenCalled();
    }
  );

  it('purges HCM evidence cache when the HCM mode unmounts', async () => {
    await renderAt('/admin/governance/audit-overview?product=HCM&tab=overview');
    expect(
      client.getQueryCache().findAll({ queryKey: HCM_AUDIT_QUERY_KEY }).length
    ).toBeGreaterThan(0);

    await act(async () => root.unmount());

    expect(client.getQueryCache().findAll({ queryKey: HCM_AUDIT_QUERY_KEY })).toHaveLength(0);
    root = createRoot(container);
  });
});
