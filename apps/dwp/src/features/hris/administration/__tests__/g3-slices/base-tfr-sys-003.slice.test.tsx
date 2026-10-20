// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HRIS_APPROVAL_SHARED_API_CONTRACTS, HrisWorkflowPolicyWorkspace } from '../../workflow';
import { HrisTeamDelegationWorkspace } from '../../../team/delegation';
import {
  delegation,
  delegationAdmission,
  delegationCommandAdmission,
  policy,
  workflowAdmission,
  workflowCommandAdmission,
} from '../../workflow/testing/hris-approval-adapter-fixtures.test-support';

import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';
import type { HrisWorkflowPolicyDataSource } from '../../workflow';
import type { HrisDelegationDataSource } from '../../../team/delegation';
import type { HrisApprovalCommandRunner } from '../../workflow';

const secureExecution = (input: {
  expectedDecisionRevision: string;
  expectedObjectVersion?: number;
  contextScopeKey: string;
}): ApprovalMutationExecution => ({
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: input.expectedDecisionRevision,
  contextKey: 'approval-owner',
  contextScopeKey: input.contextScopeKey,
  idempotencyKey: 'sys003-command-0001',
  ...(input.expectedObjectVersion === undefined
    ? {}
    : {
        objectVersion: input.expectedObjectVersion,
        stepUp: {
          challenge: 'step-up-proof',
          challengeId: 'challenge-0001',
          decisionRevision: input.expectedDecisionRevision,
          expiresAt: '2026-10-18T00:00:00Z',
        },
      }),
});

function commandRunner(
  spy: (input: Parameters<HrisApprovalCommandRunner>[0]) => unknown,
  contextScopeKey: string
): HrisApprovalCommandRunner {
  return async <T,>(input: Parameters<HrisApprovalCommandRunner>[0]) => {
    spy(input);
    return input.run(secureExecution({ ...input, contextScopeKey })) as Promise<T>;
  };
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const match = [...host.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(label)
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('BASE-TFR-SYS-003 frontend acceptance slice', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.history.replaceState(null, '', '/');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    document.body.replaceChildren();
  });

  async function render(node: React.ReactNode) {
    await act(async () =>
      root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
    );
  }

  it('seals the five shared owner contracts and no local API route', () => {
    expect(
      Object.values(HRIS_APPROVAL_SHARED_API_CONTRACTS).map(({ id, method, path }) => ({
        id,
        method,
        path,
      }))
    ).toEqual([
      { id: 'SHARED-API-005', method: 'GET', path: '/api/approvals/v1/admin/policies' },
      {
        id: 'SHARED-API-006',
        method: 'POST',
        path: '/api/approvals/v1/admin/policies/{policyId}/publish',
      },
      { id: 'SHARED-API-010', method: 'GET', path: '/api/approvals/v1/delegations' },
      { id: 'SHARED-API-011', method: 'POST', path: '/api/approvals/v1/delegations' },
      {
        id: 'SHARED-API-012',
        method: 'POST',
        path: '/api/approvals/v1/delegations/{delegationId}/revoke',
      },
    ]);
  });

  it('makes zero owner calls when default-off, unenrolled or cross-product authority is invalid', async () => {
    const workflowSource: HrisWorkflowPolicyDataSource = {
      list: vi.fn(),
      publish: vi.fn(),
    };
    const delegationSource: HrisDelegationDataSource = {
      list: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    };
    await render(
      <>
        <HrisWorkflowPolicyWorkspace dataSource={workflowSource} />
        <HrisTeamDelegationWorkspace
          admission={{
            ...delegationAdmission(),
            populationScopeKey: undefined,
          }}
          dataSource={delegationSource}
        />
      </>
    );
    expect(workflowSource.list).not.toHaveBeenCalled();
    expect(workflowSource.publish).not.toHaveBeenCalled();
    expect(delegationSource.list).not.toHaveBeenCalled();
    expect(delegationSource.create).not.toHaveBeenCalled();
    expect(delegationSource.revoke).not.toHaveBeenCalled();
    expect(host.textContent).toContain('No Approval policy request was started');
    expect(host.textContent).toContain('No Approval owner request was started');
  });

  it('keeps read and publish decisions separate and publishes only the current owner version', async () => {
    window.history.replaceState(null, '', '/hr/settings/workflow?tab=overview&focus=policy-0001');
    const next = policy({ pendingReview: false, version: 8 });
    const source: HrisWorkflowPolicyDataSource = {
      list: vi.fn().mockResolvedValue([policy()]),
      publish: vi.fn().mockResolvedValue([next]),
    };
    const runnerSpy = vi.fn();
    await render(
      <HrisWorkflowPolicyWorkspace
        admission={{ ...workflowAdmission(), command: workflowCommandAdmission() }}
        dataSource={source}
        commandRunner={commandRunner(runnerSpy, 'approval-admin-scope-42')}
      />
    );
    await vi.waitFor(() => expect(source.list).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(host.textContent).toContain('HR change approval policy'));
    const review = host.querySelector('textarea');
    expect(review).not.toBeNull();
    await act(async () => input(review!, 'Independent reviewer approved'));
    await act(async () => button(host, 'Publish reviewed version').click());
    await vi.waitFor(() => expect(source.publish).toHaveBeenCalledTimes(1));
    expect(source.publish).toHaveBeenCalledWith(
      'policy-0001',
      { expectedVersion: 7, reviewComment: 'Independent reviewer approved' },
      expect.objectContaining({ objectVersion: 7, idempotencyKey: 'sys003-command-0001' })
    );
    expect(runnerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        routeContractKey: 'route.approvals.admin.policy-publish.action',
        expectedDecisionRevision: 'decision-workflow-7',
        expectedObjectVersion: 7,
      })
    );
    await vi.waitFor(() => expect(host.textContent).toContain('Owner-confirmed publication'));

    await render(
      <HrisWorkflowPolicyWorkspace
        admission={{ ...workflowAdmission(), command: undefined }}
        dataSource={source}
        commandRunner={commandRunner(runnerSpy, 'approval-admin-scope-42')}
      />
    );
    await vi.waitFor(() => expect(source.list).toHaveBeenCalledTimes(2));
    expect(button(host, 'Publish reviewed version').disabled).toBe(true);
  });

  it('preserves delegation create window and revoke revision without optimistic success', async () => {
    window.history.replaceState(null, '', '/hr/team/delegation?tab=overview&focus=delegation-0001');
    let resolveCreate: ((value: ReturnType<typeof delegation>[]) => void) | undefined;
    const source: HrisDelegationDataSource = {
      list: vi.fn().mockResolvedValue([delegation()]),
      create: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      ),
      revoke: vi.fn().mockResolvedValue([delegation({ lifecycleState: 'REVOKED', version: 10 })]),
    };
    const runnerSpy = vi.fn();
    await render(
      <HrisTeamDelegationWorkspace
        admission={{ ...delegationAdmission(), command: delegationCommandAdmission() }}
        dataSource={source}
        commandRunner={commandRunner(runnerSpy, 'approval-work-scope-42')}
      />
    );
    await vi.waitFor(() => expect(source.list).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(host.textContent).toContain('Alex Delegate'));
    await act(async () => button(host, 'Create delegation').click());
    const fields = [...host.querySelectorAll('input')];
    expect(fields).toHaveLength(4);
    await act(async () => {
      input(fields[0]!, '88');
      input(fields[1]!, 'Coverage during leave');
      input(fields[2]!, '2026-10-18T09:00');
      input(fields[3]!, '2026-10-19T18:00');
    });
    await act(async () => button(host, 'Submit to Approval owner').click());
    await vi.waitFor(() => expect(source.create).toHaveBeenCalledTimes(1));
    expect(source.create).toHaveBeenCalledWith(
      expect.objectContaining({
        delegateUserId: 88,
        scopeType: 'ALL',
        reason: 'Coverage during leave',
      }),
      expect.objectContaining({ idempotencyKey: 'sys003-command-0001' })
    );
    await vi.waitFor(() =>
      expect(host.textContent).toContain('No optimistic success has been applied')
    );
    await act(async () => resolveCreate?.([delegation()]));
    await vi.waitFor(() =>
      expect(host.textContent).toContain('Owner-confirmed delegation outcome')
    );

    await act(async () => button(host, 'Revoke delegation').click());
    await vi.waitFor(() => expect(source.revoke).toHaveBeenCalledTimes(1));
    expect(source.revoke).toHaveBeenCalledWith(
      'delegation-0001',
      9,
      expect.objectContaining({ objectVersion: 9, idempotencyKey: 'sys003-command-0001' })
    );
    expect(runnerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        routeContractKey: 'route.approvals.work.delegation-revoke.action',
        expectedObjectVersion: 9,
      })
    );
  });

  it('renders loading, empty, unavailable and permission states without a blank canvas', async () => {
    const pending = new Promise<ReturnType<typeof policy>[]>(() => undefined);
    const loadingSource: HrisWorkflowPolicyDataSource = {
      list: vi.fn().mockReturnValue(pending),
      publish: vi.fn(),
    };
    await render(
      <HrisWorkflowPolicyWorkspace admission={workflowAdmission()} dataSource={loadingSource} />
    );
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();

    client.clear();
    const emptySource: HrisWorkflowPolicyDataSource = {
      list: vi.fn().mockResolvedValue([]),
      publish: vi.fn(),
    };
    await render(
      <HrisWorkflowPolicyWorkspace admission={workflowAdmission()} dataSource={emptySource} />
    );
    await vi.waitFor(() => expect(host.textContent).toContain('No policies are available'));

    client.clear();
    const unavailableSource: HrisWorkflowPolicyDataSource = {
      list: vi.fn().mockRejectedValue(new Error('owner unavailable')),
      publish: vi.fn(),
    };
    await render(
      <HrisWorkflowPolicyWorkspace admission={workflowAdmission()} dataSource={unavailableSource} />
    );
    await vi.waitFor(() => expect(host.textContent).toContain('Policy owner unavailable'));

    await render(
      <HrisWorkflowPolicyWorkspace
        admission={{ ...workflowAdmission(), ownerActorId: 'foreign-actor' }}
        dataSource={unavailableSource}
      />
    );
    expect(host.textContent).toContain('Workflow policy access is unavailable');
  });
});
