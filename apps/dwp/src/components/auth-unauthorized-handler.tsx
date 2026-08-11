import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setUnauthorizedHandler } from '@dwp-frontend/shared-utils/axios-instance';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { redirectToSignIn } from '@dwp-frontend/shared-utils/auth/auth-redirect';

export function AuthUnauthorizedHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  useEffect(() => {
    setUnauthorizedHandler((status) => {
      if (status === 401) {
        auth.invalidateSession();
        redirectToSignIn(navigate, location);
        return;
      }
      if (auth.isAuthenticated) navigate('/403', { replace: true });
    });

    return () => setUnauthorizedHandler(null);
  }, [auth, location, navigate]);

  return null;
}
