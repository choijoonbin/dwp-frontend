export const HRIS_APP_GOVERNANCE_ROUTE = '/admin/identity/app-governance?product=HCM' as const;

export const HRIS_HOME_DATA_RESOURCES = [
  'DATA.WORKFORCE',
  'DATA.HR_TIME',
  'DATA.HR_ABSENCE',
  'DATA.HR_PAY',
  'DATA.HR_TALENT',
] as const;

export type HrisRoleGroup =
  'EMPLOYEE' | 'MANAGER' | 'OPERATIONS' | 'CONFIGURATION_ADMIN' | 'ENTERPRISE_AUDITOR';

export type HrisAccessGrant = {
  action: string;
  resourceType: string;
  resourceKey: string;
  scopeType: 'SELF' | 'TEAM' | 'TENANT' | 'RESOURCE_SET' | string;
  scopeKey: string;
  mutable: boolean;
};

export type HrisAccessSnapshot = {
  tenantId: number;
  subjectId: number;
  evaluatedAt: string;
  policyVersion: string;
  evidenceVersion: string;
  state: 'ALLOWED' | 'DENIED';
  reasonCode: string;
  roleGroups: HrisRoleGroup[];
  grants: HrisAccessGrant[];
  authority: {
    appEntitled: boolean;
    configurationAuthority: boolean;
    accessGovernanceAuthority: boolean;
    auditAuthority: boolean;
    readOnly: boolean;
    separationOfDutiesConflict: boolean;
    commandAuthorizationReusable: boolean;
  };
};

export type HrisProjectionSourceState =
  'AVAILABLE' | 'UNAVAILABLE' | 'STALE' | 'REVOKED' | 'CONFIGURATION_REQUIRED';

export type HrisProjectionMenu = {
  navigationKey: string;
  itemType: string;
  label: string;
  description?: string | null;
  route?: string | null;
  iconKey?: string | null;
  requiredResourceKey?: string | null;
  requiredPermissionCode?: string | null;
  lifecycleState?: string;
  children: HrisProjectionMenu[];
};

export type HrisProjectionWidget = {
  templateId: string;
  templateKey: string;
  templateName: string;
  widgetKey: string;
  size?: string | null;
  height?: string | null;
  templateVersion: number;
  templateLifecycle?: string;
  freshnessState?: 'CURRENT' | 'STALE';
};

export type HrisConfigurationProjection = {
  tenantId: number;
  subjectId: number;
  evaluatedAt: string;
  projectionVersion: string;
  state: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
  readOnly: boolean;
  commandAuthorizationReusable: boolean;
  allowedActions: string[];
  menus: HrisProjectionMenu[];
  widgets: HrisProjectionWidget[];
  sources: Array<{
    source: 'NAVIGATION' | 'HOME_TEMPLATE' | string;
    state: HrisProjectionSourceState;
    reasonCode?: string | null;
  }>;
};

export type HrisHomeEntitlement = {
  resourceType: 'DATA';
  resourceKey: (typeof HRIS_HOME_DATA_RESOURCES)[number];
  permissionCode: 'VIEW' | 'MANAGE';
  scopeType: string;
  scopeKey: string;
};

export type HrisSystemWorkspaceModel = {
  state: 'READY' | 'PARTIAL' | 'CONFIGURATION_REQUIRED' | 'DENIED';
  reasonCode: string | null;
  readOnly: boolean;
  roleGroups: HrisRoleGroup[];
  menus: HrisProjectionMenu[];
  widgets: HrisProjectionWidget[];
  sources: HrisConfigurationProjection['sources'];
  homeEntitlements: HrisHomeEntitlement[];
  evidenceVersion: string;
  projectionVersion: string;
  canOpenGovernance: boolean;
  configurationActions: Array<'VIEW' | 'UPDATE' | 'PUBLISH'>;
};

export class HrisSystemBoundaryError extends Error {
  constructor(public readonly reason: 'TENANT_MISMATCH' | 'COMMAND_AUTHORITY_REUSE') {
    super(`HRIS system boundary rejected: ${reason}`);
    this.name = 'HrisSystemBoundaryError';
  }
}

function sourceAvailable(
  projection: HrisConfigurationProjection,
  source: 'NAVIGATION' | 'HOME_TEMPLATE'
): boolean {
  return projection.sources.some((item) => item.source === source && item.state === 'AVAILABLE');
}

function activeMenu(menu: HrisProjectionMenu): HrisProjectionMenu | null {
  if (menu.lifecycleState && menu.lifecycleState !== 'ACTIVE') return null;
  const children = (menu.children ?? []).map(activeMenu).filter((item) => item !== null);
  if (menu.itemType === 'GROUP' && children.length === 0) return null;
  return { ...menu, children };
}

function hasProductGrant(
  access: HrisAccessSnapshot,
  resourceKey: 'UI.MENU.HRIS' | 'UI.WIDGET.HRIS'
): boolean {
  return access.grants.some(
    (grant) =>
      grant.resourceType === 'PRODUCT' &&
      grant.resourceKey === resourceKey &&
      grant.action === 'VIEW' &&
      grant.scopeType === 'SELF' &&
      grant.scopeKey === String(access.subjectId)
  );
}

export function toHrisHomeEntitlements(access: HrisAccessSnapshot): HrisHomeEntitlement[] {
  if (access.state !== 'ALLOWED' || access.authority.commandAuthorizationReusable) return [];
  const supported = new Set<string>(HRIS_HOME_DATA_RESOURCES);
  const result = new Map<string, HrisHomeEntitlement>();
  for (const grant of access.grants) {
    if (
      grant.resourceType !== 'DATA' ||
      !supported.has(grant.resourceKey) ||
      (grant.action !== 'VIEW' && grant.action !== 'MANAGE') ||
      !grantScopeMatchesActor(grant, access)
    ) {
      continue;
    }
    const entitlement: HrisHomeEntitlement = {
      resourceType: 'DATA',
      resourceKey: grant.resourceKey as HrisHomeEntitlement['resourceKey'],
      permissionCode: grant.action,
      scopeType: grant.scopeType,
      scopeKey: grant.scopeKey,
    };
    result.set(
      `${entitlement.resourceKey}:${entitlement.permissionCode}:${entitlement.scopeType}:${entitlement.scopeKey}`,
      entitlement
    );
  }
  return Array.from(result.values()).sort((left, right) =>
    `${left.resourceKey}:${left.permissionCode}:${left.scopeType}`.localeCompare(
      `${right.resourceKey}:${right.permissionCode}:${right.scopeType}`
    )
  );
}

function grantScopeMatchesActor(
  grant: HrisAccessGrant,
  access: Pick<HrisAccessSnapshot, 'tenantId' | 'subjectId'>
): boolean {
  if (grant.scopeType === 'SELF') return grant.scopeKey === String(access.subjectId);
  if (grant.scopeType === 'TENANT') return grant.scopeKey === String(access.tenantId);
  return grant.scopeType === 'TEAM' && grant.scopeKey === 'ASSIGNED';
}

export function buildHrisSystemWorkspaceModel(
  access: HrisAccessSnapshot,
  projection: HrisConfigurationProjection
): HrisSystemWorkspaceModel {
  if (access.tenantId !== projection.tenantId || access.subjectId !== projection.subjectId) {
    throw new HrisSystemBoundaryError('TENANT_MISMATCH');
  }
  if (access.authority.commandAuthorizationReusable || projection.commandAuthorizationReusable) {
    throw new HrisSystemBoundaryError('COMMAND_AUTHORITY_REUSE');
  }
  if (access.state === 'DENIED') {
    return {
      state: 'DENIED',
      reasonCode: access.reasonCode,
      readOnly: true,
      roleGroups: [],
      menus: [],
      widgets: [],
      sources: projection.sources,
      homeEntitlements: [],
      evidenceVersion: access.evidenceVersion,
      projectionVersion: projection.projectionVersion,
      canOpenGovernance: false,
      configurationActions: [],
    };
  }

  const menuAllowed = hasProductGrant(access, 'UI.MENU.HRIS');
  const widgetAllowed = hasProductGrant(access, 'UI.WIDGET.HRIS');
  const menus =
    menuAllowed && sourceAvailable(projection, 'NAVIGATION')
      ? projection.menus.map(activeMenu).filter((item) => item !== null)
      : [];
  const widgets =
    widgetAllowed && sourceAvailable(projection, 'HOME_TEMPLATE')
      ? projection.widgets.filter(
          (widget) =>
            (!widget.templateLifecycle || widget.templateLifecycle === 'PUBLISHED') &&
            widget.freshnessState !== 'STALE'
        )
      : [];
  const configurationActions = access.grants
    .filter(
      (grant) =>
        grant.resourceType === 'CONFIGURATION' &&
        grant.resourceKey === 'HCM.CONFIGURATION_WORKBENCH' &&
        grant.scopeType === 'TENANT' &&
        grant.scopeKey === String(access.tenantId)
    )
    .map((grant) => grant.action)
    .filter((action): action is 'VIEW' | 'UPDATE' | 'PUBLISH' =>
      ['VIEW', 'UPDATE', 'PUBLISH'].includes(action)
    );
  const homeEntitlements = toHrisHomeEntitlements(access);
  const hasModuleGrant = access.grants.some((grant) =>
    ['DATA', 'CONFIGURATION', 'AUDIT', 'APP_RESOURCE_SET'].includes(grant.resourceType)
  );
  const projectedState = !hasModuleGrant
    ? 'CONFIGURATION_REQUIRED'
    : projection.state === 'PARTIAL'
      ? 'PARTIAL'
      : projection.state === 'UNAVAILABLE' || (menus.length === 0 && widgets.length === 0)
        ? 'CONFIGURATION_REQUIRED'
        : 'READY';

  return {
    state: projectedState,
    reasonCode: projectedState === 'CONFIGURATION_REQUIRED' ? 'CONFIGURATION_REQUIRED' : null,
    readOnly: access.authority.readOnly || projection.readOnly,
    roleGroups: [...access.roleGroups],
    menus,
    widgets,
    sources: projection.sources,
    homeEntitlements,
    evidenceVersion: access.evidenceVersion,
    projectionVersion: projection.projectionVersion,
    canOpenGovernance:
      access.authority.accessGovernanceAuthority ||
      access.authority.configurationAuthority ||
      access.authority.auditAuthority,
    configurationActions: Array.from(new Set(configurationActions)),
  };
}

export type OwnerRequestIdentity = {
  presetCode: string;
  resourceSetId: string;
  validTo: string;
  reviewDueAt: string;
};

export type OwnerCommandReceipt = {
  idempotencyKey: string;
  request: OwnerRequestIdentity;
  status: 'CONFIRMED' | 'REPLAYED' | 'RESULT_UNKNOWN' | 'RECONCILED';
  presetAssignmentId?: string;
};

export type OwnerAssignmentEvidence = OwnerRequestIdentity & {
  presetAssignmentId: string;
  requestChannel: string;
  lifecycleState: string;
};

function sameOwnerRequest(
  request: OwnerRequestIdentity,
  assignment: OwnerAssignmentEvidence
): boolean {
  return (
    assignment.requestChannel === 'SELF_SERVICE' &&
    assignment.presetCode === request.presetCode &&
    assignment.resourceSetId === request.resourceSetId &&
    assignment.validTo === request.validTo &&
    assignment.reviewDueAt === request.reviewDueAt
  );
}

export function reconcileOwnerCommandReceipt(
  receipt: OwnerCommandReceipt,
  assignments: readonly OwnerAssignmentEvidence[]
): OwnerCommandReceipt {
  const matches = assignments.filter((assignment) => sameOwnerRequest(receipt.request, assignment));
  if (matches.length !== 1) return receipt;
  const [assignment] = matches;
  if (receipt.status === 'RESULT_UNKNOWN') {
    return { ...receipt, status: 'RECONCILED', presetAssignmentId: assignment.presetAssignmentId };
  }
  if (
    receipt.status === 'CONFIRMED' &&
    receipt.presetAssignmentId === assignment.presetAssignmentId
  ) {
    return { ...receipt, status: 'REPLAYED' };
  }
  return receipt;
}
