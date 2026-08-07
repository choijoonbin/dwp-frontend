import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastViewport } from '@dwp-frontend/design-system';

import { AuthUnauthorizedHandler } from './components/auth-unauthorized-handler';

type AppProps = {
  children: React.ReactNode;
};

export default function App({ children }: AppProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <AuthUnauthorizedHandler />
      {children}
      <ToastViewport />
    </>
  );
}
