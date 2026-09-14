import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, RefreshCcw } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  HttpError,
  HttpTransportError,
  productSurfaceServerNow,
  useProductSurfaceAuthority,
  useToast,
} from '@dwp-frontend/shared-utils';
import { initializeApprovalAttachmentPolicy } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-initialize-api';
import { ApprovalAttachmentPolicyResponseError } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import {
  hasWritableProductSurfaceCapability,
  resolveCanonicalProductSurfaceContext,
} from '../../components/product-surface-capability-access';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useProductSurfaceGovernedMutation } from '../../components/use-product-surface-governed-mutation';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalManagementScopeReady } from './approval-management-scope';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import { ApprovalSurface } from './approval-ui';
import type { QueryClient, UseQueryResult } from '@tanstack/react-query';
import type { ApprovalAttachmentPolicy } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';
import type { ApprovalAttachmentPolicyInitializeInput } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-initialize-api';
import type { ApprovalManagementScopeBinding } from './approval-management-command-scope';
import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';

const capability = 'approvals.policy.update';
type AllowedSurfaceDecision = NonNullable<ReturnType<typeof useOptionalAllowedProductSurface>>;
const freshnessMs = 30_000;
type Absence = Readonly<{ error: HttpError; updatedAt: number; updateCount: number }>;
type Identity = Readonly<{ resourceSetKey: string; contextKey: string; fingerprint: string }>;
type Original = ApprovalManagementScopeBinding & Identity;
type Command = Readonly<{
  original: Original;
  input: Readonly<ApprovalAttachmentPolicyInitializeInput>;
}>;
type Attempt = Command & Readonly<{ absence: Absence }>;
type Props = {
  installed: boolean;
  queryKey: readonly string[];
  query: UseQueryResult<ApprovalAttachmentPolicy>;
  onRefresh: () => void;
};

function absence(client: QueryClient, queryKey: readonly string[]): Absence | null {
  const cache = client.getQueryState<ApprovalAttachmentPolicy>(queryKey);
  const error = cache?.error;
  const details = error instanceof HttpError ? error.details : undefined;
  if (
    !cache ||
    cache.data !== undefined ||
    cache.status !== 'error' ||
    cache.fetchStatus !== 'idle' ||
    !(error instanceof HttpError) ||
    error.status !== 404 ||
    !details ||
    typeof details !== 'object' ||
    !('errorCode' in details) ||
    details.errorCode !== 'RESOURCE_NOT_AVAILABLE' ||
    !Number.isFinite(cache.errorUpdatedAt) ||
    cache.errorUpdatedAt <= 0 ||
    Date.now() - cache.errorUpdatedAt < 0 ||
    Date.now() - cache.errorUpdatedAt >= freshnessMs
  )
    return null;
  return Object.freeze({
    error,
    updatedAt: cache.errorUpdatedAt,
    updateCount: cache.errorUpdateCount,
  });
}

function identity(
  decision: AllowedSurfaceDecision | null,
  snapshot: ProductSurfaceAuthoritySnapshot | undefined
): Identity | null {
  const entry = resolveCanonicalProductSurfaceContext(decision, snapshot);
  const now = snapshot ? productSurfaceServerNow(snapshot) : Date.now();
  if (
    !decision ||
    !entry ||
    decision.context.productKey !== 'approvals' ||
    decision.context.surfaceKey !== 'approvals.admin' ||
    !hasWritableProductSurfaceCapability(decision, entry, capability, now)
  )
    return null;
  const grants = entry.effectiveGrants.flatMap((grant) => {
    if (
      grant.grantKind !== 'CAPABILITY' ||
      grant.capabilityContractKey !== capability ||
      grant.readOnly ||
      !['ACTIVE', 'ELIGIBLE'].includes(grant.activationState) ||
      !grant.scopeKeys.includes(decision.scope.key) ||
      grant.responsibilityRequirement !== 'REQUIRED' ||
      !grant.responsibility?.code.trim() ||
      !/^RS_[A-Z0-9_]{1,76}$/u.test(grant.responsibility.resourceSetKey) ||
      (grant.validUntil != null &&
        (!Number.isFinite(Date.parse(grant.validUntil)) || Date.parse(grant.validUntil) <= now))
    )
      return [];
    return [grant];
  });
  const grant = grants.length === 1 ? grants[0] : undefined;
  if (!grant?.responsibility) return null;
  return Object.freeze({
    resourceSetKey: grant.responsibility.resourceSetKey,
    contextKey: entry.contextKey,
    fingerprint: JSON.stringify({
      contextKey: entry.contextKey,
      selectedScope: decision.scope,
      grant,
    }),
  });
}

export function ApprovalAdminAttachmentPolicyInitialize(props: Props) {
  const { t } = useTranslation('approvals');
  const client = useQueryClient();
  const scope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(scope);
  const commandScope = useApprovalManagementCommandScope(scope.cacheKey);
  const experience = useApprovalExperience();
  const decision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  const toast = useToast();
  const [feedback, setFeedback] = useState<'UNKNOWN' | 'CHANGED' | null>(null);
  const [, refreshClock] = useState(0);
  const uncertain = useRef<Command | null>(null);
  const lock = useRef<string | null>(null);
  const mounted = useRef(false);
  const current = useRef({
    props,
    scope,
    scopeReady,
    experience,
    decision,
    snapshot: authority.snapshot,
  });
  current.current = {
    props,
    scope,
    scopeReady,
    experience,
    decision,
    snapshot: authority.snapshot,
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(
      () => refreshClock((value) => value + 1),
      Math.max(0, props.query.errorUpdatedAt + freshnessMs - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [props.query.errorUpdatedAt]);
  const currentIdentity = () => identity(current.current.decision, current.current.snapshot);
  const originalCurrent = (original: Original) => {
    const latest = current.current;
    const owner = currentIdentity();
    return (
      mounted.current &&
      latest.props.installed &&
      latest.scopeReady &&
      latest.experience.canViewPolicies &&
      commandScope.isCurrent(original) &&
      owner?.fingerprint === original.fingerprint &&
      owner.resourceSetKey === original.resourceSetKey &&
      owner.contextKey === original.contextKey
    );
  };
  const assertAttempt = (attempt: Attempt) => {
    const latest = absence(client, current.current.props.queryKey);
    if (
      !originalCurrent(attempt.original) ||
      !latest ||
      latest.error !== attempt.absence.error ||
      latest.updatedAt !== attempt.absence.updatedAt ||
      latest.updateCount !== attempt.absence.updateCount
    )
      throw new ProductSurfaceOperationCancelledError();
  };
  const dispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.attachment-policy-initialize.action',
    taskKind: 'ADMINISTRATION',
  });
  const initialize = useMutation({
    retry: false,
    mutationFn: async (attempt: Attempt) => {
      let checks = 0;
      try {
        assertAttempt(attempt);
        return await dispatch((incomingExecution) => {
          const execution = Object.freeze({
            ...incomingExecution,
            idempotencyKey: attempt.input.idempotencyKey,
          });
          assertAttempt(attempt);
          if (
            execution.mode !== 'SECURE' ||
            execution.contextScopeKey !== current.current.scope.contextScopeKey ||
            execution.contextKey !== attempt.original.contextKey ||
            execution.expectedDecisionRevision !== current.current.scope.cacheKey[5]
          )
            throw new ProductSurfaceOperationCancelledError();
          return initializeApprovalAttachmentPolicy(attempt.input, execution, {
            resourceSetKey: attempt.original.resourceSetKey,
            beforeDispatch: () => {
              assertAttempt(attempt);
              checks += 1;
            },
          });
        });
      } catch (error) {
        if (mounted.current && commandScope.isCurrent(attempt.original)) {
          const unknown =
            checks >= 2 &&
            (error instanceof ApprovalAttachmentPolicyResponseError ||
              error instanceof HttpTransportError ||
              (error instanceof HttpError && error.status >= 500));
          if (unknown)
            uncertain.current = Object.freeze({ original: attempt.original, input: attempt.input });
          setFeedback(unknown || uncertain.current ? 'UNKNOWN' : 'CHANGED');
        }
        throw error;
      }
    },
    onSuccess: async (_value, attempt) => {
      if (!originalCurrent(attempt.original)) return;
      uncertain.current = null;
      setFeedback(null);
      toast.success(t('admin.attachmentPolicy.initialized'));
      // A command receipt proves the write, not that its historical policy projection is still current.
      await client.invalidateQueries({ queryKey: current.current.props.queryKey, exact: true });
    },
    onSettled: (_value, _error, attempt) => {
      if (lock.current === attempt.input.idempotencyKey) lock.current = null;
    },
  });
  const owner = currentIdentity();
  const proof = absence(client, props.queryKey);
  const canInitialize =
    props.installed &&
    scopeReady &&
    experience.canViewPolicies &&
    Boolean(owner && proof) &&
    (!uncertain.current || originalCurrent(uncertain.current.original));
  const start = () => {
    if (!canInitialize || initialize.isPending || lock.current || !owner || !proof) return;
    const command =
      uncertain.current ??
      Object.freeze({
        original: Object.freeze({ ...commandScope.binding, ...owner }),
        input: Object.freeze({
          expectedAbsent: true as const,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
    const attempt = Object.freeze({ ...command, absence: proof });
    lock.current = attempt.input.idempotencyKey;
    initialize.mutate(attempt);
  };
  if (!experience.canViewPolicies || (!proof && !props.query.isPending && !props.query.isFetching))
    return (
      <ErrorState
        title={t('admin.loadError')}
        description={t('admin.attachmentPolicy.sourceUnavailable')}
        retryLabel={t('actions.retry')}
        retrying={props.query.isFetching}
        onRetry={props.onRefresh}
      />
    );
  if (props.query.isPending || props.query.isFetching)
    return (
      <LoadingState label={t('admin.attachmentPolicy.title')} variant="skeleton" size="compact" />
    );
  return (
    <ApprovalSurface
      title={t('admin.attachmentPolicy.title')}
      meta={t('admin.attachmentPolicy.notConfigured')}
      action={
        <ActionIconButton
          label={t('actions.refresh')}
          tooltipDisablePortal
          onClick={props.onRefresh}
          disabled={initialize.isPending}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      }
    >
      <Stack gap={2} sx={{ p: 2, minWidth: 0 }}>
        {owner ? (
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t('admin.document.scope')}
            </Box>
            <Chip size="small" variant="outlined" label={owner.resourceSetKey} />
          </Stack>
        ) : null}
        <InlineFeedback severity="info">
          {t('admin.attachmentPolicy.initializeHelp')}
        </InlineFeedback>
        {feedback ? (
          <InlineFeedback severity="warning">
            {t(
              feedback === 'UNKNOWN'
                ? 'admin.attachmentPolicy.initializeUnknown'
                : 'admin.attachmentPolicy.sourceChanged'
            )}
          </InlineFeedback>
        ) : null}
        <ActionButton
          intent="primary"
          startIcon={feedback === 'UNKNOWN' ? <RefreshCcw size={16} /> : <FilePlus2 size={16} />}
          loading={initialize.isPending}
          disabled={!canInitialize}
          onClick={start}
        >
          {t(
            feedback === 'UNKNOWN'
              ? 'admin.attachmentPolicy.initializeRetry'
              : 'admin.attachmentPolicy.initializeAction'
          )}
        </ActionButton>
      </Stack>
    </ApprovalSurface>
  );
}
