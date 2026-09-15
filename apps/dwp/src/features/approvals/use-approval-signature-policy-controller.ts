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
  getApprovalSignatureProviderDiagnostics,
  getApprovalSignatureProviderOverview,
  getApprovalSignatureProviderPolicy,
  snapshotApprovalSignatureProviderTarget,
  type ApprovalSignatureProviderPinnedAuthority,
} from '@dwp-frontend/shared-utils/api/approval-signature-provider-api';
import {
  ApprovalSignaturePolicyResponseError,
  initializeApprovalSignaturePolicy,
  inspectApprovalSignatureWorm,
  publishApprovalSignaturePolicy,
  saveApprovalSignaturePolicyDraft,
  snapshotApprovalSignaturePolicyDraftInput,
  snapshotApprovalSignaturePolicyInitializeInput,
  snapshotApprovalSignaturePolicyPublishInput,
  snapshotApprovalSignatureWormInspectionInput,
} from '@dwp-frontend/shared-utils/api/approval-signature-policy-api';
import type {
  ApprovalSignaturePolicyDraftInput,
  ApprovalSignaturePolicyInitializeInput,
  ApprovalSignaturePolicyPublishInput,
  ApprovalSignatureWormInspectionInput,
} from '@dwp-frontend/shared-utils/api/approval-signature-policy-api';
import type { SignatureProviderOverview } from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import type {
  SignatureProviderPolicyRules,
  SignatureProviderPolicyView,
} from '@dwp-frontend/shared-utils/api/approval-signature-provider-policy-contract';
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
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
  type ApprovalManagementScopeBinding,
} from './approval-management-command-scope';
import { approvalSignaturePolicyPublishCommand } from './approval-signature-command';
import {
  approvalSignatureInitialPolicyRules,
  approvalSignaturePolicyDraftSourceId,
  approvalSignaturePolicyEditableRules,
  approvalSignaturePolicyFingerprint,
  approvalSignaturePolicyRulesValid,
} from './approval-signature-policy-model';
import { approvalSignatureNativeRouteInstalled } from './approval-signature-native-routes';
import { approvalSignatureProviderRouteInstalled } from './use-approval-signature-provider-diagnostics';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';

type Original = ApprovalManagementScopeBinding &
  Readonly<{
    actorId: string;
    overview: SignatureProviderOverview;
    policy: SignatureProviderPolicyView | null;
  }>;
type Editor = Readonly<{
  original: Original;
  rules: SignatureProviderPolicyRules;
  configurationProviderId: string | null;
}>;
type PolicyAttempt = Readonly<{
  original: Original;
  operation: 'INITIALIZE' | 'SAVE';
  input: ApprovalSignaturePolicyInitializeInput | ApprovalSignaturePolicyDraftInput;
}>;
type WormAttempt = Readonly<{
  original: Original;
  input: ApprovalSignatureWormInspectionInput;
}>;
type PublishAttempt = Readonly<{
  original: Original;
  input: ApprovalSignaturePolicyPublishInput;
}>;

class SignatureCommandUncertainError extends Error {}

export function useApprovalSignaturePolicyController() {
  const { t } = useTranslation('approvals');
  const scope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(scope);
  const scopeIdentity = approvalManagementScopeIdentity(scope.cacheKey);
  const commandScope = useApprovalManagementCommandScope(scope.cacheKey);
  const experience = useApprovalExperience();
  const decision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  const client = useQueryClient();
  const toast = useToast();
  const canonicalContext = resolveCanonicalProductSurfaceContext(decision, authority.snapshot);
  const commandResourceSets = new Set(
    (canonicalContext?.effectiveGrants ?? [])
      .filter(
        (grant) =>
          grant.grantKind === 'CAPABILITY' &&
          [
            'approvals.signature.read',
            'approvals.signature.manage',
            'approvals.signature.publish',
          ].includes(grant.capabilityContractKey) &&
          grant.scopeKeys.includes(scope.contextScopeKey ?? '') &&
          ['ACTIVE', 'ELIGIBLE'].includes(grant.activationState)
      )
      .map((grant) =>
        grant.grantKind === 'CAPABILITY' ? grant.responsibility?.resourceSetKey : null
      )
      .filter((value): value is string => Boolean(value))
  );
  const commandResourceSetKey =
    commandResourceSets.size === 1 ? [...commandResourceSets][0] : undefined;
  const [editor, setEditor] = useState<Editor | null>(null);
  const [wormProviderId, setWormProviderId] = useState<string | null>(null);
  const [wormArtifactId, setWormArtifactId] = useState('');
  const [feedback, setFeedback] = useState<'CHANGED' | 'UNKNOWN' | null>(null);
  const [unknownOperation, setUnknownOperation] = useState<'POLICY' | 'WORM' | null>(null);
  const lock = useRef<string | null>(null);
  const mounted = useRef(false);
  const publication = useRef<PublishAttempt | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setEditor(null);
    setWormProviderId(null);
    setWormArtifactId('');
    setFeedback(null);
    setUnknownOperation(null);
    lock.current = null;
    publication.current = null;
  }, [scopeIdentity]);

  const contextScopeKey = scope.contextScopeKey;
  const expectedDecisionRevision = scope.cacheKey[5];
  const overviewKey = ['approvals', 'admin', 'signature-diagnostics', ...scope.cacheKey] as const;
  const policyKey = ['approvals', 'admin', 'signature-provider-policy', ...scope.cacheKey] as const;
  const readInstalled =
    approvalSignatureProviderRouteInstalled('signature-diagnostics.data') &&
    approvalSignatureProviderRouteInstalled('signature-policy.data');
  const overview = useQuery({
    queryKey: overviewKey,
    queryFn: ({ signal }) =>
      getApprovalSignatureProviderOverview(
        {
          contextScopeKey: contextScopeKey!,
          expectedDecisionRevision,
          beforeDispatch: () => assertBase(),
        },
        signal
      ),
    enabled:
      readInstalled &&
      scopeReady &&
      experience.canViewSignatures &&
      Boolean(contextScopeKey && /^psr-[a-f0-9]{64}$/.test(expectedDecisionRevision)),
    staleTime: 30_000,
    retry: false,
  });
  const policy = useQuery({
    queryKey: policyKey,
    queryFn: ({ signal }) =>
      getApprovalSignatureProviderPolicy(
        currentAuthority(() => assertBase()),
        signal
      ),
    enabled: overview.isSuccess && !overview.isFetching && !overview.error,
    staleTime: 30_000,
    retry: false,
  });
  const current = useRef({
    scopeIdentity,
    scopeReady,
    scope,
    experience,
    decision,
    snapshot: authority.snapshot,
    readInstalled,
    commandResourceSetKey,
  });
  current.current = {
    scopeIdentity,
    scopeReady,
    scope,
    experience,
    decision,
    snapshot: authority.snapshot,
    readInstalled,
    commandResourceSetKey,
  };

  function assertBase(identity = scopeIdentity) {
    const latest = current.current;
    if (
      !mounted.current ||
      latest.scopeIdentity !== identity ||
      !latest.scopeReady ||
      !latest.readInstalled ||
      !latest.commandResourceSetKey ||
      !latest.experience.canViewSignatures ||
      !latest.scope.contextScopeKey ||
      !/^psr-[a-f0-9]{64}$/.test(latest.scope.cacheKey[5])
    )
      throw new ProductSurfaceOperationCancelledError();
  }

  function currentAuthority(
    beforeDispatch: () => void,
    source = client.getQueryData<SignatureProviderOverview>(overviewKey)
  ): ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }> {
    if (
      !source ||
      !contextScopeKey ||
      !commandResourceSetKey ||
      source.scope.resourceSetKey !== commandResourceSetKey
    )
      throw new ProductSurfaceOperationCancelledError();
    return Object.freeze({
      contextScopeKey,
      expectedDecisionRevision,
      resourceSetKey: commandResourceSetKey,
      registrySha256: source.scope.registrySha256,
      sourceRevision: source.scope.sourceRevision,
      sourceSha256: source.scope.sourceSha256,
      beforeDispatch,
    });
  }

  const fresh = (key: readonly unknown[]) => {
    const state = client.getQueryState(key);
    return (
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      state.error == null &&
      state.fetchFailureCount === 0
    );
  };
  const policyMissing =
    overview.data?.policy.sourceState === 'UNRECORDED' &&
    policy.error instanceof HttpError &&
    policy.error.status === 404;
  const hasRight = (capability: 'approvals.signature.manage' | 'approvals.signature.publish') => {
    const latest = current.current;
    return hasWritableProductSurfaceCapability(
      latest.decision,
      resolveCanonicalProductSurfaceContext(latest.decision, latest.snapshot),
      capability,
      latest.snapshot ? productSurfaceServerNow(latest.snapshot) : Date.now()
    );
  };
  const capture = (allowMissing: boolean): Original | null => {
    const source = client.getQueryData<SignatureProviderOverview>(overviewKey);
    const latestPolicy = client.getQueryData<SignatureProviderPolicyView>(policyKey) ?? null;
    const policyReady = latestPolicy ? fresh(policyKey) : allowMissing && policyMissing;
    return source &&
      source.scope.resourceSetKey === commandResourceSetKey &&
      fresh(overviewKey) &&
      policyReady
      ? Object.freeze({
          ...commandScope.binding,
          actorId: scope.cacheKey[1],
          overview: source,
          policy: latestPolicy,
        })
      : null;
  };
  const matches = (original: Original) => {
    const source = client.getQueryData<SignatureProviderOverview>(overviewKey);
    const latestPolicy = client.getQueryData<SignatureProviderPolicyView>(policyKey) ?? null;
    return Boolean(
      source &&
      source.scope.resourceSetKey === commandResourceSetKey &&
      fresh(overviewKey) &&
      commandScope.isCurrent(original) &&
      original.actorId === current.current.scope.cacheKey[1] &&
      JSON.stringify(source) === JSON.stringify(original.overview) &&
      (original.policy
        ? latestPolicy &&
          fresh(policyKey) &&
          approvalSignaturePolicyFingerprint(latestPolicy) ===
            approvalSignaturePolicyFingerprint(original.policy)
        : policyMissing && latestPolicy === null)
    );
  };
  const assertOriginal = (
    original: Original,
    capability: 'approvals.signature.manage' | 'approvals.signature.publish'
  ) => {
    assertBase(original.scopeIdentity);
    if (!matches(original) || !hasRight(capability))
      throw new ProductSurfaceOperationCancelledError();
  };

  const initializeDispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.signature-policy-initialize.action',
    taskKind: 'ADMINISTRATION',
  });
  const draftDispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.signature-policy-draft-update.action',
    taskKind: 'ADMINISTRATION',
  });
  const wormDispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.signature-worm-inspection.action',
    taskKind: 'ADMINISTRATION',
  });

  const markFailure = (error: unknown, dispatched: boolean, operation: 'POLICY' | 'WORM') => {
    const unknown =
      dispatched &&
      (error instanceof ApprovalSignaturePolicyResponseError ||
        error instanceof HttpTransportError ||
        (error instanceof HttpError && error.status >= 500));
    if (mounted.current) {
      setFeedback(unknown ? 'UNKNOWN' : 'CHANGED');
      setUnknownOperation(unknown ? operation : null);
    }
    return unknown;
  };

  const policyMutation = useMutation({
    retry: false,
    mutationFn: async (attempt: PolicyAttempt) => {
      let checks = 0;
      const before = () => {
        assertOriginal(attempt.original, 'approvals.signature.manage');
        checks += 1;
      };
      try {
        assertOriginal(attempt.original, 'approvals.signature.manage');
        return attempt.operation === 'INITIALIZE'
          ? initializeDispatch((execution) =>
              initializeApprovalSignaturePolicy(
                attempt.input as ApprovalSignaturePolicyInitializeInput,
                execution,
                currentAuthority(before, attempt.original.overview)
              )
            )
          : draftDispatch((execution) =>
              saveApprovalSignaturePolicyDraft(
                attempt.original.policy!.policyId,
                attempt.input as ApprovalSignaturePolicyDraftInput,
                execution,
                currentAuthority(before, attempt.original.overview)
              )
            );
      } catch (error) {
        markFailure(error, checks >= 2, 'POLICY');
        throw error;
      }
    },
    onSuccess: (value, attempt) => {
      if (!mounted.current || !commandScope.isCurrent(attempt.original)) return;
      client.setQueryData(policyKey, value);
      setEditor(null);
      setFeedback(null);
      setUnknownOperation(null);
      toast.success(t('admin.signaturePolicy.saved'));
    },
    onSettled: (_value, _error, attempt) => {
      if (lock.current === attempt.input.idempotencyKey) lock.current = null;
    },
  });

  const wormMutation = useMutation({
    retry: false,
    mutationFn: async (attempt: WormAttempt) => {
      let checks = 0;
      const before = () => {
        assertOriginal(attempt.original, 'approvals.signature.manage');
        checks += 1;
      };
      try {
        assertOriginal(attempt.original, 'approvals.signature.manage');
        return await wormDispatch((execution) =>
          inspectApprovalSignatureWorm(
            attempt.input,
            execution,
            currentAuthority(before, attempt.original.overview)
          )
        );
      } catch (error) {
        markFailure(error, checks >= 2, 'WORM');
        throw error;
      }
    },
    onSuccess: (value, attempt) => {
      if (!mounted.current || !commandScope.isCurrent(attempt.original)) return;
      client.setQueryData(overviewKey, value);
      setWormProviderId(null);
      setWormArtifactId('');
      setFeedback(null);
      setUnknownOperation(null);
      toast.success(t('admin.signaturePolicy.wormCompleted'));
    },
    onSettled: (_value, _error, attempt) => {
      if (lock.current === attempt.input.idempotencyKey) lock.current = null;
    },
  });

  const highRisk = useApprovalManagementHighRiskCommand<SignatureProviderPolicyView>({
    cacheKey: scope.cacheKey,
    operation: 'SIGNATURE_POLICY_PUBLISH',
    execute: async (command, execution) => {
      const attempt = publication.current;
      if (
        !attempt ||
        execution.mode !== 'SECURE' ||
        command.targetId !== attempt.original.policy?.policyId ||
        command.expectedObjectVersion !== attempt.input.expectedVersion ||
        command.idempotencyKey !== attempt.input.idempotencyKey ||
        JSON.stringify(command.payload) !== JSON.stringify(attempt.input)
      )
        throw new ProductSurfaceOperationCancelledError();
      let checks = 0;
      const before = () => {
        assertOriginal(attempt.original, 'approvals.signature.publish');
        checks += 1;
      };
      try {
        before();
        return await publishApprovalSignaturePolicy(
          command.targetId,
          attempt.input,
          execution,
          currentAuthority(before, attempt.original.overview)
        );
      } catch (error) {
        const unknown = markFailure(error, checks >= 2, 'POLICY');
        if (unknown) throw new SignatureCommandUncertainError();
        throw error;
      }
    },
    onSuccess: (value, _command, binding) => {
      if (!mounted.current || !commandScope.isCurrent(binding)) return;
      client.setQueryData(policyKey, value);
      publication.current = null;
      setFeedback(null);
      setUnknownOperation(null);
      toast.success(t('admin.signaturePolicy.published'));
    },
    onConflict: () => {
      if (mounted.current) setFeedback('CHANGED');
    },
  });

  const canManage = hasRight('approvals.signature.manage');
  const canPublish = hasRight('approvals.signature.publish');
  const busy = policyMutation.isPending || wormMutation.isPending || highRisk.controller.busy;
  const availableProviders = useMemo(
    () =>
      (overview.data?.providers ?? []).filter(
        (item) => item.kind !== 'INTERNAL' && item.providerId && item.providerVersion !== null
      ),
    [overview.data?.providers]
  );
  const resolvedEditorRules = (value: Editor) => {
    const selected = availableProviders.find(
      (provider) => provider.providerId === value.configurationProviderId
    );
    const configurationBinding =
      selected?.configurationRegistered &&
      selected.providerId &&
      selected.providerVersion !== null &&
      selected.providerSha256
        ? {
            sourceId: selected.providerId,
            version: selected.providerVersion,
            sha256: selected.providerSha256,
          }
        : null;
    return { ...value.rules, configurationBinding };
  };

  return {
    overview,
    policy,
    policyMissing,
    editor,
    wormProviderId,
    wormArtifactId,
    feedback,
    unknownOperation,
    availableProviders,
    busy,
    highRisk: highRisk.controller,
    canInitialize:
      policyMissing &&
      canManage &&
      approvalSignatureNativeRouteInstalled('signature-policy-initialize.action') &&
      feedback === null,
    canEdit:
      Boolean(policy.data) &&
      canManage &&
      approvalSignatureNativeRouteInstalled('signature-policy-draft-update.action') &&
      feedback === null,
    canPublish:
      Boolean(
        policy.data?.workingDraft &&
        policy.data.publishReview?.stepUpRequired &&
        policy.data.publishReview.reviewContentSha256
      ) &&
      canPublish &&
      approvalSignatureNativeRouteInstalled('signature-policy-publish.action') &&
      feedback === null,
    canInspectWorm:
      availableProviders.length > 0 &&
      canManage &&
      approvalSignatureNativeRouteInstalled('signature-worm-inspection.action') &&
      feedback === null,
    editorReady: Boolean(
      editor &&
      matches(editor.original) &&
      approvalSignaturePolicyRulesValid(resolvedEditorRules(editor))
    ),
    openEditor: () => {
      if (busy || feedback || !policy.data) return;
      const original = capture(false);
      if (!original) return;
      const rules = approvalSignaturePolicyEditableRules(policy.data);
      setEditor({
        original,
        rules,
        configurationProviderId: rules.configurationBinding?.sourceId ?? null,
      });
    },
    changeRules: (rules: SignatureProviderPolicyRules) => {
      if (!busy && feedback === null) setEditor((value) => (value ? { ...value, rules } : null));
    },
    changeConfigurationProvider: (providerId: string | null) => {
      if (!busy && feedback === null)
        setEditor((value) => (value ? { ...value, configurationProviderId: providerId } : null));
    },
    closeEditor: () => {
      if (!busy) setEditor(null);
    },
    initialize: () => {
      const original = capture(true);
      if (!original || !canManage || lock.current || feedback) return;
      const input = snapshotApprovalSignaturePolicyInitializeInput({
        expectedAbsent: true,
        expectedSourceRevision: original.overview.scope.sourceRevision,
        expectedSourceSha256: original.overview.scope.sourceSha256,
        rules: approvalSignatureInitialPolicyRules(),
        idempotencyKey: crypto.randomUUID(),
      });
      lock.current = input.idempotencyKey;
      policyMutation.mutate({ original, operation: 'INITIALIZE', input });
    },
    save: () => {
      if (!editor || !matches(editor.original) || !editor.original.policy || lock.current) return;
      const rules = resolvedEditorRules(editor);
      if (!approvalSignaturePolicyRulesValid(rules)) return;
      const input = snapshotApprovalSignaturePolicyDraftInput({
        expectedVersion: editor.original.policy.version,
        expectedDraftVersionId: approvalSignaturePolicyDraftSourceId(editor.original.policy),
        expectedSourceRevision: editor.original.overview.scope.sourceRevision,
        expectedSourceSha256: editor.original.overview.scope.sourceSha256,
        rules,
        idempotencyKey: crypto.randomUUID(),
      });
      lock.current = input.idempotencyKey;
      policyMutation.mutate({ original: editor.original, operation: 'SAVE', input });
    },
    openWorm: () => {
      if (!busy && feedback === null && availableProviders[0]?.providerId)
        setWormProviderId(availableProviders[0].providerId);
    },
    changeWormProvider: setWormProviderId,
    changeWormArtifact: setWormArtifactId,
    closeWorm: () => {
      if (!busy) {
        setWormProviderId(null);
        setWormArtifactId('');
      }
    },
    inspectWorm: async () => {
      const original = capture(false);
      if (!original || !wormProviderId || lock.current || feedback) return;
      try {
        assertOriginal(original, 'approvals.signature.manage');
        const details = await getApprovalSignatureProviderDiagnostics(
          wormProviderId,
          currentAuthority(
            () => assertOriginal(original, 'approvals.signature.manage'),
            original.overview
          )
        );
        assertOriginal(original, 'approvals.signature.manage');
        const input = snapshotApprovalSignatureWormInspectionInput({
          expectedSourceRevision: original.overview.scope.sourceRevision,
          expectedSourceSha256: original.overview.scope.sourceSha256,
          target: snapshotApprovalSignatureProviderTarget(details),
          artifactId: wormArtifactId.trim() || null,
          idempotencyKey: crypto.randomUUID(),
        });
        lock.current = input.idempotencyKey;
        wormMutation.mutate({ original, input });
      } catch {
        if (mounted.current) setFeedback('CHANGED');
      }
    },
    publish: () => {
      const original = capture(false);
      const review = original?.policy?.publishReview;
      if (!original || !original.policy?.workingDraft || !review || feedback || busy) return;
      const input = snapshotApprovalSignaturePolicyPublishInput({
        expectedVersion: original.policy.version,
        expectedDraftVersionId: original.policy.workingDraft.versionId,
        expectedSourceRevision: original.overview.scope.sourceRevision,
        expectedSourceSha256: original.overview.scope.sourceSha256,
        reviewContentSha256: review.reviewContentSha256,
        idempotencyKey: crypto.randomUUID(),
      });
      publication.current = { original, input };
      void highRisk.begin(approvalSignaturePolicyPublishCommand(original.policy.policyId, input));
    },
    refresh: async () => {
      const binding = commandScope.binding;
      await overview.refetch();
      await policy.refetch();
      if (mounted.current && commandScope.isCurrent(binding) && feedback !== 'UNKNOWN') {
        setFeedback(null);
        setUnknownOperation(null);
      }
    },
  };
}
