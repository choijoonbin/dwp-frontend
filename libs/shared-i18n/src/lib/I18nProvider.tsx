import type { ReactNode } from 'react';

import { initI18n } from './i18n';

initI18n();

type I18nProviderProps = {
  children: ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps) {
  return <>{children}</>;
}
