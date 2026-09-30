import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderSupportSession } from '@dwp-frontend/shared-utils';

import { formatProviderDate, ProviderStatusChip } from './provider-ui';
import {
  hasUnknownProviderSupportScope,
  providerSupportScopeLabel,
} from './provider-support-presentation';

export function ProviderTenantSupportHistory({ sessions }: { sessions: ProviderSupportSession[] }) {
  const { t } = useTranslation('provider');

  return (
    <Stack divider={<Divider flexItem />} sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}>
      {sessions.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          {t('tenantDetail.support.empty')}
        </Typography>
      ) : (
        sessions.map((session) => (
          <Stack
            key={session.supportSessionId}
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            gap={1.25}
            sx={{ py: 1.25 }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={700}>
                {session.operatorName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {session.scopes.map((scope) => providerSupportScopeLabel(t, scope)).join(', ')}
              </Typography>
              {hasUnknownProviderSupportScope(session.scopes) && (
                <Typography variant="caption" color="warning.main" display="block">
                  {t('support.scopes.unknownEvidence')}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {formatProviderDate(session.expiresAt)}
            </Typography>
            <ProviderStatusChip state={session.lifecycleState} />
          </Stack>
        ))
      )}
    </Stack>
  );
}
