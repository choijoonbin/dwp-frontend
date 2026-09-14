import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorState, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import {
  HttpError,
  HttpTransportError,
  useToast,
  useProductSurfaceAuthority,
  productSurfaceServerNow,
} from '@dwp-frontend/shared-utils';
import {
  ApprovalAttachmentPolicyResponseError,
  getApprovalAttachmentPolicy,
  saveApprovalAttachmentPolicyDraft,
  publishApprovalAttachmentPolicy,
} from '@dwp-frontend/shared-utils/api/approval-attachment-policy-api';
import {
  readApprovalAttachmentPolicy,
  snapshotApprovalAttachmentPolicyDraft,
  snapshotApprovalAttachmentPolicyPublish,
} from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';
import Stack from '@mui/material/Stack';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useProductSurfaceGovernedMutation } from '../../components/use-product-surface-governed-mutation';
import {
  hasWritableProductSurfaceCapability,
  resolveCanonicalProductSurfaceContext,
} from '../../components/product-surface-capability-access';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { approvalAttachmentPolicyPublishCommand } from './approval-high-risk-command-model';
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
} from './approval-management-command-scope';
import { useApprovalManagementScopeReady } from './approval-management-scope';
import { approvalSignatureSourceState } from './approval-signature-source-state';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import {
  ApprovalAdminAttachmentPolicy,
  approvalAttachmentPolicyRulesValid,
} from './approval-admin-attachment-policy';
import { ApprovalAdminAttachmentPolicyReview } from './approval-admin-attachment-policy-review';
import { ApprovalAdminAttachmentPolicyInitialize } from './approval-admin-attachment-policy-initialize';
import type {
  ApprovalAttachmentPolicy,
  ApprovalAttachmentRules,
  ApprovalAttachmentPolicyDraftInput,
  ApprovalAttachmentPolicyPublishInput,
} from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';
import type { ApprovalManagementScopeBinding } from './approval-management-command-scope';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

const base = '/api/approvals/v1/admin/attachments';
export const APPROVAL_ATTACHMENT_POLICY_ROUTES = {
  'attachment-policy.data': ['GET', `${base}/policy`],
  'attachment-policy-initialize.action': ['POST', `${base}/policies`],
  'attachment-policy-draft.action': ['PUT', `${base}/policies/{policyId}/draft`],
  'attachment-policy-publish.action': ['POST', `${base}/policies/{policyId}/publish`],
} as const;
type Leaf = keyof typeof APPROVAL_ATTACHMENT_POLICY_ROUTES;
export function approvalAttachmentPolicyRouteInstalled(
  leaf: Leaf,
  projections: readonly ProductAuthorizationRouteProjection[] = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS
) {
  const [method, path] = APPROVAL_ATTACHMENT_POLICY_ROUTES[leaf];
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
export function approvalAttachmentPolicyFingerprint(policy: ApprovalAttachmentPolicy) {
  return JSON.stringify(readApprovalAttachmentPolicy(policy));
}
type Original = ApprovalManagementScopeBinding &
  Readonly<{
    policy: Readonly<ApprovalAttachmentPolicy>;
    actorId: string;
  }>;
type Draft = Readonly<{
  original: Original;
  input: ApprovalAttachmentPolicyDraftInput;
}>;
type Review = Readonly<{
  original: Original;
  key: string;
  input?: Readonly<ApprovalAttachmentPolicyPublishInput>;
}>;

export function useApprovalAdminAttachmentPolicyController() {
  const { t } = useTranslation('approvals');
  const scope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(scope);
  const commandScope = useApprovalManagementCommandScope(scope.cacheKey);
  const experience = useApprovalExperience();
  const decision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  const client = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [feedback, setFeedback] = useState<'UNKNOWN' | 'CHANGED' | null>(null);
  const lock = useRef<string | null>(null);
  const uncertain = useRef<Draft | null>(null);
  const publication = useRef<Review | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const installed = approvalAttachmentPolicyRouteInstalled('attachment-policy.data');
  const queryKey = ['approvals', 'admin', 'attachment-policy', ...scope.cacheKey] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getApprovalAttachmentPolicy(scope.contextScopeKey, signal),
    enabled: installed && scopeReady && experience.canViewPolicies,
    retry: false,
    staleTime: 30_000,
  });
  const state = approvalSignatureSourceState(query);
  const current = useRef({
    scopeReady,
    experience,
    decision,
    snapshot: authority.snapshot,
    scope,
    queryKey,
    installed,
    state,
  });
  current.current = {
    scopeReady,
    experience,
    decision,
    snapshot: authority.snapshot,
    scope,
    queryKey,
    installed,
    state,
  };
  const latestPolicy = () =>
    client.getQueryData<ApprovalAttachmentPolicy>(current.current.queryKey);
  const ready = () => {
    const latest = current.current;
    const cache = client.getQueryState(latest.queryKey);
    return (
      mounted.current &&
      latest.installed &&
      latest.scopeReady &&
      latest.experience.canViewPolicies &&
      latest.state === 'READY' &&
      cache?.status === 'success' &&
      cache.fetchStatus === 'idle' &&
      cache.error == null &&
      cache.fetchFailureCount === 0 &&
      Boolean(latestPolicy())
    );
  };
  const capture = (): Original | null => {
    const policy = latestPolicy();
    return ready() && policy
      ? Object.freeze({
          ...commandScope.binding,
          actorId: scope.cacheKey[1],
          policy: readApprovalAttachmentPolicy(policy),
        })
      : null;
  };
  const matches = (original: Original | null) => {
    const latest = latestPolicy();
    return Boolean(
      original &&
      latest &&
      ready() &&
      commandScope.isCurrent(original) &&
      original.actorId === current.current.scope.cacheKey[1] &&
      approvalAttachmentPolicyFingerprint(original.policy) ===
        approvalAttachmentPolicyFingerprint(latest)
    );
  };
  const hasRight = (capability: 'approvals.policy.update' | 'approvals.policy.publish') => {
    const latest = current.current;
    return hasWritableProductSurfaceCapability(
      latest.decision,
      resolveCanonicalProductSurfaceContext(latest.decision, latest.snapshot),
      capability,
      latest.snapshot ? productSurfaceServerNow(latest.snapshot) : Date.now()
    );
  };
  const saveInstalled = approvalAttachmentPolicyRouteInstalled('attachment-policy-draft.action');
  const publishInstalled = approvalAttachmentPolicyRouteInstalled(
    'attachment-policy-publish.action'
  );
  const dispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.attachment-policy-draft.action',
    taskKind: 'ADMINISTRATION',
  });
  const assertOriginal = (
    original: Original,
    capability: 'approvals.policy.update' | 'approvals.policy.publish'
  ) => {
    if (!matches(original) || !hasRight(capability))
      throw new ProductSurfaceOperationCancelledError();
  };
  const markError = (error: unknown, wasDispatched: boolean) => {
    const unknown =
      wasDispatched &&
      (error instanceof ApprovalAttachmentPolicyResponseError ||
        error instanceof HttpTransportError ||
        (error instanceof HttpError && error.status >= 500));
    setFeedback(unknown ? 'UNKNOWN' : 'CHANGED');
    return unknown;
  };
  const save = useMutation({
    retry: false,
    mutationFn: async (attempt: Draft) => {
      let checks = 0;
      try {
        if (!saveInstalled) throw new ProductSurfaceOperationCancelledError();
        assertOriginal(attempt.original, 'approvals.policy.update');
        return await dispatch((execution) => {
          assertOriginal(attempt.original, 'approvals.policy.update');
          return saveApprovalAttachmentPolicyDraft(
            attempt.original.policy.policyId,
            attempt.input,
            execution,
            {
              beforeDispatch: () => {
                assertOriginal(attempt.original, 'approvals.policy.update');
                // The transport checks once before CSRF and again immediately before sending.
                checks += 1;
              },
            }
          );
        });
      } catch (error) {
        if (mounted.current && commandScope.isCurrent(attempt.original)) {
          if (markError(error, checks >= 2)) uncertain.current = attempt;
        }
        throw error;
      }
    },
    onSuccess: (value, attempt) => {
      if (!mounted.current || !commandScope.isCurrent(attempt.original)) return;
      client.setQueryData(current.current.queryKey, value);
      setDraft(null);
      setFeedback(null);
      uncertain.current = null;
      toast.success(t('admin.attachmentPolicy.saved'));
    },
    onSettled: (_value, _error, attempt) => {
      if (lock.current === attempt.input.idempotencyKey) lock.current = null;
    },
  });
  const highRisk = useApprovalManagementHighRiskCommand({
    cacheKey: scope.cacheKey,
    operation: 'ATTACHMENT_POLICY_PUBLISH',
    execute: async (command, execution) => {
      const attempt = publication.current;
      if (
        !publishInstalled ||
        !attempt?.input ||
        execution.mode !== 'SECURE' ||
        command.targetId !== attempt.original.policy.policyId ||
        command.expectedObjectVersion !== attempt.original.policy.version ||
        command.idempotencyKey !== attempt.key ||
        JSON.stringify(command.payload) !== JSON.stringify(attempt.input)
      )
        throw new ProductSurfaceOperationCancelledError();
      const assertPublish = () => {
        assertOriginal(attempt.original, 'approvals.policy.publish');
        const policy = latestPolicy();
        if (
          !policy?.pending ||
          !policy.publishEligible ||
          policy.publishReason !== 'ALLOWED' ||
          String(policy.pendingMakerUserId) === current.current.scope.cacheKey[1]
        )
          throw new ProductSurfaceOperationCancelledError();
      };
      assertPublish();
      return publishApprovalAttachmentPolicy(command.targetId, attempt.input, execution, {
        beforeDispatch: assertPublish,
      });
    },
    onSuccess: (value, _command, binding) => {
      if (!mounted.current || !commandScope.isCurrent(binding)) return;
      client.setQueryData(current.current.queryKey, value);
      setReview(null);
      publication.current = null;
      setFeedback(null);
      toast.success(t('admin.attachmentPolicy.published'));
    },
    onConflict: (_command, binding) => {
      if (mounted.current && commandScope.isCurrent(binding)) setFeedback('CHANGED');
    },
  });
  const busy = save.isPending || highRisk.controller.busy;
  const sourceReady = state === 'READY' && scopeReady;
  const canEdit =
    sourceReady && saveInstalled && hasRight('approvals.policy.update') && feedback !== 'CHANGED';
  const checkerEligible = Boolean(
    query.data?.pending &&
    query.data.publishEligible &&
    query.data.publishReason === 'ALLOWED' &&
    String(query.data.pendingMakerUserId) !== scope.cacheKey[1]
  );
  const canPublish =
    sourceReady &&
    publishInstalled &&
    hasRight('approvals.policy.publish') &&
    checkerEligible &&
    feedback === null;
  return {
    query,
    queryKey,
    state,
    installed,
    scopeReady,
    draft,
    review,
    feedback,
    busy,
    canEdit,
    canPublish,
    checkerEligible,
    draftReady: Boolean(draft && matches(draft.original) && canEdit),
    reviewReady: Boolean(review && matches(review.original) && canPublish),
    highRisk: highRisk.controller,
    openEdit: () => {
      if (busy) return;
      if (feedback === 'UNKNOWN') {
        if (uncertain.current && commandScope.isCurrent(uncertain.current.original))
          setDraft(uncertain.current);
        return;
      }
      if (!canEdit) return;
      const original = capture();
      if (!original) return;
      setDraft({
        original,
        input: snapshotApprovalAttachmentPolicyDraft({
          expectedVersion: original.policy.version,
          idempotencyKey: crypto.randomUUID(),
          rules: original.policy.pending ?? original.policy.published,
        }),
      });
      setFeedback(null);
    },
    changeRules: (rules: ApprovalAttachmentRules) => {
      if (!busy && feedback !== 'UNKNOWN')
        setDraft((value) => (value ? { ...value, input: { ...value.input, rules } } : null));
    },
    closeEdit: () => {
      if (!busy) {
        setDraft(null);
        if (feedback !== 'UNKNOWN') {
          uncertain.current = null;
          setFeedback(null);
        }
      }
    },
    saveDraft: () => {
      if (
        !draft ||
        !canEdit ||
        !matches(draft.original) ||
        !approvalAttachmentPolicyRulesValid(draft.input.rules) ||
        lock.current
      )
        return;
      const attempt = uncertain.current ?? {
        ...draft,
        input: snapshotApprovalAttachmentPolicyDraft(draft.input),
      };
      lock.current = attempt.input.idempotencyKey;
      save.mutate(attempt);
    },
    openReview: () => {
      if (!canPublish || busy || feedback === 'UNKNOWN') return;
      const original = capture();
      if (original) {
        setReview({ original, key: crypto.randomUUID() });
        setFeedback(null);
      }
    },
    closeReview: () => {
      if (!busy) setReview(null);
    },
    publish: (comment: string) => {
      if (
        !review ||
        !canPublish ||
        !matches(review.original) ||
        !comment.trim() ||
        comment.trim().length > 1000 ||
        busy
      )
        return;
      const input = snapshotApprovalAttachmentPolicyPublish({
        expectedVersion: review.original.policy.version,
        idempotencyKey: review.key,
        reviewComment: comment.trim(),
      });
      const command = approvalAttachmentPolicyPublishCommand(
        review.original.policy.policyId,
        input
      );
      publication.current = { ...review, input };
      void highRisk.begin(command);
    },
    refresh: async () => {
      const binding = commandScope.binding;
      const result = await query.refetch();
      if (
        mounted.current &&
        commandScope.isCurrent(binding) &&
        result.isSuccess &&
        feedback !== 'UNKNOWN'
      )
        setFeedback(null);
    },
  };
}

export function ApprovalAdminAttachmentPolicyController() {
  const { t } = useTranslation('approvals');
  const controller = useApprovalAdminAttachmentPolicyController();
  if (!controller.installed)
    return <InlineFeedback severity="info">{t('admin.attachmentPolicy.inactive')}</InlineFeedback>;
  if (controller.scopeReady && !controller.query.data)
    return (
      <ApprovalAdminAttachmentPolicyInitialize
        installed={approvalAttachmentPolicyRouteInstalled('attachment-policy-initialize.action')}
        queryKey={controller.queryKey}
        query={controller.query}
        onRefresh={() => void controller.refresh()}
      />
    );
  if (!controller.scopeReady || controller.state === 'DENIED' || controller.state === 'UNAVAILABLE')
    return (
      <ErrorState
        title={t('admin.loadError')}
        description={t('admin.attachmentPolicy.sourceUnavailable')}
        retryLabel={t('actions.retry')}
        retrying={controller.query.isFetching}
        onRetry={() => void controller.refresh()}
      />
    );
  if (controller.state === 'LOADING')
    return (
      <LoadingState label={t('admin.attachmentPolicy.title')} variant="skeleton" size="compact" />
    );
  if (!controller.query.data) return null;
  return (
    <Stack gap={2} minWidth={0}>
      {controller.state === 'STALE' ? (
        <InlineFeedback severity="warning">
          {t('admin.attachmentPolicy.sourceStale')}
        </InlineFeedback>
      ) : null}
      {controller.feedback ? (
        <InlineFeedback severity="warning">
          {t(
            controller.feedback === 'UNKNOWN'
              ? 'admin.attachmentPolicy.commandUnknown'
              : 'admin.attachmentPolicy.sourceChanged'
          )}
        </InlineFeedback>
      ) : null}
      <ApprovalAdminAttachmentPolicy
        policy={controller.query.data}
        draft={controller.draft?.input.rules ?? null}
        draftPolicy={controller.draft?.original.policy ?? null}
        canEdit={controller.canEdit}
        canPublish={controller.canPublish}
        busy={controller.busy}
        refreshing={controller.query.isFetching}
        draftReady={controller.draftReady}
        draftLocked={controller.feedback === 'UNKNOWN'}
        onEdit={controller.openEdit}
        onReview={controller.openReview}
        onRefresh={() => void controller.refresh()}
        onChange={controller.changeRules}
        onSave={controller.saveDraft}
        onClose={controller.closeEdit}
      />
      <ApprovalAdminAttachmentPolicyReview
        policy={controller.review?.original.policy ?? null}
        ready={controller.reviewReady}
        busy={controller.busy}
        onClose={controller.closeReview}
        onSubmit={controller.publish}
      />
      <ApprovalHighRiskCommandDialog controller={controller.highRisk} />
    </Stack>
  );
}
