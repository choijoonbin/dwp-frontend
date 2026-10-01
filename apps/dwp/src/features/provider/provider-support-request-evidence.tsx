import { useTranslation } from 'react-i18next';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { ProviderSupportAccessRequest } from '@dwp-frontend/shared-utils';

import { formatProviderDate } from './provider-ui';
import {
  hasUnknownProviderSupportScope,
  providerSupportModeLabel,
  providerSupportScopeLabel,
} from './provider-support-presentation';

export function ProviderSupportRequestEvidence({
  request,
  showHeading = true,
}: {
  request: ProviderSupportAccessRequest;
  showHeading?: boolean;
}) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const rows = [
    {
      label: t('support.columns.tenant'),
      value: `${request.tenantName} · ${request.tenantKey}`,
    },
    {
      label: t('support.columns.requester'),
      value: request.requesterName,
    },
    {
      label: t('support.columns.scopes'),
      value: request.scopes.map((scope) => providerSupportScopeLabel(t, scope)).join(', '),
    },
    {
      label: t('support.columns.duration'),
      value: t('support.minutes', { count: request.durationMinutes }),
    },
    {
      label: t('support.columns.mode'),
      value: providerSupportModeLabel(t, request.accessMode),
    },
    {
      label: t('support.columns.risk'),
      value: display('riskTiers', request.riskTier),
    },
    {
      label: t('support.columns.approvalReference'),
      value: request.approvalReference?.trim() || t('support.notProvided'),
    },
    {
      label: t('support.columns.purpose'),
      value: request.justification,
    },
    {
      label: t('support.columns.decisionDue'),
      value: formatProviderDate(request.decisionDueAt),
    },
  ];

  return (
    <Box component="section" aria-label={t('support.reviewEvidence')}>
      {showHeading && (
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('support.reviewEvidence')}
        </Typography>
      )}
      <Box
        component="dl"
        sx={{
          m: 0,
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {rows.map((row) => (
          <Box
            key={row.label}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(7rem, 0.4fr) minmax(0, 1fr)', sm: '9rem 1fr' },
              gap: 1,
              py: 0.75,
              '& + &': { borderTop: 1, borderColor: 'divider' },
            }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {row.label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {row.value}
            </Typography>
          </Box>
        ))}
      </Box>
      {hasUnknownProviderSupportScope(request.scopes) && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {t('support.scopes.unknownEvidence')}
        </Alert>
      )}
    </Box>
  );
}
