import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
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
import { isAllowedCanaryDecisionTrusted } from '../../shell/product-surface-canary-runtime';
import { mapProductSurfaceDirectEvaluation } from '../../shell/product-surface-context';
import {
  HRM007_FEATURE,
  HRM007_QUERY_CONTRACTS,
  Hrm007AppointmentsPage,
  Hrm007PeopleEmploymentPage,
  Hrm007TeamPeopleChangesPage,
  createHrm007QueryAdapter,
  createHrm007QueryRequest,
} from '../people/hrm-007-workbench';

import type {
  ProductSurfaceEffectiveContext,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils/api/auth-api';
import type { TrustedProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type {
  EffectiveProductSurfaceContext,
  EffectiveProductSurfaceContextEnvelope,
  ProductSurfaceDirectEvaluation,
} from '../../shell/product-surface-context';
import type {
  Hrm007QueryId,
  Hrm007QueryOptions,
  Hrm007TrustedAdmission,
  Hrm007TrustedScope,
} from '../people/hrm-007-workbench';

export const HRM007_PAGE_ROUTE_CONTRACTS = Object.freeze({
  'IAQ-005': 'route.hcm.team.people-changes.page',
  'IAQ-007': 'route.hcm.operations.people-appointments.page',
  'IAQ-013': 'route.hcm.configuration.people-employment.page',
} as const);

export const HRM007_DATA_ROUTE_CONTRACTS = Object.freeze({
  'IAQ-005': 'route.hcm.team.people-changes.data',
  'IAQ-007': 'route.hcm.operations.people-appointments.data',
  'IAQ-013': 'route.hcm.configuration.people-employment.data',
} as const);

const HRM007_QUERY_ADAPTER = createHrm007QueryAdapter();
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

type QueryField = Readonly<{
  searchKey: string;
  group: string;
  field?: string;
  kind: 'integer' | 'civil-date' | 'instant' | 'codes' | 'public-ids';
  minimum?: number;
}>;

function queryFields(fields: readonly QueryField[]): readonly QueryField[] {
  return Object.freeze(fields);
}

const QUERY_FIELDS: Readonly<Record<Hrm007QueryId, readonly QueryField[]>> = Object.freeze({
  'IAQ-005': queryFields([
    {
      searchKey: 'filter[changeRequestSummary][minimumItemCount]',
      group: 'changeRequestSummary',
      field: 'minimumItemCount',
      kind: 'integer',
    },
    {
      searchKey: 'filter[changeRequestSummary][maximumItemCount]',
      group: 'changeRequestSummary',
      field: 'maximumItemCount',
      kind: 'integer',
    },
    {
      searchKey: 'filter[limitedEmployment][codes]',
      group: 'limitedEmployment',
      field: 'codes',
      kind: 'codes',
    },
    {
      searchKey: 'filter[limitedEmployment][minimumRevision]',
      group: 'limitedEmployment',
      field: 'minimumRevision',
      kind: 'integer',
      minimum: 1,
    },
    {
      searchKey: 'filter[approvalStatus][codes]',
      group: 'approvalStatus',
      field: 'codes',
      kind: 'codes',
    },
    {
      searchKey: 'filter[approvalStatus][minimumRevision]',
      group: 'approvalStatus',
      field: 'minimumRevision',
      kind: 'integer',
      minimum: 1,
    },
    { searchKey: 'filter[effectiveOn]', group: 'effectiveOn', kind: 'civil-date' },
  ]),
  'IAQ-007': queryFields([
    {
      searchKey: 'filter[appointment][startFrom]',
      group: 'appointment',
      field: 'startFrom',
      kind: 'instant',
    },
    {
      searchKey: 'filter[appointment][startTo]',
      group: 'appointment',
      field: 'startTo',
      kind: 'instant',
    },
    {
      searchKey: 'filter[appointment][endFrom]',
      group: 'appointment',
      field: 'endFrom',
      kind: 'instant',
    },
    {
      searchKey: 'filter[appointment][endTo]',
      group: 'appointment',
      field: 'endTo',
      kind: 'instant',
    },
    { searchKey: 'filter[assignment][codes]', group: 'assignment', field: 'codes', kind: 'codes' },
    {
      searchKey: 'filter[assignment][publicIds]',
      group: 'assignment',
      field: 'publicIds',
      kind: 'public-ids',
    },
    {
      searchKey: 'filter[employment][activeOn]',
      group: 'employment',
      field: 'activeOn',
      kind: 'civil-date',
    },
    {
      searchKey: 'filter[employment][from]',
      group: 'employment',
      field: 'from',
      kind: 'civil-date',
    },
    { searchKey: 'filter[employment][to]', group: 'employment', field: 'to', kind: 'civil-date' },
    { searchKey: 'filter[effectiveOn]', group: 'effectiveOn', kind: 'civil-date' },
  ]),
  'IAQ-013': queryFields([
    {
      searchKey: 'filter[policyMetadata][policyKeys]',
      group: 'policyMetadata',
      field: 'policyKeys',
      kind: 'public-ids',
    },
    {
      searchKey: 'filter[policyMetadata][minimumRevision]',
      group: 'policyMetadata',
      field: 'minimumRevision',
      kind: 'integer',
      minimum: 1,
    },
    {
      searchKey: 'filter[employmentRule][policyKeys]',
      group: 'employmentRule',
      field: 'policyKeys',
      kind: 'public-ids',
    },
    {
      searchKey: 'filter[employmentRule][minimumRevision]',
      group: 'employmentRule',
      field: 'minimumRevision',
      kind: 'integer',
      minimum: 1,
    },
    {
      searchKey: 'filter[impactSummary][minimumItemCount]',
      group: 'impactSummary',
      field: 'minimumItemCount',
      kind: 'integer',
    },
    {
      searchKey: 'filter[impactSummary][maximumItemCount]',
      group: 'impactSummary',
      field: 'maximumItemCount',
      kind: 'integer',
    },
    { searchKey: 'filter[effectiveOn]', group: 'effectiveOn', kind: 'civil-date' },
  ]),
});

export type Hrm007RouteQueryOptions =
  Readonly<{ state: 'valid'; options: Hrm007QueryOptions }> | Readonly<{ state: 'invalid' }>;

function validCivilDate(value: string): boolean {
  if (!CIVIL_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function validInstant(value: string): boolean {
  return INSTANT.test(value) && Number.isFinite(Date.parse(value));
}

function scalar(search: URLSearchParams, key: string): string | undefined | null {
  const values = search.getAll(key);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || !values[0] || values[0] !== values[0]!.trim()) return null;
  return values[0]!;
}

function parseQueryField(search: URLSearchParams, field: QueryField): unknown | undefined | null {
  const values = search.getAll(field.searchKey);
  if (values.length === 0) return undefined;
  if (field.kind === 'codes' || field.kind === 'public-ids') {
    const pattern = field.kind === 'codes' ? CODE : PUBLIC_ID;
    return values.length <= 50 &&
      new Set(values).size === values.length &&
      values.every((value) => value === value.trim() && pattern.test(value))
      ? values
      : null;
  }
  if (values.length !== 1 || values[0] !== values[0]!.trim()) return null;
  const value = values[0]!;
  if (field.kind === 'civil-date') return validCivilDate(value) ? value : null;
  if (field.kind === 'instant') return validInstant(value) ? value : null;
  if (!/^(?:0|[1-9]\d*)$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= (field.minimum ?? 0) ? parsed : null;
}

export function parseHrm007RouteQueryOptions(
  queryId: Hrm007QueryId,
  search: URLSearchParams,
  expectedScope: Readonly<{ key: string }>
): Hrm007RouteQueryOptions {
  const scope = scalar(search, 'scope');
  if (scope !== expectedScope.key) return { state: 'invalid' };
  const tab = scalar(search, 'tab');
  if (tab === null || (tab !== undefined && tab !== 'overview')) return { state: 'invalid' };
  const focus = scalar(search, 'focus');
  if (focus === null || (focus !== undefined && !PUBLIC_ID.test(focus)))
    return { state: 'invalid' };

  const navigationScope = scalar(search, 'navigationScope');
  const legalEntityPublicId = scalar(search, 'legalEntityPublicId');
  if (
    navigationScope === null ||
    legalEntityPublicId === null ||
    (navigationScope !== undefined &&
      navigationScope !== 'TENANT' &&
      navigationScope !== 'LEGAL_ENTITY') ||
    (navigationScope === 'TENANT' && legalEntityPublicId !== undefined) ||
    (navigationScope === 'LEGAL_ENTITY' &&
      (legalEntityPublicId === undefined || !UUID.test(legalEntityPublicId))) ||
    (navigationScope === undefined && legalEntityPublicId !== undefined)
  ) {
    return { state: 'invalid' };
  }

  const allowedFilterKeys = new Set(QUERY_FIELDS[queryId].map((field) => field.searchKey));
  if (
    [...search.keys()].some(
      (key) => (key === 'filter' || key.startsWith('filter[')) && !allowedFilterKeys.has(key)
    )
  ) {
    return { state: 'invalid' };
  }

  const filter: Record<string, unknown> = {};
  for (const field of QUERY_FIELDS[queryId]) {
    const value = parseQueryField(search, field);
    if (value === null) return { state: 'invalid' };
    if (value === undefined) continue;
    if (!field.field) {
      filter[field.group] = value;
      continue;
    }
    const group = (filter[field.group] ?? {}) as Record<string, unknown>;
    group[field.field] = value;
    filter[field.group] = group;
  }

  const sorts = search.getAll('sort');
  const contractSorts = HRM007_QUERY_CONTRACTS[queryId].sorts as readonly string[];
  if (
    sorts.length > 3 ||
    new Set(sorts).size !== sorts.length ||
    sorts.some((sort) => !contractSorts.includes(sort)) ||
    (sorts.some((sort) => sort.startsWith('itemPublicId:')) &&
      !sorts.at(-1)?.startsWith('itemPublicId:'))
  ) {
    return { state: 'invalid' };
  }
  const effectiveSorts = [...sorts];
  if (!effectiveSorts.some((sort) => sort.startsWith('itemPublicId:'))) {
    effectiveSorts.push('itemPublicId:ASC');
  }
  if (effectiveSorts.length > 3) return { state: 'invalid' };

  const asOf = scalar(search, 'asOf');
  if (asOf === null || (asOf !== undefined && !validInstant(asOf))) {
    return { state: 'invalid' };
  }
  return {
    state: 'valid',
    options: Object.freeze({
      filter: Object.freeze(filter),
      sort: Object.freeze(effectiveSorts),
      ...(asOf === undefined ? {} : { asOf }),
    }),
  };
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
          typeof entry[1] === 'string' && Boolean(entry[1].trim())
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

export type Hrm007DataAdmissionLease = Readonly<{ serverDeadlineMs: number }>;

export function resolveHrm007DataAdmissionLease(
  queryId: Hrm007QueryId,
  data: ProductSurfaceEvaluationData,
  expected: Readonly<{ contextScopeKey: string; decisionRevision: string }>,
  snapshot: TrustedProductSurfaceAuthoritySnapshot,
  serverNowMs: number
): Hrm007DataAdmissionLease | null {
  try {
    const contract = HRM007_QUERY_CONTRACTS[queryId];
    const decision = mapProductSurfaceDirectEvaluation(
      directEvaluation(data),
      { productKey: contract.productId, surfaceKey: contract.surfaceId },
      serverNowMs
    );
    if (
      decision.state !== 'allowed' ||
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
    const deadlineValues = [
      decision.revalidateAt,
      decision.context.revalidateAt,
      decision.scope.validUntil,
      data.validUntil ?? undefined,
      exactCapability[0]!.validUntil,
    ].filter((value): value is string => value !== undefined);
    const deadlines = deadlineValues.map(Date.parse);
    if (
      deadlines.length < 2 ||
      deadlines.some((deadline) => !Number.isFinite(deadline) || deadline <= serverNowMs)
    ) {
      return null;
    }
    return Object.freeze({ serverDeadlineMs: Math.min(...deadlines) });
  } catch {
    return null;
  }
}

type PageEvidence = Readonly<{
  contextScopeKey: string;
  decisionRevision: string;
  tenantId: string;
  actorId: string;
  accessMode: Hrm007TrustedScope['accessMode'];
}>;

type DataAdmissionState =
  | Readonly<{ state: 'pending' | 'denied'; identity: string }>
  | Readonly<{ state: 'allowed'; identity: string; serverDeadlineMs: number }>;

function Hrm007RouteAdmission({ queryId }: Readonly<{ queryId: Hrm007QueryId }>) {
  const auth = useAuth();
  const { i18n } = useTranslation('hcm');
  const location = useLocation();
  const pageDecision = useOptionalAllowedExactProductRoute();
  const authority = useProductSurfaceAuthority();
  const { evaluateProduct } = authority;
  const contract = HRM007_QUERY_CONTRACTS[queryId];
  const runtimeEnabled = import.meta.env.VITE_HRIS_HRM_007_ENABLED === 'true';
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
  const pageEvidence = useMemo<PageEvidence | null>(() => {
    if (
      !runtimeEnabled ||
      !snapshot ||
      !pageDecision ||
      !requestGoverned ||
      !requestReady ||
      !requestContextScopeKey ||
      !tenantId ||
      !actorId ||
      requestTenantId !== tenantId ||
      requestActorId !== actorId ||
      requestProductId !== contract.productId ||
      requestSurfaceId !== contract.surfaceId ||
      requestContextScopeKey !== pageDecision.scope.key ||
      requestDecisionRevision !== pageDecision.decisionRevision ||
      pageDecision.decisionRevision !== snapshot.envelope.decisionRevision ||
      !isAllowedCanaryDecisionTrusted(
        {
          envelope: effectiveEnvelope(snapshot),
          serverNowMs: authority.serverNowMs,
        },
        pageDecision,
        { productId: contract.productId, surfaceId: contract.surfaceId }
      )
    ) {
      return null;
    }
    const pageCapability = pageDecision.context.effectiveGrants.filter(
      (grant) =>
        grant.grantKind === 'CAPABILITY' &&
        grant.capabilityContractKey === contract.capability &&
        grant.activationState === 'ACTIVE' &&
        grant.readOnly === true &&
        grant.scopeKeys.includes(pageDecision.scope.key)
    );
    if (
      pageCapability.length !== 1 ||
      pageDecision.scope.readOnly !== true ||
      pageDecision.effectiveReadOnly !== true
    ) {
      return null;
    }
    return Object.freeze({
      contextScopeKey: pageDecision.scope.key,
      decisionRevision: pageDecision.decisionRevision,
      tenantId,
      actorId,
      accessMode: snapshot.envelope.activeAccessMode,
    });
  }, [
    actorId,
    authority.serverNowMs,
    contract.capability,
    contract.productId,
    contract.surfaceId,
    pageDecision,
    requestActorId,
    requestContextScopeKey,
    requestDecisionRevision,
    requestGoverned,
    requestProductId,
    requestReady,
    requestSurfaceId,
    requestTenantId,
    runtimeEnabled,
    snapshot,
    tenantId,
  ]);
  const queryState = useMemo(
    () =>
      pageEvidence
        ? parseHrm007RouteQueryOptions(queryId, new URLSearchParams(location.search), {
            key: pageEvidence.contextScopeKey,
          })
        : ({ state: 'invalid' } as const),
    [location.search, pageEvidence, queryId]
  );
  const identity =
    pageEvidence && queryState.state === 'valid'
      ? JSON.stringify([
          queryId,
          HRM007_PAGE_ROUTE_CONTRACTS[queryId],
          HRM007_DATA_ROUTE_CONTRACTS[queryId],
          pageEvidence.tenantId,
          pageEvidence.actorId,
          pageEvidence.accessMode,
          pageEvidence.contextScopeKey,
          pageEvidence.decisionRevision,
          queryState.options,
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
    void evaluateProduct(
      {
        subject: {
          type: 'PRODUCT',
          productKey: contract.productId,
          surfaceKey: contract.surfaceId,
        },
        routeContractKey: HRM007_DATA_ROUTE_CONTRACTS[queryId],
        contextScopeKey: pageContextScopeKey,
      },
      { signal: controller.signal }
    )
      .then((data) => {
        if (!active) return;
        const lease = resolveHrm007DataAdmissionLease(
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
    contract.productId,
    contract.surfaceId,
    evaluationGeneration,
    evaluateProduct,
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
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  let admission: Hrm007TrustedAdmission | undefined;
  if (
    pageEvidence &&
    queryState.state === 'valid' &&
    correlationId &&
    dataAdmission?.state === 'allowed' &&
    dataAdmission.identity === identity &&
    clockAnchor &&
    dataAdmission.serverDeadlineMs > directDecisionServerNow(clockAnchor, readMonotonicNowMs())
  ) {
    const trustedScope = Object.freeze({
      tenantId: pageEvidence.tenantId,
      actorId: pageEvidence.actorId,
      accessMode: pageEvidence.accessMode,
      contextScopeKey: pageEvidence.contextScopeKey,
      decisionRevision: pageEvidence.decisionRevision,
      locale,
      timeZone,
      correlationId,
    });
    try {
      createHrm007QueryRequest(queryId, trustedScope, queryState.options);
      admission = Object.freeze({
        kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
        feature: HRM007_FEATURE,
        queryId,
        ...trustedScope,
      });
    } catch {
      admission = undefined;
    }
  }
  const gate = Object.freeze({
    feature: HRM007_FEATURE,
    enabled: runtimeEnabled,
    tenantEnrolled: pageEvidence !== null,
  });
  if (
    runtimeEnabled &&
    pageEvidence &&
    queryState.state === 'valid' &&
    identity &&
    (!dataAdmission || dataAdmission.identity !== identity || dataAdmission.state === 'pending')
  ) {
    return (
      <Typography role="status" aria-live="polite" data-runtime-state="loading">
        Loading governed workbench authority…
      </Typography>
    );
  }
  const pageProps = {
    gate,
    admission,
    adapter: HRM007_QUERY_ADAPTER,
    ...(queryState.state === 'valid' ? { options: queryState.options } : {}),
  };
  if (queryId === 'IAQ-005') return <Hrm007TeamPeopleChangesPage {...pageProps} />;
  if (queryId === 'IAQ-007') return <Hrm007AppointmentsPage {...pageProps} />;
  return <Hrm007PeopleEmploymentPage {...pageProps} />;
}

export function HrisHrm007TeamPeopleChangesRouteAdmission() {
  return <Hrm007RouteAdmission queryId="IAQ-005" />;
}

export function HrisHrm007AppointmentsRouteAdmission() {
  return <Hrm007RouteAdmission queryId="IAQ-007" />;
}

export function HrisHrm007PeopleEmploymentRouteAdmission() {
  return <Hrm007RouteAdmission queryId="IAQ-013" />;
}
