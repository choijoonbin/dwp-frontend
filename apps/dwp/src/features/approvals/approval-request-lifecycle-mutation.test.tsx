// @vitest-environment jsdom

import { webcrypto } from 'node:crypto';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import {
  fireEvent,
  getByLabelText,
  getByRole,
  getByTestId,
  queryByLabelText,
  queryByRole,
} from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import { respondToApprovalInformationRequest as realInformationResponse } from '@dwp-frontend/shared-utils/api/approval-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalRequestLifecycle } from './approval-request-lifecycle';
import { captureApprovalInformationFixtureWire } from '../../../../../e2e/support/approval-information-wire-fixtures';
import {
  approvalInformationDetail,
  INFORMATION_SOURCE_CHANGES,
} from '../../../../../e2e/support/approval-information-generation-fixtures';

import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  respondToApprovalInformationRequest,
} from '@dwp-frontend/shared-utils';

type ResponseControl = Readonly<{
  onMessageChange: (value: string) => void;
  onPayloadChange: (key: string, value: string) => void;
}>;

vi.mock('./approval-request-information-receipt', () => ({
  ApprovalRequestInformationReceipt: () => null,
}));

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
  getApprovalRequests: vi.fn(),
  getApprovalRequestDetail: vi.fn(),
  respondToApprovalInformationRequest: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  responseControl: { current: null as ResponseControl | null },
  beforeDispatch: { current: null as (() => Promise<void> | void) | null },
  execution: { current: {} as Record<string, unknown> },
}));

vi.mock('./use-approval-attachment-mutation', () => ({
  approvalAttachmentRouteInstalled: () => false,
  useApprovalAttachmentMutation: () => ({ available: false, run: vi.fn() }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));

vi.mock('@mui/material/useMediaQuery', () => ({ default: () => false }));

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    disabled,
    onClick,
    type = 'button',
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit';
  }) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  FormDialog: ({
    open,
    children,
    submitLabel,
    submitDisabled,
    onSubmit,
    onClose,
    cancelLabel,
  }: {
    open: boolean;
    children: ReactNode;
    submitLabel: string;
    submitDisabled?: boolean;
    onSubmit: () => void;
    onClose: () => void;
    cancelLabel: string;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        <button type="button" onClick={onClose}>
          {cancelLabel}
        </button>
        <button type="button" disabled={submitDisabled} onClick={onSubmit}>
          {submitLabel}
        </button>
      </div>
    ) : null,
  InlineFeedback: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
    <div>
      {children}
      {action}
    </div>
  ),
  LoadingState: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    searchApprovalRequests: async (
      view: string,
      _filters: unknown,
      scope: string,
      signal: AbortSignal
    ) => {
      const items = await dependencies.getApprovalRequests(view, scope, signal);
      return {
        items,
        totalElements: items.length,
        totalPages: 1,
        page: 0,
        size: 20,
        hasNext: false,
        evaluatedAt: '2026-09-14T00:00:00Z',
      };
    },
    getApprovalRequestDetail: dependencies.getApprovalRequestDetail,
    respondToApprovalInformationRequest: (
      ...args: Parameters<typeof respondToApprovalInformationRequest>
    ) => {
      captureApprovalInformationFixtureWire(args);
      return dependencies.respondToApprovalInformationRequest(...args);
    },
    usePermissions: () => ({ permissions: [], hasPermission: () => false }),
    useToast: () => ({ success: dependencies.success, error: dependencies.error }),
  };
});

vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => dependencies.scope.current,
}));

vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canUpdateRequests: true }),
}));

vi.mock('./use-approval-governed-mutation', () => ({
  isProductSurfaceOperationCancelledError: () => false,
  useApprovalGovernedMutation: () =>
    vi.fn(async (operation: (execution: Record<string, unknown>) => Promise<unknown>) => {
      await dependencies.beforeDispatch.current?.();
      return operation(dependencies.execution.current);
    }),
}));

vi.mock('./approval-return-target', () => ({
  authorizedApprovalWorkReturnTarget: () => null,
}));

vi.mock('./approval-ui', () => ({
  ApprovalSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./approval-request-list-panel', () => ({
  ApprovalRequestListPanel: ({
    requests,
    onRespond,
  }: {
    requests: ApprovalRequest[];
    onRespond: (request: ApprovalRequest) => void;
  }) => (
    <div>
      <span data-testid="request-scope">{requests[0]?.requestId}</span>
      {requests[0] && (
        <button type="button" onClick={() => onRespond(requests[0]!)}>
          open response
        </button>
      )}
    </div>
  ),
}));

vi.mock('./approval-request-lifecycle-inspector', () => ({
  ApprovalRequestLifecycleInspector: () => null,
}));
vi.mock('./approval-request-search-controls', () => ({
  ApprovalRequestSearchControls: () => null,
}));

vi.mock('./approval-request-detail-drawer', () => ({
  ApprovalRequestDetailDrawer: () => null,
}));

vi.mock('./approval-information-response-fields', () => ({
  ApprovalInformationResponseFields: ({
    responseMessage,
    responsePayload,
    disabled,
    onResponseMessageChange,
    onResponsePayloadChange,
  }: {
    responseMessage: string;
    responsePayload: Record<string, string>;
    disabled?: boolean;
    onResponseMessageChange: (value: string) => void;
    onResponsePayloadChange: (key: string, value: string) => void;
  }) => {
    dependencies.responseControl.current = {
      onMessageChange: onResponseMessageChange,
      onPayloadChange: onResponsePayloadChange,
    };
    return (
      <div>
        <input
          aria-label="response message"
          value={responseMessage}
          disabled={disabled}
          onChange={(event) => onResponseMessageChange(event.target.value)}
        />
        <input
          aria-label="response payload"
          value={responsePayload.costCenter ?? ''}
          disabled={disabled}
          onChange={(event) => onResponsePayloadChange('costCenter', event.target.value)}
        />
      </div>
    );
  },
}));

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

function request(suffix: 'a' | 'b'): ApprovalRequest {
  return {
    requestId: `request-${suffix}`,
    requestNumber: `APR-${suffix.toUpperCase()}`,
    title: `Request ${suffix.toUpperCase()}`,
    summary: 'Needs more information',
    workflowNameKo: '기본 결재',
    workflowNameEn: 'Default approval',
    currentStepKey: 'manager',
    currentStepName: 'Manager review',
    currentStepSequence: 1,
    totalSteps: 2,
    status: 'NEEDS_INFO',
    priority: 'NORMAL',
    dataClassification: 'INTERNAL',
    latestInformationRequest: 'Provide the cost center.',
    version: 3,
  };
}

function detail(suffix: 'a' | 'b'): ApprovalRequestDetail {
  return {
    request: request(suffix),
    workflowId: `workflow-${suffix}`,
    formId: `form-${suffix}`,
    payload: { costCenter: 'old-value' },
    formSchema: {
      schemaVersion: 1,
      fields: [
        {
          key: 'costCenter',
          type: 'TEXT',
          required: true,
          labelKo: '비용 센터',
          labelEn: 'Cost center',
        },
      ],
    },
    timeline: [],
  };
}

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

function renderLifecycle() {
  root.render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        MemoryRouter,
        { initialEntries: ['/approvals/requests/needs-info'] },
        createElement(ApprovalRequestLifecycle, { view: 'needs-info' })
      )
    )
  );
}

async function openPopulatedResponse() {
  await act(async () => renderLifecycle());
  await vi.waitFor(() =>
    expect(getByTestId(container, 'request-scope').textContent).toBe('request-a')
  );
  await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'open response' })));
  const message = await vi.waitFor(() => getByLabelText(container, 'response message'));
  const payload = getByLabelText(container, 'response payload');
  await act(async () => {
    fireEvent.change(message, { target: { value: 'initial response evidence' } });
    fireEvent.change(payload, { target: { value: 'initial-cost-center' } });
  });
}

async function openTypedResponse() {
  const source = await approvalInformationDetail();
  dependencies.getApprovalRequests.mockResolvedValue([source.request]);
  dependencies.getApprovalRequestDetail.mockResolvedValue(source);
  dependencies.respondToApprovalInformationRequest.mockResolvedValue({
    ...source.request,
    status: 'IN_REVIEW',
    version: 4,
  });
  await act(async () => renderLifecycle());
  await vi.waitFor(() =>
    expect(getByTestId(container, 'request-scope')).toHaveProperty(
      'textContent',
      source.request.requestId
    )
  );
  await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'open response' })));
  await vi.waitFor(() =>
    expect(getByLabelText(container, 'response payload')).toHaveProperty('value', 'original-center')
  );
  await act(async () => {
    fireEvent.change(getByLabelText(container, 'response message'), {
      target: { value: 'original response evidence' },
    });
    fireEvent.change(getByLabelText(container, 'response payload'), {
      target: { value: 'verified-center' },
    });
  });
  await vi.waitFor(() =>
    expect(
      getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' })
    ).toHaveProperty('disabled', false)
  );
  return source;
}

async function submitTypedUnknown() {
  const source = await openTypedResponse();
  dependencies.respondToApprovalInformationRequest.mockRejectedValueOnce(
    new HttpError('Result unknown', 503)
  );
  await act(async () =>
    fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
  );
  await waitInformationRecovery();
  return source;
}

async function waitInformationRecovery() {
  await vi.waitFor(() =>
    expect(queryByRole(container, 'dialog')?.textContent).toMatch(
      /requests\.(actionError|commands\.unknown)/u
    )
  );
}

function wireCall(call: unknown[]) {
  const options = call[5] as { idempotencyKey: string; sourceGeneration?: number };
  return [
    ...call.slice(0, 5),
    { idempotencyKey: options.idempotencyKey, sourceGeneration: options.sourceGeneration },
  ];
}

function realResponseTransport() {
  dependencies.execution.current = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' };
  dependencies.respondToApprovalInformationRequest.mockImplementation(realInformationResponse);
}

function informationQuery() {
  const query = queryClient
    .getQueryCache()
    .findAll()
    .find((entry) => entry.queryKey.includes('information-response'));
  if (!query) throw new Error('Information query is missing.');
  return query;
}

async function refreshInformation() {
  await act(async () =>
    fireEvent.click(getByRole(container, 'button', { name: 'actions.refresh' }))
  );
}

describe('ApprovalRequestLifecycle mutation binding', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    dependencies.scope.current = scope('a');
    dependencies.responseControl.current = null;
    dependencies.beforeDispatch.current = null;
    dependencies.execution.current = {};
    resetCsrfToken();
    dependencies.getApprovalRequests.mockImplementation((_view: string, contextScopeKey: string) =>
      Promise.resolve([request(contextScopeKey === 'scope-b' ? 'b' : 'a')])
    );
    dependencies.getApprovalRequestDetail.mockImplementation(
      (_requestId: string, contextScopeKey: string) =>
        Promise.resolve(detail(contextScopeKey === 'scope-b' ? 'b' : 'a'))
    );
    dependencies.respondToApprovalInformationRequest.mockResolvedValue(request('a'));
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
    vi.unstubAllGlobals();
    resetCsrfToken();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('submits the immutable reviewed response while fields stay disabled during freshness check', async () => {
    await openPopulatedResponse();
    const latest = deferred<ApprovalRequestDetail>();
    dependencies.getApprovalRequestDetail.mockImplementationOnce(() => latest.promise);

    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
    );
    await vi.waitFor(() =>
      expect((getByLabelText(container, 'response message') as HTMLInputElement).disabled).toBe(
        true
      )
    );

    await act(async () => {
      dependencies.responseControl.current!.onMessageChange('late response mutation');
      dependencies.responseControl.current!.onPayloadChange('costCenter', 'late-cost-center');
    });
    await act(async () => latest.resolve(detail('a')));
    await vi.waitFor(() =>
      expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledTimes(1)
    );

    expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledWith(
      'request-a',
      'initial response evidence',
      { costCenter: 'initial-cost-center' },
      3,
      {},
      {
        idempotencyKey: expect.stringMatching(/^[A-Za-z0-9._:-]{1,120}$/u),
        onOriginalWireBody: expect.any(Function),
      }
    );
  });

  it('keeps an unknown original response command isolated through fresh same-version reads and never dispatches another POST', async () => {
    await openPopulatedResponse();
    queryClient.setDefaultOptions({ mutations: { retry: 3 } });
    dependencies.respondToApprovalInformationRequest.mockRejectedValueOnce(
      new HttpError('Response result unavailable', 503)
    );
    await act(async () => {
      const submit = getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' });
      fireEvent.click(submit);
      fireEvent.click(submit);
    });
    await vi.waitFor(() => expect(dependencies.error).toHaveBeenCalledTimes(1));
    const key = dependencies.respondToApprovalInformationRequest.mock.calls[0]![5].idempotencyKey;
    expect(key).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
    expect(getByLabelText(container, 'response message')).toHaveProperty(
      'value',
      'initial response evidence'
    );
    expect(
      getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' })
    ).toHaveProperty('disabled', true);
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'actions.refresh' }))
    );
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
    );
    expect(
      getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' })
    ).toHaveProperty('disabled', true);
    expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledTimes(1);
    expect(dependencies.respondToApprovalInformationRequest.mock.calls[0]![5].idempotencyKey).toBe(
      key
    );
  });

  it('drops a delayed response command after an A to B to A scope replay', async () => {
    await openPopulatedResponse();
    const latest = deferred<ApprovalRequestDetail>();
    dependencies.getApprovalRequestDetail.mockImplementationOnce(() => latest.promise);
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
    );

    dependencies.scope.current = scope('b');
    await act(async () => renderLifecycle());
    await vi.waitFor(() =>
      expect(getByTestId(container, 'request-scope').textContent).toBe('request-b')
    );
    dependencies.scope.current = scope('a');
    await act(async () => renderLifecycle());
    await vi.waitFor(() =>
      expect(getByTestId(container, 'request-scope').textContent).toBe('request-a')
    );

    await act(async () => latest.resolve(detail('a')));
    await act(async () => Promise.resolve());

    expect(dependencies.respondToApprovalInformationRequest).not.toHaveBeenCalled();
    expect(dependencies.success).not.toHaveBeenCalled();
    expect(dependencies.error).not.toHaveBeenCalled();
  });

  it('sends the original information generation and one stable key with canonical typed input', async () => {
    const source = await openTypedResponse();
    await act(async () => {
      const submit = getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' });
      fireEvent.click(submit);
      fireEvent.click(submit);
    });
    await vi.waitFor(() => expect(dependencies.success).toHaveBeenCalledTimes(1));
    expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledTimes(1);
    expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledWith(
      source.request.requestId,
      'original response evidence',
      { summary: '원래 요청 내용', costCenter: 'verified-center', createdFrom: 'DWP_APPROVALS' },
      3,
      {},
      {
        idempotencyKey: expect.any(String),
        sourceGeneration: 1,
        beforeDispatch: expect.any(Function),
        onOriginalWireBody: expect.any(Function),
      }
    );
  });

  it.each(INFORMATION_SOURCE_CHANGES)(
    'blocks stale $key before POST and preserves the original input',
    async ({ change }) => {
      const source = await openTypedResponse();
      dependencies.getApprovalRequestDetail.mockResolvedValueOnce(change(source));
      await act(async () =>
        fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
      );
      await waitInformationRecovery();
      expect(dependencies.respondToApprovalInformationRequest).not.toHaveBeenCalled();
      expect(getByLabelText(container, 'response message')).toHaveProperty(
        'value',
        'original response evidence'
      );
      expect(getByLabelText(container, 'response payload')).toHaveProperty(
        'value',
        'verified-center'
      );
      expect(
        getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' })
      ).toHaveProperty('disabled', true);
    }
  );

  it.each([403, 503])(
    'checks actual cached first %s failure before the governed callback observes it',
    async (status) => {
      await openTypedResponse();
      dependencies.beforeDispatch.current = () => {
        informationQuery().setState({
          status: 'error',
          error: new HttpError('Source failed', status),
          fetchFailureCount: 1,
        });
      };
      await act(async () =>
        fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
      );
      await waitInformationRecovery();
      expect(dependencies.respondToApprovalInformationRequest).not.toHaveBeenCalled();
    }
  );

  it('checks all pins again after the governed asynchronous preparation', async () => {
    const source = await openTypedResponse();
    dependencies.beforeDispatch.current = () => {
      queryClient.setQueryData(
        informationQuery().queryKey,
        INFORMATION_SOURCE_CHANGES.find((entry) => entry.key === 'policyVersion')!.change(source)
      );
    };
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
    );
    await waitInformationRecovery();
    expect(dependencies.respondToApprovalInformationRequest).not.toHaveBeenCalled();
  });

  it('retains typed UNKNOWN privately across close, first 403, and same-round recovery; only original key/body replay is allowed', async () => {
    await submitTypedUnknown();
    const original = dependencies.respondToApprovalInformationRequest.mock.calls[0]!;
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'actions.cancel' }))
    );
    expect(queryByRole(container, 'dialog')).toBeNull();
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'requests.amendment.resumeUnknown' }))
    );
    dependencies.getApprovalRequestDetail.mockRejectedValueOnce(
      new HttpError('Authority denied', 403)
    );
    await refreshInformation();
    await vi.waitFor(() => expect(queryByLabelText(container, 'response message')).toBeNull());
    expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledTimes(1);
    await refreshInformation();
    await vi.waitFor(() =>
      expect(
        getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
      ).toHaveProperty('disabled', false)
    );
    expect(getByLabelText(container, 'response message')).toHaveProperty(
      'value',
      'original response evidence'
    );
    expect(getByLabelText(container, 'response payload')).toHaveProperty(
      'value',
      'verified-center'
    );
    await act(async () => {
      dependencies.responseControl.current!.onMessageChange('blank replacement rejected');
      dependencies.responseControl.current!.onPayloadChange('costCenter', '');
      const retry = getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' });
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    await vi.waitFor(() => expect(dependencies.success).toHaveBeenCalledTimes(1));
    expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledTimes(2);
    expect(wireCall(dependencies.respondToApprovalInformationRequest.mock.calls[1]!)).toEqual(
      wireCall(original)
    );
  });

  it('keeps first 503 input readonly and recovers only the same editing origin', async () => {
    await openTypedResponse();
    dependencies.getApprovalRequestDetail.mockRejectedValueOnce(new HttpError('Unavailable', 503));
    await act(async () => queryClient.refetchQueries({ queryKey: informationQuery().queryKey }));
    await vi.waitFor(() =>
      expect(getByLabelText(container, 'response payload')).toHaveProperty('disabled', true)
    );
    expect(getByLabelText(container, 'response payload')).toHaveProperty(
      'value',
      'verified-center'
    );
    await refreshInformation();
    await vi.waitFor(() =>
      expect(
        getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' })
      ).toHaveProperty('disabled', false)
    );
    expect(dependencies.respondToApprovalInformationRequest).not.toHaveBeenCalled();
  });

  it('does not heal an UNKNOWN original command into the next information generation or claim GET-based success', async () => {
    const source = await submitTypedUnknown();
    const advanced = {
      ...source,
      request: { ...source.request, version: 4 },
      informationGeneration: 2,
      informationRound: { ...source.informationRound!, sourceGeneration: 2, targetGeneration: 3 },
    };
    dependencies.getApprovalRequests.mockResolvedValue([advanced.request]);
    dependencies.getApprovalRequestDetail.mockResolvedValue(advanced);
    await refreshInformation();
    expect(getByLabelText(container, 'response payload')).toHaveProperty(
      'value',
      'verified-center'
    );
    expect(
      getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
    ).toHaveProperty('disabled', true);
    expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledTimes(1);
    expect(dependencies.success).not.toHaveBeenCalled();
  });

  it('keeps an acknowledged command UNKNOWN if source changes while the POST result is pending', async () => {
    const source = await openTypedResponse();
    const result = deferred<ApprovalRequest>();
    dependencies.respondToApprovalInformationRequest.mockImplementationOnce(() => result.promise);
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
    );
    await vi.waitFor(() =>
      expect(dependencies.respondToApprovalInformationRequest).toHaveBeenCalledTimes(1)
    );
    await act(async () => {
      queryClient.setQueryData(
        informationQuery().queryKey,
        INFORMATION_SOURCE_CHANGES.find((entry) => entry.key === 'payloadRevision')!.change(source)
      );
      result.resolve({ ...source.request, status: 'IN_REVIEW', version: 4 });
    });
    await waitInformationRecovery();
    expect(dependencies.success).not.toHaveBeenCalled();
    expect(
      getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
    ).toHaveProperty('disabled', true);
  });

  it.each(['ROUND', 'DENIED', 'UNAVAILABLE'] as const)(
    'checks actual deferred CSRF %s and sends HTTP POST 0 without inventing UNKNOWN',
    async (change) => {
      const source = await openTypedResponse();
      realResponseTransport();
      const csrf = deferred<Response>();
      const fetch = vi.fn().mockReturnValue(csrf.promise);
      vi.stubGlobal('fetch', fetch);
      await act(async () =>
        fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
      );
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(String(fetch.mock.calls[0]![0])).toContain('/api/auth/csrf');
      await act(async () => {
        if (change === 'ROUND')
          queryClient.setQueryData(
            informationQuery().queryKey,
            INFORMATION_SOURCE_CHANGES.find((entry) => entry.key === 'roundId')!.change(source)
          );
        else
          informationQuery().setState({
            status: 'error',
            fetchFailureCount: 1,
            error: new HttpError('Source failed during CSRF', change === 'DENIED' ? 403 : 503),
          });
        csrf.resolve(
          new Response(JSON.stringify({ data: { token: 'csrf', headerName: 'X-CSRF' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      await waitInformationRecovery();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(
        queryByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
      ).toBeNull();
      if (change === 'DENIED') {
        expect(queryByLabelText(container, 'response message')).toBeNull();
        await refreshInformation();
        await vi.waitFor(() =>
          expect(getByLabelText(container, 'response payload')).toHaveProperty(
            'value',
            'verified-center'
          )
        );
      } else
        expect(getByLabelText(container, 'response payload')).toHaveProperty(
          'value',
          'verified-center'
        );
    }
  );

  it('rejects a borrowed secure command key before CSRF and does not label it UNKNOWN', async () => {
    await openTypedResponse();
    realResponseTransport();
    dependencies.execution.current = {
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: 'revision-a',
      contextKey: 'current',
      contextScopeKey: 'scope-a',
      idempotencyKey: 'another-command-key',
    };
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
    );
    await waitInformationRecovery();
    expect(fetch).not.toHaveBeenCalled();
    expect(
      queryByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
    ).toBeNull();
  });

  it('purges the private original command and input on an identity ABA during actual CSRF', async () => {
    await openTypedResponse();
    realResponseTransport();
    const csrf = deferred<Response>();
    const fetch = vi.fn().mockReturnValue(csrf.promise);
    vi.stubGlobal('fetch', fetch);
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' }))
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    dependencies.scope.current = scope('b');
    await act(async () => renderLifecycle());
    dependencies.scope.current = scope('a');
    await act(async () => renderLifecycle());
    await act(async () =>
      csrf.resolve(
        new Response(JSON.stringify({ data: { token: 'csrf', headerName: 'X-CSRF' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(queryByRole(container, 'dialog')).toBeNull();
    expect(
      queryByRole(container, 'button', { name: 'requests.amendment.resumeUnknown' })
    ).toBeNull();
    expect(dependencies.success).not.toHaveBeenCalled();
  });
});
