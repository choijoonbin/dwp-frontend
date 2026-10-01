import type {
  AppGovernanceDashboard,
  AuditPolicyRevisionPage,
  ScimConnector,
  TenantProviderDomainProjection,
} from '@dwp-frontend/shared-utils';
import type {
  AuthPolicyResponse,
  IdentityProviderResponse,
} from '@dwp-frontend/shared-utils/auth/auth-policy-types';

export type TenantSettingsTaskKind =
  'SSO_CONFIGURATION' | 'SCIM_CONFIGURATION' | 'SCIM_ATTENTION' | 'APP_APPROVAL' | 'POLICY_REVIEW';

export type TenantSettingsTask = Readonly<{
  kind: TenantSettingsTaskKind;
  count: number;
  countIsLowerBound?: boolean;
  route: string;
  tone: 'info' | 'warning' | 'critical';
}>;

export type TenantPrioritySummaryState = 'LOADING' | 'ACTION_REQUIRED' | 'CLEAR' | 'UNAVAILABLE';

export type TenantDomainOverview = Readonly<{
  state: 'NO_ACCESS' | 'LOADING' | 'ERROR' | 'EMPTY' | 'OBSERVED';
  total: number | null;
  verified: number | null;
}>;

export function resolveTenantDomainOverview(input: {
  permitted: boolean;
  loading: boolean;
  failed: boolean;
  projection?: TenantProviderDomainProjection;
}): TenantDomainOverview {
  if (!input.permitted) return { state: 'NO_ACCESS', total: null, verified: null };
  if (input.loading) return { state: 'LOADING', total: null, verified: null };
  if (input.failed || !input.projection) {
    return { state: 'ERROR', total: null, verified: null };
  }

  const total = input.projection.domains.length;
  const verified = input.projection.domains.filter(
    (domain) => domain.verificationState === 'VERIFIED'
  ).length;
  return { state: total === 0 ? 'EMPTY' : 'OBSERVED', total, verified };
}

export function resolveTenantPrioritySummaryState(input: {
  loading: boolean;
  partialFailure: boolean;
  taskCount: number;
}): TenantPrioritySummaryState {
  if (input.loading) return 'LOADING';
  if (input.taskCount > 0) return 'ACTION_REQUIRED';
  return input.partialFailure ? 'UNAVAILABLE' : 'CLEAR';
}

export type TenantAuthenticationPosture = Readonly<{
  sso: 'ENABLED' | 'INCOMPLETE' | 'DISABLED' | 'UNAVAILABLE';
  providerKeys: readonly string[];
  mfaRequired: boolean | null;
  scim: 'READY' | 'ATTENTION' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
  activeScimConnectors: number | null;
}>;

export function resolveTenantAuthenticationPosture(input: {
  authPolicy?: AuthPolicyResponse;
  identityProviders?: readonly IdentityProviderResponse[];
  scimConnectors?: readonly ScimConnector[];
}): TenantAuthenticationPosture {
  const enabledProviders = input.identityProviders?.filter((provider) => provider.enabled) ?? [];
  const configuredProviderKey = input.authPolicy?.ssoProviderKey?.trim();
  const configuredProviderObserved = Boolean(
    configuredProviderKey &&
    enabledProviders.some((provider) => provider.providerKey === configuredProviderKey)
  );
  const sso = !input.authPolicy
    ? 'UNAVAILABLE'
    : !input.authPolicy.ssoLoginEnabled
      ? 'DISABLED'
      : !input.identityProviders
        ? 'UNAVAILABLE'
        : configuredProviderObserved
          ? 'ENABLED'
          : 'INCOMPLETE';

  const usableConnectors =
    input.scimConnectors?.filter(
      (connector) =>
        connector.lifecycleState === 'ACTIVE' && connector.credentialState !== 'EXPIRED'
    ) ?? [];
  const connectorAttention =
    input.scimConnectors?.some(
      (connector) =>
        connector.health === 'ATTENTION' ||
        connector.health === 'EXPIRING' ||
        connector.health === 'EXPIRED'
    ) ?? false;
  const scim = !input.scimConnectors
    ? 'UNAVAILABLE'
    : connectorAttention
      ? 'ATTENTION'
      : usableConnectors.length > 0
        ? 'READY'
        : 'NOT_CONFIGURED';

  return {
    sso,
    providerKeys: enabledProviders.map((provider) => provider.providerKey),
    mfaRequired: input.authPolicy?.requireMfa ?? null,
    scim,
    activeScimConnectors: input.scimConnectors ? usableConnectors.length : null,
  };
}

export function resolveTenantSettingsTasks(input: {
  authentication: TenantAuthenticationPosture;
  appGovernance?: AppGovernanceDashboard;
  policyRevisions?: Pick<AuditPolicyRevisionPage, 'items' | 'hasMore'>;
}): TenantSettingsTask[] {
  const tasks: TenantSettingsTask[] = [];

  if (input.authentication.sso === 'DISABLED' || input.authentication.sso === 'INCOMPLETE') {
    tasks.push({
      kind: 'SSO_CONFIGURATION',
      count: 1,
      route: '/admin/identity/provisioning',
      tone: input.authentication.sso === 'INCOMPLETE' ? 'critical' : 'warning',
    });
  }
  if (input.authentication.scim === 'NOT_CONFIGURED') {
    tasks.push({
      kind: 'SCIM_CONFIGURATION',
      count: 1,
      route: '/admin/identity/provisioning',
      tone: 'info',
    });
  } else if (input.authentication.scim === 'ATTENTION') {
    tasks.push({
      kind: 'SCIM_ATTENTION',
      count: 1,
      route: '/admin/identity/provisioning',
      tone: 'critical',
    });
  }

  const pendingApprovals = input.appGovernance?.metrics.pendingApprovals ?? 0;
  if (pendingApprovals > 0) {
    tasks.push({
      kind: 'APP_APPROVAL',
      count: pendingApprovals,
      route: '/admin/identity/app-governance',
      tone: 'warning',
    });
  }

  const policyRevisionItems = input.policyRevisions?.items ?? [];
  const pendingPolicyRevisions = policyRevisionItems.filter((revision) =>
    ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(revision.lifecycleState)
  ).length;
  if (pendingPolicyRevisions > 0) {
    tasks.push({
      kind: 'POLICY_REVIEW',
      count: pendingPolicyRevisions,
      countIsLowerBound:
        Boolean(input.policyRevisions?.hasMore) &&
        pendingPolicyRevisions === policyRevisionItems.length,
      route: '/admin/governance/audit-governance',
      tone: 'warning',
    });
  }

  return tasks;
}
