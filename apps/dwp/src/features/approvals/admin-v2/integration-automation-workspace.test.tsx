// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminV2TestHarness } from './admin-v2-test-harness';
import { stateCopy } from './admin-v2-test-fixtures';
import { IntegrationAutomationWorkspace } from './integration-automation-workspace';

import type { AdminV2TestHarness } from './admin-v2-test-harness';
import type { IntegrationAutomationCopy } from './integration-automation-workspace';

const copy: IntegrationAutomationCopy = {
  header: {
    eyebrow: 'Approval administration',
    title: 'Integration hub',
    description: 'Govern connector mapping and delivery truth.',
    evidenceLabel: 'Probe-backed readiness',
  },
  state: stateCopy,
  navigationLabel: 'Integration views',
  catalogTab: 'Catalog',
  mappingTab: 'Mapping',
  healthTab: 'Health',
  catalogTitle: 'Connectors',
  catalogDescription: 'Governed integration definitions.',
  detailTitle: 'Connector detail',
  detailDescription: 'Select a connector.',
  mappingTitle: 'Mapping contract',
  mappingDescription: 'Allowlisted fields only.',
  fieldLabel: 'Field',
  sourceLabel: 'Source',
  targetLabel: 'Target',
  transformLabel: 'Transform',
  statusLabel: 'Status',
  probesTitle: 'Probe evidence',
  probesDescription: 'Current observations for the exact revision.',
  noSelectionLabel: 'Select a connector.',
  refreshLabel: 'Refresh',
  probeLabel: 'Run probe',
  publishLabel: 'Publish verified revision',
  mobilePublishLabel: 'Publication requires desktop review',
  mobilePublishReason: 'High-risk publication is closed on mobile.',
  staleEvidenceTitle: 'Verified probe required',
  staleEvidenceDescription: 'Publication stays closed until exact revision evidence is current.',
  secretsTitle: 'Secret-safe definition',
  secretsDescription: 'Credentials are referenced, never rendered or returned.',
};

describe('IntegrationAutomationWorkspace', () => {
  let harness: AdminV2TestHarness;
  beforeEach(() => {
    harness = createAdminV2TestHarness();
  });
  afterEach(async () => harness.destroy());

  it('keeps publication closed when current probe evidence is not verified', async () => {
    const publish = vi.fn();
    await harness.render(
      <IntegrationAutomationWorkspace
        state="ready"
        copy={copy}
        metrics={[]}
        view="catalog"
        connectors={[
          {
            id: 'connector-1',
            name: 'ERP purchase order',
            summary: 'Posts an approved request to ERP.',
            typeLabel: 'REST',
            lifecycle: { label: 'DRAFT', tone: 'warning' },
            versionLabel: 'v3',
            updatedLabel: 'now',
            facts: [],
            mappings: [],
            probes: [
              {
                id: 'probe-1',
                title: 'Contract probe',
                detail: 'Evidence expired.',
                status: { label: 'STALE', tone: 'warning' },
              },
            ],
            probeReady: true,
            publishReady: false,
            publishDisabledReason: 'Independent review evidence is required.',
          },
        ]}
        selectedConnectorId="connector-1"
        onViewChange={vi.fn()}
        onSelectConnector={vi.fn()}
        onRefresh={vi.fn()}
        onProbe={vi.fn()}
        onPublish={publish}
      />
    );

    const publishButton = [...harness.node.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(copy.publishLabel)
    );
    expect(publishButton).toBeInstanceOf(HTMLButtonElement);
    expect((publishButton as HTMLButtonElement).disabled).toBe(true);
    expect(harness.node.textContent).toContain('Independent review evidence is required.');
    expect(publish).not.toHaveBeenCalled();
  });

  it('keeps the canonical probe command reachable independently of publication readiness', async () => {
    const probe = vi.fn();
    await harness.render(
      <IntegrationAutomationWorkspace
        state="ready"
        copy={copy}
        metrics={[]}
        view="catalog"
        connectors={[
          {
            id: 'connector-1',
            name: 'ERP purchase order',
            summary: 'Posts an approved request to ERP.',
            typeLabel: 'REST',
            lifecycle: { label: 'DRAFT', tone: 'info' },
            versionLabel: 'v4',
            updatedLabel: 'current',
            facts: [],
            mappings: [],
            probes: [],
            probeReady: true,
            publishReady: false,
            publishDisabledReason: 'Independent review evidence is required.',
          },
        ]}
        selectedConnectorId="connector-1"
        onViewChange={vi.fn()}
        onSelectConnector={vi.fn()}
        onRefresh={vi.fn()}
        onProbe={probe}
        onPublish={vi.fn()}
      />
    );
    await act(async () =>
      fireEvent.click(getByRole(harness.node, 'button', { name: copy.probeLabel }))
    );
    expect(probe).toHaveBeenCalledWith('connector-1');
  });
});
