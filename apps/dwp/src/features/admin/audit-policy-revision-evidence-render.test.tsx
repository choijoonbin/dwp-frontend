// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditPolicyRevisionEvidence } from './audit-policy-revision-evidence';

import type { AuditPolicyRevision } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({ formatDate: (value: string) => value }));

const snapshot = {
  observedAt: '2026-10-01T00:00:00Z',
  coverageState: 'COMPLETE_INTERNAL_AUDIT_EVENT_OWNER',
  includedOwners: ['PLATFORM_SYS_AUDIT_EVENTS'],
  exclusions: ['EXTERNAL_PRODUCT_DATA_RETENTION'],
  auditEventCount: 120,
  affectedAuditEventCount: 30,
  affectedActorCount: 9,
  affectedTargetCount: 14,
  standardRetentionEventCount: 80,
  extendedRetentionEventCount: 40,
  legalHoldEventCount: 4,
  standardRetentionAffectedEventCount: 20,
  extendedRetentionAffectedEventCount: 10,
  highRiskClassificationAffectedEventCount: 6,
  exportableEventCountBefore: 100,
  exportableEventCountAfter: 50,
  integrityProtectedEventCountBefore: 0,
  integrityProtectedEventCountAfter: 120,
};

const revision = (overrides: Partial<AuditPolicyRevision> = {}): AuditPolicyRevision => ({
  revisionId: 'revision-1',
  revisionNumber: 1,
  lifecycleState: 'DRAFT',
  standardRetentionDays: 730,
  extendedRetentionDays: 2555,
  exportLimitRows: 5_000,
  requireExportReason: true,
  integrityEnabled: true,
  highRiskThreshold: 80,
  changeReason: 'Review the governed audit policy.',
  diff: { standardRetentionDays: { before: 365, after: 730 } },
  contentSha256: 'b'.repeat(64),
  impactSnapshot: snapshot,
  impactSha256: 'a'.repeat(64),
  createdBy: '41',
  createdAt: '2026-10-01T00:00:00Z',
  version: 0,
  approval: null,
  ...overrides,
});

let container: HTMLDivElement;
let root: Root;

async function render(value: AuditPolicyRevision) {
  await act(async () => {
    root.render(createElement(AuditPolicyRevisionEvidence, { revision: value }));
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('audit policy revision impact evidence', () => {
  it('renders complete owner counts and a shortened immutable hash', async () => {
    await render(revision());

    expect(container.textContent).toContain(
      'auditControl.governance.revisions.impact.coverage.COMPLETE_INTERNAL_AUDIT_EVENT_OWNER'
    );
    expect(container.textContent).toContain(
      'auditControl.governance.revisions.impact.metrics.affectedAuditEventCount'
    );
    expect(container.textContent).toContain('30');
    expect(container.textContent).toContain('aaaaaaaaaaaa…');
    expect(container.textContent).not.toContain('a'.repeat(64));
  });

  it('marks a legacy snapshot incomplete without claiming current coverage', async () => {
    await render(
      revision({
        impactSnapshot: {
          ...snapshot,
          coverageState: 'UNAVAILABLE_LEGACY_REVISION',
          exclusions: ['LEGACY_REVISION_NOT_SNAPSHOTTED'],
          auditEventCount: 0,
          affectedAuditEventCount: 0,
        },
      })
    );

    expect(container.textContent).toContain(
      'auditControl.governance.revisions.impact.coverage.UNAVAILABLE_LEGACY_REVISION'
    );
    expect(container.textContent).toContain('auditControl.governance.revisions.impact.incomplete');
    expect(container.textContent).toContain(
      'auditControl.governance.revisions.impact.exclusions.LEGACY_REVISION_NOT_SNAPSHOTTED'
    );
    expect(container.textContent).toContain('auditControl.governance.revisions.values.unavailable');
    expect(container.textContent).toContain(
      'auditControl.governance.revisions.impact.transition{"before":"auditControl.governance.revisions.values.unavailable","after":"auditControl.governance.revisions.values.unavailable"}'
    );
  });

  it('redacts unknown coverage boundaries and an invalid hash', async () => {
    await render(
      revision({
        impactSnapshot: {
          ...snapshot,
          coverageState: 'RAW_FUTURE_COVERAGE',
          includedOwners: ['RAW_FUTURE_OWNER'],
          exclusions: ['RAW_FUTURE_EXCLUSION'],
        },
        impactSha256: 'RAW_HASH_VALUE',
      })
    );

    expect(container.textContent).toContain(
      'auditControl.governance.revisions.impact.coverage.UNKNOWN'
    );
    expect(container.textContent).toContain(
      'auditControl.governance.revisions.impact.owners.UNKNOWN'
    );
    expect(container.textContent).toContain(
      'auditControl.governance.revisions.impact.exclusions.UNKNOWN'
    );
    expect(container.textContent).not.toContain('RAW_FUTURE_COVERAGE');
    expect(container.textContent).not.toContain('RAW_FUTURE_OWNER');
    expect(container.textContent).not.toContain('RAW_FUTURE_EXCLUSION');
    expect(container.textContent).not.toContain('RAW_HASH_VALUE');
  });
});
