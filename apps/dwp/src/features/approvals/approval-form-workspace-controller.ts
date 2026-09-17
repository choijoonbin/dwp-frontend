import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApprovalFormWorkspaceResponseError,
  HttpError,
  HttpTransportError,
  branchApprovalFormWorkspaceVersion,
  getApprovalFormWorkspace,
  getApprovalFormWorkspaceHistory,
  getApprovalFormWorkspaceVersion,
  getApprovalFormWorkspaceDiff,
  getApprovalFormWorkspacePublishReview,
  updateApprovalFormWorkingDraft,
  retireApprovalFormWorkspace,
  reinstateApprovalFormWorkspace,
  publishReviewedApprovalFormWorkspace,
  rejectApprovalFormPublishReview,
  isApprovalTypedFormSchema,
  productSurfaceServerNow,
  useProductSurfaceAuthority,
  snapshotApprovalFormWorkspace,
  useToast,
} from '@dwp-frontend/shared-utils';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useProductSurfaceGovernedMutation } from '../../components/use-product-surface-governed-mutation';
import { approvalFormReviewedPublishCommand } from './approval-high-risk-command-model';
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
} from './approval-management-command-scope';
import { useApprovalManagementScopeReset } from './approval-management-scope';
import { useApprovalFormSchemaValidation } from './approval-form-schema-validation';
import {
  approvalFormWorkspaceReadState,
  captureApprovalFormWorkspace,
  approvalFormWorkspacePinsMatch,
  captureApprovalFormWorkspaceReview,
  approvalFormWorkspaceReviewMatches,
  approvalFormWorkspaceReviewSourcesMatch,
} from './approval-form-workspace-model';
import type { QueryKey } from '@tanstack/react-query';
import type {
  ApprovalFormWorkspace,
  ApprovalFormWorkspaceReview,
  ApprovalFormWorkingDraftInput,
  ApprovalFormReviewedPublishInput,
  ApprovalFormWorkspaceVersion,
  ApprovalFormPublishReviewRejectInput,
} from '@dwp-frontend/shared-utils';
import type { ApprovalManagementRequestScope } from './use-approval-experience';
import type { ApprovalFormWorkspacePins } from './approval-form-workspace-model';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

const prefix = '/api/approvals/v1/admin/forms/{formId}';
export const APPROVAL_FORM_WORKSPACE_ROUTE_BINDINGS = {
  'form-working-draft.data': ['GET', `${prefix}/working-draft`],
  'form-version-history.data': ['GET', `${prefix}/versions`],
  'form-version-detail.data': ['GET', `${prefix}/versions/{formVersionId}`],
  'form-version-diff.data': ['GET', `${prefix}/diff`],
  'form-publish-review.data': ['GET', `${prefix}/publish-review`],
  'form-publish-review-request.data': ['GET', `${prefix}/publish-review-request`],
  'form-publish-review-candidates.data': [
    'GET',
    '/api/approvals/v1/admin/forms/publish-review-candidates',
  ],
  'form-publish-review-queue.data': [
    'GET',
    '/api/approvals/v1/admin/forms/publish-review-requests',
  ],
  'form-publish-review-request.action': ['POST', `${prefix}/publish-review-request`],
  'form-publish-review-reject.action': [
    'POST',
    `${prefix}/publish-review-requests/{requestId}/reject`,
  ],
  'form-working-draft-update.action': ['PUT', `${prefix}/working-draft`],
  'form-version-branch.action': ['POST', `${prefix}/versions/{formVersionId}/branch`],
  'form-retire.action': ['POST', `${prefix}/retire`],
  'form-reinstate.action': ['POST', `${prefix}/reinstate`],
  'form-reviewed-publish.action': ['POST', `${prefix}/publish-reviewed`],
} as const;
type Leaf = keyof typeof APPROVAL_FORM_WORKSPACE_ROUTE_BINDINGS;
export function approvalFormWorkspaceRouteInstalled(
  leaf: Leaf,
  projections: readonly ProductAuthorizationRouteProjection[] = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS
) {
  const [method, path] = APPROVAL_FORM_WORKSPACE_ROUTE_BINDINGS[leaf];
  const matches = projections.filter(
    (route) => route.routeContractKey === `route.approvals.admin.${leaf}`
  );
  return (
    matches.length === 1 &&
    matches[0]!.productId === 'approvals' &&
    matches[0]!.surfaceId === 'approvals.admin' &&
    matches[0]!.routeKind === (method === 'GET' ? 'DATA' : 'ACTION') &&
    matches[0]!.gatewayBindings.length === 1 &&
    matches[0]!.gatewayBindings[0]!.method === method &&
    matches[0]!.gatewayBindings[0]!.path === path
  );
}
type LowCommand = {
  kind: 'UPDATE' | 'BRANCH' | 'RETIRE' | 'REINSTATE';
  original: ApprovalFormWorkspacePins;
  key: string;
  input:
    | ApprovalFormWorkingDraftInput
    | { expectedFormRevision: number; expectedWorkspaceRevision: number | null };
  sourceVersionId: string | null;
  sourceVersionFingerprint: string | null;
  sourceVersion: ApprovalFormWorkspaceVersion | null;
  parents: ReadonlyArray<{ key: QueryKey; fingerprint: string }>;
};
type ReviewAttempt = {
  original: ApprovalFormWorkspacePins;
  parents: LowCommand['parents'];
  review: ApprovalFormWorkspaceReview;
  input: ApprovalFormReviewedPublishInput;
  key: string;
  comparisons: ReadonlyArray<{ key: QueryKey; fingerprint: string }>;
};
type RejectAttempt = Omit<ReviewAttempt, 'input'> & {
  input: ApprovalFormPublishReviewRejectInput;
};
type ReviewSourceAttempt = Pick<ReviewAttempt, 'original' | 'parents' | 'review' | 'comparisons'>;

export function useApprovalFormWorkspaceController({
  formId,
  requestScope,
  scopeReady,
  parentReady,
  parentQueryKeys,
  canEdit,
  canPublish,
  onChanged,
}: {
  formId: string | null;
  requestScope: ApprovalManagementRequestScope;
  scopeReady: boolean;
  parentReady: boolean;
  parentQueryKeys: readonly QueryKey[];
  canEdit: boolean;
  canPublish: boolean;
  onChanged: (formId: string) => Promise<void>;
}) {
  const client = useQueryClient();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { t } = useTranslation('approvals');
  const toast = useToast();
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const authority = useProductSurfaceAuthority();
  const actorId = Number(requestScope.cacheKey[1]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [branchOriginal, setBranchOriginal] = useState<LowCommand | null>(null);
  const [availabilityOriginal, setAvailabilityOriginal] = useState<LowCommand | null>(null);
  const [editorOriginal, setEditorOriginal] = useState<ApprovalFormWorkspacePins | null>(null);
  const [reviewOriginal, setReviewOriginal] = useState<ApprovalFormWorkspacePins | null>(null);
  const [review, setReview] = useState<ApprovalFormWorkspaceReview | null>(null);
  const [feedback, setFeedback] = useState<'UNKNOWN' | 'CHANGED' | null>(null);
  const [now, setNow] = useState(Date.now());
  const pending = useRef<LowCommand | null>(null);
  const activeLowKey = useRef<string | null>(null);
  const dispatched = useRef(new Set<string>());
  const uncertainCommands = useRef(new Set<string>());
  const reviewAttempt = useRef<ReviewAttempt | null>(null);
  const rejectAttempt = useRef<RejectAttempt | null>(null);
  const editorParents = useRef<LowCommand['parents']>([]);
  const reviewParents = useRef<LowCommand['parents']>([]);
  const selection = useRef({ formId, epoch: 0 });
  if (selection.current.formId !== formId)
    selection.current = { formId, epoch: selection.current.epoch + 1 };
  const baseKey = [
    'approvals',
    'admin',
    'form-workspace',
    formId,
    ...requestScope.cacheKey,
  ] as const;
  const workspaceKey = [...baseKey, 'head'] as const;
  const historyKey = [...baseKey, 'history'] as const;
  const versionKey = [...baseKey, 'version', selectedVersionId] as const;
  const installed = approvalFormWorkspaceRouteInstalled('form-working-draft.data');
  const readEnabled = scopeReady && parentReady && Boolean(formId) && installed;
  const workspace = useQuery({
    queryKey: workspaceKey,
    queryFn: ({ signal }) =>
      getApprovalFormWorkspace(formId!, requestScope.contextScopeKey, signal),
    enabled: readEnabled,
    retry: false,
    staleTime: 30_000,
  });
  const history = useQuery({
    queryKey: historyKey,
    queryFn: ({ signal }) =>
      getApprovalFormWorkspaceHistory(formId!, 100, requestScope.contextScopeKey, signal),
    enabled: readEnabled && approvalFormWorkspaceRouteInstalled('form-version-history.data'),
    retry: false,
    staleTime: 30_000,
  });
  const version = useQuery({
    queryKey: versionKey,
    queryFn: ({ signal }) =>
      getApprovalFormWorkspaceVersion(
        formId!,
        selectedVersionId!,
        requestScope.contextScopeKey,
        signal
      ),
    enabled:
      readEnabled &&
      Boolean(selectedVersionId) &&
      approvalFormWorkspaceRouteInstalled('form-version-detail.data'),
    retry: false,
    staleTime: 30_000,
  });
  const draft = workspace.data?.workingDraft;
  const requiredFromId =
    workspace.data?.published?.formVersionId ?? draft?.sourceVersionId ?? draft?.formVersionId;
  const fromId = selectedVersionId ?? requiredFromId;
  const diffKey = [...baseKey, 'diff', fromId, draft?.formVersionId] as const;
  const requiredDiffKey = [...baseKey, 'diff', requiredFromId, draft?.formVersionId] as const;
  const diff = useQuery({
    queryKey: diffKey,
    queryFn: ({ signal }) =>
      getApprovalFormWorkspaceDiff(
        formId!,
        fromId!,
        draft!.formVersionId,
        requestScope.contextScopeKey,
        signal
      ),
    enabled:
      readEnabled &&
      Boolean(fromId && draft) &&
      approvalFormWorkspaceRouteInstalled('form-version-diff.data'),
    retry: false,
    staleTime: 30_000,
  });
  const requiredDiff = useQuery({
    queryKey: requiredDiffKey,
    queryFn: ({ signal }) =>
      getApprovalFormWorkspaceDiff(
        formId!,
        requiredFromId!,
        draft!.formVersionId,
        requestScope.contextScopeKey,
        signal
      ),
    enabled:
      readEnabled &&
      Boolean(requiredFromId && draft) &&
      approvalFormWorkspaceRouteInstalled('form-version-diff.data'),
    retry: false,
    staleTime: 30_000,
  });
  const reviewKey = [...baseKey, 'review'] as const;
  const reviewQuery = useQuery({
    queryKey: reviewKey,
    queryFn: ({ signal }) =>
      getApprovalFormWorkspacePublishReview(formId!, requestScope.contextScopeKey, signal),
    enabled:
      readEnabled &&
      Boolean(reviewOriginal) &&
      canPublish &&
      approvalFormWorkspaceRouteInstalled('form-publish-review.data'),
    retry: false,
    staleTime: 0,
  });
  const sourceValidation = useApprovalFormSchemaValidation(
    draft && isApprovalTypedFormSchema(draft.schema) ? draft.schema : undefined,
    readEnabled
  );
  const versionValidation = useApprovalFormSchemaValidation(
    version.data && isApprovalTypedFormSchema(version.data.schema)
      ? version.data.schema
      : undefined,
    readEnabled
  );
  const versionVerified =
    !version.data ||
    !isApprovalTypedFormSchema(version.data.schema) ||
    versionValidation.compiled?.schemaSha256 === version.data.schemaSha256;
  const sourceVerified =
    !draft ||
    !isApprovalTypedFormSchema(draft.schema) ||
    sourceValidation.compiled?.schemaSha256 === draft.schemaSha256;
  const dispatchUpdate = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.form-working-draft-update.action',
    taskKind: 'ADMINISTRATION',
  });
  const dispatchBranch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.form-version-branch.action',
    taskKind: 'ADMINISTRATION',
  });
  const dispatchRetire = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.form-retire.action',
    taskKind: 'ADMINISTRATION',
  });
  const dispatchReinstate = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.form-reinstate.action',
    taskKind: 'ADMINISTRATION',
  });
  const dispatchRejectReview = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.form-publish-review-reject.action',
    taskKind: 'ADMINISTRATION',
  });
  const live = useRef({
    formId,
    scopeReady,
    parentReady,
    canEdit,
    canPublish,
    actorId,
    sourceVerified,
    commandScope,
    parentQueryKeys,
    authority,
  });
  live.current = {
    formId,
    scopeReady,
    parentReady,
    canEdit,
    canPublish,
    actorId,
    sourceVerified,
    commandScope,
    parentQueryKeys,
    authority,
  };
  const serverNow = useCallback(
    () =>
      live.current.authority.snapshot
        ? productSurfaceServerNow(live.current.authority.snapshot)
        : Date.now(),
    []
  );
  const cacheReady = (key: QueryKey) => {
    const state = client.getQueryState(key);
    return Boolean(
      state &&
      state.data !== undefined &&
      state.status === 'success' &&
      state.error == null &&
      state.fetchStatus === 'idle' &&
      state.fetchFailureCount === 0 &&
      state.fetchFailureReason == null
    );
  };
  const captureParents = (): LowCommand['parents'] =>
    live.current.parentQueryKeys.map((key) => {
      if (!cacheReady(key)) throw new ProductSurfaceOperationCancelledError();
      return { key, fingerprint: JSON.stringify(client.getQueryData(key)) };
    });
  const originalCurrent = (
    original: ApprovalFormWorkspacePins | null,
    parents: LowCommand['parents']
  ) => {
    return (
      mounted.current &&
      original?.workspace.formId === live.current.formId &&
      original.selectionEpoch === selection.current.epoch &&
      live.current.scopeReady &&
      live.current.parentReady &&
      live.current.sourceVerified &&
      cacheReady(workspaceKey) &&
      approvalFormWorkspacePinsMatch(
        original,
        client.getQueryData<ApprovalFormWorkspace>(workspaceKey),
        live.current.commandScope.binding,
        live.current.actorId
      ) &&
      parents.every(
        (entry) =>
          cacheReady(entry.key) &&
          JSON.stringify(client.getQueryData(entry.key)) === entry.fingerprint
      )
    );
  };
  const capture = () => {
    if (!live.current.canEdit || !cacheReady(workspaceKey) || !live.current.sourceVerified)
      throw new ProductSurfaceOperationCancelledError();
    return captureApprovalFormWorkspace(
      client.getQueryData<ApprovalFormWorkspace>(workspaceKey)!,
      commandScope.binding,
      actorId,
      selection.current.epoch
    );
  };
  const assertLow = (command: LowCommand) => {
    const leaf =
      command.kind === 'UPDATE'
        ? 'form-working-draft-update.action'
        : command.kind === 'BRANCH'
          ? 'form-version-branch.action'
          : command.kind === 'RETIRE'
            ? 'form-retire.action'
            : 'form-reinstate.action';
    if (
      !approvalFormWorkspaceRouteInstalled(leaf) ||
      !live.current.canEdit ||
      !originalCurrent(command.original, command.parents)
    )
      throw new ProductSurfaceOperationCancelledError();
    if (
      command.kind === 'BRANCH' &&
      (!cacheReady(versionKey) ||
        JSON.stringify(client.getQueryData(versionKey)) !== command.sourceVersionFingerprint)
    )
      throw new ProductSurfaceOperationCancelledError();
  };
  const resultCurrent = (original: ApprovalFormWorkspacePins) =>
    mounted.current &&
    commandScope.isCurrent(original) &&
    original.workspace.formId === live.current.formId &&
    original.selectionEpoch === selection.current.epoch;
  const afterChanged = async (
    value: ApprovalFormWorkspace,
    original: ApprovalFormWorkspacePins
  ) => {
    if (!resultCurrent(original)) return;
    pending.current = null;
    setFeedback(null);
    setBranchOriginal(null);
    setAvailabilityOriginal(null);
    setEditorOriginal(null);
    await onChanged(value.formId);
    if (!resultCurrent(original)) return;
    await client.invalidateQueries({ queryKey: baseKey });
  };
  const mutation = useMutation({
    mutationFn: async (command: LowCommand) => {
      assertLow(command);
      pending.current = command;
      let dispatchChecks = 0;
      const options = {
        idempotencyKey: command.key,
        beforeDispatch: () => {
          assertLow(command);
          // The shared transport checks once before CSRF and once before send.
          if (++dispatchChecks === 2) dispatched.current.add(command.key);
        },
      };
      if (command.kind === 'UPDATE') {
        if (!('draftFormVersionId' in command.input))
          throw new ProductSurfaceOperationCancelledError();
        const body = command.input;
        return dispatchUpdate((execution) => {
          assertLow(command);
          return updateApprovalFormWorkingDraft(
            command.original.workspace.formId,
            body,
            execution,
            options
          );
        });
      }
      if (command.kind === 'BRANCH')
        return dispatchBranch((execution) => {
          assertLow(command);
          return branchApprovalFormWorkspaceVersion(
            command.original.workspace.formId,
            command.sourceVersionId!,
            command.input,
            execution,
            options
          );
        });
      if (command.kind === 'RETIRE')
        return dispatchRetire((execution) => {
          assertLow(command);
          return retireApprovalFormWorkspace(
            command.original.workspace.formId,
            command.input,
            execution,
            options
          );
        });
      return dispatchReinstate((execution) => {
        assertLow(command);
        return reinstateApprovalFormWorkspace(
          command.original.workspace.formId,
          command.input,
          execution,
          options
        );
      });
    },
    onSuccess: async (value, command) => {
      if (resultCurrent(command.original))
        toast.success(
          t(
            command.kind === 'UPDATE'
              ? 'admin.formWorkspace.saved'
              : command.kind === 'BRANCH'
                ? 'admin.formWorkspace.branched'
                : 'admin.formWorkspace.availabilityUpdated'
          )
        );
      uncertainCommands.current.delete(command.key);
      await afterChanged(value, command.original);
    },
    onError: (error, command) => {
      if (!resultCurrent(command.original)) return;
      const uncertain =
        uncertainCommands.current.has(command.key) ||
        (dispatched.current.has(command.key) &&
          (error instanceof ApprovalFormWorkspaceResponseError ||
            error instanceof HttpTransportError ||
            (error instanceof HttpError && error.status >= 500)));
      if (uncertain) uncertainCommands.current.add(command.key);
      if (!uncertain) pending.current = null;
      setFeedback(uncertain ? 'UNKNOWN' : 'CHANGED');
    },
    onSettled: (_value, _error, command) => {
      if (activeLowKey.current === command.key) activeLowKey.current = null;
    },
  });
  const submitLow = (command: LowCommand) => {
    if (activeLowKey.current) return;
    activeLowKey.current = command.key;
    mutation.mutate(command);
  };
  const assertReview = (attempt: ReviewSourceAttempt) => {
    const currentReview = client.getQueryData<ApprovalFormWorkspaceReview>(reviewKey);
    const currentHistory =
      client.getQueryData<Awaited<ReturnType<typeof getApprovalFormWorkspaceHistory>>>(historyKey);
    const currentDiff =
      client.getQueryData<Awaited<ReturnType<typeof getApprovalFormWorkspaceDiff>>>(
        requiredDiffKey
      );
    const visibleDiff =
      client.getQueryData<Awaited<ReturnType<typeof getApprovalFormWorkspaceDiff>>>(diffKey);
    if (
      !approvalFormWorkspaceRouteInstalled('form-reviewed-publish.action') ||
      !live.current.canPublish ||
      !originalCurrent(attempt.original, attempt.parents) ||
      !cacheReady(reviewKey) ||
      !cacheReady(historyKey) ||
      !cacheReady(requiredDiffKey) ||
      !cacheReady(diffKey) ||
      !approvalFormWorkspaceReviewSourcesMatch(
        attempt.original,
        attempt.review,
        currentHistory,
        currentDiff,
        visibleDiff,
        selectedVersionId
      ) ||
      !attempt.comparisons.every(
        (entry) =>
          cacheReady(entry.key) &&
          JSON.stringify(client.getQueryData(entry.key)) === entry.fingerprint
      ) ||
      JSON.stringify(currentReview) !== JSON.stringify(attempt.review) ||
      !approvalFormWorkspaceReviewMatches(attempt.review, attempt.original, serverNow())
    )
      throw new ProductSurfaceOperationCancelledError();
  };
  const highRisk = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'FORM_REVIEWED_PUBLISH',
    execute: (command, execution) => {
      const attempt = reviewAttempt.current;
      if (
        !attempt ||
        execution.mode !== 'SECURE' ||
        command.targetId !== attempt.original.workspace.formId ||
        command.expectedObjectVersion !== attempt.input.expectedFormRevision ||
        JSON.stringify(command.payload) !== JSON.stringify(attempt.input)
      )
        throw new ProductSurfaceOperationCancelledError();
      assertReview(attempt);
      return publishReviewedApprovalFormWorkspace(command.targetId, attempt.input, execution, {
        idempotencyKey: execution.idempotencyKey ?? attempt.key,
        beforeDispatch: () => assertReview(attempt),
      });
    },
    onSuccess: async (value, _command, binding) => {
      if (
        commandScope.isCurrent(binding) &&
        reviewAttempt.current &&
        resultCurrent(reviewAttempt.current.original)
      ) {
        toast.success(t('admin.studio.formPublished'));
        reviewAttempt.current = null;
        setReviewOriginal(null);
        setReview(null);
        await onChanged(value.formId);
        await client.invalidateQueries({ queryKey: baseKey });
      }
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (attempt: RejectAttempt) => {
      assertReview(attempt);
      let dispatchChecks = 0;
      return dispatchRejectReview((execution) =>
        rejectApprovalFormPublishReview(
          attempt.original.workspace.formId,
          attempt.review.reviewRequest.reviewRequestId,
          attempt.input,
          execution,
          {
            idempotencyKey: attempt.key,
            beforeDispatch: () => {
              assertReview(attempt);
              if (++dispatchChecks === 2) dispatched.current.add(attempt.key);
            },
          }
        )
      );
    },
    onSuccess: async (_value, attempt) => {
      if (!resultCurrent(attempt.original)) return;
      uncertainCommands.current.delete(attempt.key);
      rejectAttempt.current = null;
      setFeedback(null);
      setReviewOriginal(null);
      setReview(null);
      toast.success(t('admin.formWorkspace.reviewRejected'));
      await onChanged(attempt.original.workspace.formId);
      if (resultCurrent(attempt.original)) await client.invalidateQueries({ queryKey: baseKey });
    },
    onError: (error, attempt) => {
      if (!resultCurrent(attempt.original)) return;
      const uncertain =
        uncertainCommands.current.has(attempt.key) ||
        (dispatched.current.has(attempt.key) &&
          (error instanceof ApprovalFormWorkspaceResponseError ||
            error instanceof HttpTransportError ||
            (error instanceof HttpError && error.status >= 500)));
      if (uncertain) uncertainCommands.current.add(attempt.key);
      else rejectAttempt.current = null;
      setFeedback(uncertain ? 'UNKNOWN' : 'CHANGED');
    },
  });
  const liveHighClose = useRef(highRisk.controller.close);
  liveHighClose.current = highRisk.controller.close;
  useEffect(() => {
    if (reviewOriginal && !review && reviewQuery.data)
      setReview(captureApprovalFormWorkspaceReview(reviewQuery.data));
  }, [reviewOriginal, review, reviewQuery.data]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNow()), 1000);
    return () => window.clearInterval(timer);
  }, [serverNow]);
  const reset = useCallback(() => {
    setSelectedVersionId(null);
    setBranchOriginal(null);
    setAvailabilityOriginal(null);
    setEditorOriginal(null);
    setReviewOriginal(null);
    setReview(null);
    setFeedback(null);
    pending.current = null;
    activeLowKey.current = null;
    reviewAttempt.current = null;
    rejectAttempt.current = null;
    editorParents.current = [];
    reviewParents.current = [];
    dispatched.current.clear();
    uncertainCommands.current.clear();
    liveHighClose.current();
  }, []);
  useApprovalManagementScopeReset(requestScope.cacheKey, reset);
  const previousForm = useRef(formId);
  useEffect(() => {
    if (previousForm.current !== formId) {
      previousForm.current = formId;
      reset();
    }
  }, [formId, reset]);
  const ready =
    scopeReady &&
    parentReady &&
    approvalFormWorkspaceReadState(workspace) === 'READY' &&
    sourceVerified &&
    installed &&
    feedback !== 'CHANGED';
  const state = !scopeReady
    ? 'DENIED'
    : !installed
      ? 'UNAVAILABLE'
      : approvalFormWorkspaceReadState(workspace);
  const captureLow = (kind: LowCommand['kind']): LowCommand => {
    const original = capture();
    return {
      kind,
      original,
      key: crypto.randomUUID(),
      input: {
        expectedFormRevision: original.workspace.formRevision,
        expectedWorkspaceRevision: original.workspace.workspaceRevision,
      },
      sourceVersionId: null,
      sourceVersionFingerprint: null,
      sourceVersion: null,
      parents: captureParents(),
    };
  };
  return {
    installed,
    workspace,
    history,
    version,
    diff,
    reviewQuery,
    review,
    state,
    ready,
    sourceValidation,
    selectedVersionId,
    setSelectedVersionId,
    editorOriginal,
    editorCurrent: feedback !== 'CHANGED' && originalCurrent(editorOriginal, editorParents.current),
    feedback,
    busy: mutation.isPending || rejectMutation.isPending,
    unknown: feedback === 'UNKNOWN',
    highRisk,
    branchOriginal,
    availabilityOriginal,
    reviewOriginal,
    historyState: approvalFormWorkspaceReadState(history),
    versionState: approvalFormWorkspaceReadState(version),
    diffState: approvalFormWorkspaceReadState(diff),
    reviewState: approvalFormWorkspaceReadState(reviewQuery),
    branchReady: Boolean(
      ready &&
      canEdit &&
      versionVerified &&
      cacheReady(versionKey) &&
      !pending.current &&
      approvalFormWorkspaceRouteInstalled('form-version-branch.action')
    ),
    updateReady:
      ready &&
      canEdit &&
      approvalFormWorkspaceRouteInstalled('form-working-draft-update.action') &&
      !pending.current,
    reviewReady: Boolean(
      canPublish &&
      reviewOriginal &&
      review &&
      originalCurrent(reviewOriginal, reviewParents.current) &&
      cacheReady(reviewKey) &&
      cacheReady(historyKey) &&
      approvalFormWorkspaceReviewSourcesMatch(
        reviewOriginal,
        review,
        history.data,
        requiredDiff.data,
        diff.data,
        selectedVersionId
      ) &&
      cacheReady(requiredDiffKey) &&
      requiredDiff.data?.complete &&
      cacheReady(diffKey) &&
      diff.data?.complete &&
      approvalFormWorkspaceReviewMatches(review, reviewOriginal, now) &&
      approvalFormWorkspaceRouteInstalled('form-reviewed-publish.action')
    ),
    reviewExpired: Boolean(review && Date.parse(review.authorityValidUntil) <= now),
    openEditor: () => {
      if (!ready || pending.current) return null;
      const original = capture();
      editorParents.current = captureParents();
      setEditorOriginal(original);
      return original;
    },
    save: (input: ApprovalFormWorkingDraftInput) => {
      if (
        feedback === 'CHANGED' ||
        !editorOriginal ||
        !originalCurrent(editorOriginal, editorParents.current) ||
        (pending.current && pending.current.kind !== 'UPDATE')
      )
        return;
      const command = pending.current ?? {
        ...captureLow('UPDATE'),
        original: editorOriginal,
        input: snapshotApprovalFormWorkspace(input),
        parents: editorParents.current,
      };
      submitLow(command);
    },
    openBranch: () => {
      if (!ready || !versionVerified || !version.data || !cacheReady(versionKey) || pending.current)
        return;
      setBranchOriginal({
        ...captureLow('BRANCH'),
        sourceVersionId: version.data.formVersionId,
        sourceVersionFingerprint: JSON.stringify(version.data),
        sourceVersion: snapshotApprovalFormWorkspace(version.data),
      });
    },
    confirmBranch: () => {
      if (branchOriginal) submitLow(pending.current ?? branchOriginal);
    },
    closeBranch: () => {
      if (!mutation.isPending) setBranchOriginal(null);
    },
    branchCurrent: Boolean(
      branchOriginal &&
      originalCurrent(branchOriginal.original, branchOriginal.parents) &&
      cacheReady(versionKey) &&
      JSON.stringify(version.data) === branchOriginal.sourceVersionFingerprint
    ),
    openAvailability: () => {
      if (!ready || pending.current) return;
      setAvailabilityOriginal(
        captureLow(workspace.data?.catalogAvailability === 'RETIRED' ? 'REINSTATE' : 'RETIRE')
      );
    },
    confirmAvailability: () => {
      if (availabilityOriginal) submitLow(pending.current ?? availabilityOriginal);
    },
    closeAvailability: () => {
      if (!mutation.isPending) setAvailabilityOriginal(null);
    },
    availabilityCurrent: Boolean(
      availabilityOriginal &&
      originalCurrent(availabilityOriginal.original, availabilityOriginal.parents) &&
      approvalFormWorkspaceRouteInstalled(
        availabilityOriginal.kind === 'RETIRE' ? 'form-retire.action' : 'form-reinstate.action'
      )
    ),
    openReview: () => {
      if (!ready || !canPublish || !workspace.data?.workingDraft || pending.current) return;
      reviewParents.current = captureParents();
      setReview(null);
      setReviewOriginal(
        captureApprovalFormWorkspace(
          workspace.data,
          commandScope.binding,
          actorId,
          selection.current.epoch
        )
      );
      void client.resetQueries({ queryKey: reviewKey, exact: true });
    },
    closeReview: () => {
      if (rejectMutation.isPending) return;
      setReviewOriginal(null);
      setReview(null);
    },
    confirmReview: (reviewComment: string) => {
      if (!reviewOriginal || !review) return;
      const input = snapshotApprovalFormWorkspace({
        expectedFormRevision: review.formRevision,
        expectedWorkspaceRevision: review.workspaceRevision,
        draftFormVersionId: review.draftFormVersionId,
        basePublishedVersionId: review.basePublishedVersionId,
        schemaSha256: review.schemaSha256,
        reviewContentDigest: review.reviewContentDigest,
        reviewRequestId: review.reviewRequest.reviewRequestId,
        expectedReviewRequestVersion: review.reviewRequest.version,
        reviewComment,
      });
      const comparisons = [historyKey, requiredDiffKey, diffKey].map((key) => ({
        key,
        fingerprint: JSON.stringify(client.getQueryData(key)),
      }));
      const attempt = {
        original: reviewOriginal,
        parents: reviewParents.current,
        review,
        input,
        key: crypto.randomUUID(),
        comparisons,
      };
      try {
        assertReview(attempt);
      } catch {
        setFeedback('CHANGED');
        return;
      }
      reviewAttempt.current = attempt;
      setReviewOriginal(null);
      void highRisk.begin(approvalFormReviewedPublishCommand(review.formId, input, attempt.key));
    },
    rejectReview: (reason: string) => {
      if (!reviewOriginal || !review || rejectMutation.isPending || rejectAttempt.current) return;
      const comparisons = [historyKey, requiredDiffKey, diffKey].map((key) => ({
        key,
        fingerprint: JSON.stringify(client.getQueryData(key)),
      }));
      const attempt: RejectAttempt = {
        original: reviewOriginal,
        parents: reviewParents.current,
        review,
        input: {
          expectedFormRevision: review.formRevision,
          expectedWorkspaceRevision: review.workspaceRevision,
          expectedReviewRequestVersion: review.reviewRequest.version,
          reason,
        },
        key: crypto.randomUUID(),
        comparisons,
      };
      try {
        assertReview(attempt);
      } catch {
        setFeedback('CHANGED');
        return;
      }
      rejectAttempt.current = attempt;
      rejectMutation.mutate(attempt);
    },
    reload: async () => {
      if (!readEnabled) return;
      const reloaded = await workspace.refetch();
      await history.refetch();
      if (selectedVersionId) await version.refetch();
      if (draft && fromId) await diff.refetch();
      if (draft && requiredFromId && requiredFromId !== fromId) await requiredDiff.refetch();
      if (reviewOriginal) await reviewQuery.refetch();
      if (
        !reloaded.error &&
        cacheReady(workspaceKey) &&
        live.current.parentQueryKeys.every(cacheReady)
      ) {
        setFeedback((current) => (current === 'CHANGED' ? null : current));
      }
    },
    retryOriginal: () => {
      if (pending.current) submitLow(pending.current);
      else if (rejectAttempt.current && !rejectMutation.isPending)
        rejectMutation.mutate(rejectAttempt.current);
    },
  };
}
