import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { useProductSurfaceAuthority } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';

import { useOptionalAllowedExactProductRoute } from '../../../components/allowed-product-surface-context';
import {
  createDirectDecisionClockAnchor,
  directDecisionServerNow,
  readMonotonicNowMs,
  scheduleDirectDecisionLease,
} from '../../../components/direct-decision-lease';
import { useProductActionMutation } from '../../../components/use-product-action-mutation';
import { isAllowedCanaryDecisionTrusted } from '../../shell/product-surface-canary-runtime';
import { mapProductSurfaceDirectEvaluation } from '../../shell/product-surface-context';
import {
  HRIS_OPERATIONS_API_CONTRACTS,
  HRIS_OPERATIONS_FEATURE,
  HrisOperationsWorkspace,
} from '../administration/operations';
import {
  HRIS_ORGANIZATION_GRAPH_CONTRACT,
  HRIS_ORGANIZATION_POSITIONS_FEATURE,
  HrisOrganizationPositionsWorkspace,
  createHrisOrganizationPositionsQueryAdapter,
} from '../people/organization-positions';
import {
  PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
  PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY,
  PAYROLL_RUN_PREPARE_FEATURE,
  PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
  HrisPayrollPopulationWorkspace,
  payrollPopulationDataSource,
} from '../payroll/population';

import type {
  ProductSurfaceEffectiveContext,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils/api/auth-api';
import type { TrustedProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type {
  AllowedSurfaceDecision,
  EffectiveProductSurfaceContext,
  EffectiveProductSurfaceContextEnvelope,
  ProductSurfaceDirectEvaluation,
} from '../../shell/product-surface-context';
import type {
  HrisOperationsDataSource,
  HrisOperationsTrustedAdmission,
} from '../administration/operations';
import type { HrisOrganizationPositionsTrustedAdmission } from '../people/organization-positions';
import type {
  HrisPayrollPopulationWorkspaceProps,
  PayrollPopulationDataSource,
  PayrollPopulationOwnerBinding,
  PayrollPopulationTrustedAdmission,
} from '../payroll/population';

export const HRIS_OPERATIONS_TARGET_SCOPE_PARAM = 'exceptionContextScopeKey' as const;

type HrisAdmittedFeature =
  | typeof HRIS_ORGANIZATION_POSITIONS_FEATURE
  | typeof PAYROLL_RUN_PREPARE_FEATURE
  | typeof HRIS_OPERATIONS_FEATURE;

type HrisPageAdmission = Readonly<{
  feature: HrisAdmittedFeature;
  pageRouteContractKey: string;
  productKey: 'hcm';
  surfaceKey: 'hcm.operations' | 'hcm.management';
  contextScopeKey: string;
  contextScopeKind: AllowedSurfaceDecision['scope']['kind'];
  decisionRevision: string;
  serverDeadlineMs: number;
}>;

const PAGE_ADMISSION_CONTRACTS = Object.freeze({
  [HRIS_ORGANIZATION_POSITIONS_FEATURE]: Object.freeze({
    pageRouteContractKey: HRIS_ORGANIZATION_GRAPH_CONTRACT.pageRouteContractKey,
    productKey: 'hcm' as const,
    surfaceKey: 'hcm.operations' as const,
  }),
  [PAYROLL_RUN_PREPARE_FEATURE]: Object.freeze({
    pageRouteContractKey: PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY,
    productKey: 'hcm' as const,
    surfaceKey: 'hcm.operations' as const,
  }),
  [HRIS_OPERATIONS_FEATURE]: Object.freeze({
    pageRouteContractKey: HRIS_OPERATIONS_API_CONTRACTS.entry.routeContractKey,
    productKey: 'hcm' as const,
    surfaceKey: 'hcm.management' as const,
  }),
});

function nonBlank(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

/**
 * Converts only the exact PAGE boundary installed by ProductSurfaceGuard. The route key is sealed
 * by the feature-specific component mounted at that exact generated route; a surface-level allow
 * never reaches this adapter.
 */
export function resolveHrisFeaturePageAdmission(
  feature: HrisAdmittedFeature,
  decision: AllowedSurfaceDecision | null,
  nowMs = Date.now()
): HrisPageAdmission | null {
  const contract = PAGE_ADMISSION_CONTRACTS[feature];
  const decisionRevalidateAtMs = Date.parse(decision?.revalidateAt ?? '');
  const contextRevalidateAtMs = Date.parse(decision?.context.revalidateAt ?? '');
  const scopeValidUntilMs = decision?.scope.validUntil
    ? Date.parse(decision.scope.validUntil)
    : undefined;
  if (
    !decision ||
    decision.context.productKey !== contract.productKey ||
    decision.context.surfaceKey !== contract.surfaceKey ||
    !nonBlank(decision.scope.key) ||
    !nonBlank(decision.decisionRevision) ||
    !nonBlank(decision.routeGrantRef) ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(decisionRevalidateAtMs) ||
    !Number.isFinite(contextRevalidateAtMs) ||
    decisionRevalidateAtMs > contextRevalidateAtMs ||
    decisionRevalidateAtMs <= nowMs ||
    contextRevalidateAtMs <= nowMs ||
    (scopeValidUntilMs !== undefined &&
      (!Number.isFinite(scopeValidUntilMs) || scopeValidUntilMs <= nowMs))
  ) {
    return null;
  }
  return Object.freeze({
    feature,
    pageRouteContractKey: contract.pageRouteContractKey,
    productKey: contract.productKey,
    surfaceKey: contract.surfaceKey,
    contextScopeKey: decision.scope.key,
    contextScopeKind: decision.scope.kind,
    decisionRevision: decision.decisionRevision,
    serverDeadlineMs: Math.min(
      decisionRevalidateAtMs,
      contextRevalidateAtMs,
      scopeValidUntilMs ?? Number.POSITIVE_INFINITY
    ),
  });
}

export function HrisOrganizationPositionsRouteAdmission() {
  const authority = useProductSurfaceAuthority();
  const decision = useOptionalAllowedExactProductRoute();
  const page = useMemo(
    () =>
      resolveHrisFeaturePageAdmission(
        HRIS_ORGANIZATION_POSITIONS_FEATURE,
        decision,
        authority.serverNowMs ?? Number.NaN
      ),
    [authority.serverNowMs, decision]
  );
  const trustedAdmission = page
    ? (Object.freeze({
        kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
        feature: HRIS_ORGANIZATION_POSITIONS_FEATURE,
        pageRouteContractKey: HRIS_ORGANIZATION_GRAPH_CONTRACT.pageRouteContractKey,
        contextScopeKey: page.contextScopeKey,
        decisionRevision: page.decisionRevision,
      }) satisfies HrisOrganizationPositionsTrustedAdmission)
    : undefined;
  const contextScopeKey = page?.contextScopeKey;
  const ownerAdapter = useMemo(
    () =>
      contextScopeKey ? createHrisOrganizationPositionsQueryAdapter(contextScopeKey) : undefined,
    [contextScopeKey]
  );
  return createElement(HrisOrganizationPositionsWorkspace, {
    admission: trustedAdmission,
    adapter: ownerAdapter,
  });
}

export function HrisPayrollPopulationRouteAdmission({
  dataSource = payrollPopulationDataSource,
}: Readonly<{ dataSource?: PayrollPopulationDataSource }>) {
  const auth = useAuth();
  const authority = useProductSurfaceAuthority();
  const decision = useOptionalAllowedExactProductRoute();
  const page = useMemo(
    () =>
      resolveHrisFeaturePageAdmission(
        PAYROLL_RUN_PREPARE_FEATURE,
        decision,
        authority.serverNowMs ?? Number.NaN
      ),
    [authority.serverNowMs, decision]
  );
  const prepare = useProductActionMutation(PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY);
  const tenantId = String(auth.user?.tenantId ?? '');
  const admittedPage = page && nonBlank(tenantId) ? page : null;
  const admission = admittedPage
    ? (Object.freeze({
        kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
        feature: PAYROLL_RUN_PREPARE_FEATURE,
        pageRouteContractKey: PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY,
        tenantId,
        contextScopeKey: admittedPage.contextScopeKey,
        decisionRevision: admittedPage.decisionRevision,
      }) satisfies PayrollPopulationTrustedAdmission)
    : undefined;
  const ownerBinding = useMemo<PayrollPopulationOwnerBinding | undefined>(
    () =>
      admittedPage
        ? Object.freeze({
            page: Object.freeze({ routeContractKey: PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY }),
            data: Object.freeze({
              contractId: 'IAQ-014' as const,
              routeContractKey: PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
              read: dataSource.population,
            }),
            prepare: Object.freeze({
              contractId: 'PEP-PAY-011' as const,
              routeContractKey: PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
              execute: prepare,
            }),
          })
        : undefined,
    [admittedPage, dataSource.population, prepare]
  );
  return createElement<HrisPayrollPopulationWorkspaceProps>(HrisPayrollPopulationWorkspace, {
    tenantId,
    admission,
    scope: admittedPage
      ? {
          ready: true,
          tenantId,
          contextScopeKey: admittedPage.contextScopeKey,
          decisionRevision: admittedPage.decisionRevision,
        }
      : undefined,
    ownerBinding,
    dataSource,
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

function includeFreshOptionalDeadline(
  deadlines: number[],
  value: string | null | undefined,
  serverNowMs: number
): boolean {
  if (value == null) return true;
  if (!nonBlank(value)) return false;
  const deadlineMs = Date.parse(value);
  if (!Number.isFinite(deadlineMs) || deadlineMs <= serverNowMs) return false;
  deadlines.push(deadlineMs);
  return true;
}

type OperationsDataDecisionLease = Readonly<{ serverDeadlineMs: number }>;

function exactOperationsDataDecision(
  data: ProductSurfaceEvaluationData,
  targetPopulationScopeKey: string,
  decisionRevision: string,
  snapshot: TrustedProductSurfaceAuthoritySnapshot,
  serverNowMs: number
): OperationsDataDecisionLease | null {
  try {
    if (!Number.isFinite(serverNowMs)) return null;
    const envelope = effectiveEnvelope(snapshot);
    const mapped = mapProductSurfaceDirectEvaluation(
      directEvaluation(data),
      { productKey: 'hcm', surfaceKey: 'hcm.operations' },
      serverNowMs
    );
    if (
      mapped.state !== 'allowed' ||
      mapped.decisionRevision !== decisionRevision ||
      mapped.decisionRevision !== snapshot.envelope.decisionRevision ||
      mapped.context.plane !== 'management' ||
      mapped.context.accessSource !== 'MANAGEMENT' ||
      mapped.context.appResourceKey !== 'APP.HCM' ||
      mapped.scope.kind !== 'TARGET_POPULATION' ||
      mapped.scope.key !== targetPopulationScopeKey ||
      mapped.scope.readOnly !== true ||
      mapped.effectiveReadOnly !== true ||
      !isAllowedCanaryDecisionTrusted({ envelope, serverNowMs }, mapped, {
        productId: 'hcm',
        surfaceId: 'hcm.operations',
      })
    ) {
      return null;
    }
    const canonicalContexts = envelope.contexts.filter(
      (context) =>
        context.productKey === 'hcm' &&
        context.surfaceKey === 'hcm.operations' &&
        context.accessMode === envelope.activeAccessMode
    );
    if (canonicalContexts.length !== 1) return null;
    const canonical = canonicalContexts[0]!;
    const deadlines: number[] = [];
    const deadlineValues = [
      mapped.revalidateAt,
      mapped.context.revalidateAt,
      mapped.scope.validUntil,
      data.validUntil,
      canonical.revalidateAt,
      ...mapped.context.scopes.map((scope) => scope.validUntil),
      ...mapped.context.effectiveGrants.map((grant) => grant.validUntil),
      ...canonical.scopes.map((scope) => scope.validUntil),
      ...canonical.effectiveGrants.map((grant) => grant.validUntil),
    ];
    if (
      !deadlineValues.every((value) =>
        includeFreshOptionalDeadline(deadlines, value, serverNowMs)
      ) ||
      deadlines.length === 0
    ) {
      return null;
    }
    return Object.freeze({ serverDeadlineMs: Math.min(...deadlines) });
  } catch {
    return null;
  }
}

function exactTargetPopulationScope(search: string, pageScopeKey: string | undefined) {
  const candidate = new URLSearchParams(search).get(HRIS_OPERATIONS_TARGET_SCOPE_PARAM);
  return candidate && /^scope-[a-f0-9]{32}$/u.test(candidate) && candidate !== pageScopeKey
    ? candidate
    : null;
}

type OperationsDataAdmissionState = Readonly<{
  identity: string;
  authorityGeneration: object;
  serverDeadlineMs: number;
  admission: HrisOperationsTrustedAdmission;
}>;

export function HrisOperationsRouteAdmission({
  dataSource,
}: Readonly<{ dataSource?: HrisOperationsDataSource }>) {
  const location = useLocation();
  const authority = useProductSurfaceAuthority();
  const { evaluateProduct, snapshot, status: authorityStatus } = authority;
  const trustedSnapshot = authorityStatus === 'ready' ? snapshot : undefined;
  const directDecisionClockAnchorRef = useRef<
    | {
        snapshot: NonNullable<typeof trustedSnapshot>;
        anchor: ReturnType<typeof createDirectDecisionClockAnchor>;
      }
    | undefined
  >(undefined);
  if (trustedSnapshot && directDecisionClockAnchorRef.current?.snapshot !== trustedSnapshot) {
    directDecisionClockAnchorRef.current = {
      snapshot: trustedSnapshot,
      anchor: createDirectDecisionClockAnchor(trustedSnapshot.clockOffsetMs),
    };
  } else if (!trustedSnapshot) {
    directDecisionClockAnchorRef.current = undefined;
  }
  const directDecisionClockAnchor = directDecisionClockAnchorRef.current?.anchor;
  const [directDecisionMonotonicFloorMs, setDirectDecisionMonotonicFloorMs] = useState(() =>
    readMonotonicNowMs()
  );
  const authorityGeneration = useMemo(
    () => Object.freeze({ authorityStatus, evaluateProduct, trustedSnapshot }),
    [authorityStatus, evaluateProduct, trustedSnapshot]
  );
  const decision = useOptionalAllowedExactProductRoute();
  const page = useMemo(
    () =>
      resolveHrisFeaturePageAdmission(
        HRIS_OPERATIONS_FEATURE,
        decision,
        directDecisionClockAnchor
          ? directDecisionServerNow(directDecisionClockAnchor, directDecisionMonotonicFloorMs)
          : Number.NaN
      ),
    [decision, directDecisionClockAnchor, directDecisionMonotonicFloorMs]
  );
  // The PAGE route's owner binding is CONFIG_SCOPE. Product Surface still represents its selected
  // context with the sealed scope-kind vocabulary, so DATA admission is separated by identity
  // rather than by inventing CONFIG_SCOPE as a Product Surface scope kind.
  const pageAdmission = page;
  const targetPopulationScopeKey = exactTargetPopulationScope(
    location.search,
    pageAdmission?.contextScopeKey
  );
  const identity =
    pageAdmission && targetPopulationScopeKey
      ? `${pageAdmission.contextScopeKey}\u0000${pageAdmission.decisionRevision}\u0000${targetPopulationScopeKey}`
      : '';
  const [dataAdmission, setDataAdmission] = useState<OperationsDataAdmissionState | null>(null);

  useEffect(() => {
    if (
      !pageAdmission ||
      !targetPopulationScopeKey ||
      authorityStatus !== 'ready' ||
      !trustedSnapshot ||
      !directDecisionClockAnchor
    ) {
      setDataAdmission(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const request = (routeContractKey: string) =>
      evaluateProduct(
        {
          subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey: 'hcm.operations' },
          routeContractKey,
          contextScopeKey: targetPopulationScopeKey,
        },
        { signal: controller.signal }
      );
    void Promise.all([
      request(HRIS_OPERATIONS_API_CONTRACTS.list.routeContractKey),
      request(HRIS_OPERATIONS_API_CONTRACTS.detail.routeContractKey),
    ])
      .then(([list, detail]) => {
        if (!active) return;
        const serverNowMs = directDecisionServerNow(
          directDecisionClockAnchor,
          directDecisionMonotonicFloorMs
        );
        const listLease = exactOperationsDataDecision(
          list,
          targetPopulationScopeKey,
          pageAdmission.decisionRevision,
          trustedSnapshot,
          serverNowMs
        );
        const detailLease = exactOperationsDataDecision(
          detail,
          targetPopulationScopeKey,
          pageAdmission.decisionRevision,
          trustedSnapshot,
          serverNowMs
        );
        if (pageAdmission.serverDeadlineMs <= serverNowMs || !listLease || !detailLease) {
          setDataAdmission(null);
          return;
        }
        setDataAdmission(
          Object.freeze({
            identity,
            authorityGeneration,
            serverDeadlineMs: Math.min(
              pageAdmission.serverDeadlineMs,
              listLease.serverDeadlineMs,
              detailLease.serverDeadlineMs
            ),
            admission: Object.freeze({
              kind: 'TRUSTED_PRODUCT_SURFACE_PAGE_AND_DATA',
              feature: HRIS_OPERATIONS_FEATURE,
              pageRouteContractKey: HRIS_OPERATIONS_API_CONTRACTS.entry.routeContractKey,
              pageContextScopeKind: 'CONFIG_SCOPE',
              pageDecisionRevision: pageAdmission.decisionRevision,
              targetPopulationScopeKey,
              dataRouteContractKeys: Object.freeze([
                HRIS_OPERATIONS_API_CONTRACTS.list.routeContractKey,
                HRIS_OPERATIONS_API_CONTRACTS.detail.routeContractKey,
              ] as const),
            }),
          })
        );
      })
      .catch(() => {
        if (active) setDataAdmission(null);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    authorityGeneration,
    authorityStatus,
    directDecisionClockAnchor,
    directDecisionMonotonicFloorMs,
    evaluateProduct,
    identity,
    pageAdmission,
    targetPopulationScopeKey,
    trustedSnapshot,
  ]);

  useEffect(() => {
    if (
      !dataAdmission ||
      dataAdmission.identity !== identity ||
      dataAdmission.authorityGeneration !== authorityGeneration ||
      !directDecisionClockAnchor
    ) {
      return undefined;
    }
    return scheduleDirectDecisionLease({
      anchor: directDecisionClockAnchor,
      serverDeadlineMs: dataAdmission.serverDeadlineMs,
      onRenew: () => undefined,
      onExpire: () => {
        setDirectDecisionMonotonicFloorMs(readMonotonicNowMs());
        setDataAdmission((current) => (current === dataAdmission ? null : current));
      },
    });
  }, [authorityGeneration, dataAdmission, directDecisionClockAnchor, identity]);

  const serverNowMs = directDecisionClockAnchor
    ? directDecisionServerNow(directDecisionClockAnchor, directDecisionMonotonicFloorMs)
    : Number.NaN;

  const admission =
    authorityStatus === 'ready' &&
    pageAdmission &&
    targetPopulationScopeKey &&
    dataAdmission?.identity === identity &&
    dataAdmission.authorityGeneration === authorityGeneration &&
    dataAdmission.serverDeadlineMs > serverNowMs
      ? dataAdmission.admission
      : undefined;
  return createElement(HrisOperationsWorkspace, {
    admission,
    exceptionContextScopeKey: admission?.targetPopulationScopeKey,
    dataSource,
  });
}
