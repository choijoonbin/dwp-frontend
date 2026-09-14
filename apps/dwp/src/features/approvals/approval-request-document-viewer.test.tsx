// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approvalDocumentRequestDetail,
  approvalDocumentTools,
} from '../../../../../e2e/support/approval-request-document-fixtures';
import { ApprovalRequestDetailDrawer } from './approval-request-detail-drawer';
import { useApprovalAttachmentClient } from './use-approval-attachment-client';

// Document-tool isolation; the real signature chain is covered by approval-signature-ceremony.spec.ts.
vi.mock('./approval-signature-panel', () => ({ ApprovalSignaturePanel: () => null }));

const deps = vi.hoisted(() => ({
  detail: vi.fn(),
  tools: vi.fn(),
  comments: vi.fn(),
  append: vi.fn(),
  close: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', async (load) => ({
  ...(await load<object>()),
  useDisplayDictionary: () => (_key: string, value: string) => value,
}));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<object>()),
  getApprovalRequestDetail: deps.detail,
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('@dwp-frontend/shared-utils/api/approval-document-api', () => ({
  getApprovalDocumentTools: deps.tools,
  getApprovalDocumentComments: deps.comments,
  appendApprovalRequestComment: deps.append,
  exportApprovalRequestDocument: vi.fn(),
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canViewRequests: true, canUpdateRequests: true }),
}));
vi.mock('./use-approval-document-mutation', () => ({
  useApprovalDocumentMutation: () => ({
    available: true,
    run: (execute: (execution: object) => Promise<unknown>) =>
      execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }),
  }),
}));
vi.mock('./use-approval-attachment-mutation', () => ({
  approvalAttachmentRouteInstalled: () => false,
  useApprovalAttachmentMutation: () => ({ available: false, run: vi.fn() }),
}));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ready: true,
    contextScopeKey: 'a',
    cacheKey: ['tenant', 'a', 'NORMAL', 'approvals.work', 'a', 'revision'],
    queryMeta: { accessSensitive: true },
  }),
}));
vi.mock('@mui/material/Drawer', () => ({
  default: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));
vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  ActionIconButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  FormField: ({
    label,
    value,
    disabled,
    onChange,
  }: {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  }) => (
    <label>
      {label}
      <textarea value={value} disabled={disabled} onChange={onChange} />
    </label>
  ),
  InlineFeedback: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
    <div>
      {children}
      {action}
    </div>
  ),
  LoadingState: ({ label }: { label: string }) => <div>{label}</div>,
  FormDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));
vi.mock('./approval-ui', () => ({
  ApprovalSurface: ({
    title,
    children,
    action,
  }: {
    title: string;
    children: ReactNode;
    action?: ReactNode;
  }) => (
    <section>
      <h3>{title}</h3>
      {action}
      {children}
    </section>
  ),
  StatusChip: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock('./approval-payload-data', () => ({
  ApprovalPayloadData: ({ payload }: { payload: unknown }) => <pre>{JSON.stringify(payload)}</pre>,
}));
vi.mock('./approval-document-print-preview', () => ({ ApprovalDocumentPrintPreview: () => null }));

const detail = approvalDocumentRequestDetail();
function Viewer() {
  const attachments = useApprovalAttachmentClient({
    owner: { type: 'REQUEST', id: detail.request.requestId },
    version: detail.request.version,
    ready: true,
  });
  return (
    <ApprovalRequestDetailDrawer
      requestId={detail.request.requestId}
      attachments={attachments}
      canUpdateRequests
      onClose={deps.close}
      onRespond={vi.fn()}
      onWithdraw={vi.fn()}
    />
  );
}
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
async function ready() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  await vi.waitFor(() =>
    expect(
      (
        getByRole(container, 'textbox', {
          name: 'requests.documents.commentText',
        }) as HTMLTextAreaElement
      ).disabled
    ).toBe(false)
  );
}
describe('Linked request viewer and document hook', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    deps.detail.mockResolvedValue(detail);
    deps.tools.mockResolvedValue(approvalDocumentTools());
    deps.comments.mockResolvedValue({
      items: [],
      totalElements: 0,
      page: 0,
      size: 25,
      commentsVersion: 0,
      evaluatedAt: new Date().toISOString(),
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: 3 }, mutations: { retry: 3 } },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <StrictMode>
          <QueryClientProvider client={client}>
            <Viewer />
          </QueryClientProvider>
        </StrictMode>
      )
    );
    await ready();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.resetAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  it('reads the live command ref on close before pending state has rendered', async () => {
    let finish!: (value: unknown) => void;
    deps.append.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await act(async () =>
      fireEvent.change(
        getByRole(container, 'textbox', { name: 'requests.documents.commentText' }),
        { target: { value: 'Original comment' } }
      )
    );
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'requests.documents.addComment' }));
      fireEvent.click(getByRole(container, 'button', { name: 'actions.close' }));
      expect(deps.close).not.toHaveBeenCalled();
    });
    await vi.waitFor(() => expect(deps.append).toHaveBeenCalledTimes(1));
    await act(async () =>
      finish({ requestId: detail.request.requestId, sequence: 1, text: 'Original comment' })
    );
  });
  it.each([403, 503])(
    'handles direct delivery/command source %s without unmounting the private command state',
    async (status) => {
      await act(async () =>
        fireEvent.change(
          getByRole(container, 'textbox', { name: 'requests.documents.commentText' }),
          { target: { value: 'Preserved user text' } }
        )
      );
      deps.tools.mockRejectedValueOnce(new HttpError('Current owner access failed', status));
      await act(async () =>
        fireEvent.click(getByRole(container, 'button', { name: 'requests.documents.addComment' }))
      );
      await vi.waitFor(() =>
        expect(container.textContent).toContain('requests.documents.sourceError')
      );
      const input = getByRole(container, 'textbox', {
        name: 'requests.documents.commentText',
      }) as HTMLTextAreaElement;
      expect(input.disabled).toBe(true);
      expect(input.value).toBe(status === 403 ? '' : 'Preserved user text');
      expect(container.textContent?.includes(detail.request.title)).toBe(status === 503);
      expect(deps.append).not.toHaveBeenCalled();
      const source = Array.from(container.querySelectorAll('section')).find((item) =>
        item.textContent?.includes('requests.documents.title')
      )!;
      await act(async () =>
        fireEvent.click(
          Array.from(source.querySelectorAll('button')).find(
            (button) => button.textContent === 'actions.refresh'
          )!
        )
      );
      await ready();
      expect(container.textContent).toContain(detail.request.title);
    }
  );
  it('preserves the original UNKNOWN through parent loading and qualifies the exact new comments head', async () => {
    let head = 0;
    deps.tools.mockImplementation(async () => ({
      ...approvalDocumentTools(),
      commentsVersion: head,
    }));
    deps.comments.mockImplementation(async () => ({
      items: [],
      totalElements: 0,
      page: 0,
      size: 25,
      commentsVersion: head,
      evaluatedAt: new Date().toISOString(),
    }));
    deps.append
      .mockImplementationOnce(async () => {
        head = 1;
        throw new HttpError('Committed but unknown', 503);
      })
      .mockResolvedValue({
        requestId: detail.request.requestId,
        sequence: 1,
        text: 'Original comment',
      });
    await act(async () => {
      fireEvent.change(
        getByRole(container, 'textbox', { name: 'requests.documents.commentText' }),
        {
          target: { value: 'Original comment' },
        }
      );
      fireEvent.click(getByRole(container, 'button', { name: 'requests.documents.addComment' }));
    });
    await vi.waitFor(() => expect(container.textContent).toContain('requests.documents.unknown'));
    const original = deps.append.mock.calls[0]![1];
    let finish!: (value: typeof detail) => void;
    deps.detail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const source = Array.from(container.querySelectorAll('section')).find((item) =>
      item.textContent?.includes('requests.documents.title')
    )!;
    await act(async () => fireEvent.click(source.querySelector('button')!));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(
      client
        .getQueryCache()
        .findAll()
        .filter((query) => query.queryKey.includes('request-document-tools'))
        .every((query) => query.queryKey.at(-1) === 3)
    ).toBe(true);
    expect(deps.append).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(detail);
    });
    await vi.waitFor(() =>
      expect(
        (
          getByRole(container, 'button', {
            name: 'requests.documents.retryOriginal',
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    await act(async () =>
      fireEvent.click(
        getByRole(container, 'button', {
          name: 'requests.documents.retryOriginal',
        })
      )
    );
    await vi.waitFor(() => expect(deps.append).toHaveBeenCalledTimes(2));
    expect(deps.append.mock.calls[1]![1]).toEqual(original);
  });
  it('does not unmask the request on owner 200 alone when the document tools recovery is still denied', async () => {
    deps.tools.mockRejectedValueOnce(new HttpError('Current source denied', 403));
    await act(async () => {
      fireEvent.change(
        getByRole(container, 'textbox', { name: 'requests.documents.commentText' }),
        {
          target: { value: 'Original local text' },
        }
      );
      fireEvent.click(getByRole(container, 'button', { name: 'requests.documents.addComment' }));
    });
    await vi.waitFor(() => expect(container.textContent).not.toContain(detail.request.title));
    deps.tools.mockRejectedValue(new HttpError('Tools remain denied', 403));
    const source = Array.from(container.querySelectorAll('section')).find((item) =>
      item.textContent?.includes('requests.documents.title')
    )!;
    await act(async () => fireEvent.click(source.querySelector('button')!));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(container.textContent).not.toContain(detail.request.title);
    expect(deps.append).not.toHaveBeenCalled();
    deps.tools.mockResolvedValue(approvalDocumentTools());
    await act(async () => fireEvent.click(source.querySelector('button')!));
    await ready();
    expect(container.textContent).toContain(detail.request.title);
  });
  it.each([403, 503])(
    'reads parent detail query failure %s before its observer can rerender',
    async (status) => {
      await act(async () =>
        fireEvent.change(
          getByRole(container, 'textbox', { name: 'requests.documents.commentText' }),
          { target: { value: 'Original local text' } }
        )
      );
      const query = client
        .getQueryCache()
        .findAll()
        .find((item) => item.queryKey.includes('detail-view'))!;
      const readsBeforeFailure = deps.detail.mock.calls.length;
      await act(async () => {
        query.setState({
          status: 'error',
          error: new HttpError('Parent authority unavailable', status),
        });
        fireEvent.click(getByRole(container, 'button', { name: 'requests.documents.addComment' }));
      });
      expect(deps.append).not.toHaveBeenCalled();
      expect(deps.detail).toHaveBeenCalledTimes(readsBeforeFailure);
      expect(
        (
          getByRole(container, 'textbox', {
            name: 'requests.documents.commentText',
          }) as HTMLTextAreaElement
        ).value
      ).toBe(status === 403 ? '' : 'Original local text');
      expect(container.textContent).not.toContain(detail.request.title);
    }
  );
});
