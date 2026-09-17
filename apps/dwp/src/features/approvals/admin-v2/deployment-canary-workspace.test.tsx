// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeploymentCanaryWorkspace } from './deployment-canary-workspace';
import { attention, deploymentCopy, facts, healthy, metrics } from './admin-v2-test-fixtures';
import { createAdminV2TestHarness, type AdminV2TestHarness } from './admin-v2-test-harness';

const packages = [
  {
    id: 'package-1',
    name: 'Finance approval assets',
    description: 'Forms, workflow, policy, and notification bindings.',
    versionLabel: 'Package v12',
    environmentLabel: 'STAGING',
    digestLabel: 'sha256: server-package-digest',
    assetCountLabel: '14 immutable assets',
    status: attention,
    validationStatus: healthy,
    facts,
    dependencies: [
      {
        id: 'dependency-1',
        title: 'Form schema compatibility',
        detail: 'All published form consumers accept schema v3.',
        status: healthy,
      },
    ],
  },
  {
    id: 'package-2',
    name: 'Security exception assets',
    description: 'Exception forms and independent-review workflow.',
    versionLabel: 'Package v4',
    environmentLabel: 'DRAFT',
    digestLabel: 'sha256: second-server-digest',
    assetCountLabel: '6 immutable assets',
    status: healthy,
    validationStatus: attention,
    facts,
    dependencies: [],
  },
] as const;

const promotionPlan = {
  id: 'plan-1',
  packageId: 'package-1',
  title: 'Promote finance approval assets',
  description: 'Governed promotion from staging to production.',
  sourceEnvironmentLabel: 'STAGING',
  targetEnvironmentLabel: 'PRODUCTION',
  scheduledLabel: 'Awaiting independent review',
  validationStatus: healthy,
  reviewStatus: attention,
  facts,
  gates: [
    {
      id: 'gate-1',
      title: 'Dependency digest verified',
      detail: 'The server verified the immutable manifest.',
      status: healthy,
    },
  ],
} as const;

const canaryEvidence = {
  planId: 'plan-1',
  status: { label: 'OBSERVING', tone: 'info' as const },
  sampledAtLabel: 'Sampled by server at 10:52 KST',
  sourceRevisionLabel: 'deployment rev-91',
  evidenceWindowLabel: 'Evidence window 15 minutes',
  metrics,
  observations: [
    {
      id: 'observation-1',
      title: 'Pinned in-flight versions',
      detail: 'Existing requests remain bound to their original asset versions.',
      status: healthy,
    },
  ],
} as const;

const irreversibleAssessment = {
  planId: 'plan-1',
  status: attention,
  reversible: false,
  assessedAtLabel: 'Assessed by server at 10:53 KST',
  sourceRevisionLabel: 'rollback rev-12',
  summary: 'Rollback is blocked because an external signature side effect is irreversible.',
  facts,
  blockers: [
    {
      id: 'blocker-1',
      title: 'External signature completed',
      detail: 'The provider-side signature cannot be reverted by this product.',
      status: attention,
    },
  ],
} as const;

describe('APR-24 approval asset deployment and canary workspace', () => {
  let harness: AdminV2TestHarness;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });

  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  function props(view: 'packages' | 'promotion' | 'canary' | 'rollback' = 'packages') {
    return {
      state: 'ready' as const,
      copy: deploymentCopy,
      metrics,
      view,
      packages,
      selectedPackageId: 'package-1',
      promotionPlan,
      canaryEvidence,
      rollbackAssessment: irreversibleAssessment,
      onViewChange: vi.fn(),
      onSelectPackage: vi.fn(),
      onRefresh: vi.fn(),
      onValidatePackage: vi.fn(),
      onSubmitPromotion: vi.fn(),
      onPauseCanary: vi.fn(),
      onRequestRollback: vi.fn(),
      promotionReady: true,
      promotionDisabledReason: 'Activation is not ready.',
      pauseReady: false,
      pauseDisabledReason: 'The API does not expose pause.',
      rollbackReady: false,
      rollbackDisabledReason: 'Exact rollback input is unavailable.',
      onRetry: vi.fn(),
      onResolveConflict: vi.fn(),
    };
  }

  it('uses immutable package props and connects selection and validation', async () => {
    const current = props();
    await harness.render(<DeploymentCanaryWorkspace {...current} />);
    expect(harness.node.textContent).toContain(packages[0].digestLabel);
    await act(async () => {
      fireEvent.click(getByRole(harness.node, 'button', { name: /Security exception assets/u }));
      fireEvent.click(
        getByRole(harness.node, 'button', { name: deploymentCopy.validatePackageLabel })
      );
    });
    expect(current.onSelectPackage).toHaveBeenCalledWith('package-2');
    expect(current.onValidatePackage).toHaveBeenCalledWith('package-1');
  });

  it('enables activation from explicit readiness even when SCHEDULED has an info tone', async () => {
    const current = props('promotion');
    await harness.render(
      <DeploymentCanaryWorkspace
        {...current}
        promotionPlan={{
          ...promotionPlan,
          validationStatus: { label: 'SCHEDULED', tone: 'info' },
          reviewStatus: { label: 'SCHEDULED', tone: 'info' },
        }}
      />
    );
    await act(async () =>
      fireEvent.click(
        getByRole(harness.node, 'button', { name: deploymentCopy.submitPromotionLabel })
      )
    );
    expect(current.onSubmitPromotion).toHaveBeenCalledWith('plan-1');
    expect(
      getByRole<HTMLButtonElement>(harness.node, 'button', {
        name: deploymentCopy.mobilePromotionLabel,
      }).disabled
    ).toBe(true);
  });

  it('renders sampled server canary evidence and closes pause when authority is stale', async () => {
    const current = props('canary');
    await harness.render(<DeploymentCanaryWorkspace {...current} state="stale" />);
    expect(harness.node.textContent).toContain(canaryEvidence.sampledAtLabel);
    expect(harness.node.textContent).toContain(canaryEvidence.sourceRevisionLabel);
    const pause = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: deploymentCopy.pauseCanaryLabel,
    });
    expect(pause.disabled).toBe(true);
    expect(harness.node.textContent).toContain(current.pauseDisabledReason);
    await act(async () => fireEvent.click(pause));
    expect(current.onPauseCanary).not.toHaveBeenCalled();
  });

  it('does not offer rollback when server evidence marks the package irreversible', async () => {
    const current = props('rollback');
    await harness.render(<DeploymentCanaryWorkspace {...current} />);
    expect(harness.node.textContent).toContain(irreversibleAssessment.summary);
    const rollback = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: deploymentCopy.requestRollbackLabel,
    });
    expect(rollback.disabled).toBe(true);
    expect(harness.node.textContent).toContain(current.rollbackDisabledReason);
    await act(async () => fireEvent.click(rollback));
    expect(current.onRequestRollback).not.toHaveBeenCalled();
  });
});
