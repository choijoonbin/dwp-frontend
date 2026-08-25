import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  revokeProviderSupportSession,
  type ProviderSupportSessionContext,
} from '@dwp-frontend/shared-utils/api/provider-control-api';
import { providerSupportContextQueryKey } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

export default function ProviderSupportBanner({
  context,
}: {
  context: ProviderSupportSessionContext;
}) {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [exiting, setExiting] = useState(false);

  const exit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await revokeProviderSupportSession(context, t('supportMode.exitReason'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: providerSupportContextQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['provider', 'support'] }),
      ]);
      toast.success(t('supportMode.exited'));
      navigate('/provider/support');
    } catch {
      toast.error(t('supportMode.exitFailed'));
      setExiting(false);
    }
  };

  return (
    <Box
      role="status"
      data-testid="provider-support-banner"
      sx={{
        px: { xs: 2, md: 3 },
        py: 1,
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexWrap: 'wrap',
        gap: 1,
        bgcolor: 'warning.light',
        color: 'warning.contrastText',
        borderBottom: 1,
        borderColor: 'warning.main',
      }}
    >
      <LifeBuoy size={18} strokeWidth={1.9} aria-hidden="true" />
      <Box sx={{ minWidth: 180, flex: 1 }}>
        <Typography variant="subtitle2">
          {t('supportMode.title', { tenant: context.tenantName })}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.86 }}>
          {t('supportMode.expires', {
            value: formatDate(context.expiresAt, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          })}
        </Typography>
      </Box>
      <Chip
        size="small"
        variant="outlined"
        label={t(`supportMode.accessMode.${context.accessMode}`)}
        color={context.accessMode === 'BREAK_GLASS' ? 'error' : 'default'}
      />
      <ActionButton
        size="small"
        intent="quiet"
        startIcon={<X size={16} />}
        disabled={exiting}
        onClick={() => void exit()}
      >
        {t('supportMode.exit')}
      </ActionButton>
    </Box>
  );
}
