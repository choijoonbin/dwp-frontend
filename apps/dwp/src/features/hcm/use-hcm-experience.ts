import { useQuery } from '@tanstack/react-query';
import {
  getPerson,
  hasAnyRole,
  HttpError,
  isProviderIdentity,
  isAppResourceEntitled,
  listPeople,
  useAuth,
  usePermissions,
  useProviderSupportContext,
  WORKFORCE_OPERATIONS_ROLES,
} from '@dwp-frontend/shared-utils';
import { selectCurrentPerson } from './hcm-experience-model';

const MANAGER_ROLES = ['MANAGER', 'LINE_MANAGER', 'PEOPLE_MANAGER'] as const;

/**
 * Resolves menu and task access from authenticated authority only.
 *
 * This hook must stay free of People/Directory reads. The HCM shell mounts it for every page,
 * including operations and management pages whose users may not have directory authority.
 */
export function useHcmAccess() {
  const auth = useAuth();
  const { permissions, hasPermission } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const providerRole = isProviderIdentity(auth.user);
  const supportContext = useProviderSupportContext(providerRole);
  const supportCanReadWorkforce = supportContext.data?.scopes.includes('WORKFORCE_READ') ?? false;
  const hasWorkforceDataAccess =
    hasPermission('DATA.WORKFORCE', 'VIEW') || hasPermission('DATA.WORKFORCE', 'MANAGE');
  const canOperate =
    supportCanReadWorkforce ||
    (isAppResourceEntitled('APP.WORKFORCE_MANAGEMENT', permissions) &&
      hasWorkforceDataAccess &&
      hasAnyRole(roles, WORKFORCE_OPERATIONS_ROLES));
  const canManageDomain = (resource: string) =>
    hasPermission(resource, 'VIEW') ||
    hasPermission(resource, 'APPROVE') ||
    hasPermission(resource, 'MANAGE');
  const canReadManagementResource = (resource: string) =>
    hasPermission(resource, 'VIEW') || hasPermission(resource, 'MANAGE');
  const canManageTime = canManageDomain('DATA.HR_TIME');
  const canManageAbsence = canManageDomain('DATA.HR_ABSENCE');
  const canManageBenefits = canManageDomain('DATA.HR_BENEFITS');
  const canManagePay = canManageDomain('DATA.HR_PAY');
  const canManageTalent = canManageDomain('DATA.HR_TALENT');

  return {
    canOperate,
    isManager: hasAnyRole(roles, MANAGER_ROLES),
    canManageWorkforce: hasPermission('DATA.WORKFORCE', 'MANAGE'),
    canManageTime,
    canManageAbsence,
    canManageBenefits,
    canManagePay,
    canManageTalent,
    canAccessOperationsOverview:
      canOperate ||
      canManageTime ||
      canManageAbsence ||
      canManageBenefits ||
      canManagePay ||
      canManageTalent,
    canAccessOrganizationDesign: canReadManagementResource('ACTION.WORKFORCE_ORG_DESIGN'),
    canAccessReferenceData: canReadManagementResource('ACTION.WORKFORCE_REFERENCE'),
    canAccessDataOperations: canReadManagementResource('ACTION.WORKFORCE_DATA_OPERATIONS'),
    canAccessExports: canReadManagementResource('ACTION.WORKFORCE_CONTROLLED_EXPORT'),
    supportCanReadWorkforce,
  };
}

export function shouldFallbackToHcmIdentitySearch(error: unknown): boolean {
  return error instanceof HttpError && error.status === 404;
}

/**
 * Links the signed-in identity to a directory person only for experiences that display person
 * details. Authorization and transport failures are surfaced as-is instead of being hidden by a
 * second directory search that is expected to fail with the same authority.
 */
export function useCurrentHcmPerson() {
  const auth = useAuth();
  const identityEmail = auth.user?.email?.trim();
  const currentPersonQuery = useQuery({
    queryKey: [
      'hcm',
      'current-person',
      auth.user?.tenantId,
      auth.user?.userId,
      auth.user?.personPublicId,
      identityEmail,
    ],
    queryFn: async () => {
      if (auth.user?.personPublicId) {
        try {
          return (await getPerson(auth.user.personPublicId, undefined, 'directory')).person;
        } catch (error) {
          if (!shouldFallbackToHcmIdentitySearch(error)) throw error;
          // A verified email is the only safe fallback for a missing synchronized identity.
        }
      }
      if (identityEmail) {
        const page = await listPeople({ query: identityEmail, size: 20, surface: 'directory' });
        const person = selectCurrentPerson(page.items, {
          email: auth.user?.email,
          displayName: auth.user?.displayName,
        });
        if (person) return person;
      }
      return undefined;
    },
    enabled: Boolean(auth.user?.personPublicId || identityEmail),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) =>
      !(error instanceof HttpError && [401, 403, 404].includes(error.status)) && failureCount < 1,
  });

  return {
    currentPerson: currentPersonQuery.data,
    currentPersonQuery,
  };
}
