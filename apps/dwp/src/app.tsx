import { useEffect } from 'react';

import { usePathname } from 'src/routes/hooks';

import { AuthUnauthorizedHandler } from './components/auth-unauthorized-handler';

// ----------------------------------------------------------------------

type AppProps = {
  children: React.ReactNode;
};

export default function App({ children }: AppProps) {
  useScrollToTop();

  return (
    <>
      <AuthUnauthorizedHandler />
      {children}
    </>
  );
}

// ----------------------------------------------------------------------

function useScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
