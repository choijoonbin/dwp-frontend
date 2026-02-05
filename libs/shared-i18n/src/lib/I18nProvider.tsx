/**
 * I18nProvider — Shell 앱 루트에서 전체 감싸기
 * Remote는 별도 init 금지, useTranslation()으로 동일 인스턴스 사용
 */

import type { ReactNode } from 'react';

import { initI18n } from './i18n';

// Shell 마운트 시 1회 초기화
initI18n();

type I18nProviderProps = {
  children: ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps) {
  return <>{children}</>;
}
