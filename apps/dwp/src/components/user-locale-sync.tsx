import { useEffect, useRef } from 'react';
import { useLanguage, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';

export function UserLocaleSync() {
  const auth = useAuth();
  const { language, setLanguage } = useLanguage();
  const synchronizedUserId = useRef<number | null>(null);

  useEffect(() => {
    const user = auth.user;
    if (!user || synchronizedUserId.current === user.userId) return;
    synchronizedUserId.current = user.userId;
    const preferred = resolveSupportedLocale(user.preferredLocale, user.tenantDefaultLocale);
    if (preferred !== language) void setLanguage(preferred);
  }, [auth.user, language, setLanguage]);

  return null;
}
