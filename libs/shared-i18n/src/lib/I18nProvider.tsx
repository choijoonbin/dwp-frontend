import type { ReactNode } from 'react';

import { initI18n } from './i18n';

type I18nProviderProps = {
  children: ReactNode;
  namespaces?: readonly string[];
};

export function I18nProvider({ children, namespaces }: I18nProviderProps) {
  initI18n(namespaces);
  return <>{children}</>;
}
