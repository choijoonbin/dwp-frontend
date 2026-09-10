import { useEffect } from 'react';
import { setUnauthorizedHandler } from '@dwp-frontend/shared-utils/axios-instance';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';

export function AuthUnauthorizedHandler() {
  const { invalidateSession, isAuthenticated, user } = useAuth();
  const sessionIdentity = user ? `${user.identityPlane}:${user.tenantId}:${user.userId}` : null;

  useEffect(() => {
    if (!isAuthenticated || !sessionIdentity) return setUnauthorizedHandler(null);

    return setUnauthorizedHandler(() => invalidateSession());
  }, [invalidateSession, isAuthenticated, sessionIdentity]);

  return null;
}
