// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApproverRoutingWorkspace } from './approver-routing-workspace';
import { attention, facts, healthy, metrics, routingCopy } from './admin-v2-test-fixtures';
import { createAdminV2TestHarness, type AdminV2TestHarness } from './admin-v2-test-harness';

const groups = [
  {
    id: 'group-1',
    name: 'Regional finance approvers',
    description: 'Resolves the current regional controller and fallback owner.',
    ownerLabel: 'Finance Governance',
    scopeLabel: 'Tenant scope',
    memberCountLabel: '3 members',
    usageLabel: '12 workflows',
    status: healthy,
    facts,
    members: [
      {
        id: 'user-1',
        name: 'Alex Morgan',
        roleLabel: 'Regional controller',
        sourceLabel: 'Directory rev-184',
        status: healthy,
      },
    ],
  },
  {
    id: 'group-2',
    name: 'Security exception board',
    description: 'Parallel review group for privileged exceptions.',
    ownerLabel: 'Security',
    scopeLabel: 'Resource set',
    memberCountLabel: '5 members',
    usageLabel: '8 workflows',
    status: attention,
    facts,
    members: [],
  },
] as const;

const simulation = {
  simulationId: 'simulation-1',
  title: 'Resolved route',
  description: 'Exact route for the supplied requester and amount.',
  status: healthy,
  inputs: facts,
  steps: [
    {
      id: 'step-1',
      title: 'Manager approval',
      detail: 'Resolved the requester line manager.',
      status: healthy,
      meta: 'Directory rev-184',
    },
  ],
  explanation: 'Amount and region matched the published finance rule.',
  authorityLabel: 'Authority rev-184',
  expiresLabel: 'Expires in 4 minutes',
} as const;

const exceptions = [
  {
    id: 'exception-1',
    title: 'No eligible cost-center owner',
    description: 'The directory returned no active candidate.',
    status: attention,
    affectedWorkflowsLabel: '3 affected workflows',
    detectedLabel: 'Detected 5 minutes ago',
    evidence: facts,
    remediationLabel: 'Request owner correction',
  },
] as const;

describe('APR-19 approver and routing workspace', () => {
  let harness: AdminV2TestHarness;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });

  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  function props(view: 'directory' | 'simulation' | 'exceptions' = 'directory') {
    return {
      state: 'ready' as const,
      copy: routingCopy,
      metrics,
      view,
      groups,
      selectedGroupId: 'group-1',
      simulation,
      exceptions,
      editGroupReady: true,
      publishGroupReady: true,
      simulationReady: true,
      simulationDisabledReason: 'Select a current routing group.',
      remediationReady: false,
      remediationDisabledReason: 'The canonical API has no remediation command.',
      onViewChange: vi.fn(),
      onSelectGroup: vi.fn(),
      onRefreshDirectory: vi.fn(),
      onRunSimulation: vi.fn(),
      onEditGroup: vi.fn(),
      onPublishGroup: vi.fn(),
      onRetireGroup: vi.fn(),
      onRequestRemediation: vi.fn(),
      onRetry: vi.fn(),
      onResolveConflict: vi.fn(),
    };
  }

  it('connects directory selection and exact edit, publish, and retire intents', async () => {
    const current = props();
    await harness.render(<ApproverRoutingWorkspace {...current} />);
    await act(async () => {
      fireEvent.click(getByRole(harness.node, 'button', { name: /Security exception board/u }));
      fireEvent.click(
        getByRole(harness.node, 'button', { name: routingCopy.refreshDirectoryLabel })
      );
      fireEvent.click(getByRole(harness.node, 'button', { name: routingCopy.editGroupLabel }));
      fireEvent.click(getByRole(harness.node, 'button', { name: routingCopy.publishGroupLabel }));
      fireEvent.click(getByRole(harness.node, 'button', { name: routingCopy.retireGroupLabel }));
    });
    expect(current.onSelectGroup).toHaveBeenCalledWith('group-2');
    expect(current.onRefreshDirectory).toHaveBeenCalledTimes(1);
    expect(current.onEditGroup).toHaveBeenCalledWith('group-1');
    expect(current.onPublishGroup).toHaveBeenCalledWith('group-1');
    expect(current.onRetireGroup).toHaveBeenCalledWith('group-1');
    expect(
      getByRole<HTMLButtonElement>(harness.node, 'button', { name: routingCopy.mobileRetireLabel })
        .disabled
    ).toBe(true);
  });

  it('shows exact simulation evidence and runs the simulator', async () => {
    const current = props('simulation');
    await harness.render(<ApproverRoutingWorkspace {...current} />);
    expect(harness.node.textContent).toContain(simulation.explanation);
    const runButtons = Array.from(
      harness.node.querySelectorAll<HTMLButtonElement>('button')
    ).filter((button) => button.textContent?.includes(routingCopy.runSimulationLabel));
    await act(async () => fireEvent.click(runButtons[0]!));
    expect(current.onRunSimulation).toHaveBeenCalledTimes(1);
  });

  it('keeps unsupported remediation unavailable from first paint and dispatches nothing', async () => {
    const current = props('exceptions');
    await harness.render(<ApproverRoutingWorkspace {...current} />);
    const remediation = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: exceptions[0].remediationLabel,
    });
    expect(remediation.disabled).toBe(true);
    await act(async () => fireEvent.click(remediation));
    expect(current.onRequestRemediation).not.toHaveBeenCalled();
    expect(harness.node.textContent).toContain(current.remediationDisabledReason);
  });

  it('keeps the unsupported remediation contract visible when no exceptions exist', async () => {
    const current = props('exceptions');
    await harness.render(<ApproverRoutingWorkspace {...current} exceptions={[]} />);
    const remediation = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: routingCopy.requestRemediationLabel,
    });
    expect(remediation.disabled).toBe(true);
    await act(async () => fireEvent.click(remediation));
    expect(current.onRequestRemediation).not.toHaveBeenCalled();
    expect(harness.node.textContent).toContain(current.remediationDisabledReason);
  });
});
