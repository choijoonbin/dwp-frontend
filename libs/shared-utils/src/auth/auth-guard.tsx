import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from './auth-provider';
import { redirectToSignIn } from './auth-redirect';

export function AuthGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) redirectToSignIn(navigate, location);
  }, [isAuthenticated, isLoading, location, navigate]);

  if (isLoading) return <>{fallback}</>;
  return isAuthenticated ? <>{children}</> : null;
}
