import { getApprovalForm, getApprovalForms, HttpError } from '@dwp-frontend/shared-utils';
import { productSurfaceServerNow } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import {
  getApprovalWorkflowPlanningSelection,
  simulateApprovalWorkflowPlanning,
} from '@dwp-frontend/shared-utils/api/approval-workflow-planning-api';
import {
  APPROVAL_WORKFLOW_PLANNING_ROUTE,
  APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE,
} from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';
import {
  approvalWorkflowPlanningAuthority,
  approvalWorkflowPlanningEntry,
} from './approval-workflow-planning-authority';
import { captureApprovalWorkflowFormSource } from './approval-workflow-typed-source';
import {
  planningFormMatches,
  planningInput,
  planningOwnerMatches,
  planningResultMatches,
  planningSelectionMatches,
} from './approval-workflow-planning-model';
import type {
  ProductSurfaceEvaluationRequest,
  ProductSurfaceEvaluationData,
  ApprovalForm,
} from '@dwp-frontend/shared-utils';
import type { ApprovalWorkflowPlanningSource } from './approval-workflow-planning-authority';
import type { ApprovalWorkflowPlanningOwner } from './approval-workflow-planning-model';
import type { ApprovalWorkflowPlanningSelection } from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';

export type ApprovalWorkflowPlanningPorts = Readonly<{
  source: () => ApprovalWorkflowPlanningSource;
  owner: () => ApprovalWorkflowPlanningOwner | undefined;
  evaluate: (
    request: ProductSurfaceEvaluationRequest,
    options: { signal: AbortSignal }
  ) => Promise<ProductSurfaceEvaluationData>;
}>;
export type ApprovalWorkflowPlanningLoaded = Readonly<{
  selection: ApprovalWorkflowPlanningSelection;
  forms: readonly ApprovalForm[];
  formSource?: Awaited<ReturnType<typeof captureApprovalWorkflowFormSource>>;
  expiresAt: number;
  snapshot: ApprovalWorkflowPlanningSource['snapshot'];
}>;
export class ApprovalWorkflowPlanningController {
  private pending?: AbortController;
  get busy() {
    return Boolean(this.pending);
  }
  cancel() {
    const pending = this.pending;
    this.pending = undefined;
    pending?.abort();
  }

  private async run<T>(
    owner: ApprovalWorkflowPlanningOwner,
    ports: ApprovalWorkflowPlanningPorts,
    action: (scope: {
      signal: AbortSignal;
      assertCurrent: () => void;
      proof: (
        route:
          | typeof APPROVAL_WORKFLOW_PLANNING_ROUTE
          | typeof APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE
      ) => Promise<NonNullable<ReturnType<typeof approvalWorkflowPlanningAuthority>>>;
      snapshot: ApprovalWorkflowPlanningSource['snapshot'];
    }) => Promise<T>
  ) {
    const entry = approvalWorkflowPlanningEntry(ports.source());
    const actual = ports.owner();
    if (
      this.pending ||
      !entry ||
      !actual ||
      actual.workflowId !== owner.workflowId ||
      actual.workflowRevision !== owner.workflowRevision ||
      actual.workflowSha256 !== owner.workflowSha256
    )
      throw new HttpError('Current planning source unavailable', 409);
    const abort = new AbortController();
    this.pending = abort;
    const assertCurrent = () => {
      const current = approvalWorkflowPlanningEntry(ports.source());
      const actualOwner = ports.owner();
      if (
        abort.signal.aborted ||
        !current ||
        !actualOwner ||
        current.source.snapshot !== entry.source.snapshot ||
        current.source.epoch !== entry.source.epoch ||
        current.source.tenantId !== entry.source.tenantId ||
        current.source.actorId !== entry.source.actorId ||
        current.context.contextKey !== entry.context.contextKey ||
        current.scope.key !== entry.scope.key ||
        current.rolloutState !== entry.rolloutState ||
        actualOwner.workflowId !== owner.workflowId ||
        actualOwner.workflowRevision !== owner.workflowRevision ||
        actualOwner.workflowSha256 !== owner.workflowSha256
      )
        throw new HttpError('Planning source changed', 409);
    };
    try {
      const proof = async (
        route:
          | typeof APPROVAL_WORKFLOW_PLANNING_ROUTE
          | typeof APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE
      ) => {
        assertCurrent();
        const evaluation = await ports.evaluate(
          {
            subject: { type: 'PRODUCT', productKey: 'approvals', surfaceKey: 'approvals.admin' },
            routeContractKey: route,
            contextKey: entry.context.contextKey,
            contextScopeKey: entry.scope.key,
          },
          { signal: abort.signal }
        );
        assertCurrent();
        const verified = approvalWorkflowPlanningAuthority(entry, evaluation, route);
        if (!verified) throw new HttpError('Fresh paired planning DATA authority denied', 403);
        return verified;
      };
      const result = await action({
        signal: abort.signal,
        assertCurrent,
        proof,
        snapshot: entry.source.snapshot,
      });
      assertCurrent();
      return result;
    } finally {
      if (this.pending === abort) this.pending = undefined;
    }
  }

  async load(
    owner: ApprovalWorkflowPlanningOwner,
    formId: string | undefined,
    ports: ApprovalWorkflowPlanningPorts
  ): Promise<ApprovalWorkflowPlanningLoaded> {
    return this.run(owner, ports, async ({ proof, signal, assertCurrent, snapshot }) => {
      const verified = await proof(APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE);
      const beforeDispatch = () => {
        assertCurrent();
        if (productSurfaceServerNow(snapshot!) >= verified.expiresAt)
          throw new HttpError('Planning proof expired', 409);
      };
      const selection = await getApprovalWorkflowPlanningSelection(
        owner.workflowId,
        formId,
        verified.authority,
        { signal, beforeDispatch }
      );
      if (
        !planningOwnerMatches(owner, selection) ||
        verified.resourceSetKey !== selection.managementResourceSetKey
      )
        throw new HttpError('Planning owner pin changed', 409);
      beforeDispatch();
      const catalog = await getApprovalForms(verified.authority.contextScopeKey, signal);
      beforeDispatch();
      const forms = selection.forms.map((pin) => {
        const matches = catalog.filter(
          (form) =>
            form.formId === pin.formId &&
            form.lifecycleState === 'PUBLISHED' &&
            form.version === pin.formRevision &&
            form.currentVersion === pin.formVersion
        );
        if (matches.length !== 1) throw new HttpError('Published form catalog changed', 409);
        return matches[0]!;
      });
      let formSource: ApprovalWorkflowPlanningLoaded['formSource'];
      if (formId) {
        formSource = await captureApprovalWorkflowFormSource(
          await getApprovalForm(formId, verified.authority.contextScopeKey, signal)
        );
        beforeDispatch();
        const pin = selection.forms.find((value) => value.formId === formId);
        if (!pin || !planningFormMatches(pin, formSource.pin))
          throw new HttpError('Published form pin changed', 409);
      }
      return Object.freeze({
        selection,
        forms,
        formSource,
        snapshot,
        expiresAt: verified.expiresAt,
      });
    });
  }

  async preview(
    owner: ApprovalWorkflowPlanningOwner,
    loaded: ApprovalWorkflowPlanningLoaded,
    raw: unknown,
    ports: ApprovalWorkflowPlanningPorts
  ) {
    if (
      !loaded.formSource ||
      !loaded.selection.selectedFormId ||
      !planningOwnerMatches(owner, loaded.selection)
    )
      throw new HttpError('Planning sample source unavailable', 409);
    const input = planningInput(loaded.selection, loaded.formSource.compiled, raw);
    return this.run(owner, ports, async ({ proof, signal, assertCurrent, snapshot }) => {
      if (snapshot !== loaded.snapshot || productSurfaceServerNow(snapshot!) >= loaded.expiresAt)
        throw new HttpError('Planning source expired', 409);
      const selectionProof = await proof(APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE);
      const beforeSelection = () => {
        assertCurrent();
        if (productSurfaceServerNow(snapshot!) >= selectionProof.expiresAt)
          throw new HttpError('Planning source expired', 409);
      };
      const fresh = await getApprovalWorkflowPlanningSelection(
        owner.workflowId,
        loaded.selection.selectedFormId!,
        selectionProof.authority,
        { signal, beforeDispatch: beforeSelection }
      );
      if (
        !planningSelectionMatches(loaded.selection, fresh) ||
        fresh.managementResourceSetKey !== selectionProof.resourceSetKey
      )
        throw new HttpError('Planning pins changed', 409);
      const form = await captureApprovalWorkflowFormSource(
        await getApprovalForm(
          fresh.selectedFormId!,
          selectionProof.authority.contextScopeKey,
          signal
        )
      );
      beforeSelection();
      if (
        !planningFormMatches(
          fresh.forms.find((value) => value.formId === fresh.selectedFormId)!,
          form.pin
        )
      )
        throw new HttpError('Planning schema changed', 409);
      const verified = await proof(APPROVAL_WORKFLOW_PLANNING_ROUTE);
      if (verified.resourceSetKey !== fresh.managementResourceSetKey)
        throw new HttpError('Planning resource set changed', 403);
      const beforeDispatch = () => {
        assertCurrent();
        if (
          productSurfaceServerNow(snapshot!) >=
          Math.min(verified.expiresAt, selectionProof.expiresAt, loaded.expiresAt)
        )
          throw new HttpError('Planning proof expired', 409);
      };
      const result = await simulateApprovalWorkflowPlanning(
        fresh.workflowId,
        fresh.workflowVersionId,
        input,
        verified.authority,
        { signal, beforeDispatch, now: () => productSurfaceServerNow(snapshot!) }
      );
      if (!planningResultMatches(owner, result))
        throw new HttpError('Planning result does not match the saved process', 409);
      return Object.freeze({
        result,
        snapshot,
        expiresAt: Math.min(
          verified.expiresAt,
          selectionProof.expiresAt,
          loaded.expiresAt,
          Date.parse(result.expiresAt)
        ),
      });
    });
  }
}
