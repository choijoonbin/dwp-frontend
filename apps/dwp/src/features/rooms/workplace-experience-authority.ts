import { useAuth, usePermissionsStore } from '@dwp-frontend/shared-utils';

export function useWorkplaceExperienceAuthority() {
  const { user } = useAuth();
  const permissions = usePermissionsStore((state) => state.permissions);
  return JSON.stringify([user, permissions]);
}
