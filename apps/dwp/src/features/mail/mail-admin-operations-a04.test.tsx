// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GovernanceSurface } from './mail-admin-operations-a04';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

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
    aiAssistanceEnabled: true,
    aiCrossAppActionsEnabled: false,
    aiAutoExecuteEnabled: false,
    retentionDays: 365,
    maximumAttachmentMb: 25,
    version: 8,
  },
  connections: [],
  sharedInboxes: [],
  providerCatalog: [],
  generatedAt: '2026-09-17T00:00:00.000Z',
};

describe('A04 governance surface', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('provides four accessible domains and fails missing contracts closed', async () => {
    await act(async () =>
      root.render(
        <GovernanceSurface
          overview={overview}
          canManage={false}
          governance={{
            generatedAt: '2026-09-17T00:00:00.000Z',
            policyVersion: 8,
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
                policyKey: 'aiAssistanceEnabled',
                configuredValue: 'true',
                effectiveValue: 'true',
                effectiveState: 'ENFORCED',
                scope: 'TENANT',
                evidenceSource: 'MailService',
                evidenceAt: '2026-09-17T00:00:00.000Z',
              },
            ],
            history: [
              {
                historyId: 'history-1',
                version: 8,
                changedBy: 'Mail administrator',
                changedAt: '2026-09-17T00:00:00.000Z',
                diffSummary: 'aiAssistanceEnabled=true',
                result: 'PARTIAL',
                correlationId: 'corr-policy-8',
              },
            ],
          }}
        />
      )
    );

    const tabs = [...host.querySelectorAll('[role="tab"]')];
    expect(tabs).toHaveLength(4);
    expect(host.textContent).toContain('Content security policy');
    expect(host.textContent).toContain('Malware inspection readiness');
    expect(host.textContent).toContain('Evidence unavailable');
    expect(host.textContent).toContain('UNAVAILABLE');

    await act(async () => (tabs[1] as HTMLButtonElement).click());
    expect(host.textContent).toContain('AI and cross-app policy');
    expect(host.textContent).toContain('Target applications');
    expect(host.textContent).toContain('External data transfer');

    await act(async () => (tabs[2] as HTMLButtonElement).click());
    expect(host.textContent).toContain('Effective policy evidence');
    expect(host.textContent).toContain('not a security score');

    await act(async () => (tabs[3] as HTMLButtonElement).click());
    expect(host.textContent).toContain('aiAssistanceEnabled=true');
    expect(host.textContent).toContain('Approver');
    expect(host.textContent).toContain('Recovery evidence');
    expect(host.textContent).toContain('not presented as recovered');
  });
});
