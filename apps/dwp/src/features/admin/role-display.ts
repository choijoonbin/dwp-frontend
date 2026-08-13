import type { TFunction } from 'i18next';

type RoleDisplaySource = {
  code: string;
  name: string;
  description?: string | null;
};

const BUILT_IN_ROLE_CODES = new Set([
  'ADMIN',
  'PLATFORM_ADMIN',
  'TENANT_ADMIN',
  'WORKSPACE_MEMBER',
  'HR_ADMIN',
  'PEOPLE_ADMIN',
  'AUDITOR',
  'AUDIT_ADMIN',
  'IDENTITY_ADMIN',
  'APP_CATALOG_ADMIN',
  'COMMUNICATIONS_EDITOR',
  'COMMUNICATIONS_PUBLISHER',
  'SERVICE_CATALOG_MANAGER',
  'SERVICE_AGENT',
  'PROVIDER_ADMIN',
  'PROVIDER_OPERATOR',
  'PROVIDER_SUPPORT',
  'PROVIDER_AUDITOR',
  'PROVIDER_TENANT_PROVISIONER',
  'PROVIDER_ENTITLEMENT_ADMIN',
  'PROVIDER_CHANGE_APPROVER',
  'PROVIDER_RELEASE_APPROVER',
  'PROVIDER_DATA_APPROVER',
]);

export type RoleDisplayCopy = {
  name: string;
  description: string;
};

export function resolveRoleDisplayCopy(
  role: RoleDisplaySource,
  t: TFunction<'admin'>
): RoleDisplayCopy {
  const description = role.description?.trim() ?? '';
  if (!BUILT_IN_ROLE_CODES.has(role.code)) {
    return { name: role.name, description };
  }

  const key = `roleGovernance.systemRoles.${role.code}`;
  return {
    name: t(`${key}.name`, { defaultValue: role.name }),
    description: t(`${key}.description`, { defaultValue: description }),
  };
}
