import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveDisplayCodeWithFallback } from './display-dictionary';

import type { TFunction } from 'i18next';

export const SYSTEM_ROLE_CODES = [
  'ADMIN',
  'PLATFORM_ADMIN',
  'TENANT_ADMIN',
  'IDENTITY_ADMIN',
  'APP_CATALOG_ADMIN',
  'WORKSPACE_MEMBER',
  'COMMUNICATIONS_EDITOR',
  'COMMUNICATIONS_PUBLISHER',
  'SERVICE_CATALOG_MANAGER',
  'SERVICE_AGENT',
  'CALENDAR_ADMIN',
  'HR_ADMIN',
  'TIME_ADMIN',
  'ABSENCE_ADMIN',
  'BENEFITS_ADMIN',
  'PAYROLL_ADMIN',
  'TALENT_ADMIN',
  'APPROVAL_DESIGNER',
  'PEOPLE_ADMIN',
  'APPROVAL_PUBLISHER',
  'APPROVAL_OPERATOR',
  'AUDITOR',
  'AUDIT_ADMIN',
  'PROVIDER_ADMIN',
  'PROVIDER_OPERATOR',
  'PROVIDER_TENANT_PROVISIONER',
  'PROVIDER_ENTITLEMENT_ADMIN',
  'PROVIDER_CHANGE_APPROVER',
  'PROVIDER_RELEASE_APPROVER',
  'PROVIDER_DATA_APPROVER',
  'PROVIDER_SUPPORT',
  'PROVIDER_AUDITOR',
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export type RoleDisplaySource = {
  code: string;
  name: string;
  description?: string | null;
};

export type RoleDisplayCopy = {
  name: string;
  description: string;
};

export function resolveRoleDisplayCopy(
  role: RoleDisplaySource,
  t: TFunction<'display'>
): RoleDisplayCopy {
  const description = role.description?.trim() ?? '';
  return {
    name: resolveDisplayCodeWithFallback(t, 'roleNames', role.code, role.name),
    description: resolveDisplayCodeWithFallback(t, 'roleDescriptions', role.code, description),
  };
}

export function useRoleDisplay() {
  const { t } = useTranslation('display');
  return useCallback(
    (code: string, name: string, description?: string | null) =>
      resolveRoleDisplayCopy({ code, name, description }, t),
    [t]
  );
}
