import { useTranslation } from 'react-i18next';
import { BookOpen, Braces, Link2, ShieldCheck } from 'lucide-react';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { NotificationTypeContract } from '@dwp-frontend/shared-utils/api/notification-api';

function contractHealthColor(value: string): 'success' | 'warning' | 'error' | 'default' {
  if (['HEALTHY', 'ACTIVE', 'CLOSED'].includes(value)) return 'success';
  if (['ATTENTION', 'DEGRADED', 'HALF_OPEN', 'IN_REVIEW'].includes(value)) return 'warning';
  if (['CRITICAL', 'BROKEN', 'OUTAGE', 'OPEN', 'QUARANTINED'].includes(value)) return 'error';
  return 'default';
}

export function NotificationAdminContractDetail({
  contract,
}: {
  contract: NotificationTypeContract;
}) {
  const { t } = useTranslation('notifications');
  const schemaRange = `v${contract.minSchemaVersion ?? contract.schemaVersion}-v${
    contract.maxSchemaVersion ?? contract.schemaVersion
  }`;
  const fields = [
    [t('admin.contracts.fields.owner'), contract.ownerLabel],
    [t('admin.contracts.fields.sourceEvent'), contract.sourceEventType],
    [t('admin.contracts.fields.priority'), t(`priority.${contract.priority}`)],
    [t('admin.contracts.fields.schemaVersion'), schemaRange],
    [t('admin.contracts.fields.classification'), contract.dataClassification],
    [
      t('admin.contracts.fields.audience'),
      t(`admin.contracts.audience.${contract.audienceMode}`, {
        defaultValue: contract.audienceMode,
      }),
    ],
    [
      t('admin.contracts.fields.interruption'),
      t(`admin.contracts.interruption.${contract.interruptionLevel}`, {
        defaultValue: contract.interruptionLevel,
      }),
    ],
    [
      t('admin.contracts.fields.mandatory'),
      t(`admin.contracts.${contract.mandatory ? 'yes' : 'no'}`),
    ],
    [
      t('admin.contracts.fields.userControl'),
      t(`admin.contracts.${contract.userConfigurable ? 'configurable' : 'managed'}`),
    ],
    [
      t('admin.contracts.fields.previewPolicy'),
      t(`admin.contracts.previewPolicy.${contract.previewPolicy}`, {
        defaultValue: contract.previewPolicy,
      }),
    ],
    [
      t('admin.contracts.fields.dedupe'),
      t(`admin.contracts.dedupe.${contract.dedupeStrategy}`, {
        defaultValue: contract.dedupeStrategy,
      }),
    ],
    [t('admin.contracts.fields.endEvent'), contract.endEventType || t('admin.contracts.none')],
    [
      t('admin.contracts.fields.retention'),
      t(`admin.contracts.retention.${contract.retentionPolicy}`, {
        defaultValue: contract.retentionPolicy,
      }),
    ],
    [t('admin.contracts.fields.entityVersion'), `v${contract.version}`],
    [t('admin.contracts.fields.volume'), formatNumber(contract.volume24Hours)],
    [
      t('admin.contracts.fields.updated'),
      formatDate(contract.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
    ],
  ];
  return (
    <Box
      component="aside"
      aria-label={t('admin.contracts.detailLabel')}
      data-testid="notification-contract-detail"
      sx={{ p: { xs: 1.5, md: 2 } }}
    >
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Chip size="small" variant="outlined" label={contract.appName} />
        <Chip
          size="small"
          variant="outlined"
          color={contractHealthColor(contract.state)}
          label={t(`admin.contractState.${contract.state}`)}
        />
        <Chip
          size="small"
          variant="outlined"
          color={contractHealthColor(contract.contractHealth)}
          label={t(`admin.contractHealth.${contract.contractHealth}`)}
        />
      </Stack>
      <Typography component="h3" variant="h6" sx={{ mt: 1.25, overflowWrap: 'anywhere' }}>
        {contract.displayName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {contract.description}
      </Typography>
      <Typography
        component="code"
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.75, overflowWrap: 'anywhere' }}
      >
        {contract.typeKey}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          columnGap: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {fields.map(([label, value]) => (
          <Box key={label} sx={{ minWidth: 0, py: 0.85, borderBottom: 1, borderColor: 'divider' }}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              sx={{ m: 0, mt: 0.25, fontWeight: 'subtitle2.fontWeight', overflowWrap: 'anywhere' }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box component="section" sx={{ mt: 2.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <Box>
            <Stack direction="row" gap={0.75} alignItems="center">
              <ShieldCheck size={17} aria-hidden />
              <Typography component="h4" variant="subtitle2">
                {t('admin.contracts.channels')}
              </Typography>
            </Stack>
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
              {contract.channels.map((channel) => (
                <Chip
                  key={channel}
                  size="small"
                  variant="outlined"
                  label={t(`channels.${channel}`)}
                />
              ))}
            </Stack>
          </Box>
          <Box>
            <Stack direction="row" gap={0.75} alignItems="center">
              <Braces size={17} aria-hidden />
              <Typography component="h4" variant="subtitle2">
                {t('admin.contracts.variables')}
              </Typography>
            </Stack>
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
              {(contract.requiredVariables ?? []).length > 0 ? (
                (contract.requiredVariables ?? []).map((variable) => (
                  <Chip key={variable} size="small" variant="outlined" label={`{{${variable}}}`} />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('admin.contracts.noVariables')}
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box component="section" sx={{ mt: 2.5, borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
        <Stack direction="row" gap={0.75} alignItems="center">
          <Link2 size={17} aria-hidden />
          <Typography component="h4" variant="subtitle2">
            {t('admin.contracts.deepLink')}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
          {contract.deepLinkTemplate || t('admin.contracts.none')}
        </Typography>
        {contract.runbookUrl && (
          <ButtonBase
            component="a"
            href={contract.runbookUrl}
            sx={{ mt: 1.5, minHeight: 36, px: 1.25, gap: 0.75, color: 'primary.main' }}
          >
            <BookOpen size={17} aria-hidden />
            <Typography variant="button">{t('admin.contracts.openRunbook')}</Typography>
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
}
