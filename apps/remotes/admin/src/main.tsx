import '@dwp-frontend/design-system/styles/global.css';

import { useEffect, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@dwp-frontend/design-system';
import { setLanguageHeaderProvider } from '@dwp-frontend/shared-utils';
import { I18nProvider, getCurrentLanguage } from '@dwp-frontend/shared-i18n';

import { AdminApp } from './admin-app';

// ----------------------------------------------------------------------

/** Standalone: API 요청 시 Accept-Language 헤더 주입 */
const InitI18nAxios = () => {
  useEffect(() => {
    setLanguageHeaderProvider(() => getCurrentLanguage());
    return () => setLanguageHeaderProvider(null);
  }, []);
  return null;
};

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <InitI18nAxios />
        <AdminApp standalone />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);
