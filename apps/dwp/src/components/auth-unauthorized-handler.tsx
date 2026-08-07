import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, redirectToSignIn, setUnauthorizedHandler } from '@dwp-frontend/shared-utils';

export function AuthUnauthorizedHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  useEffect(() => {
    setUnauthorizedHandler((status) => {
      if (status === 401) {
        auth.logout();
        redirectToSignIn(navigate, location);
        return;
      }
      navigate('/403', { replace: true });
    });

    return () => setUnauthorizedHandler(null);
  }, [auth, location, navigate]);

  return null;
}
