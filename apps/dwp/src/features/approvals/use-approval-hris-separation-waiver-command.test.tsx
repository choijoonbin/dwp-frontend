// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useApprovalHrisSeparationWaiverCommand } from './use-approval-hris-separation-waiver-command';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils/api/approval-governed-mutation';
import type { ApprovalHighRiskCommandDescriptor } from './approval-high-risk-command-model';
import type { ApprovalHrisSeparationWaiverCommandCandidate } from './use-approval-hris-separation-waiver-command';

type HighOptions = Readonly<{
  execute: (
    command: ApprovalHighRiskCommandDescriptor,
    execution: ApprovalMutationExecution
  ) => Promise<ApprovalTaskDetail>;
  onSuccess?: (result: ApprovalTaskDetail) => void | Promise<void>;
  onConflict?: () => void | Promise<void>;
}>;

const harness = vi.hoisted(() => ({
  options: undefined as HighOptions | undefined,
  begin: vi.fn(async (_command: ApprovalHighRiskCommandDescriptor) => undefined),
  close: vi.fn(),
  api: vi.fn(),
}));

vi.mock('./use-approval-high-risk-command', () => ({
  useApprovalHighRiskCommand: (options: HighOptions) => {
    harness.options = options;
    return {
      begin: harness.begin,
      controller: {
        open: false,
        busy: false,
        attempt: null,
        error: null,
        close: harness.close,
        confirm: vi.fn(),
        continueWithIdentityProvider: vi.fn(),
        selectIdentityProvider: vi.fn(),
      },
    };
  },
}));

vi.mock('@dwp-frontend/shared-utils/api/approval-hris-separation-waiver-api', () => ({
  approveApprovalHrisSeparationWaiverTask: (...args: unknown[]) => harness.api(...args),
}));

const taskId = '10000000-0000-4000-8000-000000000001';
const correlationId = '10000000-0000-4000-8000-000000000002';
const input = {
  decision: 'APPROVE',
  expectedVersion: 7,
  quorum: {
    expectedRequestVersion: 11,
    generation: 2,
    expectedStageVersion: 3,
    pins: {
      workflowVersionId: '20000000-0000-4000-8000-000000000001',
      workflowVersion: 4,
      workflowDefinitionSha256: 'a'.repeat(64),
      formSchemaSha256: 'b'.repeat(64),
      policyVersion: 5,
      policySha256: 'c'.repeat(64),
    },
    payloadRevision: 6,
    payloadSha256: 'd'.repeat(64),
  },
} as const;
const execution = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'revision-62',
  contextKey: 'approvals-work',
  contextScopeKey: 'decidable-task',
  objectVersion: input.expectedVersion,
  idempotencyKey: '30000000-0000-4000-8000-000000000001',
  stepUp: {
    challenge: 'signed-step-up',
    challengeId: '30000000-0000-4000-8000-000000000002',
    decisionRevision: 'revision-62',
    expiresAt: '2099-10-29T00:00:00Z',
  },
} as const;
const result = { task: { taskId } } as ApprovalTaskDetail;

let root: Root;
let container: HTMLDivElement;
let controller: ReturnType<typeof useApprovalHrisSeparationWaiverCommand>;

function Harness() {
  controller = useApprovalHrisSeparationWaiverCommand({});
  return null;
}

describe('HRIS separation-waiver HIGH controller', () => {
  beforeEach(() => {
    harness.options = undefined;
    harness.begin.mockClear();
    harness.close.mockClear();
    harness.api.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function candidate(overrides: Partial<ApprovalHrisSeparationWaiverCommandCandidate> = {}) {
    return {
      taskId,
      input,
      correlationId,
      scopeIdentity: 'scope-62',
      refreshCurrent: vi.fn(async () => undefined),
      assertCurrent: vi.fn(),
      ...overrides,
    } satisfies ApprovalHrisSeparationWaiverCommandCandidate;
  }

  it('refreshes and reasserts authority before exact governed dispatch', async () => {
    const order: string[] = [];
    const current = candidate({
      refreshCurrent: vi.fn(async () => {
        order.push('refresh');
      }),
      assertCurrent: vi.fn(() => {
        order.push('assert');
      }),
    });
    harness.api.mockImplementation(
      async (
        _taskId: string,
        _body: unknown,
        _execution: ApprovalMutationExecution,
        _correlationId: string,
        beforeDispatch: () => void
      ) => {
        beforeDispatch();
        order.push('api');
        return result;
      }
    );
    await act(async () => controller.begin(current));
    order.length = 0;
    const command = harness.begin.mock.calls[0]![0];

    await expect(harness.options!.execute(command, execution)).resolves.toBe(result);

    expect(order).toEqual(['refresh', 'assert', 'assert', 'api']);
    expect(harness.api).toHaveBeenCalledWith(
      taskId,
      command.payload,
      execution,
      correlationId,
      current.assertCurrent
    );
  });

  it('cancels stale local authority before transport and releases pending state on close', async () => {
    const stale = candidate({
      refreshCurrent: vi.fn(async () => {
        throw new ProductSurfaceOperationCancelledError();
      }),
    });
    await act(async () => controller.begin(stale));
    const command = harness.begin.mock.calls[0]![0];
    await expect(harness.options!.execute(command, execution)).rejects.toBeInstanceOf(
      ProductSurfaceOperationCancelledError
    );
    expect(harness.api).not.toHaveBeenCalled();
    await expect(controller.begin(candidate())).rejects.toBeInstanceOf(
      ProductSurfaceOperationCancelledError
    );
    act(() => controller.controller.close());
    await expect(controller.begin(candidate())).resolves.toBeUndefined();
  });
});
