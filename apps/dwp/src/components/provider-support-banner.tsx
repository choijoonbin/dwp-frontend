import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, LifeBuoy, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  providerSupportContextQueryKey,
  publishProviderSupportContextRevision,
} from '@dwp-frontend/shared-utils/auth/provider-support-context';
import {
  revokeProviderSupportSession,
  type ProviderSupportSessionContext,
} from '@dwp-frontend/shared-utils/api/provider-control-api';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { shellHeaderHeight } from '../features/shell/shell-registry';
import { purgeProviderSupportTenantCache } from './provider-support-cache-policy';
import {
  providerSupportRemainingTime,
  useProviderSupportClock,
} from './provider-support-session-clock';

const contextChipSx = {
  maxWidth: '100%',
  height: 'auto',
  '& .MuiChip-label': {
    py: 0.25,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
} as const;

const desktopSessionDetailsSx = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 1,
  '@media (max-width:700px)': {
    display: 'none',
  },
} as const;

export default function ProviderSupportBanner({
  context,
}: {
  context: ProviderSupportSessionContext;
}) {
  const { t, i18n } = useTranslation('provider');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const toast = useToast();
  const bannerRef = useRef<HTMLElement | null>(null);
  const [exiting, setExiting] = useState(false);
  const now = useProviderSupportClock(context.expiresAt);
  const remaining = providerSupportRemainingTime(
    context.expiresAt,
    i18n.resolvedLanguage ?? i18n.language,
    now
  );
  const previewPath = `/provider/tenants/${encodeURIComponent(context.tenantId)}/experience-preview`;

  useLayoutEffect(() => {
    const banner = bannerRef.current;
    const main = banner?.closest<HTMLElement>('#dwp-main-content');
    if (!banner || !main) return undefined;
    const root = document.documentElement;
    const previousRootHeight = root.style.getPropertyValue('--provider-support-banner-height');
    const previousMainHeight = main.style.getPropertyValue('--provider-support-banner-height');
    const previousScrollPadding = root.style.scrollPaddingTop;
    const updateHeight = () => {
      const height = `${Math.ceil(banner.getBoundingClientRect().height)}px`;
      root.style.setProperty('--provider-support-banner-height', height);
      main.style.setProperty('--provider-support-banner-height', height);
      root.style.scrollPaddingTop = `calc(${shellHeaderHeight}px + ${height} + 8px)`;
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      if (previousRootHeight)
        root.style.setProperty('--provider-support-banner-height', previousRootHeight);
      else root.style.removeProperty('--provider-support-banner-height');
      if (previousMainHeight)
        main.style.setProperty('--provider-support-banner-height', previousMainHeight);
      else main.style.removeProperty('--provider-support-banner-height');
      root.style.scrollPaddingTop = previousScrollPadding;
    };
  }, []);

  const sessionDetails = (
    <>
      <Chip
        size="small"
        variant="outlined"
        sx={contextChipSx}
        label={t('supportBar.tenantKey', { value: context.tenantKey })}
      />
      <Chip
        size="small"
        variant="outlined"
        sx={contextChipSx}
        label={t('supportBar.environment', { value: context.environmentKey ?? '—' })}
      />
      <Chip
        size="small"
        variant="outlined"
        sx={contextChipSx}
        label={t('supportBar.region', { value: context.dataRegion ?? '—' })}
      />
      {context.scopes.map((scope) => (
        <Chip
          key={scope}
          size="small"
          variant="outlined"
          sx={contextChipSx}
          label={t(`support.scopes.${scope}`, { defaultValue: scope })}
        />
      ))}
      <Chip
        size="small"
        variant="outlined"
        sx={contextChipSx}
        label={t(`support.modes.${context.accessMode}`)}
        color={context.accessMode === 'BREAK_GLASS' ? 'error' : 'default'}
      />
      <Typography variant="caption">
        {t('supportBar.sessionReference', {
          value: context.supportSessionId.slice(0, 8),
        })}
      </Typography>
      {context.scopes.includes('TENANT_EXPERIENCE_PREVIEW') && pathname !== previewPath && (
        <ActionButton
          size="small"
          intent="secondary"
          startIcon={<Eye size={16} />}
          onClick={() => navigate(previewPath)}
        >
          {t('diagnosis.actions.preview')}
        </ActionButton>
      )}
    </>
  );

  const exit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await revokeProviderSupportSession(context, t('support.revokeReason'));
      queryClient.setQueryData(providerSupportContextQueryKey, null);
      await purgeProviderSupportTenantCache(queryClient);
      publishProviderSupportContextRevision();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: providerSupportContextQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['provider', 'support'] }),
      ]);
      toast.success(t('supportBar.exited'));
      navigate('/provider/support');
    } catch {
      toast.error(t('supportBar.exitFailed'));
      setExiting(false);
    }
  };

  return (
    <Box
      ref={bannerRef}
      component="section"
      role="region"
      aria-label={t('supportBar.label')}
      data-testid="provider-support-banner"
      sx={{
        position: 'sticky',
        top: `${shellHeaderHeight}px`,
        zIndex: (theme) => theme.zIndex.appBar - 1,
        px: { xs: 2, md: 3 },
        py: 1,
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexWrap: 'wrap',
        gap: 1,
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.warning.light, 0.16)
            : alpha(theme.palette.warning.dark, 0.1),
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'warning.dark',
        boxShadow: 1,
      }}
    >
      <LifeBuoy size={18} strokeWidth={1.9} aria-hidden="true" />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2">
          {t('supportBar.title', { tenant: context.tenantName })}
        </Typography>
        <Typography
          variant="caption"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={{ display: 'block' }}
        >
          <Box component="span" sx={{ '@media (max-width:700px)': { display: 'none' } }}>
            {t('supportBar.expires', {
              value: formatDate(context.expiresAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
            {' · '}
          </Box>
          {t('supportBar.remaining', { value: remaining })}
        </Typography>
      </Box>
      <Box sx={desktopSessionDetailsSx}>{sessionDetails}</Box>
      <ActionButton
        size="small"
        intent="danger"
        startIcon={<X size={16} />}
        disabled={exiting}
        aria-label={t('support.actions.revoke')}
        onClick={() => void exit()}
      >
        {t('support.actions.revoke')}
      </ActionButton>
      <Box
        component="details"
        sx={{
          display: 'none',
          flexBasis: '100%',
          minWidth: 0,
          '@media (max-width:700px)': { display: 'block' },
          '& > summary': { cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem' },
        }}
      >
        <Box component="summary">{t('supportBar.approvedDetails')}</Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, pt: 1 }}>
          {sessionDetails}
        </Box>
      </Box>
    </Box>
  );
}
