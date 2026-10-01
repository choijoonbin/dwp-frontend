import { axiosInstance } from '../axios-instance';

import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApiResponse } from '../types';

const BASE = '/api/auth/admin/tenant-settings';
type AuthSchemas = GatewayComponents['schemas'];

export type TenantAuthPolicyDraft = {
  defaultLoginType: 'LOCAL' | 'SSO';
  allowedLoginTypes: Array<'LOCAL' | 'SSO'>;
  localLoginEnabled: boolean;
  ssoLoginEnabled: boolean;
  ssoProviderKey?: string | null;
  requireMfa: boolean;
  tokenTtlSec?: number | null;
};

export type TenantSettingImpact = {
  confidence: 'UNKNOWN' | 'ESTIMATED' | 'EXACT';
  populationCount?: number | null;
  coverage: string;
  observedAt: string;
  exclusions: string[];
};

export type TenantSettingChangeSet = {
  changeSetId: string;
  ownerType: 'AUTH_POLICY';
  ownerRef: string;
  lifecycleState: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'SUPERSEDED';
  beforeState: TenantAuthPolicyDraft;
  proposedState: TenantAuthPolicyDraft;
  beforeHash: string;
  proposedHash: string;
  impact: TenantSettingImpact;
  justification: string;
  requestedBy: number;
  submittedAt?: string | null;
  decidedBy?: number | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
  publishedBy?: number | null;
  publishedAt?: string | null;
  publishReceiptId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  allowedActions: Array<'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH'>;
};

type GeneratedAuthPolicyChangePage = Required<AuthSchemas['auth_AuthPolicyChangePage']>;

export type TenantAuthPolicyChangePage = Omit<GeneratedAuthPolicyChangePage, 'items'> & {
  items: TenantSettingChangeSet[];
};

export type TenantAccessGrant = {
  entitlementType: 'ROLE' | 'APP_PRESET' | 'APP_WORKFORCE' | 'CAPABILITY';
  entitlementKey: string;
  displayName: string;
  sourceType:
    | 'DIRECT'
    | 'GROUP'
    | 'PRIVILEGED'
    | 'APP_PRESET'
    | 'APP_PRESET_GROUP'
    | 'TENANT_APP_ASSIGNMENT'
    | 'PRODUCT_AUTHORIZATION'
    | 'TENANT_CAPABILITY_SUPPRESSION';
  sourceId: string;
  sourceName?: string | null;
  scopeType: string;
  scopeRef?: string | null;
  lifecycleState: string;
  validFrom?: string | null;
  validTo?: string | null;
  privileged: boolean;
  requestedBy?: number | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  activatedBy?: number | null;
  activatedAt?: string | null;
  approvalLineageState: string;
};

export type TenantAccessProjection = {
  snapshotId: string;
  observedAt: string;
  coverage: {
    state: 'COMPLETE_INTERNAL_OWNERS';
    includedOwners: string[];
    exclusions: string[];
    freshestSourceUpdatedAt?: string | null;
    owners: Array<{
      ownerKey: string;
      state: 'OBSERVED' | 'NO_DATA';
      freshnessState: 'FRESH' | 'STALE' | 'NO_DATA';
      observedAt: string;
      sourceUpdatedAt?: string | null;
      allowedActions: Array<'VIEW_DETAIL' | 'OPEN_OWNER' | 'REQUEST_RESTRICTIVE_OVERRIDE'>;
      exclusions: string[];
    }>;
  };
  principals: Array<{
    userId: number;
    displayName: string;
    email?: string | null;
    status: string;
    mfaEnabled: boolean;
    grants: TenantAccessGrant[];
    pendingApprovalCount: number;
    sourceUpdatedAt: string;
  }>;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type CompleteTenantAccessProjection = TenantAccessProjection & {
  collectedPages: number;
};

export type TenantEffectiveSettingSource = {
  level: 'PROVIDER' | 'TENANT' | 'USER' | string;
  ownerKey: string;
  value: unknown;
  evaluation: 'WINNER' | 'OVERRIDDEN' | 'INHERITED' | string;
  reason: string;
};

export type TenantEffectiveSetting = {
  settingKey: string;
  effectiveValue: unknown;
  resolutionStrategy: string;
  effectiveSource: string;
  locked: boolean;
  overrideAllowed: boolean;
  overrideState: string;
  sources: TenantEffectiveSettingSource[];
  evaluatedAt: string;
  evidenceState: string;
};

type GeneratedSsoTestLoginCommand = Required<AuthSchemas['auth_SsoTestLoginCommand']>;
type GeneratedSsoTestLoginReceipt = Required<AuthSchemas['auth_SsoTestLoginReceipt']>;
type GeneratedSsoTestLoginReceiptPage = Required<AuthSchemas['auth_SsoTestLoginReceiptPage']>;

export type TenantSsoTestLoginCommand = GeneratedSsoTestLoginCommand;

export type TenantSsoTestLoginReceipt = Omit<
  GeneratedSsoTestLoginReceipt,
  'providerKey' | 'blockingReasons'
> & {
  providerKey: string | null;
  blockingReasons: string[];
};

export type TenantSsoTestLoginReceiptPage = Omit<GeneratedSsoTestLoginReceiptPage, 'items'> & {
  items: TenantSsoTestLoginReceipt[];
};

export type TenantGovernanceSnapshot = {
  observedAt: string;
  tenantDirectory: {
    state: string;
    tenantId: number;
    tenantCode: string;
    tenantName: string;
    defaultLocale: string;
    sourceUpdatedAt: string;
  };
  providerDomain: {
    ownerKey: string;
    state: string;
    observedAt: string;
    exclusions: string[];
  };
  loginVerification: {
    internalPrerequisiteState: string;
    configuredProviderKey?: string | null;
    externalProbeState: string;
    lastExternalProbeAt?: string | null;
    latestReceipt?: TenantSsoTestLoginReceipt | null;
    blockingReasons: string[];
  };
  recoveryVerification: {
    state: string;
    total: number;
    verified: number;
    overdue: number;
    notVerified: number;
    freshestVerificationAt?: string | null;
    exclusions: string[];
  };
  policyOwners: Array<{
    ownerKey: string;
    state: string;
    observedAt: string;
    exclusions: string[];
  }>;
  effectiveSettings: TenantEffectiveSetting[];
};

export type TenantUserPreferenceState = {
  userId: number;
  preferredLocale?: string | null;
  tenantDefaultLocale: string;
  version: number;
  updatedAt: string;
};

export async function listTenantAuthPolicyChanges(
  limit = 100
): Promise<TenantAuthPolicyChangePage> {
  const response = await axiosInstance.get<ApiResponse<TenantAuthPolicyChangePage>>(
    `${BASE}/auth-policy/changes?limit=${limit}`
  );
  return response.data.data;
}

export async function createTenantAuthPolicyChange(request: {
  policy: TenantAuthPolicyDraft;
  justification: string;
}): Promise<TenantSettingChangeSet> {
  const response = await axiosInstance.post<ApiResponse<TenantSettingChangeSet>, typeof request>(
    `${BASE}/auth-policy/changes`,
    request
  );
  return response.data.data;
}

async function commandTenantAuthPolicyChange(
  change: TenantSettingChangeSet,
  command: 'submit' | 'publish'
): Promise<TenantSettingChangeSet> {
  const response = await axiosInstance.post<
    ApiResponse<TenantSettingChangeSet>,
    { version: number }
  >(`${BASE}/auth-policy/changes/${change.changeSetId}/${command}`, { version: change.version });
  return response.data.data;
}

export async function submitTenantAuthPolicyChange(
  change: TenantSettingChangeSet
): Promise<TenantSettingChangeSet> {
  return commandTenantAuthPolicyChange(change, 'submit');
}

export async function publishTenantAuthPolicyChange(
  change: TenantSettingChangeSet
): Promise<TenantSettingChangeSet> {
  return commandTenantAuthPolicyChange(change, 'publish');
}

export async function decideTenantAuthPolicyChange(
  change: TenantSettingChangeSet,
  decision: 'APPROVE' | 'REJECT',
  reason: string
): Promise<TenantSettingChangeSet> {
  const body = { version: change.version, decision, reason };
  const response = await axiosInstance.post<ApiResponse<TenantSettingChangeSet>, typeof body>(
    `${BASE}/auth-policy/changes/${change.changeSetId}/decision`,
    body
  );
  return response.data.data;
}

export async function getTenantAccessProjection(
  query = '',
  page = 0,
  size = 50,
  signal?: AbortSignal
): Promise<TenantAccessProjection> {
  const search = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) search.set('query', query.trim());
  const response = await axiosInstance.get<ApiResponse<TenantAccessProjection>>(
    `${BASE}/access-projection?${search.toString()}`,
    signal ? { signal } : undefined
  );
  return response.data.data;
}

const ACCESS_PROJECTION_PAGE_SIZE = 100;
const MAX_ACCESS_PROJECTION_PAGES = 10_000;

function sortedProjectionValues(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameProjectionValues(left: string[], right: string[]): boolean {
  const normalizedLeft = sortedProjectionValues(left);
  const normalizedRight = sortedProjectionValues(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function assertAccessProjectionPage(
  page: TenantAccessProjection,
  expectedPage: number,
  first: TenantAccessProjection
): void {
  if (
    page.snapshotId !== first.snapshotId ||
    page.page !== expectedPage ||
    page.size !== first.size ||
    page.totalElements !== first.totalElements ||
    page.totalPages !== first.totalPages ||
    page.coverage.state !== first.coverage.state ||
    !sameProjectionValues(page.coverage.includedOwners, first.coverage.includedOwners) ||
    !sameProjectionValues(page.coverage.exclusions, first.coverage.exclusions) ||
    page.principals.length > page.size
  ) {
    throw new Error('TENANT_ACCESS_PROJECTION_PAGINATION_CHANGED');
  }
}

function latestIso(values: Array<string | null | undefined>): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  );
}

function mergeProjectionCoverage(
  pages: TenantAccessProjection[]
): TenantAccessProjection['coverage'] {
  const first = pages[0].coverage;
  const owners = first.includedOwners.map((ownerKey) => {
    const observations = pages.flatMap((page) =>
      page.coverage.owners.filter((owner) => owner.ownerKey === ownerKey)
    );
    if (observations.length !== pages.length) {
      throw new Error('TENANT_ACCESS_PROJECTION_OWNER_COVERAGE_INCOMPLETE');
    }
    const allowedActions = observations
      .map((owner) => owner.allowedActions)
      .reduce((allowed, current) => allowed.filter((action) => current.includes(action)));
    const freshnessState = observations.some((owner) => owner.freshnessState === 'STALE')
      ? ('STALE' as const)
      : observations.some((owner) => owner.freshnessState === 'FRESH')
        ? ('FRESH' as const)
        : ('NO_DATA' as const);
    return {
      ...observations[0],
      state: observations.some((owner) => owner.state === 'OBSERVED')
        ? ('OBSERVED' as const)
        : ('NO_DATA' as const),
      freshnessState,
      observedAt: latestIso(observations.map((owner) => owner.observedAt)) ?? pages[0].observedAt,
      sourceUpdatedAt: latestIso(observations.map((owner) => owner.sourceUpdatedAt)),
      allowedActions,
      exclusions: [...new Set(observations.flatMap((owner) => owner.exclusions))],
    };
  });
  return {
    ...first,
    freshestSourceUpdatedAt: latestIso(pages.map((page) => page.coverage.freshestSourceUpdatedAt)),
    owners,
  };
}

export async function getCompleteTenantAccessProjection(
  query = '',
  signal?: AbortSignal
): Promise<CompleteTenantAccessProjection> {
  const first = await getTenantAccessProjection(query, 0, ACCESS_PROJECTION_PAGE_SIZE, signal);
  if (
    first.page !== 0 ||
    first.size < 1 ||
    first.totalElements < 0 ||
    first.totalPages < 0 ||
    first.totalPages > MAX_ACCESS_PROJECTION_PAGES ||
    first.principals.length > first.size
  ) {
    throw new Error('TENANT_ACCESS_PROJECTION_PAGINATION_INVALID');
  }

  const pages = [first];
  for (let pageNumber = 1; pageNumber < first.totalPages; pageNumber += 1) {
    const page = await getTenantAccessProjection(
      query,
      pageNumber,
      ACCESS_PROJECTION_PAGE_SIZE,
      signal
    );
    assertAccessProjectionPage(page, pageNumber, first);
    pages.push(page);
  }

  const principals = pages.flatMap((page) => page.principals);
  if (principals.length !== first.totalElements) {
    throw new Error('TENANT_ACCESS_PROJECTION_COVERAGE_INCOMPLETE');
  }
  if (new Set(principals.map((principal) => principal.userId)).size !== principals.length) {
    throw new Error('TENANT_ACCESS_PROJECTION_DUPLICATE_PRINCIPAL');
  }

  return {
    ...first,
    observedAt: latestIso(pages.map((page) => page.observedAt)) ?? first.observedAt,
    coverage: mergeProjectionCoverage(pages),
    principals,
    collectedPages: Math.max(1, first.totalPages),
  };
}

export async function getTenantGovernanceSnapshot(): Promise<TenantGovernanceSnapshot> {
  const response = await axiosInstance.get<ApiResponse<TenantGovernanceSnapshot>>(
    `${BASE}/governance-snapshot`
  );
  return response.data.data;
}

export async function requestTenantSsoTestLogin(
  command: TenantSsoTestLoginCommand
): Promise<TenantSsoTestLoginReceipt> {
  const response = await axiosInstance.post<
    ApiResponse<TenantSsoTestLoginReceipt>,
    TenantSsoTestLoginCommand
  >(`${BASE}/sso-test-login-jobs`, command);
  return response.data.data;
}

export async function listTenantSsoTestLoginReceipts(
  limit = 20
): Promise<TenantSsoTestLoginReceiptPage> {
  const response = await axiosInstance.get<ApiResponse<TenantSsoTestLoginReceiptPage>>(
    `${BASE}/sso-test-login-jobs?limit=${limit}`
  );
  return response.data.data;
}

export async function getTenantSsoTestLoginReceipt(
  jobId: string
): Promise<TenantSsoTestLoginReceipt> {
  const response = await axiosInstance.get<ApiResponse<TenantSsoTestLoginReceipt>>(
    `${BASE}/sso-test-login-jobs/${encodeURIComponent(jobId)}`
  );
  return response.data.data;
}

const SELF_EFFECTIVE_SETTINGS_BASE = '/api/auth/tenant-settings/effective-settings/me';

export async function getMyTenantEffectiveSettings(): Promise<TenantEffectiveSetting[]> {
  const response = await axiosInstance.get<ApiResponse<TenantEffectiveSetting[]>>(
    SELF_EFFECTIVE_SETTINGS_BASE
  );
  return response.data.data;
}

export async function getMyTenantPreferredLocale(): Promise<TenantUserPreferenceState> {
  const response = await axiosInstance.get<ApiResponse<TenantUserPreferenceState>>(
    `${SELF_EFFECTIVE_SETTINGS_BASE}/preferred-locale`
  );
  return response.data.data;
}

export async function restoreMyTenantPreferredLocale(
  preference: TenantUserPreferenceState
): Promise<TenantUserPreferenceState> {
  const body = { version: preference.version };
  const response = await axiosInstance.post<ApiResponse<TenantUserPreferenceState>, typeof body>(
    `${SELF_EFFECTIVE_SETTINGS_BASE}/preferred-locale/restore`,
    body
  );
  return response.data.data;
}
