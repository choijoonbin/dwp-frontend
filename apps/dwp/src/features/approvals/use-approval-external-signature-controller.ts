import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HttpError,
  HttpTransportError,
  productSurfaceServerNow,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import {
  ApprovalExternalSignatureResponseError,
  cancelApprovalExternalSignatureRequest,
  createApprovalExternalSignatureRequest,
  getApprovalExternalSignatureArtifact,
  getApprovalExternalSignatureAudit,
  getApprovalExternalSignatureContext,
  getApprovalExternalSignatureRequest,
  handoverApprovalExternalSignatureRequest,
  refreshApprovalExternalSignatureRequest,
  type ApprovalExternalSignaturePinnedAuthority,
} from '@dwp-frontend/shared-utils/api/approval-external-signature-api';
import {
  snapshotApprovalExternalSignatureCommandInput,
  snapshotApprovalExternalSignatureCreateInput,
  type ApprovalExternalSignatureCommandInput,
  type ApprovalExternalSignatureContext,
  type ApprovalExternalSignatureReceipt,
  type ApprovalExternalSignatureRequest,
} from '@dwp-frontend/shared-utils/api/approval-external-signature-contract';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import {
  hasWritableProductSurfaceCapability,
  resolveCanonicalProductSurfaceContext,
} from '../../components/product-surface-capability-access';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useProductSurfaceGovernedMutation } from '../../components/use-product-surface-governed-mutation';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { useApprovalHighRiskCommand } from './use-approval-high-risk-command';
import { approvalExternalSignatureHandoverCommand } from './approval-signature-command';
import {
  approvalExternalSignatureCanCancel,
  approvalExternalSignatureCanHandover,
  approvalExternalSignatureCanRefresh,
  approvalExternalSignatureContextCurrent,
  approvalExternalSignatureContextFingerprint,
  approvalExternalSignatureProviderTarget,
  approvalExternalSignatureRequestCurrent,
  approvalExternalSignatureRequestFingerprint,
  approvalExternalSignatureSessionKey,
  readApprovalExternalSignatureSessionId,
} from './approval-external-signature-model';
import {
  approvalExternalSignatureReadRoutesInstalled,
  approvalSignatureNativeRouteInstalled,
} from './approval-signature-native-routes';

type Props = Readonly<{
  requestId: string;
  requestVersion?: number;
  approved: boolean;
  isOwnerCurrent: () => boolean;
  ownerError?: unknown;
}>;
type Original = Readonly<{
  identity: string;
  incarnation: string;
  context: ApprovalExternalSignatureContext;
  contextFingerprint: string;
  request: ApprovalExternalSignatureRequest | null;
  requestFingerprint: string | null;
}>;
type LowAttempt = Readonly<{
  operation: 'CREATE' | 'REFRESH' | 'CANCEL';
  original: Original;
  idempotencyKey: string;
  input: ReturnType<
    | typeof snapshotApprovalExternalSignatureCreateInput
    | typeof snapshotApprovalExternalSignatureCommandInput
  >;
}>;
type HandoverAttempt = Readonly<{
  original: Original;
  input: ApprovalExternalSignatureCommandInput;
}>;

class ExternalSignatureUncertainError extends Error {}

export function useApprovalExternalSignatureController(props: Props) {
  const scope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const authority = useProductSurfaceAuthority();
  const decision = useOptionalAllowedProductSurface();
  const client = useQueryClient();
  const [signatureRequestId, setSignatureRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'CHANGED' | 'FAILED' | 'UNKNOWN' | null>(null);
  const [unknown, setUnknown] = useState<{ operation: string; idempotencyKey: string } | null>(
    null
  );
  const [showAudit, setShowAudit] = useState(false);
  const [artifactInput, setArtifactInput] = useState('');
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deniedIdentity, setDeniedIdentity] = useState<string | null>(null);
  const mounted = useRef(false);
  const lock = useRef(false);
  const handoverAttempt = useRef<HandoverAttempt | null>(null);
  const readInstalled = approvalExternalSignatureReadRoutesInstalled();
  const entry = resolveCanonicalProductSurfaceContext(decision, authority.snapshot);
  const serverNow = () =>
    authority.snapshot ? productSurfaceServerNow(authority.snapshot) : Date.now();
  const readGrants = entry?.effectiveGrants.filter(
    (grant) =>
      grant.grantKind === 'CAPABILITY' &&
      grant.capabilityContractKey === 'approvals.work.signature.read' &&
      grant.activationState === 'ACTIVE' &&
      grant.scopeKeys.includes(scope.contextScopeKey ?? '') &&
      (!grant.validUntil || Date.parse(grant.validUntil) > serverNow())
  );
  const readResourceSetKey =
    readGrants?.length === 1 && readGrants[0]?.grantKind === 'CAPABILITY'
      ? readGrants[0].responsibility?.resourceSetKey
      : undefined;
  const scopeReady =
    scope.governed &&
    scope.ready &&
    Boolean(entry && readResourceSetKey && scope.contextScopeKey) &&
    /^psr-[a-f0-9]{64}$/.test(scope.queryMeta.decisionRevision);
  const identity = JSON.stringify([scope.cacheKey, props.requestId, props.requestVersion ?? null]);
  const sessionKey = scope.contextScopeKey
    ? approvalExternalSignatureSessionKey(scope.cacheKey[1], scope.contextScopeKey, props.requestId)
    : null;
  const incarnationRef = useRef({ identity: '', value: '' });
  if (incarnationRef.current.identity !== identity) {
    incarnationRef.current = { identity, value: crypto.randomUUID() };
  }
  const contextKey = [
    'approvals',
    'external-signature-context',
    ...scope.cacheKey,
    props.requestId,
  ];
  const requestKey = [
    'approvals',
    'external-signature-request',
    ...scope.cacheKey,
    signatureRequestId ?? '',
  ];
  const current = useRef({
    identity,
    incarnation: incarnationRef.current.value,
    scope,
    scopeReady,
    decision,
    snapshot: authority.snapshot,
    props,
    contextKey,
    requestKey,
    readInstalled,
    readResourceSetKey,
  });
  current.current = {
    identity,
    incarnation: incarnationRef.current.value,
    scope,
    scopeReady,
    decision,
    snapshot: authority.snapshot,
    props,
    contextKey,
    requestKey,
    readInstalled,
    readResourceSetKey,
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setFeedback(null);
    setUnknown(null);
    setShowAudit(false);
    setArtifactInput('');
    setArtifactId(null);
    setCancelOpen(false);
    setDeniedIdentity(null);
    lock.current = false;
    handoverAttempt.current = null;
    if (typeof window === 'undefined' || !sessionKey) {
      setSignatureRequestId(null);
      return;
    }
    setSignatureRequestId(
      readApprovalExternalSignatureSessionId(window.sessionStorage.getItem(sessionKey))
    );
  }, [identity, sessionKey]);

  const assertBase = (
    expectedIdentity = identity,
    expectedIncarnation = incarnationRef.current.value
  ) => {
    const latest = current.current;
    if (
      !mounted.current ||
      latest.identity !== expectedIdentity ||
      latest.incarnation !== expectedIncarnation ||
      !latest.scopeReady ||
      !latest.readInstalled ||
      !latest.readResourceSetKey ||
      !latest.props.approved ||
      !latest.props.isOwnerCurrent() ||
      latest.props.ownerError ||
      deniedIdentity === latest.identity ||
      !resolveCanonicalProductSurfaceContext(latest.decision, latest.snapshot)
    )
      throw new ProductSurfaceOperationCancelledError();
  };
  const readOptions = () => ({
    contextScopeKey: scope.contextScopeKey!,
    expectedDecisionRevision: scope.queryMeta.decisionRevision,
    beforeDispatch: () => assertBase(),
  });
  const context = useQuery({
    queryKey: contextKey,
    queryFn: ({ signal }) =>
      getApprovalExternalSignatureContext(props.requestId, readOptions(), signal),
    enabled:
      readInstalled &&
      scopeReady &&
      props.approved &&
      props.requestVersion !== undefined &&
      deniedIdentity !== identity,
    staleTime: 15_000,
    retry: false,
    meta: scope.queryMeta,
  });
  const pinnedAuthority = (
    original: Pick<Original, 'context' | 'identity' | 'incarnation'>,
    beforeDispatch: () => void
  ): ApprovalExternalSignaturePinnedAuthority => ({
    contextScopeKey: original.context.scope.contextScopeKey,
    expectedDecisionRevision: original.context.scope.decisionRevision,
    resourceSetKey: original.context.source.resourceSetKey,
    requestId: original.context.source.requestId,
    requestVersion: original.context.source.requestVersion,
    sourceRevision: original.context.scope.sourceRevision,
    sourceSha256: original.context.scope.sourceSha256,
    beforeDispatch,
  });
  const request = useQuery({
    queryKey: requestKey,
    queryFn: ({ signal }) => {
      const owner = client.getQueryData<ApprovalExternalSignatureContext>(contextKey);
      if (!owner) throw new ProductSurfaceOperationCancelledError();
      const binding = { context: owner, identity, incarnation: incarnationRef.current.value };
      return getApprovalExternalSignatureRequest(
        signatureRequestId!,
        pinnedAuthority(binding, () => assertBase(binding.identity, binding.incarnation)),
        signal
      );
    },
    enabled:
      context.isSuccess &&
      !context.isFetching &&
      Boolean(signatureRequestId) &&
      approvalSignatureNativeRouteInstalled('external-signature-request.data'),
    staleTime: 15_000,
    retry: false,
    meta: scope.queryMeta,
  });
  const audit = useQuery({
    queryKey: [
      'approvals',
      'external-signature-audit',
      ...scope.cacheKey,
      signatureRequestId ?? '',
    ],
    queryFn: ({ signal }) => {
      const original = capture();
      if (!original?.request) throw new ProductSurfaceOperationCancelledError();
      return getApprovalExternalSignatureAudit(
        original.request.signatureRequestId,
        pinnedAuthority(original, () => assertOriginal(original, 'READ')),
        signal
      );
    },
    enabled:
      Boolean(signatureRequestId) &&
      showAudit &&
      request.isSuccess &&
      approvalSignatureNativeRouteInstalled('external-signature-audit.data'),
    staleTime: 0,
    retry: false,
    meta: scope.queryMeta,
  });
  const artifact = useQuery({
    queryKey: [
      'approvals',
      'external-signature-artifact',
      ...scope.cacheKey,
      signatureRequestId ?? '',
      artifactId ?? '',
    ],
    queryFn: ({ signal }) => {
      const original = capture();
      if (!original?.request || !artifactId) throw new ProductSurfaceOperationCancelledError();
      return getApprovalExternalSignatureArtifact(
        original.request.signatureRequestId,
        artifactId,
        pinnedAuthority(original, () => assertOriginal(original, 'READ')),
        signal
      );
    },
    enabled:
      Boolean(signatureRequestId && artifactId) &&
      request.isSuccess &&
      approvalSignatureNativeRouteInstalled('external-signature-artifact.data'),
    staleTime: 0,
    retry: false,
    meta: scope.queryMeta,
  });

  const fresh = (key: readonly unknown[]) => {
    const state = client.getQueryState(key);
    return (
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      state.error == null &&
      state.fetchFailureCount === 0
    );
  };
  const capture = (): Original | null => {
    const latestContext = client.getQueryData<ApprovalExternalSignatureContext>(contextKey);
    const latestRequest = signatureRequestId
      ? (client.getQueryData<ApprovalExternalSignatureRequest>(requestKey) ?? null)
      : null;
    const now = current.current.snapshot
      ? productSurfaceServerNow(current.current.snapshot)
      : Date.now();
    return latestContext &&
      fresh(contextKey) &&
      (!signatureRequestId || (latestRequest && fresh(requestKey))) &&
      props.requestVersion !== undefined &&
      approvalExternalSignatureContextCurrent(
        latestContext,
        props.requestId,
        props.requestVersion,
        current.current.readResourceSetKey!,
        now
      ) &&
      (!latestRequest || approvalExternalSignatureRequestCurrent(latestRequest, latestContext))
      ? Object.freeze({
          identity,
          incarnation: incarnationRef.current.value,
          context: latestContext,
          contextFingerprint: approvalExternalSignatureContextFingerprint(latestContext),
          request: latestRequest,
          requestFingerprint: latestRequest
            ? approvalExternalSignatureRequestFingerprint(latestRequest)
            : null,
        })
      : null;
  };
  const matches = (original: Original) => {
    const latest = capture();
    return Boolean(
      latest &&
      latest.identity === original.identity &&
      latest.incarnation === original.incarnation &&
      latest.contextFingerprint === original.contextFingerprint &&
      latest.requestFingerprint === original.requestFingerprint
    );
  };
  const hasRight = (
    capability: 'approvals.work.signature.update' | 'approvals.work.signature.sign'
  ) => {
    const latest = current.current;
    return hasWritableProductSurfaceCapability(
      latest.decision,
      resolveCanonicalProductSurfaceContext(latest.decision, latest.snapshot),
      capability,
      latest.snapshot ? productSurfaceServerNow(latest.snapshot) : Date.now()
    );
  };
  const assertOriginal = (
    original: Original,
    capability: 'READ' | 'approvals.work.signature.update' | 'approvals.work.signature.sign'
  ) => {
    assertBase(original.identity, original.incarnation);
    if (!matches(original) || (capability !== 'READ' && !hasRight(capability)))
      throw new ProductSurfaceOperationCancelledError();
  };

  const createDispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
    routeContractKey: 'route.approvals.work.external-signature-request-create.action',
    taskKind: 'WORK',
  });
  const refreshDispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
    routeContractKey: 'route.approvals.work.external-signature-refresh.action',
    taskKind: 'WORK',
  });
  const cancelDispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
    routeContractKey: 'route.approvals.work.external-signature-cancel.action',
    taskKind: 'WORK',
  });

  const saveSession = (id: string) => {
    setSignatureRequestId(id);
    if (typeof window !== 'undefined' && sessionKey) window.sessionStorage.setItem(sessionKey, id);
  };
  const succeed = (value: ApprovalExternalSignatureReceipt, original: Original) => {
    if (!mounted.current || current.current.identity !== original.identity) return;
    saveSession(value.signatureRequest.signatureRequestId);
    client.setQueryData(
      [
        'approvals',
        'external-signature-request',
        ...scope.cacheKey,
        value.signatureRequest.signatureRequestId,
      ],
      value.signatureRequest
    );
    setFeedback(null);
    setUnknown(null);
    setCancelOpen(false);
  };
  const fail = (
    error: unknown,
    attempt: { original: Original; operation: string; idempotencyKey: string },
    dispatched: boolean
  ) => {
    if (!mounted.current || current.current.identity !== attempt.original.identity) return false;
    const isUnknown =
      dispatched &&
      (error instanceof ApprovalExternalSignatureResponseError ||
        error instanceof HttpTransportError ||
        (error instanceof HttpError && error.status >= 500));
    if (isUnknown) {
      setUnknown({ operation: attempt.operation, idempotencyKey: attempt.idempotencyKey });
      setFeedback('UNKNOWN');
    } else {
      if (error instanceof HttpError && error.status === 403) setDeniedIdentity(identity);
      setFeedback(error instanceof ProductSurfaceOperationCancelledError ? 'CHANGED' : 'FAILED');
    }
    return isUnknown;
  };
  const runLow = async (attempt: LowAttempt) => {
    if (lock.current || unknown) return;
    lock.current = true;
    setBusy(true);
    let checks = 0;
    const before = () => {
      assertOriginal(attempt.original, 'approvals.work.signature.update');
      checks += 1;
    };
    try {
      assertOriginal(attempt.original, 'approvals.work.signature.update');
      const pinned = pinnedAuthority(attempt.original, before);
      const value =
        attempt.operation === 'CREATE'
          ? await createDispatch((execution) =>
              createApprovalExternalSignatureRequest(
                props.requestId,
                attempt.input as ReturnType<typeof snapshotApprovalExternalSignatureCreateInput>,
                execution,
                pinned
              )
            )
          : attempt.operation === 'REFRESH'
            ? await refreshDispatch((execution) =>
                refreshApprovalExternalSignatureRequest(
                  attempt.original.request!.signatureRequestId,
                  attempt.input as ApprovalExternalSignatureCommandInput,
                  execution,
                  pinned
                )
              )
            : await cancelDispatch((execution) =>
                cancelApprovalExternalSignatureRequest(
                  attempt.original.request!.signatureRequestId,
                  attempt.input as ApprovalExternalSignatureCommandInput,
                  execution,
                  pinned
                )
              );
      succeed(value, attempt.original);
    } catch (error) {
      fail(error, attempt, checks >= 2);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const high = useApprovalHighRiskCommand<ApprovalExternalSignatureReceipt>({
    operation: 'EXTERNAL_SIGNATURE_HANDOVER',
    execute: async (command, execution) => {
      const attempt = handoverAttempt.current;
      if (
        !attempt ||
        !attempt.original.request ||
        execution.mode !== 'SECURE' ||
        command.targetId !== attempt.original.request.signatureRequestId ||
        command.expectedObjectVersion !== attempt.input.expectedVersion ||
        command.idempotencyKey !== attempt.input.idempotencyKey ||
        JSON.stringify(command.payload) !== JSON.stringify(attempt.input)
      )
        throw new ProductSurfaceOperationCancelledError();
      let checks = 0;
      const before = () => {
        assertOriginal(attempt.original, 'approvals.work.signature.sign');
        checks += 1;
      };
      try {
        before();
        return await handoverApprovalExternalSignatureRequest(
          attempt.original.request.signatureRequestId,
          attempt.input,
          execution,
          pinnedAuthority(attempt.original, before)
        );
      } catch (error) {
        if (
          fail(
            error,
            {
              original: attempt.original,
              operation: 'HANDOVER',
              idempotencyKey: attempt.input.idempotencyKey,
            },
            checks >= 2
          )
        )
          throw new ExternalSignatureUncertainError();
        throw error;
      }
    },
    onSuccess: (value) => {
      const attempt = handoverAttempt.current;
      if (attempt) succeed(value, attempt.original);
      handoverAttempt.current = null;
    },
    onConflict: () => {
      if (mounted.current) setFeedback('CHANGED');
    },
  });
  useEffect(() => {
    if (unknown && high.controller.open && !high.controller.busy) high.controller.close();
  }, [high.controller, unknown]);

  const providers = useMemo(
    () =>
      (context.data?.providers ?? [])
        .map((provider) => ({
          provider,
          target: approvalExternalSignatureProviderTarget(provider),
        }))
        .filter(
          (
            entry
          ): entry is {
            provider: typeof entry.provider;
            target: NonNullable<typeof entry.target>;
          } => Boolean(entry.target && entry.provider.requiredByPolicy)
        ),
    [context.data?.providers]
  );
  const currentRequest = request.data ?? null;
  const ready = Boolean(capture()) && !busy && !high.controller.open && !unknown;

  return {
    context,
    request,
    audit,
    artifact,
    providers,
    currentRequest,
    signatureRequestId,
    busy,
    feedback,
    unknown,
    showAudit,
    artifactInput,
    artifactId,
    cancelOpen,
    high: high.controller,
    blocked: busy || high.controller.open || Boolean(unknown),
    isBlocked: () => lock.current || high.controller.open || Boolean(unknown),
    canCreate:
      ready &&
      !signatureRequestId &&
      context.data?.gateState === 'ELIGIBLE' &&
      providers.length > 0 &&
      hasRight('approvals.work.signature.update') &&
      approvalSignatureNativeRouteInstalled('external-signature-request-create.action'),
    canHandover:
      ready &&
      Boolean(currentRequest && approvalExternalSignatureCanHandover(currentRequest.state)) &&
      hasRight('approvals.work.signature.sign') &&
      approvalSignatureNativeRouteInstalled('external-signature-handover.action'),
    canRefresh:
      ready &&
      Boolean(currentRequest && approvalExternalSignatureCanRefresh(currentRequest.state)) &&
      hasRight('approvals.work.signature.update') &&
      approvalSignatureNativeRouteInstalled('external-signature-refresh.action'),
    canCancel:
      ready &&
      Boolean(currentRequest && approvalExternalSignatureCanCancel(currentRequest.state)) &&
      hasRight('approvals.work.signature.update') &&
      approvalSignatureNativeRouteInstalled('external-signature-cancel.action'),
    create: (providerId: string) => {
      const original = capture();
      const provider = providers.find((entry) => entry.target.providerId === providerId);
      if (!original || original.request || !provider || lock.current || unknown) return;
      const input = snapshotApprovalExternalSignatureCreateInput({
        expectedRequestVersion: original.context.source.requestVersion,
        expectedSourceRevision: original.context.scope.sourceRevision,
        expectedSourceSha256: original.context.scope.sourceSha256,
        provider: provider.target,
        idempotencyKey: crypto.randomUUID(),
      });
      void runLow({
        operation: 'CREATE',
        original,
        idempotencyKey: input.idempotencyKey,
        input,
      });
    },
    handover: () => {
      const original = capture();
      if (!original?.request || !approvalExternalSignatureCanHandover(original.request.state))
        return;
      const input = snapshotApprovalExternalSignatureCommandInput({
        expectedVersion: original.request.version,
        expectedSourceRevision: original.context.scope.sourceRevision,
        expectedSourceSha256: original.context.scope.sourceSha256,
        idempotencyKey: crypto.randomUUID(),
      });
      handoverAttempt.current = { original, input };
      void high.begin(
        approvalExternalSignatureHandoverCommand(original.request.signatureRequestId, input)
      );
    },
    refreshProvider: () => {
      const original = capture();
      if (!original?.request) return;
      const input = snapshotApprovalExternalSignatureCommandInput({
        expectedVersion: original.request.version,
        expectedSourceRevision: original.context.scope.sourceRevision,
        expectedSourceSha256: original.context.scope.sourceSha256,
        idempotencyKey: crypto.randomUUID(),
      });
      void runLow({
        operation: 'REFRESH',
        original,
        idempotencyKey: input.idempotencyKey,
        input,
      });
    },
    openCancel: () => {
      if (ready) setCancelOpen(true);
    },
    closeCancel: () => {
      if (!busy) setCancelOpen(false);
    },
    cancel: () => {
      const original = capture();
      if (!original?.request) return;
      const input = snapshotApprovalExternalSignatureCommandInput({
        expectedVersion: original.request.version,
        expectedSourceRevision: original.context.scope.sourceRevision,
        expectedSourceSha256: original.context.scope.sourceSha256,
        idempotencyKey: crypto.randomUUID(),
      });
      void runLow({
        operation: 'CANCEL',
        original,
        idempotencyKey: input.idempotencyKey,
        input,
      });
    },
    setShowAudit,
    setArtifactInput,
    loadArtifact: () => {
      const value = readApprovalExternalSignatureSessionId(artifactInput.trim());
      if (value && ready) setArtifactId(value);
    },
    reload: async () => {
      if (unknown?.operation === 'CREATE') return;
      const result = await context.refetch();
      if (signatureRequestId) await request.refetch();
      if (result.isSuccess && mounted.current && !unknown) setFeedback(null);
    },
  };
}

export type ApprovalExternalSignatureControllerProps = Props;
