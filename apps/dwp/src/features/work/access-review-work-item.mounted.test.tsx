// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessReviewWorkItem } from './access-review-work-item';

import type { AccessReviewWorkDetail } from '@dwp-frontend/shared-utils/api/access-review-work-api';
import type { ReactNode } from 'react';
import type * as SharedUtilsModule from '@dwp-frontend/shared-utils';

const state = vi.hoisted(() => ({
  user: {
    identityPlane: 'TENANT',
    tenantId: 'tenant-a',
    userId: 'user-a',
    personPublicId: 'person-a',
    roles: ['REVIEWER'],
    groups: [],
    resourceRoles: [],
  },
  permissions: [{ resource: 'APP.WORK', action: 'VIEW' }],
  getDetail: vi.fn(),
  decide: vi.fn(),
  evaluate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  changeReason: null as null | ((event: { target: { value: string } }) => void),
  submitDialog: null as null | (() => void),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({ formatDate: (value: string) => value }));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => false }));
vi.mock('../../components/shell-auxiliary-avoidance/use-shell-auxiliary-avoidance', () => ({
  useShellAuxiliaryAvoidance: () => undefined,
}));
vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({ user: state.user, isAuthenticated: true, isLoading: false }),
}));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ permissions: state.permissions }),
}));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtilsModule>()),
  getAccessReviewWorkDetail: (...args: unknown[]) => state.getDetail(...args),
  decideAccessReviewWork: (...args: unknown[]) => state.decide(...args),
  useProductSurfaceAuthority: () => ({
    status: 'ready',
    snapshot: {
      envelope: { activeAccessMode: 'NORMAL', decisionRevision: 'authority-1' },
      clockOffsetMs: 0,
    },
    evaluateGoverned: (...args: unknown[]) => state.evaluate(...args),
    revalidate: vi.fn(),
  }),
  useToast: () => ({ success: state.toastSuccess, error: state.toastError }),
}));
vi.mock('../../routes/governed-route-access-guard', async () => {
  const { createElement } = await import('react');
  return {
    GovernedRouteAccessGuard: ({ children }: { children: ReactNode }) =>
      createElement('div', null, children),
    mapGovernedRouteEvaluation: () => ({
      state: 'allowed',
      decisionRevision: 'decision-1',
      effectiveReadOnly: false,
    }),
    useGovernedRouteAccessDecision: () => ({
      state: 'allowed',
      decisionRevision: 'decision-1',
      effectiveReadOnly: false,
    }),
  };
});
vi.mock('@dwp-frontend/design-system', async () => {
  const { createElement } = await import('react');
  return {
    ActionButton: ({
      children,
      disabled,
      onClick,
    }: {
      children: ReactNode;
      disabled?: boolean;
      onClick?: () => void;
    }) => createElement('button', { disabled, onClick }, children),
    FormDialog: ({
      children,
      open,
      onSubmit,
      submitDisabled,
    }: {
      children: ReactNode;
      open: boolean;
      onSubmit: () => void;
      submitDisabled?: boolean;
    }) => {
      state.submitDialog = open ? onSubmit : null;
      return open
        ? createElement(
            'div',
            null,
            children,
            createElement(
              'button',
              { 'data-dialog-submit': true, disabled: submitDisabled, onClick: onSubmit },
              'submit'
            )
          )
        : null;
    },
    FormField: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (event: { target: { value: string } }) => void;
    }) => {
      state.changeReason = onChange;
      return createElement('output', { 'data-reason': true }, value);
    },
    InlineFeedback: ({ children }: { children: ReactNode }) => createElement('div', null, children),
    LoadingState: ({ label }: { label: string }) => createElement('div', null, label),
    LocalErrorState: ({ title }: { title: string }) => createElement('div', null, title),
  };
});

const workItemRef = 'opaque-review-ref';
const detail: AccessReviewWorkDetail = {
  workItemRef,
  campaignName: 'Quarterly access review',
  dueAt: '2026-09-30T00:00:00Z',
  subjectUserId: 7,
  subjectDisplayName: 'Current owner subject',
  subjectEmail: 'subject@example.com',
  roleId: 8,
  roleCode: 'FINANCE_VIEWER',
  roleName: 'Finance viewer',
  accessSourceType: 'DIRECT',
  sourceKey: null,
  sourceDisplayName: null,
  assignmentCreatedAt: '2026-01-01T00:00:00Z',
  subjectLastSignInAt: '2026-08-01T00:00:00Z',
  privileged: false,
  recommendation: 'KEEP',
  recommendationReason: 'RECENT_ACTIVITY',
  decision: 'PENDING',
  decisionReason: null,
  decidedAt: null,
  remediationState: 'NOT_REQUIRED',
  version: 3,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
let rootMounted: boolean;
let commandsEnabled: boolean;
let preflight: ReturnType<typeof vi.fn<() => Promise<boolean>>>;

async function render() {
  rootMounted = true;
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <AccessReviewWorkItem
          workItemRef={workItemRef}
          commandsEnabled={commandsEnabled}
          commandScope={`${workItemRef}:${detail.version}:PENDING`}
          preflight={preflight}
        />
      </QueryClientProvider>
    )
  );
}

function button(label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === label
  );
}

async function waitFor(assertion: () => void) {
  await act(async () => vi.waitFor(assertion));
}

async function beginDecision(receipt: Promise<AccessReviewWorkDetail>) {
  state.getDetail.mockResolvedValue(detail);
  state.decide.mockReturnValue(receipt);
  await render();
  await waitFor(() => expect(button('workPage.accessReview.keep')).toBeDefined());
  await act(async () => button('workPage.accessReview.keep')?.click());
  await act(async () =>
    state.changeReason?.({ target: { value: 'Access remains required for current duties.' } })
  );
  await act(async () => button('workHub.accessEvidence.preview')?.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[data-dialog-submit]')?.click());
  await waitFor(() => expect(state.decide).toHaveBeenCalledOnce());
}

describe('mounted access review Work owner lifecycle', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state.user = {
      identityPlane: 'TENANT',
      tenantId: 'tenant-a',
      userId: 'user-a',
      personPublicId: 'person-a',
      roles: ['REVIEWER'],
      groups: [],
      resourceRoles: [],
    };
    state.permissions = [{ resource: 'APP.WORK', action: 'VIEW' }];
    state.changeReason = null;
    state.submitDialog = null;
    commandsEnabled = true;
    preflight = vi.fn().mockResolvedValue(true);
    state.evaluate.mockResolvedValue({ decision: 'ALLOWED' });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    rootMounted = false;
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    if (rootMounted) await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('aborts detail reads independently for tenant, user, and permission-scope transitions', async () => {
    const reads = Array.from({ length: 4 }, () => deferred<AccessReviewWorkDetail>());
    const signals: AbortSignal[] = [];
    state.getDetail.mockImplementation((_reference: string, signal: AbortSignal) => {
      signals.push(signal);
      return reads[signals.length - 1]!.promise;
    });

    await render();
    await waitFor(() => expect(signals).toHaveLength(1));

    state.user = { ...state.user, tenantId: 'tenant-b' };
    await render();
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0]?.aborted).toBe(true);

    state.user = { ...state.user, userId: 'user-b' };
    await render();
    await waitFor(() => expect(signals).toHaveLength(3));
    expect(signals[1]?.aborted).toBe(true);

    state.permissions = [{ resource: 'APP.WORK', action: 'READ_ONLY' }];
    await render();
    await waitFor(() => expect(signals).toHaveLength(4));
    expect(signals[2]?.aborted).toBe(true);

    await act(async () => reads[3]!.resolve(detail));
    await waitFor(() => expect(host.textContent).toContain(detail.subjectDisplayName));
    await act(async () => {
      reads[0]!.resolve({ ...detail, subjectDisplayName: 'Stale tenant subject' });
      reads[1]!.resolve({ ...detail, subjectDisplayName: 'Stale user subject' });
      reads[2]!.resolve({ ...detail, subjectDisplayName: 'Stale permission subject' });
    });
    expect(host.textContent).not.toContain('Stale tenant subject');
    expect(host.textContent).not.toContain('Stale user subject');
    expect(host.textContent).not.toContain('Stale permission subject');
  });

  it('fails closed when the detail response belongs to another opaque Work reference', async () => {
    state.getDetail.mockResolvedValue({ ...detail, workItemRef: 'another-review-ref' });
    await render();

    await waitFor(() => expect(host.textContent).toContain('workPage.accessReview.loadErrorTitle'));
    expect(host.textContent).not.toContain(detail.subjectDisplayName);
  });

  it.each<{ label: string; move: () => void }>([
    { label: 'tenant', move: () => (state.user = { ...state.user, tenantId: 'tenant-b' }) },
    { label: 'user', move: () => (state.user = { ...state.user, userId: 'user-b' }) },
    {
      label: 'access',
      move: () => (state.permissions = [{ resource: 'APP.WORK', action: 'READ_ONLY' }]),
    },
  ])(
    'aborts and suppresses a late decision receipt after a $label transition',
    async ({ move }) => {
      const receipt = deferred<AccessReviewWorkDetail>();
      await beginDecision(receipt.promise);
      const signal = state.decide.mock.calls[0]?.[2] as AbortSignal;
      expect(state.getDetail.mock.calls.some((call) => call[1] === signal)).toBe(true);
      expect(state.evaluate.mock.calls[0]?.[1]).toEqual({ signal });
      const invalidate = vi.spyOn(client, 'invalidateQueries');

      move();
      await render();
      expect(signal.aborted).toBe(true);
      await act(async () => receipt.resolve({ ...detail, decision: 'APPROVE', version: 4 }));

      expect(state.toastSuccess).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
    }
  );

  it('does not publish a transport-success receipt with a mismatched decision identity', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await beginDecision(
      Promise.resolve({
        ...detail,
        workItemRef: 'another-review-ref',
        decision: 'REVOKE',
        version: detail.version,
      })
    );

    await waitFor(() => expect(state.toastError).toHaveBeenCalledOnce());
    expect(state.toastSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(host.textContent).toContain(detail.subjectDisplayName);
    expect(
      client
        .getQueryCache()
        .getAll()
        .some(
          (query) =>
            (query.state.data as AccessReviewWorkDetail | undefined)?.workItemRef ===
            'another-review-ref'
        )
    ).toBe(false);
  });

  it.each([
    ['subject', { subjectUserId: 99 }],
    ['role', { roleId: 99 }],
    ['source', { accessSourceType: 'GROUP', sourceKey: 'another-group' }],
  ] as const)(
    'does not decide when the fresh %s differs from the reviewed preview',
    async (_case, overrides) => {
      state.getDetail.mockResolvedValue(detail);
      await render();
      await waitFor(() => expect(button('workPage.accessReview.keep')).toBeDefined());
      await act(async () => button('workPage.accessReview.keep')?.click());
      await act(async () =>
        state.changeReason?.({ target: { value: 'Access remains required for current duties.' } })
      );
      await act(async () => button('workHub.accessEvidence.preview')?.click());
      state.getDetail.mockResolvedValue({ ...detail, ...overrides });
      await act(async () => state.submitDialog?.());
      await waitFor(() => expect(state.toastError).toHaveBeenCalledOnce());
      expect(state.decide).not.toHaveBeenCalled();
      expect(state.toastSuccess).not.toHaveBeenCalled();
    }
  );

  it('does not start decision preflight or mutation from a programmatic submit while commands are disabled', async () => {
    state.getDetail.mockResolvedValue(detail);
    await render();
    await waitFor(() => expect(button('workPage.accessReview.keep')).toBeDefined());
    await act(async () => button('workPage.accessReview.keep')?.click());
    await act(async () =>
      state.changeReason?.({ target: { value: 'Access remains required for current duties.' } })
    );
    await act(async () => button('workHub.accessEvidence.preview')?.click());
    await waitFor(() => expect(state.submitDialog).not.toBeNull());
    const readsBeforeSubmit = state.getDetail.mock.calls.length;

    commandsEnabled = false;
    await render();
    await act(async () => state.submitDialog?.());

    expect(state.getDetail).toHaveBeenCalledTimes(readsBeforeSubmit);
    expect(state.evaluate).not.toHaveBeenCalled();
    expect(state.decide).not.toHaveBeenCalled();
  });

  it.each(['a cached refetch failure', 'fresh action availability drift'])(
    'does not dispatch a decision after %s',
    async () => {
      state.getDetail.mockResolvedValue(detail);
      state.decide.mockResolvedValue({ ...detail, decision: 'APPROVE', version: 4 });
      preflight.mockResolvedValue(false);
      await render();
      await waitFor(() => expect(button('workPage.accessReview.keep')).toBeDefined());
      await act(async () => button('workPage.accessReview.keep')?.click());
      await act(async () =>
        state.changeReason?.({ target: { value: 'Access remains required for current duties.' } })
      );
      await act(async () => button('workHub.accessEvidence.preview')?.click());
      await act(async () => state.submitDialog?.());
      await waitFor(() => expect(state.toastError).toHaveBeenCalledOnce());

      expect(preflight).toHaveBeenCalledOnce();
      expect(state.evaluate).toHaveBeenCalledOnce();
      expect(state.decide).not.toHaveBeenCalled();
    }
  );

  it('aborts and suppresses a late decision receipt after the Work detail unmounts', async () => {
    const receipt = deferred<AccessReviewWorkDetail>();
    await beginDecision(receipt.promise);
    const signal = state.decide.mock.calls[0]?.[2] as AbortSignal;
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(async () => root.unmount());
    rootMounted = false;
    expect(signal.aborted).toBe(true);
    await act(async () => receipt.resolve({ ...detail, decision: 'APPROVE', version: 4 }));

    expect(state.toastSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
