import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HttpError,
  HttpTransportError,
  productSurfaceServerNow,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ApprovalSignatureResponseError,
  cancelApprovalSignatureRequest,
  consentApprovalSignatureRequest,
  createApprovalSignatureRequest,
  getApprovalSignatureAudit,
  getApprovalSignatureCeremony,
  getApprovalSignatureCommandReceipt,
  getApprovalSignatureContext,
  signApprovalSignatureRequest,
} from '@dwp-frontend/shared-utils/api/approval-signature-api';
import type {
  ApprovalSignatureDispatchOptions,
  ApprovalSignatureReceiptQuery,
} from '@dwp-frontend/shared-utils/api/approval-signature-api';
import type {
  ApprovalSignatureCancelInput,
  ApprovalSignatureCeremony,
  ApprovalSignatureCommandReceipt,
  ApprovalSignatureConsentInput,
  ApprovalSignatureContext,
  ApprovalSignatureCreateInput,
  ApprovalSignatureReceipt,
  ApprovalSignatureSignInput,
} from '@dwp-frontend/shared-utils/api/approval-signature-contract';
import {
  approvalSignatureCanonicalJson,
  approvalSignatureSha256,
} from '@dwp-frontend/shared-utils/api/approval-signature-verification';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import {
  hasWritableProductSurfaceCapability,
  resolveCanonicalProductSurfaceContext,
} from '../../components/product-surface-capability-access';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { useApprovalHighRiskCommand } from './use-approval-high-risk-command';
import { approvalSignatureSignCommand } from './approval-signature-command';
import { useApprovalSignatureMutation } from './approval-signature-mutation';
import {
  approvalSignatureDocumentCurrent,
  approvalSignatureDocumentFingerprint,
  approvalSignatureRouteInstalled,
} from './approval-signature-source-model';
import type { ApprovalSignatureDocument } from './approval-signature-source-model';

type Original = Readonly<{
  identity: string;
  document: ApprovalSignatureDocument;
  fingerprint: string;
  requestVersion: number;
}>;
type LowAttempt = Readonly<{
  original: Original;
  query: ApprovalSignatureReceiptQuery;
}> &
  (
    | Readonly<{ operation: 'CREATE'; input: ApprovalSignatureCreateInput }>
    | Readonly<{ operation: 'CONSENT'; input: ApprovalSignatureConsentInput }>
    | Readonly<{ operation: 'CANCEL'; input: ApprovalSignatureCancelInput }>
  );
type UnknownAttempt = Readonly<{
  original: Original;
  query: ApprovalSignatureReceiptQuery;
  low?: LowAttempt;
}>;

export type ApprovalSignatureControllerProps = Readonly<{
  requestId: string;
  requestVersion?: number;
  approved: boolean;
  isOwnerCurrent: () => boolean;
  ownerError?: unknown;
}>;

export function useApprovalSignatureController(props: ApprovalSignatureControllerProps) {
  const { i18n } = useTranslation('approvals');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const scope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const authority = useProductSurfaceAuthority();
  const decision = useOptionalAllowedProductSurface();
  const client = useQueryClient();
  const [signatureId, setSignatureId] = useState<string>();
  const [accepted, setAccepted] = useState(false);
  const [consentOriginal, setConsentOriginal] = useState<Original | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'CHANGED' | 'FAILED' | 'UNKNOWN' | null>(null);
  const [uncertain, setUncertain] = useState<UnknownAttempt | null>(null);
  const [metadata, setMetadata] = useState<ApprovalSignatureCommandReceipt>();
  const [showAudit, setShowAudit] = useState(false);
  const [deniedIdentity, setDeniedIdentity] = useState<string>();
  const mounted = useRef(false);
  const lock = useRef(false);
  const abort = useRef<AbortController | undefined>(undefined);
  const pending = useRef<UnknownAttempt | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);
  const identity = JSON.stringify([scope.cacheKey, props.requestId, locale]);
  const entry = resolveCanonicalProductSurfaceContext(decision, authority.snapshot);
  const serverNow = () =>
    authority.snapshot ? productSurfaceServerNow(authority.snapshot) : Date.now();
  const readGrant = entry?.effectiveGrants.some(
    (grant) =>
      grant.grantKind === 'CAPABILITY' &&
      grant.capabilityContractKey === 'approvals.work.signature.read' &&
      grant.activationState === 'ACTIVE' &&
      grant.scopeKeys.includes(scope.contextScopeKey ?? '') &&
      (!grant.validUntil || Date.parse(grant.validUntil) > serverNow())
  );
  const scopeReady =
    scope.governed &&
    scope.ready &&
    Boolean(entry && readGrant && scope.contextScopeKey) &&
    /^psr-[a-f0-9]{64}$/.test(scope.queryMeta.decisionRevision);
  const contextKey = ['approvals', 'signature-context', ...scope.cacheKey, props.requestId, locale];
  const ceremonyKey = ['approvals', 'signature-ceremony', ...scope.cacheKey, signatureId];
  const current = useRef({
    scopeReady,
    scope,
    props,
    identity,
    entry,
    decision,
    snapshot: authority.snapshot,
    contextKey,
    ceremonyKey,
  });
  current.current = {
    scopeReady,
    scope,
    props,
    identity,
    entry,
    decision,
    snapshot: authority.snapshot,
    contextKey,
    ceremonyKey,
  };
  const readOptions = () => ({
    contextScopeKey: scope.contextScopeKey!,
    expectedDecisionRevision: scope.queryMeta.decisionRevision,
    beforeDispatch: () => {
      const latest = current.current;
      if (
        !mounted.current ||
        !latest.scopeReady ||
        latest.identity !== identity ||
        !resolveCanonicalProductSurfaceContext(latest.decision, latest.snapshot)
      )
        throw new ProductSurfaceOperationCancelledError();
    },
  });
  const context = useQuery({
    queryKey: contextKey,
    queryFn: ({ signal }) =>
      getApprovalSignatureContext(props.requestId, locale, { ...readOptions(), signal }),
    enabled:
      scopeReady && props.approved && approvalSignatureRouteInstalled('signature-context.data'),
    retry: false,
    staleTime: 0,
    meta: scope.queryMeta,
  });
  const ceremony = useQuery({
    queryKey: ceremonyKey,
    queryFn: ({ signal }) =>
      getApprovalSignatureCeremony(signatureId!, props.requestId, { ...readOptions(), signal }),
    enabled:
      scopeReady &&
      Boolean(signatureId) &&
      approvalSignatureRouteInstalled('signature-request.data'),
    retry: false,
    staleTime: 0,
    meta: scope.queryMeta,
  });
  const audit = useQuery({
    queryKey: ['approvals', 'signature-audit', ...scope.cacheKey, signatureId],
    queryFn: ({ signal }) => getApprovalSignatureAudit(signatureId!, { ...readOptions(), signal }),
    enabled:
      scopeReady &&
      showAudit &&
      Boolean(signatureId) &&
      approvalSignatureRouteInstalled('signature-audit.data'),
    retry: false,
    staleTime: 0,
    meta: scope.queryMeta,
  });
  const fresh = (key: readonly unknown[]) => {
    const cache = client.getQueryState(key);
    return (
      cache?.status === 'success' &&
      cache.fetchStatus === 'idle' &&
      cache.error == null &&
      cache.fetchFailureCount === 0
    );
  };
  const latestDocument = () =>
    signatureId
      ? client.getQueryData<ApprovalSignatureCeremony>(current.current.ceremonyKey)
      : client.getQueryData<ApprovalSignatureContext>(current.current.contextKey);
  const ready = () => {
    const latest = current.current;
    const owner = client.getQueryData<ApprovalSignatureContext>(latest.contextKey);
    const document = latestDocument();
    const now = latest.snapshot ? productSurfaceServerNow(latest.snapshot) : Date.now();
    return Boolean(
      mounted.current &&
      latest.scopeReady &&
      deniedIdentity !== latest.identity &&
      resolveCanonicalProductSurfaceContext(latest.decision, latest.snapshot) &&
      latest.props.approved &&
      latest.props.isOwnerCurrent() &&
      latest.props.requestVersion !== undefined &&
      owner &&
      document &&
      fresh(latest.contextKey) &&
      (!signatureId || fresh(latest.ceremonyKey)) &&
      approvalSignatureDocumentCurrent(
        document,
        owner,
        latest.props.requestId,
        latest.props.requestVersion,
        latest.scope.cacheKey[1],
        now
      )
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
  const matches = (original: Original) => {
    const document = latestDocument();
    return (
      ready() &&
      current.current.identity === original.identity &&
      document &&
      original.requestVersion === current.current.props.requestVersion &&
      approvalSignatureDocumentFingerprint(document) === original.fingerprint
    );
  };
  const assertOriginal = (
    original: Original,
    capability: 'approvals.work.signature.update' | 'approvals.work.signature.sign'
  ) => {
    if (!matches(original) || !hasRight(capability))
      throw new ProductSurfaceOperationCancelledError();
  };
  const capture = (): Original | null => {
    const document = latestDocument();
    return ready() && document && props.requestVersion !== undefined
      ? Object.freeze({
          identity,
          document,
          fingerprint: approvalSignatureDocumentFingerprint(document),
          requestVersion: props.requestVersion,
        })
      : null;
  };
  const options = (
    original: Original,
    capability: 'approvals.work.signature.update' | 'approvals.work.signature.sign'
  ): ApprovalSignatureDispatchOptions => ({
    contextScopeKey: current.current.scope.contextScopeKey!,
    expectedDecisionRevision: current.current.scope.queryMeta.decisionRevision,
    resourceSetKey: original.document.source.resourceSetKey,
    requestId: props.requestId,
    signal: abort.current?.signal,
    beforeDispatch: () => assertOriginal(original, capability),
  });
  const success = (result: ApprovalSignatureReceipt) => {
    if (!mounted.current) return;
    const key = [
      'approvals',
      'signature-ceremony',
      ...current.current.scope.cacheKey,
      result.ceremony.signatureRequestId,
    ];
    client.setQueryData(key, result.ceremony);
    setSignatureId(result.ceremony.signatureRequestId);
    setAccepted(false);
    setConsentOriginal(null);
    setUncertain(null);
    setMetadata(undefined);
    setFeedback(null);
    pending.current = null;
  };
  const failure = (error: unknown, attempt: UnknownAttempt) => {
    if (!mounted.current) return;
    const unknown =
      error instanceof ApprovalSignatureResponseError ||
      error instanceof HttpTransportError ||
      (error instanceof HttpError && error.status >= 500);
    if (unknown) {
      setConsentOriginal(null);
      const query =
        error instanceof ApprovalSignatureResponseError ? error.receiptQuery : attempt.query;
      setUncertain(Object.freeze({ ...attempt, query }));
      setFeedback('UNKNOWN');
    } else {
      if (error instanceof HttpError && error.status === 403) {
        setConsentOriginal(null);
        setDeniedIdentity(current.current.identity);
        void client.invalidateQueries({
          queryKey: current.current.contextKey,
          refetchType: 'none',
        });
      }
      setFeedback(error instanceof ProductSurfaceOperationCancelledError ? 'CHANGED' : 'FAILED');
    }
  };
  const createDispatch = useApprovalSignatureMutation('signature-request-create.action');
  const consentDispatch = useApprovalSignatureMutation('signature-consent.action');
  const cancelDispatch = useApprovalSignatureMutation('signature-cancel.action');
  const refreshOriginal = async (original: Original) => {
    if (!matches(original)) throw new ProductSurfaceOperationCancelledError();
    const result = await context.refetch();
    if (!result.isSuccess) throw new ProductSurfaceOperationCancelledError();
    if ('signatureRequestId' in original.document) {
      const latest = await ceremony.refetch();
      if (!latest.isSuccess) throw new ProductSurfaceOperationCancelledError();
    }
    if (!matches(original)) throw new ProductSurfaceOperationCancelledError();
  };
  const dispatchLow = async (attempt: LowAttempt) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    abort.current = new AbortController();
    pending.current = attempt;
    try {
      assertOriginal(attempt.original, 'approvals.work.signature.update');
      await refreshOriginal(attempt.original);
      const config = () => options(attempt.original, 'approvals.work.signature.update');
      const result =
        attempt.operation === 'CREATE'
          ? await createDispatch.run((execution) =>
              createApprovalSignatureRequest(props.requestId, attempt.input, execution, config())
            )
          : attempt.operation === 'CONSENT'
            ? await consentDispatch.run((execution) =>
                consentApprovalSignatureRequest(signatureId!, attempt.input, execution, config())
              )
            : await cancelDispatch.run((execution) =>
                cancelApprovalSignatureRequest(signatureId!, attempt.input, execution, config())
              );
      assertOriginal(attempt.original, 'approvals.work.signature.update');
      success(result);
    } catch (error) {
      failure(error, { original: attempt.original, query: attempt.query, low: attempt });
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const low = async (operation: 'CREATE' | 'CONSENT' | 'CANCEL') => {
    if (lock.current || uncertain) return;
    const original = operation === 'CONSENT' ? consentOriginal : capture();
    if (!original || !hasRight('approvals.work.signature.update')) {
      setFeedback('CHANGED');
      return;
    }
    const document = original.document;
    const idempotencyKey = crypto.randomUUID();
    const expectedVersion = 'version' in document ? document.version : original.requestVersion;
    const common = { expectedVersion, sourceDigest: document.sourceDigest, idempotencyKey };
    const queryBase = {
      idempotencyKey,
      originalOperation: operation,
      targetId: operation === 'CREATE' ? props.requestId : signatureId!,
    };
    if (operation === 'CREATE' && !('signatureRequestId' in document)) {
      const input = Object.freeze({ ...common, signerKind: 'SELF_ATTESTATION' as const, locale });
      const query = Object.freeze({
        ...queryBase,
        bodySha256: await approvalSignatureSha256(approvalSignatureCanonicalJson(input)),
      });
      await dispatchLow(Object.freeze({ original, operation, input, query }));
    } else if (
      operation === 'CONSENT' &&
      'state' in document &&
      document.state === 'AWAITING_CONSENT' &&
      accepted
    ) {
      const input = Object.freeze({
        ...common,
        termsId: document.terms.termsId,
        termsVersion: document.terms.version,
        termsSha256: document.terms.sha256,
        locale: document.terms.locale,
        accepted: true,
      });
      const query = Object.freeze({
        ...queryBase,
        bodySha256: await approvalSignatureSha256(approvalSignatureCanonicalJson(input)),
      });
      await dispatchLow(Object.freeze({ original, operation, input, query }));
    } else if (
      operation === 'CANCEL' &&
      'state' in document &&
      ['AWAITING_CONSENT', 'CONSENTED'].includes(document.state)
    ) {
      const input = Object.freeze(common);
      const query = Object.freeze({
        ...queryBase,
        bodySha256: await approvalSignatureSha256(approvalSignatureCanonicalJson(input)),
      });
      await dispatchLow(Object.freeze({ original, operation, input, query }));
    }
  };
  const high = useApprovalHighRiskCommand<ApprovalSignatureReceipt>({
    operation: 'SIGNATURE_SIGN',
    execute: async (command, execution) => {
      const attempt = pending.current;
      if (!attempt || attempt.query.originalOperation !== 'SIGN')
        throw new ProductSurfaceOperationCancelledError();
      const document = attempt.original.document;
      if (
        !('signatureRequestId' in document) ||
        !document.consentReceiptId ||
        command.targetId !== document.signatureRequestId ||
        command.idempotencyKey !== attempt.query.idempotencyKey
      )
        throw new ProductSurfaceOperationCancelledError();
      const input: ApprovalSignatureSignInput = Object.freeze({
        expectedVersion: document.version,
        sourceDigest: document.sourceDigest,
        consentReceiptId: document.consentReceiptId,
        idempotencyKey: attempt.query.idempotencyKey,
      });
      assertOriginal(attempt.original, 'approvals.work.signature.sign');
      try {
        await refreshOriginal(attempt.original);
        return await signApprovalSignatureRequest(
          document.signatureRequestId,
          input,
          execution,
          options(attempt.original, 'approvals.work.signature.sign')
        );
      } catch (error) {
        failure(error, attempt);
        throw error;
      }
    },
    onSuccess: success,
    onConflict: () => {
      if (mounted.current) setFeedback('CHANGED');
    },
  });
  const { open: highOpen, busy: highBusy, close: closeHigh } = high.controller;
  useEffect(() => {
    if (uncertain && highOpen && !highBusy) closeHigh();
  }, [uncertain, highOpen, highBusy, closeHigh]);
  const sign = async () => {
    if (lock.current || high.controller.open || uncertain) return;
    const original = capture();
    const document = original?.document;
    if (
      !original ||
      !document ||
      !('signatureRequestId' in document) ||
      document.state !== 'CONSENTED' ||
      !document.consentReceiptId ||
      !hasRight('approvals.work.signature.sign') ||
      !approvalSignatureRouteInstalled('signature-sign.action') ||
      !document.source.signingKeySha256
    )
      return;
    lock.current = true;
    try {
      const input = Object.freeze({
        expectedVersion: document.version,
        sourceDigest: document.sourceDigest,
        consentReceiptId: document.consentReceiptId,
        idempotencyKey: crypto.randomUUID(),
      });
      const query = Object.freeze({
        idempotencyKey: input.idempotencyKey,
        originalOperation: 'SIGN' as const,
        targetId: document.signatureRequestId,
        bodySha256: await approvalSignatureSha256(approvalSignatureCanonicalJson(input)),
      });
      assertOriginal(original, 'approvals.work.signature.sign');
      pending.current = Object.freeze({ original, query });
      abort.current = new AbortController();
      await high.begin(approvalSignatureSignCommand(document.signatureRequestId, input));
    } catch {
      if (mounted.current) setFeedback('CHANGED');
    } finally {
      lock.current = false;
    }
  };
  const lookup = async () => {
    if (
      lock.current ||
      !uncertain ||
      !current.current.scopeReady ||
      !approvalSignatureRouteInstalled('signature-command-receipt.data')
    )
      return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await getApprovalSignatureCommandReceipt(
        uncertain.query,
        props.requestId,
        readOptions()
      );
      if (!mounted.current) return;
      setMetadata(result);
      // A receipt proves a journal event, never the availability of full artifact evidence.
      if (result.sourceCurrent) {
        setSignatureId(result.signatureRequestId);
        setUncertain(null);
        setConsentOriginal(null);
        setAccepted(false);
        setFeedback(null);
        pending.current = null;
        await client.invalidateQueries({
          queryKey: [
            'approvals',
            'signature-ceremony',
            ...scope.cacheKey,
            result.signatureRequestId,
          ],
        });
      } else {
        setUncertain(null);
        setConsentOriginal(null);
        setAccepted(false);
        setFeedback('CHANGED');
        pending.current = null;
      }
    } catch {
      if (mounted.current) setFeedback('UNKNOWN');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const refresh = async () => {
    if (lock.current || high.controller.busy || uncertain) return;
    setAccepted(false);
    const result = await context.refetch();
    const ceremonyResult = signatureId && result.isSuccess ? await ceremony.refetch() : undefined;
    if (mounted.current && result.isSuccess && (!signatureId || ceremonyResult?.isSuccess)) {
      setFeedback(null);
      setDeniedIdentity(undefined);
    }
  };
  const denied =
    !scopeReady ||
    [context.data, ceremony.data].some(
      (data) => data && String(data.source.ownerUserId) !== scope.cacheKey[1]
    ) ||
    (props.ownerError instanceof HttpError && [401, 403, 404].includes(props.ownerError.status)) ||
    deniedIdentity === identity ||
    (context.error instanceof HttpError && context.error.status === 403) ||
    (ceremony.error instanceof HttpError && ceremony.error.status === 403);
  const visible =
    denied ||
    !props.approved ||
    (context.data && context.data.source.requestVersion !== props.requestVersion) ||
    metadata?.sourceCurrent === false ||
    context.isError ||
    context.isFetching ||
    (signatureId && (ceremony.isError || ceremony.isFetching))
      ? undefined
      : latestDocument();
  const blocked = busy || high.controller.open || Boolean(uncertain) || Boolean(consentOriginal);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  return {
    visible,
    context: context.data,
    accepted,
    setAccepted,
    busy,
    feedback,
    metadata,
    uncertain,
    audit,
    showAudit,
    setShowAudit,
    denied,
    loading: context.isFetching || ceremony.isFetching,
    ready: ready(),
    canUpdate: hasRight('approvals.work.signature.update'),
    canSign: hasRight('approvals.work.signature.sign'),
    createAvailable: createDispatch.available,
    consentAvailable: consentDispatch.available,
    cancelAvailable: cancelDispatch.available,
    signAvailable: approvalSignatureRouteInstalled('signature-sign.action'),
    blocked,
    isBlocked: () => blockedRef.current || lock.current,
    create: () => low('CREATE'),
    consent: () => low('CONSENT'),
    cancel: () => low('CANCEL'),
    sign,
    consentDocument: consentOriginal?.document,
    consentReady: Boolean(
      consentOriginal && matches(consentOriginal) && hasRight('approvals.work.signature.update')
    ),
    openConsent: () => {
      const original = capture();
      if (
        original &&
        'state' in original.document &&
        original.document.state === 'AWAITING_CONSENT'
      ) {
        setAccepted(false);
        setConsentOriginal(original);
      }
    },
    closeConsent: () => {
      if (!lock.current && !uncertain) {
        setConsentOriginal(null);
        setAccepted(false);
      }
    },
    lookup,
    refresh,
    retryOriginal: () =>
      uncertain?.low && matches(uncertain.original) && !metadata
        ? dispatchLow(uncertain.low)
        : Promise.resolve(),
    canRetry: Boolean(uncertain?.low && matches(uncertain.original) && !metadata),
    high: high.controller,
  };
}
