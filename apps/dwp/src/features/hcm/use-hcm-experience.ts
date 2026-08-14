import { useQuery } from '@tanstack/react-query';
import {
  getPerson,
  hasAnyRole,
  hasProviderControlPlaneRole,
  isAppResourceEntitled,
  listPeople,
  useAuth,
  usePermissions,
  useProviderSupportContext,
  WORKFORCE_OPERATIONS_ROLES,
} from '@dwp-frontend/shared-utils';
import { selectCurrentPerson } from './hcm-experience-model';

const MANAGER_ROLES = ['MANAGER', 'LINE_MANAGER', 'PEOPLE_MANAGER'] as const;

export function useHcmExperience() {
  const auth = useAuth();
  const { permissions, hasPermission } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const providerRole = hasProviderControlPlaneRole(roles);
  const supportContext = useProviderSupportContext(providerRole);
  const identityQueries = [auth.user?.email]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const currentPersonQuery = useQuery({
    queryKey: [
      'hcm',
      'current-person',
      auth.user?.tenantId,
      auth.user?.userId,
      auth.user?.personPublicId,
      identityQueries,
    ],
    queryFn: async () => {
      if (auth.user?.personPublicId) {
        try {
          return (await getPerson(auth.user.personPublicId, undefined, 'directory')).person;
        } catch {
          // A verified email is the only safe fallback for partially synchronized identities.
        }
      }
      for (const query of identityQueries) {
        const page = await listPeople({ query, size: 20, surface: 'directory' });
        const person = selectCurrentPerson(page.items, {
          email: auth.user?.email,
          displayName: auth.user?.displayName,
        });
        if (person) return person;
      }
      return undefined;
    },
    enabled: Boolean(auth.user?.personPublicId || identityQueries.length),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const currentPerson = currentPersonQuery.data;
  const supportCanReadWorkforce = supportContext.data?.scopes.includes('WORKFORCE_READ') ?? false;
  const hasWorkforceDataAccess =
    hasPermission('DATA.WORKFORCE', 'VIEW') || hasPermission('DATA.WORKFORCE', 'MANAGE');
  const canOperate =
    supportCanReadWorkforce ||
    (isAppResourceEntitled('APP.WORKFORCE_MANAGEMENT', permissions) &&
      hasWorkforceDataAccess &&
      hasAnyRole(roles, WORKFORCE_OPERATIONS_ROLES));
  const isManager = (currentPerson?.directReportCount ?? 0) > 0 || hasAnyRole(roles, MANAGER_ROLES);
  const canManageDomain = (resource: string) =>
    hasPermission(resource, 'VIEW') ||
    hasPermission(resource, 'APPROVE') ||
    hasPermission(resource, 'MANAGE');

  return {
    currentPerson,
    currentPersonQuery,
    canOperate,
    isManager,
    canManageWorkforce: hasPermission('DATA.WORKFORCE', 'MANAGE'),
    canManageTime: canManageDomain('DATA.HR_TIME'),
    canManageAbsence: canManageDomain('DATA.HR_ABSENCE'),
    canManageBenefits: canManageDomain('DATA.HR_BENEFITS'),
    canManagePay: canManageDomain('DATA.HR_PAY'),
    canManageTalent: canManageDomain('DATA.HR_TALENT'),
    supportCanReadWorkforce,
  };
}
