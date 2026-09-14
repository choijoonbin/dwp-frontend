import { useAuth } from '@dwp-frontend/shared-utils';
import { useRoomsCapabilities, useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import { useWorkplaceMemberScopeRevision } from './workplace-member-scope-revision';

/** Scope revisions also distinguish a permission or delegation context revisited later. */
export function useWorkplaceGovernanceTargetScope() {
  const { user } = useAuth();
  const rooms = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceCapabilities();
  const authorityKey = useWorkplaceMemberScopeRevision(
    JSON.stringify([
      user,
      rooms,
      governance.effectiveScopes,
      governance.globalAdministrator,
      governance.isLoaded,
      governance.isError,
    ])
  );
  return {
    ...governance,
    authorityKey,
    ready:
      rooms.isLoaded && rooms.canViewWorkplaceAdmin && governance.isLoaded && !governance.isError,
  };
}
