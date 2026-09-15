import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HttpError,
  HttpTransportError,
  productSurfaceServerNow,
  useProductSurfaceAuthority,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  getApprovalSignatureProviderDiagnosticHistory,
  getApprovalSignatureProviderDiagnostics,
  getApprovalSignatureProviderOverview,
  getApprovalSignatureProviderPolicy,
  getApprovalSignatureProviderPolicyHistory,
  probeApprovalSignatureProviderKms,
  probeApprovalSignatureProviders,
  snapshotApprovalSignatureProviderKmsProbeInput,
  snapshotApprovalSignatureProviderProbeInput,
  snapshotApprovalSignatureProviderTarget,
  type ApprovalSignatureProviderKmsProbeInput,
  type ApprovalSignatureProviderPinnedAuthority,
  type ApprovalSignatureProviderProbeInput,
} from '@dwp-frontend/shared-utils/api/approval-signature-provider-api';
import type {
  SignatureProviderDiagnostics,
  SignatureProviderOverview,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import {
  hasWritableProductSurfaceCapability,
  resolveCanonicalProductSurfaceContext,
} from '../../components/product-surface-capability-access';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useProductSurfaceGovernedMutation } from '../../components/use-product-surface-governed-mutation';
import {
  approvalManagementScopeIdentity,
  useApprovalManagementScopeReady,
} from './approval-management-scope';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { approvalSignatureSourceState } from './approval-signature-source-state';
import {
  signatureDiagnosticsScopeMatches,
  type SignatureDiagnosticsReadState,
} from './approval-signature-diagnostics-model';
import {
  APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES,
  approvalSignatureOfficialGatewayRouteAvailable,
  type ApprovalSignatureGatewayRouteStatus,
} from './approval-signature-gateway-contract';
import { approvalSignatureProviderRuntimeReady } from './approval-signature-runtime-readiness';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';

import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

export const APPROVAL_SIGNATURE_PROVIDER_ROUTES = {
  'signature-diagnostics.data': ['GET', '/api/approvals/v1/admin/signatures/diagnostics'],
  'signature-provider-diagnostics.data': [
    'GET',
    '/api/approvals/v1/admin/signatures/providers/{providerId}/diagnostics',
  ],
  'signature-diagnostic-history.data': [
    'GET',
    '/api/approvals/v1/admin/signatures/diagnostic-history',
  ],
  'signature-policy.data': ['GET', '/api/approvals/v1/admin/signatures/policy'],
  'signature-policy-history.data': [
    'GET',
    '/api/approvals/v1/admin/signatures/policies/{policyId}/history',
  ],
  'signature-probe.action': ['POST', '/api/approvals/v1/admin/signatures/probes'],
  'signature-kms-probe.action': ['POST', '/api/approvals/v1/admin/signatures/kms/probes'],
} as const;

type SignatureProviderRoute = keyof typeof APPROVAL_SIGNATURE_PROVIDER_ROUTES;
const manageCapability = 'approvals.signature.manage';
const requiredReadRoutes = [
  'signature-diagnostics.data',
  'signature-provider-diagnostics.data',
  'signature-diagnostic-history.data',
  'signature-policy.data',
  'signature-policy-history.data',
] as const satisfies readonly SignatureProviderRoute[];

export function approvalSignatureProviderRouteInstalled(
  leaf: SignatureProviderRoute,
  projections: readonly ProductAuthorizationRouteProjection[] = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  officialRoutes: readonly ApprovalSignatureGatewayRouteStatus[] = APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES
): boolean {
  const [method, path] = APPROVAL_SIGNATURE_PROVIDER_ROUTES[leaf];
  const matches = projections.filter(
    (route) => route.routeContractKey === `route.approvals.admin.${leaf}`
  );
  return (
    approvalSignatureOfficialGatewayRouteAvailable(method, path, officialRoutes) &&
    matches.length === 1 &&
    matches[0]!.productId === 'approvals' &&
    matches[0]!.surfaceId === 'approvals.admin' &&
    matches[0]!.routeKind === (method === 'GET' ? 'DATA' : 'ACTION') &&
    matches[0]!.gatewayBindings.length === 1 &&
    matches[0]!.gatewayBindings[0]!.method === method &&
    matches[0]!.gatewayBindings[0]!.path === path
  );
}

export function approvalSignatureProviderReadModelInstalled(
  projections: readonly ProductAuthorizationRouteProjection[] = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  officialRoutes: readonly ApprovalSignatureGatewayRouteStatus[] = APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES
): boolean {
  return requiredReadRoutes.every((leaf) =>
    approvalSignatureProviderRouteInstalled(leaf, projections, officialRoutes)
  );
}

function diagnosticsReadState(source: {
  data: unknown;
  error?: unknown;
  failureReason?: unknown;
  failureCount?: number;
  isError?: boolean;
  isPending?: boolean;
  isFetching?: boolean;
}): SignatureDiagnosticsReadState {
  const state = approvalSignatureSourceState(source);
  if (state === 'READY') return 'CURRENT';
  return state;
}

function subordinateReadState(
  source: Parameters<typeof diagnosticsReadState>[0],
  overviewState: SignatureDiagnosticsReadState
): SignatureDiagnosticsReadState {
  return overviewState === 'CURRENT' ? diagnosticsReadState(source) : overviewState;
}

function pinnedAuthority(
  overview: SignatureProviderOverview,
  contextScopeKey: string,
  expectedDecisionRevision: string,
  beforeDispatch?: () => void
): ApprovalSignatureProviderPinnedAuthority {
  if (
    overview.scope.contextScopeKey !== contextScopeKey ||
    overview.scope.decisionRevision !== expectedDecisionRevision
  ) {
    throw new ProductSurfaceOperationCancelledError();
  }
  return Object.freeze({
    contextScopeKey,
    expectedDecisionRevision,
    resourceSetKey: overview.scope.resourceSetKey,
    registrySha256: overview.scope.registrySha256,
    sourceRevision: overview.scope.sourceRevision,
    sourceSha256: overview.scope.sourceSha256,
    ...(beforeDispatch ? { beforeDispatch } : {}),
  });
}

function overviewFingerprint(value: SignatureProviderOverview): string {
  return JSON.stringify(value);
}

type PreparedCommand<T> = Readonly<{
  operation: 'PROVIDER' | 'KMS';
  binding: ReturnType<typeof useApprovalManagementCommandScope>['binding'];
  actorId: string;
  overview: SignatureProviderOverview;
  input: T;
}>;
type PreparedProbe = PreparedCommand<ApprovalSignatureProviderProbeInput>;
type PreparedKmsProbe = PreparedCommand<ApprovalSignatureProviderKmsProbeInput>;

export function useApprovalSignatureProviderDiagnostics() {
  const { t } = useTranslation('approvals');
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const scopeIdentity = approvalManagementScopeIdentity(requestScope.cacheKey);
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const experience = useApprovalExperience();
  const decision = useOptionalAllowedProductSurface();
  const surfaceAuthority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [diagnosticCursor, setDiagnosticCursor] = useState<string | null>(null);
  const [policyCursor, setPolicyCursor] = useState<string | null>(null);
  const [probeFeedback, setProbeFeedback] = useState<'UNKNOWN' | 'CHANGED' | null>(null);
  const uncertainProbe = useRef<PreparedProbe | null>(null);
  const uncertainKmsProbe = useRef<PreparedKmsProbe | null>(null);
  const [uncertainOperation, setUncertainOperation] = useState<'PROVIDER' | 'KMS' | null>(null);
  const mounted = useRef(false);
  const lock = useRef<string | null>(null);
  const detailsInstalled = approvalSignatureProviderRouteInstalled(
    'signature-provider-diagnostics.data'
  );
  const diagnosticHistoryInstalled = approvalSignatureProviderRouteInstalled(
    'signature-diagnostic-history.data'
  );
  const policyInstalled = approvalSignatureProviderRouteInstalled('signature-policy.data');
  const policyHistoryInstalled = approvalSignatureProviderRouteInstalled(
    'signature-policy-history.data'
  );
  const probeInstalled = approvalSignatureProviderRouteInstalled('signature-probe.action');
  const kmsProbeInstalled = approvalSignatureProviderRouteInstalled('signature-kms-probe.action');
  const nativeReadsInstalled = approvalSignatureProviderReadModelInstalled();
  const contextScopeKey = requestScope.contextScopeKey;
  const expectedDecisionRevision = requestScope.cacheKey[5];
  const actorId = requestScope.cacheKey[1];
  const current = useRef({
    scopeIdentity,
    scopeReady,
    contextScopeKey,
    expectedDecisionRevision,
    actorId,
    decision,
    snapshot: surfaceAuthority.snapshot,
    experience,
    diagnosticsInstalled: nativeReadsInstalled,
    detailsInstalled,
    probeInstalled,
    kmsProbeInstalled,
  });
  current.current = {
    scopeIdentity,
    scopeReady,
    contextScopeKey,
    expectedDecisionRevision,
    actorId,
    decision,
    snapshot: surfaceAuthority.snapshot,
    experience,
    diagnosticsInstalled: nativeReadsInstalled,
    detailsInstalled,
    probeInstalled,
    kmsProbeInstalled,
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setSelectedProviderId(null);
    setHistoryOpen(false);
    setDiagnosticCursor(null);
    setPolicyCursor(null);
    setProbeFeedback(null);
    uncertainProbe.current = null;
    uncertainKmsProbe.current = null;
    setUncertainOperation(null);
    lock.current = null;
  }, [scopeIdentity]);

  const assertScopeCurrent = (identity = scopeIdentity) => {
    const latest = current.current;
    if (
      !mounted.current ||
      latest.scopeIdentity !== identity ||
      !latest.scopeReady ||
      !latest.diagnosticsInstalled ||
      !latest.experience.canViewSignatures ||
      !latest.contextScopeKey ||
      !/^psr-[a-f0-9]{64}$/.test(latest.expectedDecisionRevision)
    ) {
      throw new ProductSurfaceOperationCancelledError();
    }
  };

  const overviewKey = ['approvals', 'admin', 'signature-diagnostics', ...requestScope.cacheKey];
  const overview = useQuery({
    queryKey: overviewKey,
    queryFn: ({ signal }) => {
      const identity = scopeIdentity;
      assertScopeCurrent(identity);
      return getApprovalSignatureProviderOverview(
        {
          contextScopeKey: contextScopeKey!,
          expectedDecisionRevision,
          beforeDispatch: () => assertScopeCurrent(identity),
        },
        signal
      );
    },
    enabled:
      nativeReadsInstalled &&
      scopeReady &&
      experience.canViewSignatures &&
      Boolean(contextScopeKey && /^psr-[a-f0-9]{64}$/.test(expectedDecisionRevision)),
    staleTime: 30_000,
    retry: false,
  });
  const overviewState = diagnosticsReadState(overview);
  const runtimeReady =
    overviewState === 'CURRENT' &&
    approvalSignatureProviderRuntimeReady(
      overview.data,
      surfaceAuthority.snapshot ? productSurfaceServerNow(surfaceAuthority.snapshot) : Date.now()
    );

  const currentPinnedAuthority = (beforeDispatch?: () => void) => {
    const value = queryClient.getQueryData<SignatureProviderOverview>(overviewKey);
    if (!value) throw new ProductSurfaceOperationCancelledError();
    return pinnedAuthority(value, contextScopeKey!, expectedDecisionRevision, beforeDispatch);
  };

  const detailKey = [
    'approvals',
    'admin',
    'signature-provider-diagnostics',
    selectedProviderId ?? '',
    ...requestScope.cacheKey,
  ];
  const details = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => {
      const identity = scopeIdentity;
      const providerId = selectedProviderId!;
      assertScopeCurrent(identity);
      return getApprovalSignatureProviderDiagnostics(
        providerId,
        currentPinnedAuthority(() => assertScopeCurrent(identity)),
        signal
      );
    },
    enabled: detailsInstalled && overviewState === 'CURRENT' && selectedProviderId !== null,
    staleTime: 15_000,
    retry: false,
  });
  const detailsState = subordinateReadState(details, overviewState);

  const policyKey = ['approvals', 'admin', 'signature-provider-policy', ...requestScope.cacheKey];
  const policy = useQuery({
    queryKey: policyKey,
    queryFn: ({ signal }) => {
      const identity = scopeIdentity;
      assertScopeCurrent(identity);
      return getApprovalSignatureProviderPolicy(
        currentPinnedAuthority(() => assertScopeCurrent(identity)),
        signal
      );
    },
    enabled: policyInstalled && overviewState === 'CURRENT',
    staleTime: 30_000,
    retry: false,
  });
  const policyState = subordinateReadState(policy, overviewState);

  const diagnosticHistoryKey = [
    'approvals',
    'admin',
    'signature-diagnostic-history',
    diagnosticCursor ?? '',
    ...requestScope.cacheKey,
  ];
  const diagnosticHistory = useQuery({
    queryKey: diagnosticHistoryKey,
    queryFn: ({ signal }) => {
      const identity = scopeIdentity;
      assertScopeCurrent(identity);
      return getApprovalSignatureProviderDiagnosticHistory(
        diagnosticCursor,
        currentPinnedAuthority(() => assertScopeCurrent(identity)),
        signal
      );
    },
    enabled: diagnosticHistoryInstalled && historyOpen && overviewState === 'CURRENT',
    staleTime: 15_000,
    retry: false,
  });
  const diagnosticHistoryState = subordinateReadState(diagnosticHistory, overviewState);

  const policyHistoryKey = [
    'approvals',
    'admin',
    'signature-policy-history',
    policy.data?.policyId ?? '',
    policyCursor ?? '',
    ...requestScope.cacheKey,
  ];
  const policyHistory = useQuery({
    queryKey: policyHistoryKey,
    queryFn: ({ signal }) => {
      const identity = scopeIdentity;
      assertScopeCurrent(identity);
      return getApprovalSignatureProviderPolicyHistory(
        policy.data!.policyId,
        policyCursor,
        currentPinnedAuthority(() => assertScopeCurrent(identity)),
        signal
      );
    },
    enabled:
      policyHistoryInstalled && historyOpen && policyState === 'CURRENT' && Boolean(policy.data),
    staleTime: 15_000,
    retry: false,
  });
  const policyHistoryState = subordinateReadState(policyHistory, policyState);

  const canManage = useMemo(() => {
    const entry = resolveCanonicalProductSurfaceContext(decision, surfaceAuthority.snapshot);
    const now = surfaceAuthority.snapshot
      ? productSurfaceServerNow(surfaceAuthority.snapshot)
      : Date.now();
    return hasWritableProductSurfaceCapability(decision, entry, manageCapability, now);
  }, [decision, surfaceAuthority.snapshot]);

  const assertPrepared = (prepared: PreparedCommand<unknown>) => {
    assertScopeCurrent(prepared.binding.scopeIdentity);
    const latest = current.current;
    const cached = queryClient.getQueryData<SignatureProviderOverview>(overviewKey);
    const cacheState = queryClient.getQueryState(overviewKey);
    const entry = resolveCanonicalProductSurfaceContext(latest.decision, latest.snapshot);
    const now = latest.snapshot ? productSurfaceServerNow(latest.snapshot) : Date.now();
    if (
      !(prepared.operation === 'PROVIDER' ? latest.probeInstalled : latest.kmsProbeInstalled) ||
      !latest.detailsInstalled ||
      latest.actorId !== prepared.actorId ||
      !commandScope.isCurrent(prepared.binding) ||
      !cached ||
      overviewFingerprint(cached) !== overviewFingerprint(prepared.overview) ||
      cacheState?.status !== 'success' ||
      cacheState.fetchStatus !== 'idle' ||
      cacheState.error != null ||
      cacheState.fetchFailureCount !== 0 ||
      !signatureDiagnosticsScopeMatches(cached.scope, prepared.overview.scope) ||
      !hasWritableProductSurfaceCapability(latest.decision, entry, manageCapability, now)
    ) {
      throw new ProductSurfaceOperationCancelledError();
    }
  };

  const dispatchProbe = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.signature-probe.action',
    taskKind: 'ADMINISTRATION',
  });
  const dispatchKmsProbe = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.signature-kms-probe.action',
    taskKind: 'ADMINISTRATION',
  });

  const probe = useMutation({
    retry: false,
    mutationFn: async (prepared: PreparedProbe) => {
      let checks = 0;
      try {
        assertPrepared(prepared);
        return await dispatchProbe((execution) => {
          assertPrepared(prepared);
          return probeApprovalSignatureProviders(
            prepared.input,
            execution,
            {
              ...pinnedAuthority(prepared.overview, contextScopeKey!, expectedDecisionRevision),
              beforeDispatch: () => {
                assertPrepared(prepared);
                checks += 1;
              },
            }
          );
        });
      } catch (error) {
        if (mounted.current && commandScope.isCurrent(prepared.binding)) {
          const unknown =
            checks >= 2 &&
            (error instanceof HttpTransportError ||
              (error instanceof HttpError && error.status >= 500) ||
              (!(error instanceof HttpError) &&
                !(error instanceof ProductSurfaceOperationCancelledError)));
          if (unknown) {
            uncertainProbe.current = prepared;
            setUncertainOperation('PROVIDER');
          } else {
            uncertainProbe.current = null;
            setUncertainOperation(null);
          }
          setProbeFeedback(unknown ? 'UNKNOWN' : 'CHANGED');
        }
        throw error;
      }
    },
    onSuccess: async (_result, prepared) => {
      if (!mounted.current || !commandScope.isCurrent(prepared.binding)) return;
      uncertainProbe.current = null;
      setUncertainOperation(null);
      setProbeFeedback(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: overviewKey, exact: true }),
        queryClient.invalidateQueries({
          queryKey: ['approvals', 'admin', 'signature-provider-diagnostics'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['approvals', 'admin', 'signature-diagnostic-history'],
        }),
      ]);
      toast.success(t('admin.signatureDiagnostics.probeSucceeded'));
    },
    onSettled: (_result, _error, prepared) => {
      if (lock.current === prepared.input.idempotencyKey) lock.current = null;
    },
  });

  const kmsProbe = useMutation({
    retry: false,
    mutationFn: async (prepared: PreparedKmsProbe) => {
      let checks = 0;
      try {
        assertPrepared(prepared);
        return await dispatchKmsProbe((execution) => {
          assertPrepared(prepared);
          return probeApprovalSignatureProviderKms(
            prepared.input,
            execution,
            {
              ...pinnedAuthority(prepared.overview, contextScopeKey!, expectedDecisionRevision),
              beforeDispatch: () => {
                assertPrepared(prepared);
                checks += 1;
              },
            }
          );
        });
      } catch (error) {
        if (mounted.current && commandScope.isCurrent(prepared.binding)) {
          const unknown =
            checks >= 2 &&
            (error instanceof HttpTransportError ||
              (error instanceof HttpError && error.status >= 500) ||
              (!(error instanceof HttpError) &&
                !(error instanceof ProductSurfaceOperationCancelledError)));
          if (unknown) {
            uncertainKmsProbe.current = prepared;
            setUncertainOperation('KMS');
          } else {
            uncertainKmsProbe.current = null;
            setUncertainOperation(null);
          }
          setProbeFeedback(unknown ? 'UNKNOWN' : 'CHANGED');
        }
        throw error;
      }
    },
    onSuccess: async (_result, prepared) => {
      if (!mounted.current || !commandScope.isCurrent(prepared.binding)) return;
      uncertainKmsProbe.current = null;
      setUncertainOperation(null);
      setProbeFeedback(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: overviewKey, exact: true }),
        queryClient.invalidateQueries({
          queryKey: ['approvals', 'admin', 'signature-provider-diagnostics'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['approvals', 'admin', 'signature-diagnostic-history'],
        }),
      ]);
      toast.success(t('admin.signatureDiagnostics.kmsProbeSucceeded'));
    },
    onSettled: (_result, _error, prepared) => {
      if (lock.current === prepared.input.idempotencyKey) lock.current = null;
    },
  });

  const fetchDetails = async (
    overviewValue: SignatureProviderOverview,
    providerId: string,
    identity: string
  ): Promise<SignatureProviderDiagnostics> => {
    const authority = pinnedAuthority(
      overviewValue,
      contextScopeKey!,
      expectedDecisionRevision,
      () => assertScopeCurrent(identity)
    );
    return queryClient.fetchQuery({
      queryKey: [
        'approvals',
        'admin',
        'signature-provider-diagnostics',
        providerId,
        ...requestScope.cacheKey,
      ],
      queryFn: ({ signal }) =>
        getApprovalSignatureProviderDiagnostics(providerId, authority, signal),
      staleTime: 0,
    });
  };

  const prepareProbe = async (providerId: string | null): Promise<PreparedProbe | null> => {
    if (
      probe.isPending ||
      kmsProbe.isPending ||
      lock.current ||
      probeFeedback === 'CHANGED' ||
      (probeFeedback === 'UNKNOWN' && uncertainOperation !== 'PROVIDER')
    )
      return null;
    const value = queryClient.getQueryData<SignatureProviderOverview>(overviewKey);
    if (!value || overviewState !== 'CURRENT' || !canManage) return null;
    const identity = scopeIdentity;
    const providers = value.providers.filter(
      (candidate) =>
        candidate.kind !== 'INTERNAL' &&
        candidate.providerId !== null &&
        (providerId === null || candidate.providerId === providerId)
    );
    if (providers.length === 0 || (providerId !== null && providers.length !== 1)) return null;
    try {
      assertScopeCurrent(identity);
      const resolved = await Promise.all(
        providers.map((candidate) => fetchDetails(value, candidate.providerId!, identity))
      );
      assertScopeCurrent(identity);
      const input = snapshotApprovalSignatureProviderProbeInput({
        expectedSourceRevision: value.scope.sourceRevision,
        expectedSourceSha256: value.scope.sourceSha256,
        allProviders: providerId === null,
        targets: resolved.map(snapshotApprovalSignatureProviderTarget),
        idempotencyKey: crypto.randomUUID(),
      });
      const prepared = Object.freeze({
        operation: 'PROVIDER' as const,
        binding: commandScope.binding,
        actorId,
        overview: value,
        input,
      });
      assertPrepared(prepared);
      return prepared;
    } catch {
      setProbeFeedback('CHANGED');
      return null;
    }
  };

  const configuredKmsProviderId =
    policyState === 'CURRENT'
      ? (policy.data?.published?.rules.configurationBinding?.sourceId ??
        (overview.data?.kms.verificationKind === 'INTERNAL_KEY'
          ? (overview.data.providers.find((provider) => provider.kind === 'INTERNAL')?.providerId ??
            null)
          : null))
      : null;
  const kmsTargetProviderId =
    configuredKmsProviderId !== null &&
    overview.data?.providers.some((provider) => provider.providerId === configuredKmsProviderId)
      ? configuredKmsProviderId
      : null;

  const prepareKmsProbe = async (): Promise<PreparedKmsProbe | null> => {
    if (
      probe.isPending ||
      kmsProbe.isPending ||
      lock.current ||
      probeFeedback === 'CHANGED' ||
      (probeFeedback === 'UNKNOWN' && uncertainOperation !== 'KMS') ||
      !kmsTargetProviderId
    )
      return null;
    const value = queryClient.getQueryData<SignatureProviderOverview>(overviewKey);
    if (!value || overviewState !== 'CURRENT' || policyState !== 'CURRENT' || !canManage)
      return null;
    const identity = scopeIdentity;
    try {
      assertScopeCurrent(identity);
      const resolved = await fetchDetails(value, kmsTargetProviderId, identity);
      assertScopeCurrent(identity);
      const input = snapshotApprovalSignatureProviderKmsProbeInput({
        expectedSourceRevision: value.scope.sourceRevision,
        expectedSourceSha256: value.scope.sourceSha256,
        target: snapshotApprovalSignatureProviderTarget(resolved),
        idempotencyKey: crypto.randomUUID(),
      });
      const prepared = Object.freeze({
        operation: 'KMS' as const,
        binding: commandScope.binding,
        actorId,
        overview: value,
        input,
      });
      assertPrepared(prepared);
      return prepared;
    } catch {
      setProbeFeedback('CHANGED');
      setUncertainOperation(null);
      return null;
    }
  };

  const runProbe = async (providerId: string | null) => {
    const prepared =
      uncertainProbe.current && providerId === null
        ? uncertainProbe.current
        : await prepareProbe(providerId);
    if (!prepared || lock.current) return;
    try {
      assertPrepared(prepared);
    } catch {
      setProbeFeedback('CHANGED');
      return;
    }
    lock.current = prepared.input.idempotencyKey;
    probe.mutate(prepared);
  };

  const runKmsProbe = async () => {
    const prepared = uncertainKmsProbe.current ?? (await prepareKmsProbe());
    if (!prepared || lock.current) return;
    try {
      assertPrepared(prepared);
    } catch {
      setProbeFeedback('CHANGED');
      setUncertainOperation(null);
      return;
    }
    lock.current = prepared.input.idempotencyKey;
    kmsProbe.mutate(prepared);
  };

  return {
    contractAvailable: nativeReadsInstalled,
    runtimeReady,
    installed: nativeReadsInstalled && runtimeReady,
    overview,
    overviewState,
    details,
    detailsState,
    policy,
    policyState,
    diagnosticHistory,
    diagnosticHistoryState,
    policyHistory,
    policyHistoryState,
    selectedProviderId,
    historyOpen,
    probeFeedback,
    uncertainOperation,
    probeBusy: probe.isPending || kmsProbe.isPending,
    canProbe:
      probeInstalled &&
      detailsInstalled &&
      overviewState === 'CURRENT' &&
      canManage &&
      probeFeedback !== 'CHANGED' &&
      (probeFeedback !== 'UNKNOWN' || uncertainOperation === 'PROVIDER'),
    canKmsProbe:
      kmsProbeInstalled &&
      detailsInstalled &&
      overviewState === 'CURRENT' &&
      policyState === 'CURRENT' &&
      canManage &&
      kmsTargetProviderId !== null &&
      probeFeedback !== 'CHANGED' &&
      (probeFeedback !== 'UNKNOWN' || uncertainOperation === 'KMS'),
    openProvider: (providerId: string) => {
      if (detailsInstalled && overviewState === 'CURRENT') setSelectedProviderId(providerId);
    },
    closeProvider: () => {
      if (!probe.isPending && !kmsProbe.isPending) setSelectedProviderId(null);
    },
    openHistory: () => {
      if (diagnosticHistoryInstalled && overviewState === 'CURRENT') setHistoryOpen(true);
    },
    closeHistory: () => setHistoryOpen(false),
    nextDiagnosticHistory: () => {
      if (diagnosticHistory.data?.nextCursor)
        setDiagnosticCursor(diagnosticHistory.data.nextCursor);
    },
    nextPolicyHistory: () => {
      if (policyHistory.data?.nextCursor) setPolicyCursor(policyHistory.data.nextCursor);
    },
    refresh: async () => {
      const result = await overview.refetch();
      if (
        result.isSuccess &&
        !result.isFetching &&
        !uncertainProbe.current &&
        !uncertainKmsProbe.current
      ) {
        setProbeFeedback(null);
        setUncertainOperation(null);
      }
    },
    runProbe,
    runKmsProbe,
  };
}
