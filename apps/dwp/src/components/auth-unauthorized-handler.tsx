// ----------------------------------------------------------------------

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, redirectToSignIn, setUnauthorizedHandler } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * AuthUnauthorizedHandler: Sets up global 401/403 error handler
 * Should be mounted once at the root level (in App or main.tsx)
 */
export const AuthUnauthorizedHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  useEffect(() => {
    setUnauthorizedHandler((status: number) => {
      if (status === 401) {
        // 401: Logout and redirect to sign-in
        auth.logout();
        redirectToSignIn(navigate, location);
      } else if (status === 403) {
        // 403: No logout, just redirect to /403
        navigate('/403');
      }
    });

    // Cleanup: remove handler on unmount
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [navigate, location, auth]);

  return null;
};
