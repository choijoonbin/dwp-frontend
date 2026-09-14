// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import {
  fireEvent,
  getByLabelText,
  getByRole,
  queryByLabelText,
  queryByRole,
} from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import { respondToApprovalInformationRequest as realInformationResponse } from '@dwp-frontend/shared-utils/api/approval-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  approvalInformationDetail,
  ORIGINAL_INFORMATION_USER,
  OTHER_INFORMATION_USER,
} from '../../../../../e2e/support/approval-information-generation-fixtures';
import { ApprovalRequestLifecycle } from './approval-request-lifecycle';
import { captureApprovalInformationFixtureWire } from '../../../../../e2e/support/approval-information-wire-fixtures';

import type { ChangeEvent } from 'react';
import type {
  ApprovalMutationExecution,
  ApprovalRequest,
  ApprovalRequestDetail,
  respondToApprovalInformationRequest,
} from '@dwp-frontend/shared-utils';
import type {
  ApprovalFormUserCandidate,
  ApprovalFormUserCandidates,
} from '@dwp-frontend/shared-utils/api/approval-form-user-api';
import type { ApprovalRequestUserBinding } from './approval-request-user-picker';

type PickerControl = {
  onChange: (event: null, value: ApprovalFormUserCandidate | null) => void;
  freeSolo?: boolean;
  slotProps?: { clearIndicator?: { sx?: { display?: string } } };
};
const deps = vi.hoisted(() => ({
  detail: undefined as ApprovalRequestDetail | undefined,
  detailStatus: 200,
  directoryStatus: 200,
  directoryPeople: [] as ApprovalFormUserCandidate[],
  directory: vi.fn(),
  respond: vi.fn(),
  success: vi.fn(),
  picker: undefined as PickerControl | undefined,
}));
vi.mock('./use-approval-attachment-mutation', () => ({
  approvalAttachmentRouteInstalled: () => false,
  useApprovalAttachmentMutation: () => ({ available: false, run: vi.fn() }),
}));
vi.mock('./approval-request-information-receipt', () => ({
  ApprovalRequestInformationReceipt: () => null,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => false }));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  searchApprovalRequests: async () => ({
    items: [deps.detail!.request],
    totalElements: 1,
    totalPages: 1,
    size: 20,
    page: 0,
    hasNext: false,
    evaluatedAt: new Date().toISOString(),
  }),
  getApprovalRequestDetail: async () => {
    if (deps.detailStatus !== 200) throw new HttpError('Owner source failed', deps.detailStatus);
    return deps.detail!;
  },
  respondToApprovalInformationRequest: (
    ...args: Parameters<typeof respondToApprovalInformationRequest>
  ) => {
    captureApprovalInformationFixtureWire(args);
    return deps.respond(...args);
  },
  usePermissions: () => ({ permissions: [], hasPermission: () => false }),
  useToast: () => ({ success: deps.success, error: vi.fn() }),
}));
vi.mock('@dwp-frontend/shared-utils/api/approval-form-user-api', () => ({
  searchApprovalFormUserCandidates: deps.directory,
}));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    governed: true,
    ready: true,
    contextScopeKey: 'scope-a',
    cacheKey: ['tenant-a', 'actor-a', 'NORMAL', 'approvals.work', 'scope-a', 'revision-a'],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-a',
      actorId: 'actor-a',
      accessMode: 'NORMAL',
      productId: 'approvals',
      surfaceId: 'approvals.work',
      contextScopeKey: 'scope-a',
      decisionRevision: 'revision-a',
    },
  }),
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canUpdateRequests: true }),
}));
vi.mock('./use-approval-governed-mutation', () => ({
  isProductSurfaceOperationCancelledError: () => false,
  useApprovalGovernedMutation:
    () => async (operation: (execution: ApprovalMutationExecution) => Promise<unknown>) =>
      operation({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }),
}));
vi.mock('./approval-return-target', () => ({ authorizedApprovalWorkReturnTarget: () => null }));
vi.mock('./approval-ui', () => ({
  ApprovalSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('./approval-request-lifecycle-inspector', () => ({
  ApprovalRequestLifecycleInspector: () => null,
}));
vi.mock('./approval-request-search-controls', () => ({
  ApprovalRequestSearchControls: () => null,
}));
vi.mock('./approval-request-detail-drawer', () => ({ ApprovalRequestDetailDrawer: () => null }));
vi.mock('./approval-request-list-panel', () => ({
  ApprovalRequestListPanel: ({
    requests,
    onRespond,
  }: {
    requests: ApprovalRequest[];
    onRespond: (request: ApprovalRequest) => void;
  }) =>
    requests[0] ? <button onClick={() => onRespond(requests[0]!)}>open response</button> : null,
}));
vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  ActionIconButton: ({
    label,
    disabled,
    onClick,
  }: {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }) => <button aria-label={label} disabled={disabled} onClick={onClick} />,
  InlineFeedback: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
    <div>
      {children}
      {action}
    </div>
  ),
  LoadingState: () => <div>loading</div>,
  FormDialog: ({
    open,
    children,
    submitLabel,
    submitDisabled,
    cancelLabel,
    onClose,
    onSubmit,
  }: {
    open: boolean;
    children: ReactNode;
    submitLabel: string;
    submitDisabled: boolean;
    cancelLabel: string;
    onClose: () => void;
    onSubmit: () => void;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        <button onClick={onClose}>{cancelLabel}</button>
        <button disabled={submitDisabled} onClick={onSubmit}>
          {submitLabel}
        </button>
      </div>
    ) : null,
  FormField: ({
    label,
    value,
    disabled,
    onChange,
  }: {
    label: string;
    value: string;
    disabled?: boolean;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  }) => <input aria-label={label} value={value} disabled={disabled} onChange={onChange} />,
  DatePickerField: () => null,
  SelectField: () => null,
  AutocompleteField: ({
    label,
    value,
    inputValue,
    disabled,
    options,
    onInputChange,
    onChange,
    errorMessage,
    freeSolo,
    slotProps,
  }: {
    label: string;
    value: ApprovalFormUserCandidate | null;
    inputValue: string;
    disabled: boolean;
    options: ApprovalFormUserCandidate[];
    onInputChange: (event: null, text: string, reason: string) => void;
    onChange: PickerControl['onChange'];
    errorMessage?: ReactNode;
    freeSolo?: boolean;
    slotProps?: { clearIndicator?: { sx?: { display?: string } } };
  }) => {
    deps.picker = { onChange, freeSolo, slotProps };
    return (
      <div>
        <input
          aria-label={label}
          value={inputValue}
          disabled={disabled}
          onChange={(event) => onInputChange(null, event.target.value, 'input')}
        />
        <span>{value?.personPublicId}</span>
        {errorMessage && <div role="alert">{errorMessage}</div>}
        {options.map((person) => (
          <button
            key={person.personPublicId}
            disabled={disabled}
            onClick={() => onChange(null, person)}
          >
            {person.displayName}
          </button>
        ))}
      </div>
    );
  },
}));

let root: Root;
let client: QueryClient;
let container: HTMLDivElement;
function render() {
  root.render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ApprovalRequestLifecycle view="needs-info" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
async function findButton(name: string) {
  return vi.waitFor(() => getByRole(container, 'button', { name }));
}
async function click(name: string) {
  const button = await findButton(name);
  await act(async () => fireEvent.click(button));
}
async function verifyOriginal(term = '김결') {
  await act(async () =>
    fireEvent.change(getByLabelText(container, '검토자'), { target: { value: term } })
  );
  await click(ORIGINAL_INFORMATION_USER.displayName);
}
async function openResponse() {
  await act(async () => render());
  await click('open response');
  await vi.waitFor(() =>
    expect(getByLabelText(container, '비용 센터')).toHaveProperty('value', 'original-center')
  );
  await act(async () => {
    fireEvent.change(getByLabelText(container, 'requests.responseLabel'), {
      target: { value: 'Original response' },
    });
    fireEvent.change(getByLabelText(container, '비용 센터'), {
      target: { value: 'verified-center' },
    });
  });
  await verifyOriginal();
  await vi.waitFor(() =>
    expect(
      getByRole(container, 'button', { name: 'requests.dialog.respond.confirm' })
    ).toHaveProperty('disabled', false)
  );
}
async function openUnknown() {
  await openResponse();
  deps.respond.mockRejectedValueOnce(new HttpError('Unknown result', 503));
  await click('requests.dialog.respond.confirm');
  await vi.waitFor(() => expect(container.textContent).toContain('requests.commands.unknown'));
  expect(deps.respond).toHaveBeenCalledTimes(1);
}
async function qualifyOriginal() {
  await click('actions.refresh');
  await vi.waitFor(() =>
    expect(getByLabelText(container, '검토자')).toHaveProperty('disabled', false)
  );
  expect(getByLabelText(container, 'requests.responseLabel')).toHaveProperty('disabled', true);
  expect(getByLabelText(container, '비용 센터')).toHaveProperty('disabled', true);
  expect(
    getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
  ).toHaveProperty('disabled', true);
}
function originalWire(call: unknown[]) {
  const options = call[5] as { idempotencyKey: string; sourceGeneration: number };
  return [call[0], call[1], call[2], call[3], options.idempotencyKey, options.sourceGeneration];
}

describe('Actual information Lifecycle + Amendment + TypedFields + USER recovery', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('crypto', webcrypto);
    resetCsrfToken();
    deps.detail = await approvalInformationDetail(true);
    deps.detailStatus = 200;
    deps.directoryStatus = 200;
    deps.directoryPeople = [ORIGINAL_INFORMATION_USER, OTHER_INFORMATION_USER];
    deps.directory.mockImplementation(async (binding: ApprovalRequestUserBinding) => {
      if (deps.directoryStatus !== 200)
        throw new HttpError('Directory source failed', deps.directoryStatus);
      return {
        formVersionId: binding.formVersionId,
        schemaSha256: binding.schemaSha256,
        fieldPath: binding.fieldKey,
        requestId: binding.requestId,
        requestVersion: binding.requestVersion,
        decisionRevision: 'revision-a',
        validUntil: new Date(Date.now() + 60_000).toISOString(),
        people: deps.directoryPeople,
        mayBeTruncated: false,
      };
    });
    deps.respond.mockResolvedValue({ ...deps.detail.request, status: 'IN_REVIEW', version: 4 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetCsrfToken();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  it('reverifies only the original UUID after close/403/qualified recovery and replays the same immutable command', async () => {
    await openUnknown();
    const original = originalWire(deps.respond.mock.calls[0]!);
    await click('actions.cancel');
    expect(queryByRole(container, 'dialog')).toBeNull();
    await click('requests.amendment.resumeUnknown');
    deps.detailStatus = 403;
    await click('actions.refresh');
    await vi.waitFor(() => expect(queryByLabelText(container, '검토자')).toBeNull());
    deps.detailStatus = 200;
    await qualifyOriginal();
    await verifyOriginal();
    await vi.waitFor(() =>
      expect(
        getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
      ).toHaveProperty('disabled', false)
    );
    expect(deps.picker!.freeSolo).toBe(false);
    expect(deps.picker!.slotProps?.clearIndicator?.sx?.display).toBe('none');
    expect(getByLabelText(container, '비용 센터')).toHaveProperty('value', 'verified-center');
    await act(async () => {
      deps.picker!.onChange(null, OTHER_INFORMATION_USER);
      deps.picker!.onChange(null, null);
    });
    await click('requests.amendment.retryOriginal');
    await vi.waitFor(() => expect(deps.success).toHaveBeenCalledTimes(1));
    expect(deps.respond).toHaveBeenCalledTimes(2);
    expect(originalWire(deps.respond.mock.calls[1]!)).toEqual(original);
    expect((deps.respond.mock.calls[1]![2] as Record<string, unknown>).reviewer).toBe(
      ORIGINAL_INFORMATION_USER.personPublicId
    );
  });
  it.each([403, 503])(
    'preserves all inputs on the first directory %s and closes write readiness until current original proof recovers',
    async (status) => {
      await openUnknown();
      await qualifyOriginal();
      deps.directoryStatus = status;
      const priorDirectoryCalls = deps.directory.mock.calls.length;
      await act(async () =>
        fireEvent.change(getByLabelText(container, '검토자'), { target: { value: '김결' } })
      );
      await vi.waitFor(
        () => expect(deps.directory.mock.calls.length).toBeGreaterThan(priorDirectoryCalls),
        { timeout: 5000 }
      );
      await vi.waitFor(
        () =>
          expect(getByRole(container, 'alert').textContent).toContain(
            'requests.typed.userUnavailable'
          ),
        { timeout: 5000 }
      );
      expect(
        queryByRole(container, 'button', { name: ORIGINAL_INFORMATION_USER.displayName })
      ).toBeNull();
      expect(getByLabelText(container, '비용 센터')).toHaveProperty('value', 'verified-center');
      expect(getByLabelText(container, 'requests.responseLabel')).toHaveProperty(
        'value',
        'Original response'
      );
      expect(
        getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
      ).toHaveProperty('disabled', true);
      expect(deps.respond).toHaveBeenCalledTimes(1);
      deps.directoryStatus = 200;
      await verifyOriginal('김결재');
      await vi.waitFor(() =>
        expect(
          getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
        ).toHaveProperty('disabled', false)
      );
    }
  );
  it('never heals the original USER input into a different directory UUID', async () => {
    await openUnknown();
    await qualifyOriginal();
    deps.directoryPeople = [OTHER_INFORMATION_USER];
    await act(async () =>
      fireEvent.change(getByLabelText(container, '검토자'), { target: { value: '김다' } })
    );
    await vi.waitFor(() => expect(deps.directory).toHaveBeenCalledTimes(2));
    expect(
      queryByRole(container, 'button', { name: OTHER_INFORMATION_USER.displayName })
    ).toBeNull();
    await act(async () => deps.picker!.onChange(null, OTHER_INFORMATION_USER));
    expect(
      getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
    ).toHaveProperty('disabled', true);
    expect(deps.respond).toHaveBeenCalledTimes(1);
  });
  it('checks original reference TTL at dispatch and renews only the same UUID without changing the original command', async () => {
    await openUnknown();
    await qualifyOriginal();
    await verifyOriginal();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 65_000);
    await act(async () => render());
    expect(
      getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
    ).toHaveProperty('disabled', true);
    await click('requests.amendment.retryOriginal');
    expect(deps.respond).toHaveBeenCalledTimes(1);
    deps.directoryStatus = 503;
    await click('requests.typed.userRefresh');
    await vi.waitFor(() => expect(deps.directory).toHaveBeenCalledTimes(3));
    await vi.waitFor(() =>
      expect(getByRole(container, 'alert').textContent).toContain('requests.typed.userUnavailable')
    );
    expect(deps.respond).toHaveBeenCalledTimes(1);
    deps.directoryStatus = 200;
    await click('requests.typed.userRefresh');
    await click(ORIGINAL_INFORMATION_USER.displayName);
    await vi.waitFor(() =>
      expect(
        getByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
      ).toHaveProperty('disabled', false)
    );
    await click('requests.amendment.retryOriginal');
    await vi.waitFor(() => expect(deps.respond).toHaveBeenCalledTimes(2));
    expect(originalWire(deps.respond.mock.calls[1]!)).toEqual(
      originalWire(deps.respond.mock.calls[0]!)
    );
  });
  it.each([403, 503, 'OTHER_UUID'] as const)(
    'rechecks actual candidate cache %s during deferred CSRF before observer effects and sends HTTP POST 0',
    async (change) => {
      await openResponse();
      deps.respond.mockImplementation(realInformationResponse);
      let resolveCsrf!: (response: Response) => void;
      const csrf = new Promise<Response>((resolve) => {
        resolveCsrf = resolve;
      });
      const fetch = vi.fn().mockReturnValue(csrf);
      vi.stubGlobal('fetch', fetch);
      await click('requests.dialog.respond.confirm');
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(String(fetch.mock.calls[0]![0])).toContain('/api/auth/csrf');
      const source = client
        .getQueryCache()
        .findAll()
        .find((query) => query.queryKey.includes('form-user-candidates'));
      if (!source) throw new Error('Actual USER candidate query is missing.');
      await act(async () => {
        if (change === 'OTHER_UUID') {
          const data = source.state.data as ApprovalFormUserCandidates;
          client.setQueryData(source.queryKey, { ...data, people: [OTHER_INFORMATION_USER] });
        } else
          source.setState({
            status: 'error',
            fetchFailureCount: 1,
            error: new HttpError('Candidate authority changed during CSRF', change),
          });
        resolveCsrf(
          new Response(JSON.stringify({ data: { token: 'csrf', headerName: 'X-CSRF' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      await vi.waitFor(() => expect(container.textContent).toContain('requests.actionError'));
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(deps.success).not.toHaveBeenCalled();
      expect(
        queryByRole(container, 'button', { name: 'requests.amendment.retryOriginal' })
      ).toBeNull();
      expect(getByLabelText(container, '비용 센터')).toHaveProperty('value', 'verified-center');
      expect(getByLabelText(container, 'requests.responseLabel')).toHaveProperty(
        'value',
        'Original response'
      );
      expect(getByLabelText(container, '비용 센터')).toHaveProperty('disabled', true);
    }
  );
});
