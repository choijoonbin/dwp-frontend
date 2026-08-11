import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage, type SupportedLocale } from '@dwp-frontend/shared-i18n';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';

export function usePreferredLanguage() {
  const languageState = useLanguage();
  const auth = useAuth();
  const toast = useToast();
  const { t } = useTranslation('common');
  const [isSaving, setIsSaving] = useState(false);

  const setLanguage = useCallback(
    async (locale: SupportedLocale) => {
      if (isSaving || languageState.language === locale) return;
      if (!auth.user) {
        await languageState.setLanguage(locale);
        return;
      }
      setIsSaving(true);
      try {
        if (auth.user.preferredLocale !== locale) await auth.setPreferredLocale(locale);
        await languageState.setLanguage(locale);
      } catch {
        toast.error(t('language.preferenceSaveError'));
      } finally {
        setIsSaving(false);
      }
    },
    [auth, isSaving, languageState, t, toast]
  );

  return { ...languageState, setLanguage, isSaving };
}
