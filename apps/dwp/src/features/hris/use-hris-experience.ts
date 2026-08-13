import { useQuery } from '@tanstack/react-query';
import { getPerson, listPeople, useAuth, usePermissions } from '@dwp-frontend/shared-utils';

import {
  hasAnyRole,
  hasProviderControlPlaneRole,
  WORKFORCE_OPERATIONS_ROLES,
} from '../auth/control-plane-access';
import { isAppResourceEntitled } from '../home/app-launchpad-model';
import { useProviderSupportContext } from '../provider/use-provider-support-context';
import { selectCurrentPerson } from './hris-experience-model';

const MANAGER_ROLES = ['MANAGER', 'LINE_MANAGER', 'PEOPLE_MANAGER'] as const;

export function useHrisExperience() {
  const auth = useAuth();
  const { permissions, hasPermission } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const providerRole = hasProviderControlPlaneRole(roles);
  const supportContext = useProviderSupportContext(providerRole);
  const identityQueries = [auth.user?.email, auth.user?.displayName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const currentPersonQuery = useQuery({
    queryKey: [
      'hris',
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
          // Older or partially synchronized identities can still use the directory fallback.
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
  const canOperate =
    supportCanReadWorkforce ||
    (isAppResourceEntitled('APP.WORKFORCE_MANAGEMENT', permissions) &&
      hasAnyRole(roles, WORKFORCE_OPERATIONS_ROLES));
  const isManager = (currentPerson?.directReportCount ?? 0) > 0 || hasAnyRole(roles, MANAGER_ROLES);

  return {
    currentPerson,
    currentPersonQuery,
    canOperate,
    isManager,
    canManageWorkforce: hasPermission('DATA.WORKFORCE', 'MANAGE'),
    supportCanReadWorkforce,
  };
}
