// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, getByTestId, queryByText } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalDelegations } from './approval-delegations';

import type { ApprovalDelegation, ApprovalDelegationCreateInput } from '@dwp-frontend/shared-utils';

const dependencies = vi.hoisted(() => ({
  scope: {
    current: {
      governed: true,
      ready: true,
      contextScopeKey: 'scope-a',
      cacheKey: ['tenant-a', 'user-a', 'NORMAL', 'approvals.work', 'scope-a', 'revision-a'],
      queryMeta: {
        accessSensitive: true,
        tenantId: 'tenant-a',
        actorId: 'user-a',
        accessMode: 'NORMAL',
        productId: 'approvals',
        surfaceId: 'approvals.work',
        contextScopeKey: 'scope-a',
        decisionRevision: 'revision-a',
      },
    },
  },
  getApprovalDelegations: vi.fn(),
  createApprovalDelegation: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

const createInput: ApprovalDelegationCreateInput = {
  delegateUserId: 91,
  startsAt: '2026-09-12T00:00:00Z',
  endsAt: '2026-09-13T00:00:00Z',
  reason: 'Coverage',
  scopeType: 'ALL',
};

const previousDelegation: ApprovalDelegation = {
  delegationId: 'delegation-a',
  delegatorUserId: 11,
  delegateUserId: 91,
  delegateDisplayName: 'Previous Scope Candidate',
  scopeType: 'ALL',
  startsAt: createInput.startsAt,
  endsAt: createInput.endsAt,
  lifecycleState: 'ACTIVE',
  reason: createInput.reason,
  version: 1,
  direction: 'OUTGOING',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getApprovalDelegations: dependencies.getApprovalDelegations,
    createApprovalDelegation: dependencies.createApprovalDelegation,
    useToast: () => ({ success: dependencies.success, error: dependencies.error }),
  };
});

vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => dependencies.scope.current,
}));

vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canManageDelegations: true }),
}));

vi.mock('./use-approval-governed-mutation', () => ({
  isProductSurfaceOperationCancelledError: () => false,
  useApprovalGovernedMutation: () =>
    vi.fn((operation: (execution: Record<string, never>) => Promise<unknown>) => operation({})),
}));

vi.mock('./approval-ui', () => ({
  ApprovalSurface: ({ action, children }: { action?: ReactNode; children: ReactNode }) => (
    <div>
      {action}
      {children}
    </div>
  ),
}));

vi.mock('./approval-delegation-workspace', () => ({
  ApprovalDelegationWorkspace: ({ delegations }: { delegations: ApprovalDelegation[] }) => (
    <div data-testid="delegation-count">{delegations.length}</div>
  ),
}));

vi.mock('./approval-delegation-editor', () => ({
  ApprovalDelegationEditor: ({
    open,
    recoveryMessage,
    onSubmit,
  }: {
    open: boolean;
    recoveryMessage?: string;
    onSubmit: (input: ApprovalDelegationCreateInput) => void;
  }) =>
    open ? (
      <div data-testid="delegation-editor">
        {recoveryMessage && <div>{recoveryMessage}</div>}
        <button type="button" onClick={() => onSubmit(createInput)}>
          submit delegation
        </button>
      </div>
    ) : null,
}));

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

function scope(suffix: 'a' | 'b') {
  return {
    governed: true,
    ready: true,
    contextScopeKey: `scope-${suffix}`,
    cacheKey: [
      `tenant-${suffix}`,
      `user-${suffix}`,
      'NORMAL',
      'approvals.work',
      `scope-${suffix}`,
      `revision-${suffix}`,
    ],
    queryMeta: {
      accessSensitive: true,
      tenantId: `tenant-${suffix}`,
      actorId: `user-${suffix}`,
      accessMode: 'NORMAL',
      productId: 'approvals',
      surfaceId: 'approvals.work',
      contextScopeKey: `scope-${suffix}`,
      decisionRevision: `revision-${suffix}`,
    },
  };
}

function renderDelegations() {
  root.render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(ApprovalDelegations))
  );
}

async function beginCreate() {
  await act(async () => renderDelegations());
  await vi.waitFor(() => expect(getByTestId(container, 'delegation-count').textContent).toBe('0'));
  await act(async () =>
    fireEvent.click(getByRole(container, 'button', { name: 'delegations.add' }))
  );
  await vi.waitFor(() => expect(getByTestId(container, 'delegation-editor')).toBeTruthy());
  await act(async () =>
    fireEvent.click(getByRole(container, 'button', { name: 'submit delegation' }))
  );
  await vi.waitFor(() => expect(dependencies.createApprovalDelegation).toHaveBeenCalledTimes(1));
}

async function moveToScopeAndReopenEditor(suffix: 'a' | 'b') {
  dependencies.scope.current = scope(suffix);
  await act(async () => renderDelegations());
  await vi.waitFor(() =>
    expect(
      queryClient.getQueryData(['approvals', ...dependencies.scope.current.cacheKey, 'delegations'])
    ).toEqual([])
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () =>
    fireEvent.click(getByRole(container, 'button', { name: 'delegations.add' }))
  );
  await vi.waitFor(() => expect(getByTestId(container, 'delegation-editor')).toBeTruthy());
}

describe('ApprovalDelegations mutation scope transition', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    dependencies.scope.current = scope('a');
    dependencies.getApprovalDelegations.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('drops a successful command after an A to B to A scope replay', async () => {
    let resolvePrevious!: (delegations: ApprovalDelegation[]) => void;
    dependencies.createApprovalDelegation.mockImplementation(
      () =>
        new Promise<ApprovalDelegation[]>((resolve) => {
          resolvePrevious = resolve;
        })
    );

    await beginCreate();
    await moveToScopeAndReopenEditor('b');
    await moveToScopeAndReopenEditor('a');
    await act(async () => resolvePrevious([previousDelegation]));

    expect(getByTestId(container, 'delegation-editor')).toBeTruthy();
    expect(getByTestId(container, 'delegation-count').textContent).toBe('0');
    expect(dependencies.success).not.toHaveBeenCalled();
    expect(dependencies.error).not.toHaveBeenCalled();
  });

  it('drops a failed command after an A to B to A scope replay without toast leakage', async () => {
    let rejectPrevious!: (error: Error) => void;
    dependencies.createApprovalDelegation.mockImplementation(
      () =>
        new Promise<ApprovalDelegation[]>((_resolve, reject) => {
          rejectPrevious = reject;
        })
    );

    await beginCreate();
    await moveToScopeAndReopenEditor('b');
    await moveToScopeAndReopenEditor('a');
    await act(async () => rejectPrevious(new Error('scope-a unavailable')));

    expect(getByTestId(container, 'delegation-editor')).toBeTruthy();
    expect(queryByText(container, 'delegations.createError')).toBeNull();
    expect(dependencies.success).not.toHaveBeenCalled();
    expect(dependencies.error).not.toHaveBeenCalled();
  });

  it('serializes double-clicked delegation commands before React can publish mutation pending', async () => {
    let release!: (delegations: ApprovalDelegation[]) => void;
    dependencies.createApprovalDelegation.mockImplementation(
      () =>
        new Promise<ApprovalDelegation[]>((resolve) => {
          release = resolve;
        })
    );
    await beginCreate();
    await act(async () => {
      const submit = getByRole(container, 'button', { name: 'submit delegation' });
      fireEvent.click(submit);
      fireEvent.click(submit);
    });
    expect(dependencies.createApprovalDelegation).toHaveBeenCalledTimes(1);
    await act(async () => release([previousDelegation]));
    expect(dependencies.success).toHaveBeenCalledTimes(1);
  });

  it('rechecks the live authority ref after a delayed freshness query and sends no command after authority is revoked', async () => {
    await act(async () => renderDelegations());
    await vi.waitFor(() =>
      expect(getByTestId(container, 'delegation-count').textContent).toBe('0')
    );
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'delegations.add' }))
    );
    let release!: (items: ApprovalDelegation[]) => void;
    dependencies.getApprovalDelegations.mockImplementationOnce(
      () =>
        new Promise<ApprovalDelegation[]>((resolve) => {
          release = resolve;
        })
    );
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit delegation' }))
    );
    await vi.waitFor(() => expect(release).toBeDefined());
    dependencies.scope.current = { ...scope('a'), ready: false };
    await act(async () => renderDelegations());
    await act(async () => release([]));
    expect(dependencies.createApprovalDelegation).not.toHaveBeenCalled();
    expect(dependencies.success).not.toHaveBeenCalled();
  });
});
