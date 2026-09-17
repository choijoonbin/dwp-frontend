import { describe, expect, it } from 'vitest';

import {
  buildMailGovernancePolicyViews,
  mailGovernanceEvidenceCounts,
  mailGovernanceRowsForDomain,
} from './mail-admin-operations-a04-model';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';

const overview: MailAdminOverview = {
  personalAccounts: 1,
  sharedAccounts: 0,
  activeConnections: 1,
  degradedConnections: 0,
  openSharedThreads: 0,
  pendingAiProposals: 0,
  queuedDeliveries: 0,
  failedDeliveries: 0,
  policy: {
    externalSenderBanner: true,
    blockRemoteImages: true,
    allowSharedInboxes: true,
    aiAssistanceEnabled: false,
    aiCrossAppActionsEnabled: false,
    aiAutoExecuteEnabled: false,
    retentionDays: 365,
    maximumAttachmentMb: 25,
    version: 7,
  },
  connections: [],
  sharedInboxes: [],
  providerCatalog: [],
  generatedAt: '2026-09-17T00:00:00.000Z',
};

describe('A04 policy governance projection', () => {
  it('keeps configured, effective, and evidence states independent', () => {
    const rows = buildMailGovernancePolicyViews(overview, {
      generatedAt: '2026-09-17T00:00:00.000Z',
      policyVersion: 7,
      rows: [
        {
          policyKey: 'externalSenderBanner',
          configuredValue: 'true',
          effectiveValue: 'UNKNOWN',
          effectiveState: 'UNVERIFIED',
          scope: 'TENANT',
          evidenceSource: 'CLIENT_RENDERER_NOT_ATTESTED',
          evidenceAt: '2026-09-17T00:00:00.000Z',
        },
        {
          policyKey: 'blockRemoteImages',
          configuredValue: 'true',
          effectiveValue: 'true',
          effectiveState: 'ENFORCED',
          scope: 'TENANT',
          evidenceSource: 'MailWorkspaceRepository',
          evidenceAt: '2026-09-17T00:00:00.000Z',
        },
      ],
      history: [],
    });

    expect(rows.find((row) => row.policyKey === 'externalSenderBanner')).toMatchObject({
      configuredValue: 'true',
      effectiveValue: 'UNKNOWN',
      evidenceState: 'UNAVAILABLE',
    });
    expect(rows.find((row) => row.policyKey === 'blockRemoteImages')?.evidenceState).toBe(
      'VERIFIED'
    );
  });

  it('fails missing scanner, DLP, and AI scope contracts closed', () => {
    const rows = buildMailGovernancePolicyViews(overview);
    const content = mailGovernanceRowsForDomain(rows, 'CONTENT');
    const ai = mailGovernanceRowsForDomain(rows, 'AI');

    expect(content.find((row) => row.policyKey === 'attachmentInspectionReadiness')).toMatchObject({
      effectiveState: 'UNAVAILABLE',
      evidenceState: 'UNAVAILABLE',
      missingContract: true,
    });
    expect(content.some((row) => row.policyKey === 'dlpReadiness')).toBe(true);
    expect(ai.some((row) => row.policyKey === 'aiTargetApplications')).toBe(true);
    expect(ai.some((row) => row.policyKey === 'aiExternalTransfer')).toBe(true);
    expect(mailGovernanceEvidenceCounts(rows).UNAVAILABLE).toBeGreaterThan(0);
  });
});
