import { useEffect, useMemo, useState } from 'react';
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
import {
  HrisWorkflowPolicyWorkspace,
  HRIS_APPROVAL_ADAPTER_FEATURE,
  HRIS_APPROVAL_SHARED_API_CONTRACTS,
} from '../administration/workflow';
import { HrisTeamDelegationWorkspace } from '../team/delegation';
import { isAllowedCanaryDecisionTrusted } from '../../../components/product-surface-canary-runtime';
import { mapProductSurfaceDirectEvaluation } from '../../../components/product-surface-context';

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
import type { HrisApprovalAdapterAdmission } from '../administration/workflow';

export const HRIS_SYS_003_PAGE_ROUTE_CONTRACTS = Object.freeze({
  SETTINGS_WORKFLOW: 'route.hcm.configuration.workflow.page',
  TEAM_DELEGATION: 'route.hcm.team.delegation.page',
} as const);

type Sys003Workspace = keyof typeof HRIS_SYS_003_PAGE_ROUTE_CONTRACTS;

const SYS003_CONTRACTS = Object.freeze({
  SETTINGS_WORKFLOW: Object.freeze({
    workspace: 'SETTINGS_WORKFLOW' as const,
    hcmSurfaceId: 'hcm.management' as const,
    hcmCapability: 'hcm.configuration.workflow.view',
    hcmPageRouteContractKey: HRIS_SYS_003_PAGE_ROUTE_CONTRACTS.SETTINGS_WORKFLOW,
    approvalSurfaceId: 'approvals.admin' as const,
    approvalCapability: HRIS_APPROVAL_SHARED_API_CONTRACTS.policyList.capability,
    approvalPageRouteContractKey: HRIS_APPROVAL_SHARED_API_CONTRACTS.policyList.routeContractKey,
  }),
  TEAM_DELEGATION: Object.freeze({
    workspace: 'TEAM_DELEGATION' as const,
    hcmSurfaceId: 'hcm.team' as const,
    hcmCapability: 'hcm.team.members.view',
    hcmPageRouteContractKey: HRIS_SYS_003_PAGE_ROUTE_CONTRACTS.TEAM_DELEGATION,
    approvalSurfaceId: 'approvals.work' as const,
    approvalCapability: HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationList.capability,
    approvalPageRouteContractKey:
      HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationList.routeContractKey,
  }),
});

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

function fresh(value: string | null | undefined, serverNowMs: number): boolean {
  if (value == null) return true;
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) && deadline > serverNowMs;
}

export function resolveSys003ApprovalOwnerScopeKey(
  workspace: Sys003Workspace,
  snapshot: TrustedProductSurfaceAuthoritySnapshot,
  serverNowMs: number
): string | undefined {
  const contract = SYS003_CONTRACTS[workspace];
  const contexts = snapshot.envelope.contexts.filter(
    (context) =>
      context.productKey === 'approvals' &&
      context.surfaceKey === contract.approvalSurfaceId &&
      context.accessMode === snapshot.envelope.activeAccessMode &&
      fresh(context.revalidateAt, serverNowMs)
  );
  if (contexts.length !== 1) return undefined;
  const context = contexts[0]!;
  const grants = context.effectiveGrants.filter(
    (grant) =>
      grant.grantKind === 'CAPABILITY' &&
      grant.capabilityContractKey === contract.approvalCapability &&
      grant.activationState === 'ACTIVE' &&
      fresh(grant.validUntil, serverNowMs)
  );
  if (grants.length !== 1) return undefined;
  const grantScopeKeys = new Set(grants[0]!.scopeKeys);
  const scopes = context.scopes.filter(
    (scope) =>
      grantScopeKeys.has(scope.key) &&
      scope.key.trim().length > 0 &&
      fresh(scope.validUntil, serverNowMs)
  );
  if (scopes.length === 1) return scopes[0]!.key;
  const defaults = scopes.filter((scope) => scope.isDefault);
  return defaults.length === 1 ? defaults[0]!.key : undefined;
}

export type Sys003ApprovalReadLease = Readonly<{
  ownerContextScopeKey: string;
  serverDeadlineMs: number;
}>;

export function resolveSys003ApprovalReadLease(
  workspace: Sys003Workspace,
  data: ProductSurfaceEvaluationData,
  expected: Readonly<{ ownerContextScopeKey: string; decisionRevision: string }>,
  snapshot: TrustedProductSurfaceAuthoritySnapshot,
  serverNowMs: number
): Sys003ApprovalReadLease | null {
  try {
    const contract = SYS003_CONTRACTS[workspace];
    const decision = mapProductSurfaceDirectEvaluation(
      directEvaluation(data),
      { productKey: 'approvals', surfaceKey: contract.approvalSurfaceId },
      serverNowMs
    );
    if (
      decision.state !== 'allowed' ||
      decision.decisionRevision !== expected.decisionRevision ||
      decision.decisionRevision !== snapshot.envelope.decisionRevision ||
      decision.scope.key !== expected.ownerContextScopeKey ||
      !isAllowedCanaryDecisionTrusted(
        { envelope: effectiveEnvelope(snapshot), serverNowMs },
        decision,
        { productId: 'approvals', surfaceId: contract.approvalSurfaceId }
      )
    ) {
      return null;
    }
    const grants = decision.context.effectiveGrants.filter(
      (grant) =>
        grant.grantKind === 'CAPABILITY' &&
        grant.capabilityContractKey === contract.approvalCapability &&
        grant.activationState === 'ACTIVE' &&
        grant.scopeKeys.includes(expected.ownerContextScopeKey)
    );
    if (grants.length !== 1) return null;
    const deadlineValues = [
      decision.revalidateAt,
      decision.context.revalidateAt,
      decision.scope.validUntil,
      data.validUntil ?? undefined,
      grants[0]!.validUntil,
    ].filter((value): value is string => value !== undefined);
    const deadlines = deadlineValues.map(Date.parse);
    if (
      deadlines.length < 2 ||
      deadlines.some((deadline) => !Number.isFinite(deadline) || deadline <= serverNowMs)
    ) {
      return null;
    }
    return Object.freeze({
      ownerContextScopeKey: expected.ownerContextScopeKey,
      serverDeadlineMs: Math.min(...deadlines),
    });
  } catch {
    return null;
  }
}

type HcmPageEvidence = Readonly<{
  tenantId: string;
  actorId: string;
  hcmContextScopeKey: string;
  decisionRevision: string;
  serverDeadlineMs: number;
}>;

type ApprovalReadState =
  | Readonly<{ state: 'pending' | 'denied'; identity: string }>
  | Readonly<{
      state: 'allowed';
      identity: string;
      ownerContextScopeKey: string;
      serverDeadlineMs: number;
    }>;

function HrisSys003RouteAdmission({ workspace }: Readonly<{ workspace: Sys003Workspace }>) {
  const auth = useAuth();
  const pageDecision = useOptionalAllowedExactProductRoute();
  const authority = useProductSurfaceAuthority();
  const { evaluateProduct } = authority;
  const contract = SYS003_CONTRACTS[workspace];
  const runtimeEnabled = import.meta.env.VITE_HRIS_SYS_003_ENABLED === 'true';
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: contract.hcmSurfaceId,
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
  const serverNowMs = authority.status === 'ready' ? authority.serverNowMs : undefined;
  const pageEvidence = useMemo<HcmPageEvidence | null>(() => {
    if (
      !runtimeEnabled ||
      !snapshot ||
      serverNowMs === undefined ||
      !pageDecision ||
      !requestGoverned ||
      !requestReady ||
      !requestContextScopeKey ||
      !tenantId ||
      !actorId ||
      requestTenantId !== tenantId ||
      requestActorId !== actorId ||
      requestProductId !== 'hcm' ||
      requestSurfaceId !== contract.hcmSurfaceId ||
      requestContextScopeKey !== pageDecision.scope.key ||
      requestDecisionRevision !== pageDecision.decisionRevision ||
      pageDecision.decisionRevision !== snapshot.envelope.decisionRevision ||
      pageDecision.scope.readOnly !== true ||
      pageDecision.effectiveReadOnly !== true ||
      !isAllowedCanaryDecisionTrusted(
        { envelope: effectiveEnvelope(snapshot), serverNowMs },
        pageDecision,
        { productId: 'hcm', surfaceId: contract.hcmSurfaceId }
      )
    ) {
      return null;
    }
    const grants = pageDecision.context.effectiveGrants.filter(
      (grant) =>
        grant.grantKind === 'CAPABILITY' &&
        grant.capabilityContractKey === contract.hcmCapability &&
        grant.activationState === 'ACTIVE' &&
        grant.readOnly === true &&
        grant.scopeKeys.includes(pageDecision.scope.key)
    );
    if (grants.length !== 1) return null;
    const deadlineValues = [
      pageDecision.revalidateAt,
      pageDecision.context.revalidateAt,
      pageDecision.scope.validUntil,
      grants[0]!.validUntil,
    ].filter((value): value is string => value !== undefined);
    const deadlines = deadlineValues.map(Date.parse);
    if (
      deadlines.length < 2 ||
      deadlines.some((deadline) => !Number.isFinite(deadline) || deadline <= serverNowMs)
    ) {
      return null;
    }
    return Object.freeze({
      tenantId,
      actorId,
      hcmContextScopeKey: pageDecision.scope.key,
      decisionRevision: pageDecision.decisionRevision,
      serverDeadlineMs: Math.min(...deadlines),
    });
  }, [
    actorId,
    contract.hcmCapability,
    contract.hcmSurfaceId,
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
    serverNowMs,
    snapshot,
    tenantId,
  ]);
  const ownerContextScopeKey = useMemo(
    () =>
      pageEvidence && snapshot && serverNowMs !== undefined
        ? resolveSys003ApprovalOwnerScopeKey(workspace, snapshot, serverNowMs)
        : undefined,
    [pageEvidence, serverNowMs, snapshot, workspace]
  );
  const identity =
    pageEvidence && ownerContextScopeKey
      ? JSON.stringify([
          workspace,
          contract.hcmPageRouteContractKey,
          contract.approvalPageRouteContractKey,
          pageEvidence.tenantId,
          pageEvidence.actorId,
          pageEvidence.hcmContextScopeKey,
          ownerContextScopeKey,
          pageEvidence.decisionRevision,
        ])
      : '';
  const hcmDecisionRevision = pageEvidence?.decisionRevision ?? '';
  const hcmPageServerDeadlineMs = pageEvidence?.serverDeadlineMs ?? 0;
  const [evaluationGeneration, setEvaluationGeneration] = useState(0);
  const [readState, setReadState] = useState<ApprovalReadState | null>(null);
  const clockAnchor = useMemo(
    () => (snapshot ? createDirectDecisionClockAnchor(snapshot.clockOffsetMs) : undefined),
    [snapshot]
  );

  useEffect(() => {
    if (
      !identity ||
      !hcmDecisionRevision ||
      !hcmPageServerDeadlineMs ||
      !ownerContextScopeKey ||
      !snapshot ||
      !clockAnchor
    ) {
      setReadState(null);
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setReadState(Object.freeze({ state: 'pending', identity }));
    void evaluateProduct(
      {
        subject: {
          type: 'PRODUCT',
          productKey: 'approvals',
          surfaceKey: contract.approvalSurfaceId,
        },
        routeContractKey: contract.approvalPageRouteContractKey,
        contextScopeKey: ownerContextScopeKey,
      },
      { signal: controller.signal }
    )
      .then((data) => {
        if (!active) return;
        const lease = resolveSys003ApprovalReadLease(
          workspace,
          data,
          {
            ownerContextScopeKey,
            decisionRevision: hcmDecisionRevision,
          },
          snapshot,
          directDecisionServerNow(clockAnchor)
        );
        setReadState(
          lease
            ? Object.freeze({
                state: 'allowed',
                identity,
                ownerContextScopeKey: lease.ownerContextScopeKey,
                serverDeadlineMs: Math.min(hcmPageServerDeadlineMs, lease.serverDeadlineMs),
              })
            : Object.freeze({ state: 'denied', identity })
        );
      })
      .catch(() => {
        if (active) setReadState(Object.freeze({ state: 'denied', identity }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    clockAnchor,
    contract.approvalPageRouteContractKey,
    contract.approvalSurfaceId,
    evaluateProduct,
    evaluationGeneration,
    hcmDecisionRevision,
    hcmPageServerDeadlineMs,
    identity,
    ownerContextScopeKey,
    snapshot,
    workspace,
  ]);

  useEffect(() => {
    if (!clockAnchor || readState?.state !== 'allowed' || readState.identity !== identity) {
      return undefined;
    }
    return scheduleDirectDecisionLease({
      anchor: clockAnchor,
      serverDeadlineMs: readState.serverDeadlineMs,
      onRenew: () => setEvaluationGeneration((current) => current + 1),
      onExpire: () =>
        setReadState((current) =>
          current === readState ? Object.freeze({ state: 'denied', identity }) : current
        ),
    });
  }, [clockAnchor, identity, readState]);

  if (!runtimeEnabled) {
    return workspace === 'SETTINGS_WORKFLOW' ? (
      <HrisWorkflowPolicyWorkspace />
    ) : (
      <HrisTeamDelegationWorkspace />
    );
  }
  if (pageEvidence && !ownerContextScopeKey) {
    return (
      <Typography role="alert" data-runtime-state="denied">
        Approval owner scope is unavailable for this HR workspace.
      </Typography>
    );
  }
  if (
    identity &&
    (!readState || readState.identity !== identity || readState.state === 'pending')
  ) {
    return (
      <Typography role="status" aria-live="polite" data-runtime-state="loading">
        Loading cross-product authority…
      </Typography>
    );
  }
  if (readState?.state === 'denied' && readState.identity === identity) {
    return (
      <Typography role="alert" data-runtime-state="denied">
        Approval owner access is unavailable for this HR workspace.
      </Typography>
    );
  }

  let admission: HrisApprovalAdapterAdmission | undefined;
  if (
    pageEvidence &&
    readState?.state === 'allowed' &&
    readState.identity === identity &&
    clockAnchor &&
    readState.serverDeadlineMs > directDecisionServerNow(clockAnchor, readMonotonicNowMs())
  ) {
    admission = Object.freeze({
      kind: 'TRUSTED_HRIS_APPROVAL_CROSS_PRODUCT',
      feature: HRIS_APPROVAL_ADAPTER_FEATURE,
      workspace: contract.workspace,
      tenantEnrolled: true,
      tenantId: pageEvidence.tenantId,
      actorId: pageEvidence.actorId,
      ownerTenantId: pageEvidence.tenantId,
      ownerActorId: pageEvidence.actorId,
      hcmPageRouteContractKey: contract.hcmPageRouteContractKey,
      hcmContextScopeKey: pageEvidence.hcmContextScopeKey,
      ownerContextScopeKey: readState.ownerContextScopeKey,
      ...(workspace === 'TEAM_DELEGATION'
        ? { populationScopeKey: pageEvidence.hcmContextScopeKey }
        : {}),
      pageDecisionRevision: pageEvidence.decisionRevision,
      read: Object.freeze({
        allowed: true,
        capability: contract.approvalCapability,
        routeContractKey: contract.approvalPageRouteContractKey,
        contextScopeKey: readState.ownerContextScopeKey,
        decisionRevision: pageEvidence.decisionRevision,
      }),
      // v51 has no contract-owned Approval ACTION SoD mapping. Commands therefore remain absent;
      // neither workspace can construct or execute a mutation from PAGE/read evidence alone.
    });
  }
  return workspace === 'SETTINGS_WORKFLOW' ? (
    <HrisWorkflowPolicyWorkspace admission={admission} />
  ) : (
    <HrisTeamDelegationWorkspace admission={admission} />
  );
}

export function HrisWorkflowPolicyRouteAdmission() {
  return <HrisSys003RouteAdmission workspace="SETTINGS_WORKFLOW" />;
}

export function HrisTeamDelegationRouteAdmission() {
  return <HrisSys003RouteAdmission workspace="TEAM_DELEGATION" />;
}
