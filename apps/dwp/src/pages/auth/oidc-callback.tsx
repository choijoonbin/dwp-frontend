import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getOidcCallback,
  safeReturnUrl,
  signalProductSurfaceStepUpCompletion,
  useAuth,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import type { OidcCallbackResult } from '@dwp-frontend/shared-utils';

export const STEP_UP_POPUP_CLOSE_GRACE_MS = 250;

export function closeStepUpPopupWithFallback({
  closePopup,
  isPopupClosed,
  schedule,
  navigateFallback,
}: {
  closePopup: () => void;
  isPopupClosed: () => boolean;
  schedule: (callback: () => void, delayMs: number) => void;
  navigateFallback: () => void;
}): void {
  closePopup();
  schedule(() => {
    if (!isPopupClosed()) navigateFallback();
  }, STEP_UP_POPUP_CLOSE_GRACE_MS);
}

export function resolveOidcCallbackDestination(
  result: OidcCallbackResult,
  requestedLoginReturnUrl: string | null
): string {
  return result.purpose === 'STEP_UP'
    ? result.returnTo
    : safeReturnUrl(requestedLoginReturnUrl) || '/';
}

export default function OidcCallbackPage() {
  const { t } = useTranslation('auth');
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorKey, setErrorKey] = useState<'invalid' | 'sessionUnverified' | 'failed' | null>(null);
  const callbackStarted = useRef(false);

  useEffect(() => {
    if (callbackStarted.current) return;
    callbackStarted.current = true;

    const run = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      if (!code || !state) {
        setErrorKey('invalid');
        return;
      }

      try {
        const result = await getOidcCallback({
          code,
          state,
          providerKey: searchParams.get('providerKey') || undefined,
          tenantId: searchParams.get('tenantId') || undefined,
        });
        const authenticated = await refreshSession();
        if (!authenticated) {
          setErrorKey('sessionUnverified');
          return;
        }
        const destination = resolveOidcCallbackDestination(result, searchParams.get('returnUrl'));
        if (result.purpose === 'STEP_UP') {
          signalProductSurfaceStepUpCompletion(
            result.flowId,
            window.location.origin,
            window.opener
          );
          closeStepUpPopupWithFallback({
            closePopup: () => window.close(),
            isPopupClosed: () => window.closed,
            schedule: (callback, delayMs) => {
              window.setTimeout(callback, delayMs);
            },
            navigateFallback: () => navigate(destination, { replace: true }),
          });
          return;
        }
        navigate(destination, { replace: true });
      } catch {
        setErrorKey('failed');
      }
    };

    void run();
  }, [navigate, refreshSession, searchParams]);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      {errorKey ? (
        <Alert severity="error">{t(`callback.${errorKey}`)}</Alert>
      ) : (
        <Box role="status" aria-label={t('callback.processing')}>
          <CircularProgress aria-hidden="true" />
        </Box>
      )}
    </Box>
  );
}
