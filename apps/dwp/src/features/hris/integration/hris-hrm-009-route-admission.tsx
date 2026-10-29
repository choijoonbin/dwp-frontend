import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { resolveSupportedLocale, resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { useProductSurfaceAuthority } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';

import Typography from '@mui/material/Typography';

import { useOptionalAllowedExactProductRoute } from '../../../components/allowed-product-surface-context';
import {
  createDirectDecisionClockAnchor,
  directDecisionServerNow,
  readMonotonicNowMs,
  scheduleDirectDecisionLease,
} from '../../../components/direct-decision-lease';
import { useProductSurfaceRequestScope } from '../../../components/use-product-surface-request-scope';
import { isAllowedCanaryDecisionTrusted } from '../../../components/product-surface-canary-runtime';
import { mapProductSurfaceDirectEvaluation } from '../../../components/product-surface-context';
import {
  HRM009_FEATURE,
  HRM009_QUERY_CONTRACTS,
  Hrm009OperationsCertificatesSurface,
  Hrm009SelfServiceRequestsSurface,
  createHrm009QueryAdapter,
} from '../employee-services/certificates';

import type {
  ProductSurfaceEffectiveContext,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils/api/auth-api';
import type { TrustedProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type {
  EffectiveProductSurfaceContext,
  EffectiveProductSurfaceContextEnvelope,
  ProductSurfaceDirectEvaluation,
} from '../../../components/product-surface-context';
import type { Hrm009QueryId, Hrm009TrustedScope } from '../employee-services/certificates';

export const HRM009_PAGE_ROUTE_CONTRACTS = Object.freeze({
  'IAQ-003': 'route.hcm.personal.requests.page',
  'IAQ-010': 'route.hcm.operations.certificates-documents.page',
} as const);

export const HRM009_DATA_ROUTE_CONTRACTS = Object.freeze({
  'IAQ-003': 'route.hcm.personal.requests.data',
  'IAQ-010': 'route.hcm.operations.certificates-documents.data',
} as const);

const HRM009_QUERY_ADAPTER = createHrm009QueryAdapter();
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function abortedBeforeDispatch(): Error {
  const error = new Error('HRM-009 DATA evaluation was aborted before dispatch.');
  error.name = 'AbortError';
  return error;
}

function waitForActiveBrowserTask(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortedBeforeDispatch());
      return;
    }
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(abortedBeforeDispatch());
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) {
        reject(abortedBeforeDispatch());
        return;
      }
      resolve();
    }, 0);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

type RuntimeContract = Readonly<{
  productId: 'hcm';
  surfaceId: 'hcm.personal' | 'hcm.operations';
  plane: 'work' | 'management';
  pageRouteContractKey: (typeof HRM009_PAGE_ROUTE_CONTRACTS)[Hrm009QueryId];
  dataRouteContractKey: (typeof HRM009_DATA_ROUTE_CONTRACTS)[Hrm009QueryId];
  capability: string;
  path: string;
  allowedScopeKinds: ReadonlySet<string>;
}>;

const RUNTIME_CONTRACTS: Readonly<Record<Hrm009QueryId, RuntimeContract>> = Object.freeze({
  'IAQ-003': Object.freeze({
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    plane: 'work',
    pageRouteContractKey: HRM009_PAGE_ROUTE_CONTRACTS['IAQ-003'],
    dataRouteContractKey: HRM009_DATA_ROUTE_CONTRACTS['IAQ-003'],
    capability: HRM009_QUERY_CONTRACTS['IAQ-003'].capability,
    path: HRM009_QUERY_CONTRACTS['IAQ-003'].route,
    allowedScopeKinds: new Set(['SELF']),
  }),
  'IAQ-010': Object.freeze({
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    plane: 'management',
    pageRouteContractKey: HRM009_PAGE_ROUTE_CONTRACTS['IAQ-010'],
    dataRouteContractKey: HRM009_DATA_ROUTE_CONTRACTS['IAQ-010'],
    capability: HRM009_QUERY_CONTRACTS['IAQ-010'].capability,
    path: HRM009_QUERY_CONTRACTS['IAQ-010'].route,
    allowedScopeKinds: new Set(['LEGAL_ENTITY', 'ORG_UNIT', 'TARGET_POPULATION']),
  }),
});

export type Hrm009RouteState =
  | Readonly<{
      state: 'valid';
      initialFocusPublicId?: string;
      requestedScopeKey?: string;
    }>
  | Readonly<{ state: 'invalid' }>;

function normalizedPath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
}

function scalar(search: URLSearchParams, key: string): string | undefined | null {
  const values = search.getAll(key);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || !values[0] || values[0] !== values[0]!.trim()) return null;
  return values[0]!;
}

export function parseHrm009RouteState(
  queryId: Hrm009QueryId,
  pathname: string,
  search: URLSearchParams
): Hrm009RouteState {
  const contract = RUNTIME_CONTRACTS[queryId];
  if (normalizedPath(pathname) !== contract.path) return { state: 'invalid' };
  const allowedKeys = new Set(['tab', 'focus', 'scope', 'navigationScope', 'legalEntityPublicId']);
  if ([...search.keys()].some((key) => !allowedKeys.has(key))) return { state: 'invalid' };
  const tab = scalar(search, 'tab');
  const focus = scalar(search, 'focus');
  const requestedScopeKey = scalar(search, 'scope');
  const navigationScope = scalar(search, 'navigationScope');
  const legalEntityPublicId = scalar(search, 'legalEntityPublicId');
  if (
    tab === null ||
    (tab !== undefined && tab !== 'overview') ||
    focus === null ||
    (focus !== undefined && !PUBLIC_ID.test(focus)) ||
    requestedScopeKey === null ||
    (requestedScopeKey !== undefined && !PUBLIC_ID.test(requestedScopeKey)) ||
    navigationScope === null ||
    legalEntityPublicId === null ||
    (navigationScope !== undefined &&
      navigationScope !== 'TENANT' &&
      navigationScope !== 'LEGAL_ENTITY') ||
    (navigationScope === 'TENANT' && legalEntityPublicId !== undefined) ||
    (navigationScope === 'LEGAL_ENTITY' &&
      (queryId === 'IAQ-003' ||
        legalEntityPublicId === undefined ||
        !UUID.test(legalEntityPublicId))) ||
    (navigationScope === undefined && legalEntityPublicId !== undefined)
  ) {
    return { state: 'invalid' };
  }
  return Object.freeze({
    state: 'valid' as const,
    ...(focus === undefined ? {} : { initialFocusPublicId: focus }),
    ...(requestedScopeKey === undefined ? {} : { requestedScopeKey }),
  });
}

function effectiveContext(context: ProductSurfaceEffectiveContext): EffectiveProductSurfaceContext {
  return {
    ...context,
    plane: context.plane as EffectiveProductSurfaceContext['plane'],
    effectiveGrants: context.effectiveGrants.map((grant) => ({
      ...grant,
      validUntil: grant.validUntil ?? undefined,
      responsibility:
        grant.grantKind === 'CAPABILITY' ? (grant.responsibility ?? undefined) : undefined,
    })) as EffectiveProductSurfaceContext['effectiveGrants'],
    scopes: context.scopes.map((scope) => ({
      ...scope,
      kind: scope.kind as EffectiveProductSurfaceContext['scopes'][number]['kind'],
      validUntil: scope.validUntil ?? undefined,
    })),
  };
}

function effectiveEnvelope(
  snapshot: TrustedProductSurfaceAuthoritySnapshot
): EffectiveProductSurfaceContextEnvelope {
  return {
    contractVersion: snapshot.envelope.contractVersion,
    decisionRevision: snapshot.envelope.decisionRevision,
    sourceRevisions: Object.fromEntries(
      Object.entries(snapshot.envelope.sourceRevisions).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && entry[1].trim().length > 0
      )
    ),
    activeAccessMode: snapshot.envelope.activeAccessMode,
    generatedAt: snapshot.envelope.generatedAt,
    contexts: snapshot.envelope.contexts.map(effectiveContext),
  };
}

function directEvaluation(data: ProductSurfaceEvaluationData): ProductSurfaceDirectEvaluation {
  return {
    decision: data.decision,
    reasonCode: data.reasonCode ?? undefined,
    decisionRevision: data.decisionRevision ?? undefined,
    context: data.context ? effectiveContext(data.context) : undefined,
    routeGrantRef: data.routeGrantRef ?? undefined,
    scope: data.scope
      ? {
          ...data.scope,
          kind: data.scope.kind as EffectiveProductSurfaceContext['scopes'][number]['kind'],
          validUntil: data.scope.validUntil ?? undefined,
        }
      : undefined,
    effectiveReadOnly: data.effectiveReadOnly ?? undefined,
    revalidateAt: data.revalidateAt ?? undefined,
    validUntil: data.validUntil ?? undefined,
    expiredAt: data.expiredAt ?? undefined,
    requiredAssurance: data.requiredAssurance ?? undefined,
    requestPolicyRef: data.requestPolicyRef ?? undefined,
    correlationId: data.correlationId ?? undefined,
  };
}

function freshDeadline(value: string | null | undefined, serverNowMs: number) {
  if (!value) return null;
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) && deadline > serverNowMs ? deadline : null;
}

export type Hrm009DataAdmissionLease = Readonly<{ serverDeadlineMs: number }>;

export function resolveHrm009DataAdmissionLease(
  queryId: Hrm009QueryId,
  data: ProductSurfaceEvaluationData,
  expected: Readonly<{ contextScopeKey: string; decisionRevision: string }>,
  snapshot: TrustedProductSurfaceAuthoritySnapshot,
  serverNowMs: number
): Hrm009DataAdmissionLease | null {
  try {
    const contract = RUNTIME_CONTRACTS[queryId];
    const decision = mapProductSurfaceDirectEvaluation(
      directEvaluation(data),
      { productKey: contract.productId, surfaceKey: contract.surfaceId },
      serverNowMs
    );
    if (
      decision.state !== 'allowed' ||
      decision.context.plane !== contract.plane ||
      decision.context.appResourceKey !== 'APP.HCM' ||
      !contract.allowedScopeKinds.has(decision.scope.kind) ||
      decision.decisionRevision !== expected.decisionRevision ||
      decision.decisionRevision !== snapshot.envelope.decisionRevision ||
      decision.scope.key !== expected.contextScopeKey ||
      decision.scope.readOnly !== true ||
      decision.effectiveReadOnly !== true ||
      !isAllowedCanaryDecisionTrusted(
        { envelope: effectiveEnvelope(snapshot), serverNowMs },
        decision,
        { productId: contract.productId, surfaceId: contract.surfaceId }
      )
    ) {
      return null;
    }
    const exactCapability = decision.context.effectiveGrants.filter(
      (grant) =>
        grant.grantKind === 'CAPABILITY' &&
        grant.capabilityContractKey === contract.capability &&
        grant.activationState === 'ACTIVE' &&
        grant.readOnly === true &&
        grant.scopeKeys.includes(expected.contextScopeKey)
    );
    if (exactCapability.length !== 1) return null;
    const requiredDeadlines = [decision.revalidateAt, decision.context.revalidateAt].map((value) =>
      freshDeadline(value, serverNowMs)
    );
    const optionalValues = [
      decision.scope.validUntil,
      data.validUntil,
      exactCapability[0]!.validUntil,
    ].filter((value): value is string => value !== undefined && value !== null);
    const optionalDeadlines = optionalValues.map((value) => freshDeadline(value, serverNowMs));
    if (
      requiredDeadlines.some((deadline) => deadline === null) ||
      optionalDeadlines.some((deadline) => deadline === null)
    ) {
      return null;
    }
    return Object.freeze({
      serverDeadlineMs: Math.min(
        ...(requiredDeadlines as number[]),
        ...(optionalDeadlines as number[])
      ),
    });
  } catch {
    return null;
  }
}

type PageEvidence = Readonly<{
  contextScopeKey: string;
  decisionRevision: string;
  tenantId: string;
  actorId: string;
}>;

type DataAdmissionState =
  | Readonly<{ state: 'pending' | 'denied'; identity: string }>
  | Readonly<{ state: 'allowed'; identity: string; serverDeadlineMs: number }>;

function Hrm009RouteAdmission({ queryId }: Readonly<{ queryId: Hrm009QueryId }>) {
  const auth = useAuth();
  const { i18n, t } = useTranslation('hcm');
  const location = useLocation();
  const pageDecision = useOptionalAllowedExactProductRoute();
  const authority = useProductSurfaceAuthority();
  const { evaluateProduct } = authority;
  const contract = RUNTIME_CONTRACTS[queryId];
  const runtimeEnabled = import.meta.env.VITE_HRIS_HRM_009_ENABLED === 'true';
  const requestScope = useProductSurfaceRequestScope({
    productKey: contract.productId,
    surfaceKey: contract.surfaceId,
  });
  const requestGoverned = requestScope.governed;
  const requestReady = requestScope.ready;
  const requestContextScopeKey = requestScope.contextScopeKey;
  const requestTenantId = requestScope.queryMeta.tenantId;
  const requestActorId = requestScope.queryMeta.actorId;
  const requestProductId = requestScope.queryMeta.productId;
  const requestSurfaceId = requestScope.queryMeta.surfaceId;
  const requestDecisionRevision = requestScope.queryMeta.decisionRevision;
  const tenantId = String(auth.user?.tenantId ?? '');
  const actorId = String(auth.user?.userId ?? '');
  const snapshot = authority.status === 'ready' ? authority.snapshot : undefined;
  const routeState = useMemo(
    () => parseHrm009RouteState(queryId, location.pathname, new URLSearchParams(location.search)),
    [location.pathname, location.search, queryId]
  );
  const requestedRouteScopeKey =
    routeState.state === 'valid' ? routeState.requestedScopeKey : undefined;
  const pageEvidence = useMemo<PageEvidence | null>(() => {
    if (
      !runtimeEnabled ||
      routeState.state !== 'valid' ||
      !snapshot ||
      !pageDecision ||
      !requestGoverned ||
      !requestReady ||
      !requestContextScopeKey ||
      (requestedRouteScopeKey !== undefined && requestedRouteScopeKey !== pageDecision.scope.key) ||
      !tenantId ||
      !actorId ||
      requestTenantId !== tenantId ||
      requestActorId !== actorId ||
      requestProductId !== contract.productId ||
      requestSurfaceId !== contract.surfaceId ||
      requestContextScopeKey !== pageDecision.scope.key ||
      requestDecisionRevision !== pageDecision.decisionRevision ||
      pageDecision.decisionRevision !== snapshot.envelope.decisionRevision ||
      pageDecision.context.plane !== contract.plane ||
      pageDecision.context.appResourceKey !== 'APP.HCM' ||
      !contract.allowedScopeKinds.has(pageDecision.scope.kind) ||
      pageDecision.scope.readOnly !== true ||
      pageDecision.effectiveReadOnly !== true ||
      !isAllowedCanaryDecisionTrusted(
        { envelope: effectiveEnvelope(snapshot), serverNowMs: authority.serverNowMs },
        pageDecision,
        { productId: contract.productId, surfaceId: contract.surfaceId }
      )
    ) {
      return null;
    }
    const exactCapability = pageDecision.context.effectiveGrants.filter(
      (grant) =>
        grant.grantKind === 'CAPABILITY' &&
        grant.capabilityContractKey === contract.capability &&
        grant.activationState === 'ACTIVE' &&
        grant.readOnly === true &&
        grant.scopeKeys.includes(pageDecision.scope.key)
    );
    return exactCapability.length === 1
      ? Object.freeze({
          contextScopeKey: pageDecision.scope.key,
          decisionRevision: pageDecision.decisionRevision,
          tenantId,
          actorId,
        })
      : null;
  }, [
    actorId,
    authority.serverNowMs,
    contract,
    pageDecision,
    requestActorId,
    requestContextScopeKey,
    requestDecisionRevision,
    requestGoverned,
    requestProductId,
    requestReady,
    requestedRouteScopeKey,
    requestSurfaceId,
    requestTenantId,
    routeState.state,
    runtimeEnabled,
    snapshot,
    tenantId,
  ]);
  const identity = pageEvidence
    ? JSON.stringify([
        queryId,
        contract.pageRouteContractKey,
        contract.dataRouteContractKey,
        pageEvidence.tenantId,
        pageEvidence.actorId,
        pageEvidence.contextScopeKey,
        pageEvidence.decisionRevision,
      ])
    : '';
  const pageContextScopeKey = pageEvidence?.contextScopeKey ?? '';
  const pageDecisionRevision = pageEvidence?.decisionRevision ?? '';
  const [evaluationGeneration, setEvaluationGeneration] = useState(0);
  const [dataAdmission, setDataAdmission] = useState<DataAdmissionState | null>(null);
  const clockAnchor = useMemo(
    () => (snapshot ? createDirectDecisionClockAnchor(snapshot.clockOffsetMs) : undefined),
    [snapshot]
  );

  useEffect(() => {
    if (!identity || !pageContextScopeKey || !pageDecisionRevision || !snapshot || !clockAnchor) {
      setDataAdmission(null);
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setDataAdmission(Object.freeze({ state: 'pending', identity }));
    void waitForActiveBrowserTask(controller.signal)
      .then(() =>
        !active || controller.signal.aborted
          ? undefined
          : evaluateProduct(
              {
                subject: {
                  type: 'PRODUCT',
                  productKey: contract.productId,
                  surfaceKey: contract.surfaceId,
                },
                routeContractKey: contract.dataRouteContractKey,
                contextScopeKey: pageContextScopeKey,
              },
              { signal: controller.signal }
            )
      )
      .then((data) => {
        if (!active || data === undefined) return;
        const lease = resolveHrm009DataAdmissionLease(
          queryId,
          data,
          {
            contextScopeKey: pageContextScopeKey,
            decisionRevision: pageDecisionRevision,
          },
          snapshot,
          directDecisionServerNow(clockAnchor)
        );
        setDataAdmission(
          lease
            ? Object.freeze({
                state: 'allowed',
                identity,
                serverDeadlineMs: lease.serverDeadlineMs,
              })
            : Object.freeze({ state: 'denied', identity })
        );
      })
      .catch(() => {
        if (active) setDataAdmission(Object.freeze({ state: 'denied', identity }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    clockAnchor,
    contract,
    evaluateProduct,
    evaluationGeneration,
    identity,
    pageContextScopeKey,
    pageDecisionRevision,
    queryId,
    snapshot,
  ]);

  useEffect(() => {
    if (!clockAnchor || dataAdmission?.state !== 'allowed' || dataAdmission.identity !== identity) {
      return undefined;
    }
    return scheduleDirectDecisionLease({
      anchor: clockAnchor,
      serverDeadlineMs: dataAdmission.serverDeadlineMs,
      onRenew: () => setEvaluationGeneration((current) => current + 1),
      onExpire: () =>
        setDataAdmission((current) =>
          current === dataAdmission ? Object.freeze({ state: 'denied', identity }) : current
        ),
    });
  }, [clockAnchor, dataAdmission, identity]);

  const correlationId = useMemo(
    () => (identity && globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : ''),
    [identity]
  );
  const now =
    clockAnchor === undefined
      ? Number.POSITIVE_INFINITY
      : directDecisionServerNow(clockAnchor, readMonotonicNowMs());
  const admitted = Boolean(
    pageEvidence &&
    correlationId &&
    dataAdmission?.state === 'allowed' &&
    dataAdmission.identity === identity &&
    dataAdmission.serverDeadlineMs > now
  );
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const timeZone = resolveSystemTimeZone('UTC');
  const scope = useMemo<Hrm009TrustedScope | undefined>(
    () =>
      admitted
        ? Object.freeze({
            contextScopeKey: pageContextScopeKey,
            decisionRevision: pageDecisionRevision,
            locale,
            timeZone,
            correlationId,
          })
        : undefined,
    [admitted, correlationId, locale, pageContextScopeKey, pageDecisionRevision, timeZone]
  );
  const gate = Object.freeze({
    feature: HRM009_FEATURE,
    enabled: runtimeEnabled,
    tenantEnrolled: admitted,
  });
  if (
    runtimeEnabled &&
    pageEvidence &&
    identity &&
    (!dataAdmission || dataAdmission.identity !== identity || dataAdmission.state === 'pending')
  ) {
    return (
      <Typography role="status" aria-live="polite" data-runtime-state="loading">
        {t('administration.integration.loadingCertificateAuthority')}
      </Typography>
    );
  }
  const surfaceProps = {
    gate,
    scope,
    ...(admitted ? { adapter: HRM009_QUERY_ADAPTER } : {}),
    ...(routeState.state === 'valid' && routeState.initialFocusPublicId
      ? { initialFocusPublicId: routeState.initialFocusPublicId }
      : {}),
  };
  return queryId === 'IAQ-003' ? (
    <Hrm009SelfServiceRequestsSurface {...surfaceProps} />
  ) : (
    <Hrm009OperationsCertificatesSurface {...surfaceProps} />
  );
}

export function HrisHrm009SelfServiceRequestsRouteAdmission() {
  return <Hrm009RouteAdmission queryId="IAQ-003" />;
}

export function HrisHrm009OperationsCertificatesRouteAdmission() {
  return <Hrm009RouteAdmission queryId="IAQ-010" />;
}
