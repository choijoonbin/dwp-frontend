import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import {
  planningAuthorityFixture,
  planningIds,
  planningSelectionFixture,
  planningResultFixture,
} from '@dwp-frontend/shared-utils/test-utils/approval-workflow-planning-fixtures';
import { APPROVAL_WORKFLOW_PLANNING_ROUTE } from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';
import { ApprovalWorkflowPlanningController } from './approval-workflow-planning-controller';
import { typedEditorSeed } from './approval-form-builder-typed-model';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import { planningSelectionMatches } from './approval-workflow-planning-model';
import type { ApprovalWorkflowPlanningSource } from './approval-workflow-planning-authority';
import type { ApprovalWorkflowPlanningOwner } from './approval-workflow-planning-model';
import type { ApprovalFormDetail } from '@dwp-frontend/shared-utils';

describe('actual planning DATA transport with current native form/policy pins', () => {
  let source: ApprovalWorkflowPlanningSource;
  let owner: ApprovalWorkflowPlanningOwner | undefined;
  let selection: ReturnType<typeof planningSelectionFixture>;
  let form: ApprovalFormDetail;
  let controller: ApprovalWorkflowPlanningController;
  let fetch: ReturnType<typeof vi.fn>;
  let evaluationHook: (() => void) | undefined;
  let selectionHook: (() => void) | undefined;
  let postStatus: number;
  const response = (data: unknown, status = 200) =>
    new Response(JSON.stringify({ data }), { status });
  const ports = () => ({
    source: () => source,
    owner: () => owner,
    evaluate: vi.fn(async (request: { routeContractKey?: string }) => {
      evaluationHook?.();
      return planningAuthorityFixture(
        request.routeContractKey === APPROVAL_WORKFLOW_PLANNING_ROUTE
          ? APPROVAL_WORKFLOW_PLANNING_ROUTE
          : undefined
      ).evaluation;
    }),
  });
  beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    resetCsrfToken();
    controller = new ApprovalWorkflowPlanningController();
    source = planningAuthorityFixture().source;
    selection = planningSelectionFixture();
    evaluationHook = undefined;
    selectionHook = undefined;
    postStatus = 200;
    const schema = {
      ...typedEditorSeed('Summary', 'Summary'),
      fields: [
        ...typedEditorSeed('Summary', 'Summary').fields,
        { key: 'amount', type: 'NUMBER' as const, labelKo: 'Amount', labelEn: 'Amount' },
      ],
    };
    const compiled = await compileApprovalTypedForm(schema);
    selection.forms[0]!.formSchemaSha256 = compiled.schemaSha256;
    form = {
      form: {
        formId: planningIds.form,
        formKey: 'FORM',
        categoryId: planningIds.form,
        categoryKey: 'GENERAL',
        categoryNameKo: 'General',
        categoryNameEn: 'General',
        nameKo: 'Published form',
        nameEn: 'Published form',
        descriptionKo: '',
        descriptionEn: '',
        formKind: 'REQUEST',
        lifecycleState: 'PUBLISHED',
        currentVersion: 2,
        fieldCount: 2,
        routeCount: 1,
        usageCount: 0,
        version: 4,
        updatedAt: new Date().toISOString(),
      },
      schema,
      schemaHash: compiled.schemaSha256,
      formVersionId: planningIds.formVersion,
      routes: [],
    };
    owner = {
      workflowId: planningIds.workflow,
      workflowRevision: 7,
      workflowSha256: 'a'.repeat(64),
      definition: {
        schemaContract: 'DWP_APPROVAL_WORKFLOW_QUORUM_V2',
        schemaVersion: 2,
        slaMinutes: 60,
        stages: [
          {
            key: 'FINANCE',
            name: 'Finance',
            candidateRole: 'FINANCE_REVIEWER',
            quorum: { mode: 'PERCENT', value: 67 },
            slaMinutes: 15,
            predecessors: [],
          },
        ],
      },
    };
    fetch = vi.fn(async (url: string) => {
      if (url.includes('/csrf')) return response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
      if (url.includes('/planning-selection')) {
        selectionHook?.();
        return response({
          ...selection,
          selectedFormId: url.includes('formId=') ? planningIds.form : null,
        });
      }
      if (url.includes('/simulation')) return response(planningResultFixture(), postStatus);
      if (url.includes(`/forms/${planningIds.form}`)) return response(form);
      if (url.includes('/forms')) return response([form.form]);
      throw new Error(`Unexpected HTTP ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
  });
  afterEach(() => {
    controller.cancel();
    resetCsrfToken();
    vi.unstubAllGlobals();
  });
  it('loads true published schema then previews server pins without live eligibility claim', async () => {
    const loaded = await controller.load(owner!, planningIds.form, ports());
    const output = await controller.preview(
      owner!,
      loaded,
      { summary: 'Plan', amount: '20.00' },
      ports()
    );
    expect(output.result.runtimeEligibility).toBe('NOT_EVALUATED');
    expect(output.result.requesterExclusion).toBe('NOT_EVALUATED');
    const post = fetch.mock.calls.find(([url]) => String(url).includes('/simulation'))!;
    const body = JSON.parse(post[1].body);
    expect(Object.keys(body)).toHaveLength(8);
    expect(body.samplePayload.amount).toBe('20');
    expect(body.policySha256).toBe(selection.policy.sha256);
    expect(body.formSchemaSha256).toBe(form.schemaHash);
    expect(post[1].headers['Idempotency-Key']).toBeUndefined();
  });
  it('Source11 missing sends neither evaluation nor catalog/CSRF/preview', async () => {
    source = {
      ...source,
      projections: source.projections.filter(
        (route) => route.routeContractKey === APPROVAL_WORKFLOW_PLANNING_ROUTE
      ),
    };
    const currentPorts = ports();
    await expect(controller.load(owner!, undefined, currentPorts)).rejects.toThrow();
    expect(currentPorts.evaluate).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['actor', 'epoch', 'snapshot', 'owner', 'unmount'])(
    'late %s drift before selection prevents HTTP',
    async (kind) => {
      evaluationHook = () => {
        if (kind === 'actor') source = { ...source, actorId: '100' };
        if (kind === 'epoch') source = { ...source, epoch: source.epoch + 1 };
        if (kind === 'snapshot')
          source = { ...source, snapshot: planningAuthorityFixture().source.snapshot };
        if (kind === 'owner') owner = { ...owner!, workflowRevision: 8 };
        if (kind === 'unmount') owner = undefined;
      };
      await expect(controller.load(owner!, planningIds.form, ports())).rejects.toThrow('changed');
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it('fresh policy drift closes POST instead of reusing previous pins', async () => {
    const loaded = await controller.load(owner!, planningIds.form, ports());
    selection.policy.version += 1;
    await expect(controller.preview(owner!, loaded, { summary: 'Plan' }, ports())).rejects.toThrow(
      'pins changed'
    );
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/simulation'))).toHaveLength(0);
  });
  it('form schema revision mismatch never opens sample or preview', async () => {
    form.form.version += 1;
    await expect(controller.load(owner!, planningIds.form, ports())).rejects.toThrow(
      'catalog changed'
    );
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/simulation'))).toHaveLength(0);
  });
  it('late cancelled selection cannot populate a new owner', async () => {
    selectionHook = () => {
      controller.cancel();
      source = { ...source, epoch: 1 };
    };
    await expect(controller.load(owner!, planningIds.form, ports())).rejects.toThrow('changed');
    expect(controller.busy).toBe(false);
  });
  it('real 503 preview does not retry, create tasks or invent verified output', async () => {
    const loaded = await controller.load(owner!, planningIds.form, ports());
    postStatus = 503;
    await expect(
      controller.preview(owner!, loaded, { summary: 'Plan' }, ports())
    ).rejects.toThrow();
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/simulation'))).toHaveLength(1);
  });
  it('compares instants independently of fresh generatedAt without weakening any native pin', () => {
    const next = { ...selection, generatedAt: new Date(Date.now() + 1).toISOString() };
    expect(planningSelectionMatches(selection, next)).toBe(true);
    expect(
      planningSelectionMatches(selection, { ...next, workflowVersionId: planningIds.form })
    ).toBe(false);
  });
});
