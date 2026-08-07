import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getAccessToken } from './token-storage';
import { redirectToSignIn } from './auth-redirect';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getAccessToken();

  useEffect(() => {
    if (!token) redirectToSignIn(navigate, location);
  }, [location, navigate, token]);

  return token ? <>{children}</> : null;
}
