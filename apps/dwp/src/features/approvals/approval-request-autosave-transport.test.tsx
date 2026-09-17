// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApprovalRequestAutosave } from './use-approval-request-autosave';
import { ApprovalDraftSaveBlockedError } from './approval-request-autosave-model';

import type {
  ApprovalRequestDetail,
  DwaionProposalHandoffBinding,
} from '@dwp-frontend/shared-utils';
import type { ApprovalDraftSnapshot } from './approval-request-autosave-model';

const dependencies = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  reconcile: vi.fn(),
  detail: vi.fn(),
  authority: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<Record<string, unknown>>()),
  createApprovalRequest: dependencies.create,
  updateApprovalDraft: dependencies.update,
  getApprovalDraftReconciliation: dependencies.reconcile,
  getApprovalRequestDetail: dependencies.detail,
}));
vi.mock('./use-approval-governed-mutation', () => ({
  useApprovalGovernedMutation:
    () => async (operation: (execution: unknown) => Promise<unknown>) => {
      await dependencies.authority();
      return operation({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' });
    },
}));

const input: ApprovalDraftSnapshot = {
  workflowId: 'workflow-1',
  formId: 'form-1',
  title: 'Preserved local title',
  summary: '',
  priority: 'NORMAL',
  payload: { summary: '', createdFrom: 'DWP_APPROVALS' },
};
const detail = (version = 3, title = input.title): ApprovalRequestDetail => ({
  request: {
    requestId: 'request-1',
    requestNumber: 'APR-1',
    title,
    summary: '',
    priority: 'NORMAL',
    status: 'DRAFT',
    version,
    workflowNameKo: '결재',
    workflowNameEn: 'Approval',
    totalSteps: 1,
    dataClassification: 'INTERNAL',
  },
  workflowId: input.workflowId,
  formId: input.formId,
  payload: { ...input.payload },
  timeline: [],
});
const receipt = (key: string) => ({
  idempotencyKey: key,
  receipts: [
    {
      commandType: 'CREATE',
      route: 'POST /v1/requests',
      draft: {
        requestId: 'request-1',
        version: 3,
        payloadRevision: 1,
        deletedAt: null,
        deletedBy: null,
      },
      completedAt: '2026-09-14T00:00:00Z',
    },
  ],
});
let api: ReturnType<typeof useApprovalRequestAutosave>;
function Harness({
  sessionKey,
  dwaionProposalHandoff,
}: {
  sessionKey: string;
  dwaionProposalHandoff?: DwaionProposalHandoffBinding;
}) {
  api = useApprovalRequestAutosave({
    sessionKey,
    input,
    ready: true,
    contextScopeKey: sessionKey,
    isCurrent: () => true,
    dwaionProposalHandoff,
  });
  return <output>{api.status}</output>;
}
let root: Root;
let container: HTMLDivElement;
function render(
  sessionKey = 'scope-a:epoch-1',
  dwaionProposalHandoff?: DwaionProposalHandoffBinding
) {
  root.render(
    <StrictMode>
      <Harness sessionKey={sessionKey} dwaionProposalHandoff={dwaionProposalHandoff} />
    </StrictMode>
  );
}
async function loseCreateResponse() {
  dependencies.create.mockRejectedValue(new Error('Response lost'));
  await act(async () => {
    await expect(api.flush()).rejects.toThrow('Response lost');
  });
  return dependencies.create.mock.calls[0]![2].idempotencyKey as string;
}
describe('Approval autosave transport and receipt binding', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks();
    dependencies.authority.mockResolvedValue(undefined);
    dependencies.detail.mockResolvedValue(detail());
    dependencies.reconcile.mockImplementation((key: string) => Promise.resolve(receipt(key)));
    dependencies.update.mockResolvedValue(detail(5));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => render());
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('reconciles CREATE with the exact key and actual saved input without a second create', async () => {
    const key = await loseCreateResponse();
    await act(async () => {
      await api.reconcile();
    });
    expect(dependencies.reconcile).toHaveBeenCalledWith(key, 'scope-a:epoch-1');
    expect(dependencies.detail).toHaveBeenCalledWith('request-1', 'scope-a:epoch-1');
    expect(dependencies.create).toHaveBeenCalledTimes(1);
    expect(api).toMatchObject({ status: 'SAVED', receipt: { requestId: 'request-1', version: 3 } });
  });

  it('preserves local input and blocks overwrite when CREATE reconciliation finds a later edit', async () => {
    await loseCreateResponse();
    dependencies.detail.mockResolvedValue(detail(4, 'Another editor changed the title'));
    await act(async () => {
      await expect(api.reconcile()).rejects.toThrow('Review before reapplying');
    });
    expect(api).toMatchObject({
      status: 'CONFLICT',
      dirty: true,
      latestLoaded: false,
      receipt: { requestId: 'request-1', version: 4 },
    });
    await act(async () => {
      api.reviewLatest(detail(4).request);
    });
    expect(api.conflicts.map((conflict) => conflict.path)).toEqual(['$document']);
    await act(async () => {
      await expect(api.reapply()).rejects.toBeInstanceOf(ApprovalDraftSaveBlockedError);
    });
    expect(dependencies.create).toHaveBeenCalledTimes(1);
    expect(dependencies.update).not.toHaveBeenCalled();
    expect(api.status).toBe('CONFLICT');
  });

  it('replays only the identical immutable CREATE key when no receipt exists', async () => {
    const key = await loseCreateResponse();
    dependencies.reconcile.mockResolvedValue({ idempotencyKey: key, receipts: [] });
    dependencies.create.mockResolvedValue(detail().request);
    await act(async () => {
      await api.reconcile();
    });
    expect(dependencies.create).toHaveBeenCalledTimes(2);
    expect(dependencies.create.mock.calls[1]).toEqual(dependencies.create.mock.calls[0]);
  });

  it('does not accept a different command key or invent a successful save', async () => {
    await loseCreateResponse();
    dependencies.reconcile.mockResolvedValue(receipt('another-command-key'));
    await act(async () => {
      await expect(api.reconcile()).rejects.toBeInstanceOf(ApprovalDraftSaveBlockedError);
    });
    expect(api.status).toBe('UNKNOWN');
    expect(dependencies.detail).not.toHaveBeenCalled();
    expect(dependencies.create).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch a delayed authority result into an A to B to A session generation', async () => {
    let resolve!: () => void;
    dependencies.authority.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      })
    );
    let flight!: Promise<unknown>;
    await act(async () => {
      flight = api.flush().catch((error: unknown) => error);
    });
    await act(async () => render('scope-b:epoch-2'));
    await act(async () => render('scope-a:epoch-3'));
    await act(async () => {
      resolve();
      await flight;
    });
    expect(dependencies.create).not.toHaveBeenCalled();
    expect(api.receipt).toBeUndefined();
    expect(api.status).toBe('LOCAL');
  });

  it('never carries a DWAI-ON binding into a later ordinary request session', async () => {
    const binding: DwaionProposalHandoffBinding = {
      version: 1,
      handoffId: '00000000-0000-4000-8000-000000000011',
      proposalId: '00000000-0000-4000-8000-000000000012',
      actionKey: 'APPROVAL.REQUEST.CREATE',
      handoffVersion: 1,
    };
    dependencies.create.mockResolvedValue(detail().request);
    await act(async () => render('scope-dwaion:epoch-1', binding));
    await act(async () => void (await api.flush()));
    expect(dependencies.create.mock.calls.at(-1)?.[0]).toMatchObject({
      dwaionProposalHandoff: binding,
    });

    dependencies.create.mockClear();
    await act(async () => render('scope-ordinary:epoch-2'));
    await act(async () => void (await api.flush()));
    expect(dependencies.create.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      'dwaionProposalHandoff',
      binding
    );
    expect(dependencies.create.mock.calls.at(-1)?.[0].dwaionProposalHandoff).toBeUndefined();
  });
});
