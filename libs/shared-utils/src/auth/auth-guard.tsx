// ----------------------------------------------------------------------

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { getAccessToken } from './token-storage';
import { redirectToSignIn } from './auth-redirect';

// ----------------------------------------------------------------------

type AuthGuardProps = {
  children: React.ReactNode;
};

/**
 * AuthGuard: Protects routes that require authentication
 * - If no token exists, redirects to /sign-in with returnUrl
 * - If token exists, renders children
 */
export const AuthGuard = ({ children }: AuthGuardProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      redirectToSignIn(navigate, location);
    }
  }, [navigate, location]);

  const token = getAccessToken();
  if (!token) {
    // Return null while redirecting (prevents flash of content)
    return null;
  }

  return <>{children}</>;
};
