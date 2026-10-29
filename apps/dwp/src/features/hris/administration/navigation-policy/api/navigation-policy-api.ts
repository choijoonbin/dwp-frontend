import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  selectNavigationPolicyCommandReceipt,
  selectNavigationPolicyWorkspace,
} from '../model/navigation-policy-adapter';
import { HR_OPERATIONS_WORKBENCH_ID } from '../../../shell/navigation-policy/hr-operations-navigation-policy';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  NavigationPolicyAction,
  NavigationPolicyCommandReceipt,
  NavigationPolicyDraft,
  NavigationPolicyScopeKind,
  NavigationPolicyWorkspace,
} from '../model/navigation-policy-model';
import type {
  HrisNavigationPolicyGroup,
  HrisNavigationRolloutMode,
} from '../../../shell/navigation-policy/hr-operations-navigation-policy';

export const NAVIGATION_POLICY_ADMIN_BASE =
  '/api/platform/v1/admin/hris/navigation-policies' as const;
export const NAVIGATION_POLICY_V2_ADMIN_BASE =
  '/api/platform/v2/admin/hris/navigation-policies' as const;
export const NAVIGATION_POLICY_RUNTIME_PATH =
  '/api/platform/v1/hris/navigation/projection' as const;

export const NAVIGATION_POLICY_OPERATION_BINDINGS = [
  ['GET', `${NAVIGATION_POLICY_ADMIN_BASE}/workspace`],
  ['POST', `${NAVIGATION_POLICY_ADMIN_BASE}/drafts`],
  ['PUT', `${NAVIGATION_POLICY_ADMIN_BASE}/drafts/{revisionId}`],
  ['POST', `${NAVIGATION_POLICY_ADMIN_BASE}/drafts/{revisionId}/validate`],
  ['POST', `${NAVIGATION_POLICY_ADMIN_BASE}/drafts/{revisionId}/submit`],
  ['POST', `${NAVIGATION_POLICY_ADMIN_BASE}/revisions/{revisionId}/approve`],
  ['POST', `${NAVIGATION_POLICY_ADMIN_BASE}/revisions/{revisionId}/publish`],
  ['POST', `${NAVIGATION_POLICY_ADMIN_BASE}/revisions/{revisionId}/restore`],
  ['GET', NAVIGATION_POLICY_RUNTIME_PATH],
] as const;

export const NAVIGATION_POLICY_V2_OPERATION_BINDINGS = [
  ['GET', `${NAVIGATION_POLICY_V2_ADMIN_BASE}/workspace`],
  ['POST', `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts`],
  ['PUT', `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/{revisionId}`],
  ['POST', `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/{revisionId}/validate`],
  ['POST', `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/{revisionId}/submit`],
  ['POST', `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/{revisionId}/approve`],
  ['POST', `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/{revisionId}/publish`],
  ['POST', `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/{revisionId}/restore`],
] as const;

export const HCM_NAVIGATION_POLICY_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createNavigationPolicyDraftRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-draft-create.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_ADMIN_BASE}/drafts`,
  },
  {
    apiFunction: 'updateNavigationPolicyDraftRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-draft-update.action',
    method: 'PUT',
    path: `${NAVIGATION_POLICY_ADMIN_BASE}/drafts/{revisionId}`,
  },
  {
    apiFunction: 'validateNavigationPolicyDraftRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-draft-validate.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_ADMIN_BASE}/drafts/{revisionId}/validate`,
  },
  {
    apiFunction: 'submitNavigationPolicyDraftRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-draft-submit.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_ADMIN_BASE}/drafts/{revisionId}/submit`,
  },
  {
    apiFunction: 'approveNavigationPolicyRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-revision-approve.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_ADMIN_BASE}/revisions/{revisionId}/approve`,
  },
  {
    apiFunction: 'publishNavigationPolicyRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-revision-publish.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_ADMIN_BASE}/revisions/{revisionId}/publish`,
  },
  {
    apiFunction: 'restoreNavigationPolicyRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-revision-restore.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_ADMIN_BASE}/revisions/{revisionId}/restore`,
  },
] as const;

export const HCM_NAVIGATION_POLICY_V2_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createNavigationPolicyV2DraftRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-v2-draft-create.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts`,
  },
  {
    apiFunction: 'updateNavigationPolicyV2DraftRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-v2-draft-update.action',
    method: 'PUT',
    path: `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/{revisionId}`,
  },
  {
    apiFunction: 'validateNavigationPolicyV2DraftRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-v2-draft-validate.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/{revisionId}/validate`,
  },
  {
    apiFunction: 'submitNavigationPolicyV2DraftRevision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-v2-draft-submit.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/{revisionId}/submit`,
  },
  {
    apiFunction: 'approveNavigationPolicyV2Revision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-v2-revision-approve.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/{revisionId}/approve`,
  },
  {
    apiFunction: 'publishNavigationPolicyV2Revision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-v2-revision-publish.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/{revisionId}/publish`,
  },
  {
    apiFunction: 'restoreNavigationPolicyV2Revision',
    routeContractKey: 'route.hcm.configuration.navigation-policy-v2-revision-restore.action',
    method: 'POST',
    path: `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/{revisionId}/restore`,
  },
] as const;

export type NavigationPolicyCommandEnvelope<T> = Readonly<{
  body: T;
  expectedVersion: number;
  requestDigest: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type NavigationPolicyDraftBody = Readonly<{
  scopeKind: NavigationPolicyScopeKind;
  scopePublicId?: string;
  legalEntityPublicId: string | null;
  rolloutMode: HrisNavigationRolloutMode;
  workbenchId: typeof HR_OPERATIONS_WORKBENCH_ID;
  groups: readonly HrisNavigationPolicyGroup[];
}>;

export type NavigationPolicyLifecycleBody = Readonly<{ reason?: string }>;
export type NavigationPolicyRestoreBody = Readonly<{ reason: string }>;

export async function readNavigationPolicyWorkspace(
  input: Readonly<{
    scopeKind: NavigationPolicyScopeKind;
    scopePublicId?: string | null;
    correlationId: string;
    contextScopeKey?: string;
    signal?: AbortSignal;
  }>
): Promise<NavigationPolicyWorkspace> {
  const search = workspaceSearch(input.scopeKind, input.scopePublicId);
  const scoped = productSurfaceReadScopeConfig(input.contextScopeKey, input.signal);
  const workspacePath =
    input.scopeKind === 'LEGAL_ENTITY'
      ? NAVIGATION_POLICY_V2_OPERATION_BINDINGS[0][1]
      : NAVIGATION_POLICY_OPERATION_BINDINGS[0][1];
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${workspacePath}?${search.toString()}`,
    {
      ...scoped,
      headers: commandIdentityHeaders(input.correlationId),
    }
  );
  if (input.scopeKind === 'TENANT') {
    return selectNavigationPolicyWorkspace(response.data.data);
  }
  const tenantResponse = await axiosInstance.get<ApiResponse<unknown>>(
    `${NAVIGATION_POLICY_OPERATION_BINDINGS[0][1]}?${workspaceSearch('TENANT').toString()}`,
    {
      ...scoped,
      headers: commandIdentityHeaders(input.correlationId),
    }
  );
  return selectNavigationPolicyWorkspace(response.data.data, tenantResponse.data.data);
}

export function createNavigationPolicyDraftRevision(
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyDraftBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<NavigationPolicyCommandReceipt> {
  if (envelope.expectedVersion !== 0) {
    return Promise.reject(new Error('A new navigation-policy draft must start at version zero.'));
  }
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_ADMIN_BASE}/drafts`,
    envelope,
    authority,
    'CREATE_DRAFT'
  );
}

export function updateNavigationPolicyDraftRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyDraftBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return mutate(
    'PUT',
    `${NAVIGATION_POLICY_ADMIN_BASE}/drafts/${encodeURIComponent(revisionId)}`,
    envelope,
    authority,
    'SAVE_DRAFT'
  );
}

export function validateNavigationPolicyDraftRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyLifecycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return draftTransition(revisionId, 'validate', envelope, authority, 'VALIDATE');
}

export function submitNavigationPolicyDraftRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyLifecycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return draftTransition(revisionId, 'submit', envelope, authority, 'SUBMIT');
}

export function approveNavigationPolicyRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyLifecycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return revisionTransition(revisionId, 'approve', envelope, authority, 'APPROVE');
}

export function publishNavigationPolicyRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyLifecycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return revisionTransition(revisionId, 'publish', envelope, authority, 'PUBLISH');
}

export function restoreNavigationPolicyRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyRestoreBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return revisionTransition(revisionId, 'restore', envelope, authority, 'RESTORE');
}

export function createNavigationPolicyV2DraftRevision(
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyDraftBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<NavigationPolicyCommandReceipt> {
  if (envelope.expectedVersion !== 0) {
    return Promise.reject(new Error('A new navigation-policy draft must start at version zero.'));
  }
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts`,
    envelope,
    authority,
    'CREATE_DRAFT'
  );
}

export function updateNavigationPolicyV2DraftRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyDraftBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return mutate(
    'PUT',
    `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/${encodeURIComponent(revisionId)}`,
    envelope,
    authority,
    'SAVE_DRAFT'
  );
}

export function validateNavigationPolicyV2DraftRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyLifecycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/${encodeURIComponent(revisionId)}/validate`,
    envelope,
    authority,
    'VALIDATE'
  );
}

export function submitNavigationPolicyV2DraftRevision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyLifecycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_V2_ADMIN_BASE}/drafts/${encodeURIComponent(revisionId)}/submit`,
    envelope,
    authority,
    'SUBMIT'
  );
}

export function approveNavigationPolicyV2Revision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyLifecycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/${encodeURIComponent(revisionId)}/approve`,
    envelope,
    authority,
    'APPROVE',
    true
  );
}

export function publishNavigationPolicyV2Revision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyLifecycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/${encodeURIComponent(revisionId)}/publish`,
    envelope,
    authority,
    'PUBLISH',
    true
  );
}

export function restoreNavigationPolicyV2Revision(
  revisionId: string,
  envelope: NavigationPolicyCommandEnvelope<NavigationPolicyRestoreBody>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_V2_ADMIN_BASE}/revisions/${encodeURIComponent(revisionId)}/restore`,
    envelope,
    authority,
    'RESTORE',
    true
  );
}

export function navigationPolicyDraftBody(draft: NavigationPolicyDraft): NavigationPolicyDraftBody {
  return Object.freeze({
    scopeKind: draft.scopeKind,
    ...(draft.scopeKind === 'LEGAL_ENTITY' && draft.scopePublicId
      ? { scopePublicId: draft.scopePublicId }
      : {}),
    legalEntityPublicId: draft.legalEntityPublicId,
    rolloutMode: draft.rolloutMode,
    workbenchId: draft.workbenchId,
    groups: draft.groups,
  });
}

function draftTransition<T>(
  revisionId: string,
  suffix: 'validate' | 'submit',
  envelope: NavigationPolicyCommandEnvelope<T>,
  authority: ProductSurfaceGovernedMutationAuthority,
  action: 'VALIDATE' | 'SUBMIT'
) {
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_ADMIN_BASE}/drafts/${encodeURIComponent(revisionId)}/${suffix}`,
    envelope,
    authority,
    action
  );
}

function revisionTransition<T>(
  revisionId: string,
  suffix: 'approve' | 'publish' | 'restore',
  envelope: NavigationPolicyCommandEnvelope<T>,
  authority: ProductSurfaceGovernedMutationAuthority,
  action: 'APPROVE' | 'PUBLISH' | 'RESTORE'
) {
  return mutate(
    'POST',
    `${NAVIGATION_POLICY_ADMIN_BASE}/revisions/${encodeURIComponent(revisionId)}/${suffix}`,
    envelope,
    authority,
    action,
    true
  );
}

async function mutate<T>(
  method: 'POST' | 'PUT',
  path: string,
  envelope: NavigationPolicyCommandEnvelope<T>,
  authority: ProductSurfaceGovernedMutationAuthority,
  action: NavigationPolicyAction,
  highRisk = false
): Promise<NavigationPolicyCommandReceipt> {
  assertEnvelope(envelope, authority);
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: false })
    : productSurfaceGovernedMutationConfig(authority, { objectVersionHeader: true });
  const config = {
    ...governed,
    headers: {
      ...governed.headers,
      ...commandIdentityHeaders(envelope.correlationId),
      'Idempotency-Key': envelope.idempotencyKey,
    },
  };
  const body = {
    ...envelope.body,
    expectedVersion: envelope.expectedVersion,
    requestDigest: envelope.requestDigest,
  };
  const response =
    method === 'PUT'
      ? await axiosInstance.put<ApiResponse<unknown>>(path, body, config)
      : await axiosInstance.post<ApiResponse<unknown>>(path, body, config);
  return selectNavigationPolicyCommandReceipt(response.data.data, {
    action,
    requestDigest: envelope.requestDigest,
  });
}

function assertEnvelope<T>(
  envelope: NavigationPolicyCommandEnvelope<T>,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  if (
    !Number.isSafeInteger(envelope.expectedVersion) ||
    envelope.expectedVersion < 0 ||
    !/^[a-f0-9]{64}$/i.test(envelope.requestDigest) ||
    !envelope.idempotencyKey.trim() ||
    !envelope.correlationId.trim()
  ) {
    throw new Error('Navigation-policy command envelope is invalid.');
  }
  if (
    authority.mode === 'SECURE' &&
    ((authority.idempotencyKey !== undefined &&
      authority.idempotencyKey !== envelope.idempotencyKey) ||
      authority.objectVersion !== envelope.expectedVersion)
  ) {
    throw new Error('Navigation-policy authority does not match the sealed command.');
  }
}

function commandIdentityHeaders(correlationId: string) {
  return {
    'X-Correlation-ID': correlationId,
  };
}

function workspaceSearch(scopeKind: NavigationPolicyScopeKind, scopePublicId?: string | null) {
  const search = new URLSearchParams({
    workbenchId: HR_OPERATIONS_WORKBENCH_ID,
    scopeKind,
  });
  if (scopeKind === 'LEGAL_ENTITY') {
    if (!scopePublicId?.trim()) throw new Error('Legal-entity policy scope is required.');
    search.set('scopePublicId', scopePublicId);
  }
  return search;
}
