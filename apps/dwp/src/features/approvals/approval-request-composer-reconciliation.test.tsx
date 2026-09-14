// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApprovalRequestComposer } from './use-approval-request-composer';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import { approvalRequestTypedEvaluation } from './approval-request-schema-model';
import {
  APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
  APPROVAL_REQUEST_TYPED_TEST_INPUT,
} from '../../../../../e2e/support/approval-request-typed-fixture';

import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

const dependencies = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  reconcile: vi.fn(),
  detail: vi.fn(),
  forms: vi.fn(),
  template: vi.fn(),
  submit: vi.fn(),
  submitExecution: {} as Record<string, unknown>,
  scope: { ready: true, identity: 'actor-a' },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<Record<string, unknown>>()),
  createApprovalRequest: dependencies.create,
  updateApprovalDraft: dependencies.update,
  getApprovalDraftReconciliation: dependencies.reconcile,
  getApprovalRequestDetail: dependencies.detail,
  getPublishedApprovalForms: dependencies.forms,
  getPublishedApprovalFormTemplate: dependencies.template,
  submitApprovalRequest: dependencies.submit,
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: (): ReturnType<typeof useProductSurfaceRequestScope> => ({
    ready: dependencies.scope.ready,
    governed: false,
    contextScopeKey: dependencies.scope.identity,
    cacheKey: [
      'tenant-a',
      dependencies.scope.identity,
      'NORMAL',
      'approvals.work',
      dependencies.scope.identity,
      'revision-a',
    ],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-a',
      actorId: dependencies.scope.identity,
      accessMode: 'NORMAL',
      productId: 'approvals',
      surfaceId: 'approvals.work',
      contextScopeKey: dependencies.scope.identity,
      decisionRevision: 'revision-a',
    },
  }),
}));
vi.mock('./use-approval-governed-mutation', () => ({
  isProductSurfaceOperationCancelledError: () => false,
  useApprovalGovernedMutation:
    (route: string) => async (operation: (execution: unknown) => Promise<unknown>) =>
      operation(
        route.endsWith('request-submit.action')
          ? dependencies.submitExecution
          : { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }
      ),
}));

const original = {
  title: 'Original local title',
  summary: 'Original local summary',
  payloadValues: { costCenter: 'A' },
};
function detail(version = 3, title = original.title): ApprovalRequestDetail {
  return {
    request: {
      requestId: 'request-1',
      requestNumber: 'APR-1',
      version,
      status: 'DRAFT',
      title,
      summary: original.summary,
      priority: 'NORMAL',
      workflowNameKo: '결재',
      workflowNameEn: 'Approval',
      totalSteps: 1,
      dataClassification: 'INTERNAL',
    },
    workflowId: 'workflow-1',
    formId: 'form-1',
    payload: { summary: original.summary, costCenter: 'A', createdFrom: 'DWP_APPROVALS' },
    timeline: [],
  };
}
function receipt(key: string, update = false, version = 3) {
  return {
    idempotencyKey: key,
    receipts: [
      {
        commandType: update ? 'UPDATE' : 'CREATE',
        route: update ? 'PUT /v1/requests/request-1/draft' : 'POST /v1/requests',
        draft: {
          requestId: 'request-1',
          version,
          payloadRevision: 1,
          deletedAt: null,
          deletedBy: null,
        },
        completedAt: '2026-09-14T00:00:00Z',
      },
    ],
  };
}
let api: ReturnType<typeof useApprovalRequestComposer>;
function Harness() {
  api = useApprovalRequestComposer();
  return <output>{api.title}</output>;
}
let root: Root;
let client: QueryClient;
let container: HTMLDivElement;
function render(draft = false) {
  root.render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[`/approvals/requests/new${draft ? '?draft=request-1' : ''}`]}
        >
          <Harness />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>
  );
}
async function compose() {
  await act(async () => render());
  await vi.waitFor(() => expect(api.forms.data).toBeDefined());
  await act(async () => api.requestFormChange('form-1'));
  await vi.waitFor(() => expect(api.contextReady).toBe(true));
  await act(async () => {
    api.setTitle(original.title);
    api.setSummary(original.summary);
    api.setPayloadValues({ ...original.payloadValues });
  });
}
async function loseCreate() {
  dependencies.create.mockRejectedValueOnce(new Error('Response lost'));
  await act(async () => {
    await expect(api.autosave.flush()).rejects.toThrow('Response lost');
  });
  expect(api.autosave.status).toBe('UNKNOWN');
  return dependencies.create.mock.calls[0]![2].idempotencyKey as string;
}
async function denyReceipt() {
  dependencies.reconcile.mockRejectedValueOnce(new HttpError('Receipt denied', 403));
  await act(async () => api.reconcile());
  expect(api.autosave).toMatchObject({ status: 'DENIED', unresolved: true });
  expect(api).toMatchObject({
    title: '',
    summary: '',
    formId: '',
    payloadValues: {},
    fieldsDisabled: true,
    contentMasked: true,
    contextReady: false,
  });
}
describe('Actual composer and autosave receipt-denial recovery', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks();
    dependencies.scope = { ready: true, identity: 'actor-a' };
    dependencies.submitExecution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' };
    dependencies.forms.mockResolvedValue([{ formId: 'form-1' }]);
    dependencies.template.mockResolvedValue({
      workflow: { workflowId: 'workflow-1' },
      form: { schema: { schemaVersion: 1, fields: [] } },
    });
    dependencies.detail.mockResolvedValue(detail());
    dependencies.update.mockResolvedValue(detail(4));
    dependencies.submit.mockResolvedValue({ ...detail(4).request, status: 'SUBMITTED' });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('captures one immutable original submit key before dispatch and suppresses double confirmation', async () => {
    await compose();
    dependencies.create.mockResolvedValue(detail().request);
    let release!: () => void;
    dependencies.submit.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    await act(async () => {
      api.submit();
      api.submit();
    });
    await vi.waitFor(() => expect(dependencies.submit).toHaveBeenCalledTimes(1));
    const command = api.save.variables!;
    expect(Object.isFrozen(command.input)).toBe(true);
    const key = command.input.idempotencyKey;
    expect(key).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
    expect(dependencies.submit).toHaveBeenCalledWith('request-1', 3, dependencies.submitExecution, {
      idempotencyKey: key,
    });
    expect(dependencies.create.mock.calls[0]![2].idempotencyKey).not.toBe(key);
    await act(async () => release());
  });

  it('retains dispatched submit UNKNOWN through fresh DRAFT reads, with no new key, autosave or automatic POST retry', async () => {
    await compose();
    client.setDefaultOptions({ mutations: { retry: 3 } });
    dependencies.create.mockResolvedValue(detail().request);
    dependencies.submit.mockRejectedValueOnce(new HttpError('Submit result unavailable', 503));
    await act(async () => api.submit());
    await vi.waitFor(() => expect(api.submissionUnknown).toBe(true));
    const key = api.save.variables!.input.idempotencyKey;
    expect(api).toMatchObject({
      title: original.title,
      summary: original.summary,
      fieldsDisabled: true,
      contextReady: false,
    });
    await act(async () => api.refreshContext());
    await act(async () => {
      api.submit();
      api.saveDraft();
      api.saveAndClose();
      api.requestFormChange('other-form');
    });
    expect(api.recovery?.kind).toBe('UNKNOWN');
    expect(api.save.variables!.input.idempotencyKey).toBe(key);
    expect(dependencies.submit).toHaveBeenCalledTimes(1);
    expect(dependencies.detail).toHaveBeenCalledWith('request-1', 'actor-a');
    expect(dependencies.update).not.toHaveBeenCalled();
    expect(dependencies.create).toHaveBeenCalledTimes(1);
  });

  it('uses the real API key guard to reject borrowed secure identity before HTTP, without replacing the original submit key', async () => {
    await compose();
    dependencies.create.mockResolvedValue(detail().request);
    const actual = await vi.importActual<typeof SharedUtils>('@dwp-frontend/shared-utils');
    dependencies.submit.mockImplementation(actual.submitApprovalRequest);
    dependencies.submitExecution = {
      mode: 'SECURE',
      rolloutState: '110',
      expectedDecisionRevision: 'rev-1',
      contextKey: 'context-1',
      contextScopeKey: 'actor-a',
      idempotencyKey: 'borrowed-command',
    };
    const http = vi.fn();
    vi.stubGlobal('fetch', http);
    await act(async () => api.submit());
    await vi.waitFor(() => expect(api.save.isError).toBe(true));
    expect(http).not.toHaveBeenCalled();
    expect(api.save.variables!.input.idempotencyKey).not.toBe('borrowed-command');
    await act(async () => {
      await api.refreshContext();
      api.submit();
    });
    expect(dependencies.submit).toHaveBeenCalledTimes(1);
    expect(http).not.toHaveBeenCalled();
  });

  it('masks UNKNOWN receipt403 but restores the exact original input after same-key reconciliation, never blank CAS', async () => {
    await compose();
    const key = await loseCreate();
    await denyReceipt();
    await act(async () => api.saveDraft());
    expect(dependencies.update).not.toHaveBeenCalled();
    await act(async () => api.refreshContext());
    expect(api.autosave.status).toBe('UNKNOWN');
    expect(api.fieldsDisabled).toBe(true);
    expect(dependencies.template).toHaveBeenLastCalledWith(
      'form-1',
      'actor-a',
      expect.any(AbortSignal)
    );
    dependencies.reconcile.mockResolvedValue(receipt(key));
    await act(async () => api.reconcile());
    expect(dependencies.reconcile).toHaveBeenNthCalledWith(2, key, 'actor-a');
    expect(api).toMatchObject({
      title: original.title,
      summary: original.summary,
      formId: 'form-1',
      payloadValues: original.payloadValues,
      contentMasked: false,
    });
    expect(api.autosave).toMatchObject({ status: 'SAVED', dirty: false, unresolved: false });
    await act(async () => {
      await api.autosave.flush();
    });
    expect(dependencies.create).toHaveBeenCalledTimes(1);
    expect(dependencies.update).not.toHaveBeenCalled();
    await act(async () => api.setTitle('Reviewed title'));
    await act(async () => {
      await api.autosave.flush();
    });
    expect(dependencies.update).toHaveBeenCalledWith(
      'request-1',
      expect.objectContaining({
        title: 'Reviewed title',
        summary: original.summary,
        expectedVersion: 3,
        payload: expect.objectContaining({ costCenter: 'A', summary: original.summary }),
      }),
      expect.anything(),
      { idempotencyKey: expect.any(String) }
    );
  });

  it('keeps input masked and receipt reads blocked while authoritative source access remains denied', async () => {
    await compose();
    const key = await loseCreate();
    await denyReceipt();
    dependencies.forms.mockRejectedValue(new HttpError('Form source denied', 403));
    await act(async () => api.refreshContext());
    await act(async () => api.reconcile());
    expect(dependencies.reconcile).toHaveBeenCalledTimes(1);
    expect(api.contentMasked).toBe(true);
    expect(api.title).toBe('');
    dependencies.forms.mockResolvedValue([{ formId: 'form-1' }]);
    await act(async () => api.refreshContext());
    dependencies.reconcile.mockResolvedValue(receipt(key));
    await act(async () => api.reconcile());
    expect(api.title).toBe(original.title);
    expect(dependencies.create).toHaveBeenCalledTimes(1);
    expect(dependencies.update).not.toHaveBeenCalled();
  });

  it('purges quarantined input and discards a delayed receipt across A to B to A identity epochs', async () => {
    await compose();
    const key = await loseCreate();
    await denyReceipt();
    await act(async () => api.refreshContext());
    let resolve!: (value: ReturnType<typeof receipt>) => void;
    dependencies.reconcile.mockReturnValue(
      new Promise<ReturnType<typeof receipt>>((done) => {
        resolve = done;
      })
    );
    let flight!: Promise<void>;
    await act(async () => {
      flight = api.reconcile();
    });
    dependencies.scope.identity = 'actor-b';
    await act(async () => render());
    dependencies.scope.identity = 'actor-a';
    await act(async () => render());
    await act(async () => {
      resolve(receipt(key));
      await flight;
    });
    expect(api).toMatchObject({ title: '', summary: '', formId: '', payloadValues: {} });
    expect(api.autosave.unresolved).toBe(false);
    expect(api.autosave.receipt).toBeUndefined();
    expect(dependencies.detail).not.toHaveBeenCalled();
    expect(dependencies.create).toHaveBeenCalledTimes(1);
    expect(dependencies.update).not.toHaveBeenCalled();
  });

  it('reconciles an UPDATE denial into the same draft/version without overwriting saved fields', async () => {
    await act(async () => render(true));
    await vi.waitFor(() => expect(api.contextReady).toBe(true));
    await act(async () => api.setTitle('Updated local title'));
    dependencies.update.mockRejectedValueOnce(new Error('Update response lost'));
    await act(async () => {
      await expect(api.autosave.flush()).rejects.toThrow('Update response lost');
    });
    const key = dependencies.update.mock.calls[0]![3].idempotencyKey as string;
    await denyReceipt();
    dependencies.detail.mockResolvedValue(detail(4, 'Updated local title'));
    await act(async () => api.refreshContext());
    dependencies.reconcile.mockResolvedValue(receipt(key, true, 4));
    await act(async () => api.reconcile());
    expect(api.title).toBe('Updated local title');
    expect(api.summary).toBe(original.summary);
    expect(api.autosave).toMatchObject({ status: 'SAVED', dirty: false, receipt: { version: 4 } });
    await act(async () => {
      await api.autosave.flush();
    });
    expect(dependencies.update).toHaveBeenCalledTimes(1);
    expect(dependencies.create).not.toHaveBeenCalled();
  });

  it('restores preserved input for review, not automatic overwrite, when the denied CREATE receipt finds a newer edit', async () => {
    await compose();
    const key = await loseCreate();
    await denyReceipt();
    await act(async () => api.refreshContext());
    dependencies.reconcile.mockResolvedValue(receipt(key));
    dependencies.detail.mockResolvedValue(detail(4, 'Another editor changed the title'));
    await act(async () => api.reconcile());
    expect(api.title).toBe(original.title);
    expect(api.summary).toBe(original.summary);
    expect(api.autosave).toMatchObject({
      status: 'CONFLICT',
      latestLoaded: false,
      receipt: { requestId: 'request-1', version: 4 },
    });
    expect(api.contextReady).toBe(false);
    expect(dependencies.update).not.toHaveBeenCalled();
    await act(async () => api.refreshContext());
    expect(api.autosave.latestLoaded).toBe(true);
    dependencies.update.mockResolvedValue(detail(5));
    await act(async () => api.reapply());
    expect(dependencies.update).toHaveBeenCalledWith(
      'request-1',
      expect.objectContaining({
        title: original.title,
        summary: original.summary,
        expectedVersion: 4,
        payload: expect.objectContaining({ costCenter: 'A', summary: original.summary }),
      }),
      expect.anything(),
      { idempotencyKey: expect.any(String) }
    );
    expect(dependencies.create).toHaveBeenCalledTimes(1);
  });
});

describe('Actual composer and autosave typed form integration', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks();
    dependencies.scope = { ready: true, identity: 'actor-a' };
    dependencies.forms.mockResolvedValue([{ formId: 'form-1' }]);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function typedSource(hash?: string) {
    const compiled = await compileApprovalTypedForm(APPROVAL_REQUEST_TYPED_TEST_SCHEMA);
    dependencies.template.mockResolvedValue({
      workflow: { workflowId: 'workflow-1' },
      form: {
        schema: APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
        schemaHash: hash ?? compiled.schemaSha256,
      },
    });
    const payload = approvalRequestTypedEvaluation(
      compiled,
      APPROVAL_REQUEST_TYPED_TEST_INPUT,
      original.summary,
      'DRAFT'
    ).payload;
    const server = {
      ...detail(),
      formSchema: APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
      payload: { ...payload },
    };
    dependencies.detail.mockResolvedValue(server);
    dependencies.create.mockResolvedValue(server.request);
    dependencies.update.mockResolvedValue({
      ...server,
      request: { ...server.request, version: 4 },
    });
    dependencies.submit.mockResolvedValue({ ...server.request, status: 'SUBMITTED', version: 4 });
    return { compiled, server, payload };
  }

  it('saves partial numeric drafts with strings and submits the same canonical row/calculation payload with actual expected version', async () => {
    const { payload } = await typedSource();
    await compose();
    await act(async () => api.setPayloadValues(structuredClone(APPROVAL_REQUEST_TYPED_TEST_INPUT)));
    expect(api.submissionReady).toBe(true);
    await act(async () => {
      await api.autosave.flush();
    });
    expect(dependencies.create).toHaveBeenCalledWith(
      expect.objectContaining({ payload }),
      expect.anything(),
      { idempotencyKey: expect.any(String) }
    );
    await act(async () => api.submit());
    await vi.waitFor(() =>
      expect(dependencies.submit).toHaveBeenCalledWith('request-1', 3, expect.anything(), {
        idempotencyKey: expect.any(String),
      })
    );
    expect(dependencies.create).toHaveBeenCalledTimes(1);
    expect(dependencies.update).not.toHaveBeenCalled();
  });

  it('hydrates trusted stored typed rows without computed editing inputs, but re-evaluates identical canonical values and does not save again', async () => {
    const { payload } = await typedSource();
    await act(async () => render(true));
    await vi.waitFor(() => expect(api.contextReady).toBe(true));
    expect(api.payloadValues).toEqual({
      category: 'STANDARD',
      items: [{ quantity: '2', price: '10.25' }],
    });
    expect(api.formEvaluation.draftEvaluation?.payload).toEqual(payload);
    expect(api.autosave.dirty).toBe(false);
    await act(async () => {
      await api.autosave.flush();
    });
    expect(dependencies.create).not.toHaveBeenCalled();
    expect(dependencies.update).not.toHaveBeenCalled();
  });

  it('does not enable typed writes when the advertised published schema hash is different', async () => {
    await typedSource('0'.repeat(64));
    await act(async () => render());
    await vi.waitFor(() => expect(api.forms.data).toBeDefined());
    await act(async () => api.requestFormChange('form-1'));
    await vi.waitFor(() => expect(api.formEvaluation.compiled).not.toBeNull());
    expect(api.schemaBindingReady).toBe(false);
    expect(api.contextReady).toBe(false);
    await act(async () => {
      api.saveDraft();
      api.submit();
    });
    expect(dependencies.create).not.toHaveBeenCalled();
    expect(dependencies.submit).not.toHaveBeenCalled();
  });

  it('preserves invalid decimal strings and tampered fresh computed inputs while blocking all save/submit dispatch', async () => {
    await typedSource();
    await compose();
    for (const values of [
      { category: 'STANDARD', items: [{ quantity: '1e3', price: '10' }] },
      { ...APPROVAL_REQUEST_TYPED_TEST_INPUT, total: '999' },
    ]) {
      await act(async () => api.setPayloadValues(values));
      expect(api.payloadValues).toEqual(values);
      expect(api.contextReady).toBe(false);
      expect(api.submissionReady).toBe(false);
      await act(async () => {
        api.saveDraft();
        api.submit();
      });
    }
    expect(dependencies.create).not.toHaveBeenCalled();
    expect(dependencies.submit).not.toHaveBeenCalled();
  });

  it('distinguishes DRAFT validity from conditional SUBMIT requirements without losing partial rows', async () => {
    await typedSource();
    await compose();
    await act(async () => api.setPayloadValues({ category: 'OTHER', items: [{ quantity: '2' }] }));
    expect(api.contextReady).toBe(true);
    expect(api.submissionReady).toBe(false);
    await act(async () => {
      await api.autosave.flush();
    });
    expect(dependencies.create.mock.calls[0]![0].payload).toEqual({
      category: 'OTHER',
      items: [{ quantity: '2' }],
      summary: original.summary,
      createdFrom: 'DWP_APPROVALS',
    });
    expect(dependencies.submit).not.toHaveBeenCalled();
  });

  it('keeps exact structured original input through UNKNOWN receipt403 and restores it without a blank or computed-value CAS', async () => {
    await typedSource();
    await compose();
    await act(async () => api.setPayloadValues(structuredClone(APPROVAL_REQUEST_TYPED_TEST_INPUT)));
    const key = await loseCreate();
    await denyReceipt();
    await act(async () => api.refreshContext());
    dependencies.reconcile.mockResolvedValue(receipt(key));
    await act(async () => api.reconcile());
    expect(api.contentMasked).toBe(false);
    expect(api.payloadValues).toEqual(APPROVAL_REQUEST_TYPED_TEST_INPUT);
    expect(api.autosave).toMatchObject({ status: 'SAVED', dirty: false, unresolved: false });
    expect(dependencies.update).not.toHaveBeenCalled();
    await act(async () =>
      api.setPayloadValues({ category: 'STANDARD', items: [{ quantity: '3', price: '10.25' }] })
    );
    await act(async () => {
      await api.autosave.flush();
    });
    expect(dependencies.update).toHaveBeenCalledWith(
      'request-1',
      expect.objectContaining({
        expectedVersion: 3,
        summary: original.summary,
        payload: expect.objectContaining({
          items: [{ quantity: '3', price: '10.25', lineTotal: '30.75' }],
          total: '30.75',
        }),
      }),
      expect.anything(),
      { idempotencyKey: expect.any(String) }
    );
  });
});
