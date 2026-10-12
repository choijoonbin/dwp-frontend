// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, queryByText, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReferenceConfigurationStudio } from '../components/reference-configuration-studio';

import type {
  ReferenceConfigurationCommandInput,
  ReferenceConfigurationCommandReceipt,
  ReferenceConfigurationLifecycle,
  ReferenceConfigurationLifecycleAction,
} from '../model/reference-configuration-model';

const CONFIGURATION_ID = '10000000-0000-4000-8000-000000000001';
const RECEIPT_ID = '50000000-0000-4000-8000-000000000001';

describe('ReferenceConfigurationStudio command-owner boundary', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it('executes injected validate simulate submit approve publish rollback retire and records receipts', async () => {
    const calls: ReferenceConfigurationCommandInput[] = [];
    const onCommitted = vi.fn();
    const commandOwner = {
      execute: vi.fn(async (input: ReferenceConfigurationCommandInput) => {
        calls.push(input);
        return receipt(input.action, input.aggregateVersion + 1);
      }),
    };
    const chain: readonly [
      ReferenceConfigurationLifecycle,
      ReferenceConfigurationLifecycleAction,
    ][] = [
      ['DRAFT', 'VALIDATE'],
      ['VALIDATED', 'SIMULATE'],
      ['SIMULATED', 'SUBMIT'],
      ['PENDING_APPROVAL', 'APPROVE'],
      ['APPROVED', 'PUBLISH'],
      ['PUBLISHED', 'ROLLBACK'],
      ['PUBLISHED', 'RETIRE'],
    ];

    for (const [index, [lifecycle, action]] of chain.entries()) {
      await renderStudio({
        lifecycle,
        action,
        aggregateVersion: index + 1,
        commandOwner,
        onCommitted,
      });
      const button = getByRole(host, 'button', {
        name: `${action} reference configuration`,
      });
      expect((button as HTMLButtonElement).disabled).toBe(false);
      await act(async () => fireEvent.click(button));
      await waitFor(() => expect(host.textContent).toContain(`${action} completed`));
      expect(host.textContent).toContain(`Immutable receipt ${RECEIPT_ID}`);
    }

    expect(calls.map(({ action }) => action)).toEqual(chain.map(([, action]) => action));
    expect(calls).toEqual(
      chain.map(([, action], index) => ({
        action,
        configurationId: CONFIGURATION_ID,
        version: 3,
        aggregateVersion: index + 1,
      }))
    );
    expect(onCommitted).toHaveBeenCalledTimes(7);
    expect(Object.isFrozen(onCommitted.mock.calls[0][0])).toBe(true);
  });

  it('fails closed without an injected owner and does not expose an executable action', async () => {
    await renderStudio({ lifecycle: 'DRAFT', action: 'VALIDATE', aggregateVersion: 1 });
    const button = getByRole(host, 'button', {
      name: 'VALIDATE reference configuration',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(host.textContent).toContain('Lifecycle command authority is unavailable');
    fireEvent.click(button);
    expect(queryByText(host, /completed/u)).toBeNull();
  });

  it('renders stale and error outcomes without fabricating a successful receipt', async () => {
    const staleOwner = {
      execute: vi.fn(async () =>
        Promise.reject({ response: { status: 409, data: { code: 'OBJECT_VERSION_CONFLICT' } } })
      ),
    };
    await renderStudio({
      lifecycle: 'APPROVED',
      action: 'PUBLISH',
      aggregateVersion: 4,
      commandOwner: staleOwner,
    });
    await act(async () =>
      fireEvent.click(getByRole(host, 'button', { name: 'PUBLISH reference configuration' }))
    );
    await waitFor(() => expect(host.textContent).toContain('Lifecycle evidence is stale'));
    expect(host.textContent).not.toContain('Immutable receipt');

    const failedOwner = {
      execute: vi.fn(async () => Promise.reject(new Error('owner unavailable'))),
    };
    await renderStudio({
      lifecycle: 'DRAFT',
      action: 'VALIDATE',
      aggregateVersion: 5,
      commandOwner: failedOwner,
    });
    await act(async () =>
      fireEvent.click(getByRole(host, 'button', { name: 'VALIDATE reference configuration' }))
    );
    await waitFor(() => expect(host.textContent).toContain('VALIDATE failed'));
    expect(host.textContent).toContain('owner unavailable');
    expect(host.textContent).not.toContain('Immutable receipt');
  });

  it.each(['FAILED', 'RESULT_UNKNOWN'] as const)(
    'does not render %s owner receipts as successful',
    async (status) => {
      const owner = {
        execute: vi.fn(async () => ({ ...receipt('VALIDATE', 2), status })),
      };
      const onCommitted = vi.fn();
      await renderStudio({
        lifecycle: 'DRAFT',
        action: 'VALIDATE',
        aggregateVersion: 1,
        commandOwner: owner,
        onCommitted,
      });
      await act(async () =>
        fireEvent.click(getByRole(host, 'button', { name: 'VALIDATE reference configuration' }))
      );
      await waitFor(() => expect(host.textContent).toContain('VALIDATE failed'));
      expect(host.textContent).not.toContain('Immutable receipt');
      expect(onCommitted).not.toHaveBeenCalled();
    }
  );

  async function renderStudio(input: {
    lifecycle: ReferenceConfigurationLifecycle;
    action: ReferenceConfigurationLifecycleAction;
    aggregateVersion: number;
    commandOwner?: { execute(input: ReferenceConfigurationCommandInput): Promise<unknown> };
    onCommitted?: (
      receipt: ReferenceConfigurationCommandReceipt
    ) => void | Promise<void>;
  }) {
    await act(async () => {
      root.render(
        <ReferenceConfigurationStudio
          state="READY"
          workbench={workbench(input.lifecycle, input.action)}
          detail={detail(input.lifecycle, input.aggregateVersion)}
          detailLoading={false}
          selectedId={CONFIGURATION_ID}
          statusFilter=""
          onStatusFilterChange={vi.fn()}
          onSelect={vi.fn()}
          onRefresh={vi.fn()}
          commandOwner={input.commandOwner}
          onCommandCommitted={input.onCommitted}
        />
      );
    });
  }
});

function receipt(action: ReferenceConfigurationLifecycleAction, aggregateVersion: number) {
  return {
    receiptId: RECEIPT_ID,
    commandType: `${action}_VERSION`,
    originatingAction: `configuration.version.${action.toLowerCase()}`,
    subjectPrincipalPublicId: '60000000-0000-4000-8000-000000000001',
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 7,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 9,
    status: 'SUCCEEDED',
    correlationId: '30000000-0000-4000-8000-000000000001',
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-12T12:00:00Z',
    aggregateVersion,
    resultRef: `${CONFIGURATION_ID}/${action === 'ROLLBACK' ? 99 : 3}`,
  };
}

function detail(lifecycle: ReferenceConfigurationLifecycle, aggregateVersion: number) {
  return {
    configurationId: CONFIGURATION_ID,
    version: 3,
    state: lifecycle,
    effectiveFrom: '2026-10-12T12:00:00Z',
    effectiveTo: null,
    schemaKey: 'employment-status',
    schemaVersion: 1,
    payloadDigest: 'b'.repeat(64),
    approvalReceiptId: null,
    aggregateVersion,
  } as const;
}

function workbench(
  lifecycle: ReferenceConfigurationLifecycle,
  actionName: ReferenceConfigurationLifecycleAction
) {
  const action = actionName.toLowerCase();
  return {
    projectionVersion: '1' as const,
    asOf: '2026-10-12T12:00:00Z',
    variantKey: 'REFERENCE' as const,
    queryState: {
      state: 'COMPLETE' as const,
      scopeDecisionRevision: 'scope-1',
      freshness: 'CURRENT' as const,
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: '30000000-0000-4000-8000-000000000001',
      cachePolicy: {
        authorizationDecisionRevision: 'scope-1',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1' as const,
        maxAgeSeconds: 30,
      },
    },
    items: [
      {
        itemPublicId: CONFIGURATION_ID,
        title: 'Employment status',
        statusCode: lifecycle,
        fieldGroups: {
          POLICY_VERSION: { decision: 'VIEW', value: { revision: 3 } },
          REFERENCE_DATA: { decision: 'VIEW', value: { code: 'SYS' } },
          EFFECTIVE_STATUS: { decision: 'VIEW', value: { code: lifecycle } },
        },
        deepLink: {
          route: '/hr/settings/reference-data' as const,
          resourcePublicId: CONFIGURATION_ID,
        },
        availableActions: [
          {
            actionKey: `hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions.resource.${action}`,
            method: 'POST' as const,
            hrefTemplate: `/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/${action}`,
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY' as const,
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' as const,
          },
        ],
      },
    ],
  };
}
