// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByLabelText, getByRole } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApprovalRequestDraftCommand } from './use-approval-request-draft-command';
import { HttpError } from '@dwp-frontend/shared-utils';
import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

const dependencies = vi.hoisted(() => ({
  remove: vi.fn(),
  restore: vi.fn(),
  recover: vi.fn(),
  reconcile: vi.fn(),
  latest: vi.fn(),
  success: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<Record<string, unknown>>()),
  deleteApprovalDraft: dependencies.remove,
  restoreApprovalDraft: dependencies.restore,
  recoverApprovalDraft: dependencies.recover,
  getApprovalDraftReconciliation: dependencies.reconcile,
  useToast: () => ({ success: dependencies.success }),
}));
vi.mock('./use-approval-governed-mutation', () => ({
  useApprovalGovernedMutation: () => (operation: (execution: unknown) => Promise<unknown>) =>
    operation({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }),
}));

const request: ApprovalRequest = {
  requestId: 'request-1',
  requestNumber: 'APR-1',
  title: 'My draft',
  summary: '',
  status: 'DRAFT',
  priority: 'NORMAL',
  workflowNameKo: '결재',
  workflowNameEn: 'Approval',
  totalSteps: 1,
  dataClassification: 'INTERNAL',
  version: 3,
};
const state = {
  requestId: 'request-1',
  version: 4,
  payloadRevision: 2,
  deletedAt: '2026-09-14T00:00:00Z',
  deletedBy: 1,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function Harness({ identity }: { identity: string }) {
  const command = useApprovalRequestDraftCommand({
    cacheKey: [identity],
    ready: true,
    reloadCurrent: dependencies.latest,
  });
  return (
    <>
      <button onClick={() => command.open('delete', request)}>open delete</button>
      <button onClick={() => command.open('recover', request, 2)}>open recover</button>
      <label>
        reason
        <input
          value={command.action?.reason ?? ''}
          onChange={(event) => command.setReason(event.target.value)}
        />
      </label>
      <button
        onClick={() => {
          command.submit();
          command.submit();
        }}
      >
        submit twice
      </button>
      <button onClick={command.reconcile}>reconcile</button>
      <button onClick={() => void command.refresh()}>refresh</button>
      <output>{command.problem}</output>
    </>
  );
}

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
function render(identity = 'scope-a') {
  root.render(
    <QueryClientProvider client={client}>
      <Harness identity={identity} />
    </QueryClientProvider>
  );
}
async function open(kind = 'delete') {
  await act(async () => fireEvent.click(getByRole(container, 'button', { name: `open ${kind}` })));
  await act(async () =>
    fireEvent.change(getByLabelText(container, 'reason'), { target: { value: 'User reason' } })
  );
}
describe('Approval draft command fencing', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks();
    dependencies.latest.mockResolvedValue(request);
    dependencies.remove.mockResolvedValue(state);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => render());
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('synchronously blocks double submit and captures immutable reason/version/key', async () => {
    await open();
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit twice' }))
    );
    await vi.waitFor(() => expect(dependencies.remove).toHaveBeenCalledTimes(1));
    expect(dependencies.remove).toHaveBeenCalledWith(
      'request-1',
      {
        expectedVersion: 3,
        reason: 'User reason',
        idempotencyKey: expect.stringMatching(/^[A-Za-z0-9._:-]{1,120}$/u),
      },
      expect.anything()
    );
  });

  it('requires explicit review after version conflict and preserves user reason', async () => {
    dependencies.latest.mockResolvedValue({ ...request, version: 4 });
    dependencies.recover.mockResolvedValue({ ...state, deletedAt: null, version: 5 });
    await open('recover');
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit twice' }))
    );
    await vi.waitFor(() => expect(container.textContent).toContain('CONFLICT'));
    expect(dependencies.recover).not.toHaveBeenCalled();
    expect((getByLabelText(container, 'reason') as HTMLInputElement).value).toBe('User reason');
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'refresh' })));
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit twice' }))
    );
    await vi.waitFor(() => expect(dependencies.recover).toHaveBeenCalledTimes(1));
    expect(dependencies.recover.mock.calls[0]![1]).toMatchObject({
      revision: 2,
      expectedVersion: 4,
      reason: 'User reason',
    });
  });

  it('reconciles the original unknown delete result without a second deletion', async () => {
    dependencies.remove.mockRejectedValue(new Error('Response lost'));
    dependencies.reconcile.mockImplementation((key: string) =>
      Promise.resolve({
        idempotencyKey: key,
        receipts: [
          {
            commandType: 'DELETE',
            route: 'POST /v1/requests/request-1/draft/delete',
            draft: state,
            completedAt: '2026-09-14T00:00:00Z',
          },
        ],
      })
    );
    await open();
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit twice' }))
    );
    await vi.waitFor(() => expect(container.textContent).toContain('UNKNOWN'));
    const sentKey = dependencies.remove.mock.calls[0]![1].idempotencyKey;
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'reconcile' })));
    await vi.waitFor(() => expect(dependencies.success).toHaveBeenCalledTimes(1));
    expect(dependencies.reconcile).toHaveBeenCalledWith(sentKey, undefined);
    expect(dependencies.remove).toHaveBeenCalledTimes(1);
  });

  it('drops an A to B to A delayed pre-command read', async () => {
    const pending = deferred<ApprovalRequest>();
    dependencies.latest.mockReturnValue(pending.promise);
    await open();
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit twice' }))
    );
    await act(async () => render('scope-b'));
    await act(async () => render('scope-a'));
    await act(async () => pending.resolve(request));
    expect(dependencies.remove).not.toHaveBeenCalled();
    expect(dependencies.success).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('CONFLICT');
  });

  it('retains the immutable unknown key through receipt 403 and resumes only reconciliation after refresh', async () => {
    dependencies.remove.mockRejectedValue(new Error('Response lost'));
    dependencies.reconcile
      .mockRejectedValueOnce(new HttpError('Receipt denied', 403))
      .mockImplementation((key: string) =>
        Promise.resolve({
          idempotencyKey: key,
          receipts: [
            {
              commandType: 'DELETE',
              route: 'POST /v1/requests/request-1/draft/delete',
              draft: state,
              completedAt: '2026-09-14T00:00:00Z',
            },
          ],
        })
      );
    await open();
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit twice' }))
    );
    await vi.waitFor(() => expect(container.textContent).toContain('UNKNOWN'));
    const key = dependencies.remove.mock.calls[0]![1].idempotencyKey;
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'reconcile' })));
    await vi.waitFor(() => expect(container.textContent).toContain('DENIED'));
    expect((getByLabelText(container, 'reason') as HTMLInputElement).value).toBe('');
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'refresh' })));
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'reconcile' })));
    await vi.waitFor(() => expect(dependencies.success).toHaveBeenCalledTimes(1));
    expect(dependencies.reconcile).toHaveBeenNthCalledWith(1, key, undefined);
    expect(dependencies.reconcile).toHaveBeenNthCalledWith(2, key, undefined);
    expect(dependencies.remove).toHaveBeenCalledTimes(1);
  });

  it('clears the command on first 403 and cannot submit retained authority', async () => {
    dependencies.remove.mockRejectedValue(new HttpError('Denied', 403));
    await open();
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit twice' }))
    );
    await vi.waitFor(() => expect(container.textContent).toContain('DENIED'));
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'submit twice' }))
    );
    expect(dependencies.remove).toHaveBeenCalledTimes(1);
    expect((getByLabelText(container, 'reason') as HTMLInputElement).value).toBe('');
  });
});
