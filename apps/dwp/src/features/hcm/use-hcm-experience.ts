import { useQuery } from '@tanstack/react-query';
import { getPerson, listPeople } from '@dwp-frontend/shared-utils/api/people-admin-api';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { selectCurrentPerson } from './hcm-experience-model';

export { canAccessLegacyHcmSurface, useHcmAccess } from './hcm-surface-access';
export type { HcmLegacySurfaceAudience, HcmLegacySurfaceId } from './hcm-surface-access';

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
