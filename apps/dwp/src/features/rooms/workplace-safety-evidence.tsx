import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  workplaceSafetyConnectorTone,
  workplaceSafetySourceTone,
} from './workplace-safety-ui-model';

import type {
  WorkplaceSafetyAudienceSnapshot,
  WorkplaceSafetyCommandReceipt,
  WorkplaceSafetyConnectorTruth,
} from '@dwp-frontend/shared-utils';

export function WorkplaceSafetyAudienceEvidence({
  audience,
}: {
  audience: WorkplaceSafetyAudienceSnapshot;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Box>
          <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
            {t('workplace.safety.audience.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workplace.safety.audience.deduplication', {
              candidates: audience.totalCandidates,
              deduplicated: audience.deduplicatedCount,
              excluded: audience.excludedCount,
              unknown: audience.unknownCount,
            })}
          </Typography>
        </Box>
        <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
          <Typography variant="h5" fontWeight="fontWeightBold">
            {audience.finalTargetCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('workplace.safety.audience.finalTargets')} ·{' '}
            {formatDate(audience.asOf, { dateStyle: 'short', timeStyle: 'short' }, locale)}
          </Typography>
        </Stack>
      </Stack>
      <TableContainer
        tabIndex={0}
        aria-label={t('workplace.safety.audience.tableLabel')}
        sx={(theme) => ({ ...workplaceMemberCard(theme), overflowX: 'auto' })}
      >
        <Table size="small" aria-label={t('workplace.safety.audience.tableLabel')}>
          <TableHead>
            <TableRow>
              <TableCell>{t('workplace.safety.audience.source')}</TableCell>
              <TableCell>{t('workplace.safety.audience.coverage')}</TableCell>
              <TableCell>{t('workplace.safety.audience.counts')}</TableCell>
              <TableCell>{t('workplace.safety.audience.asOf')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {audience.sources.map((source) => (
              <TableRow key={source.source}>
                <TableCell>
                  <Stack gap={0.5} alignItems="flex-start">
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {t(`workplace.safety.sources.${source.source}`)}
                    </Typography>
                    <Chip
                      size="small"
                      color={workplaceSafetySourceTone(source)}
                      label={`${t(`workplace.safety.availability.${source.availability}`)} · ${t(
                        `workplace.safety.freshness.${source.freshness}`
                      )}`}
                    />
                  </Stack>
                </TableCell>
                <TableCell>
                  {source.coveragePercent === null
                    ? t('workplace.safety.unknown')
                    : `${source.coveragePercent.toFixed(1)}%`}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {t('workplace.safety.audience.sourceCounts', {
                      included: source.includedCount,
                      excluded: source.excludedCount,
                      unknown: source.unknownCount,
                    })}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                    {source.sourceAt
                      ? formatDate(
                          source.sourceAt,
                          { dateStyle: 'short', timeStyle: 'short' },
                          locale
                        )
                      : t('workplace.safety.unknown')}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

export function WorkplaceSafetyConnectorEvidence({
  connectors,
}: {
  connectors: readonly WorkplaceSafetyConnectorTruth[];
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <Stack spacing={1}>
      <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
        {t('workplace.safety.connectors.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('workplace.safety.connectors.description')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {connectors.map((connector) => (
          <Box
            key={connector.kind}
            sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25, minWidth: 0 })}
          >
            <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight="fontWeightBold">
                  {t(`workplace.safety.connectorKinds.${connector.kind}`)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {connector.providerCode ?? t('workplace.safety.unknown')}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={workplaceSafetyConnectorTone(connector.state)}
                label={t(`workplace.safety.connectorStates.${connector.state}`)}
              />
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75 }}
            >
              {t('workplace.safety.connectors.evaluatedAt', {
                value: formatDate(
                  connector.evaluatedAt,
                  { dateStyle: 'short', timeStyle: 'short' },
                  locale
                ),
              })}
            </Typography>
            {connector.errorCode && (
              <Typography variant="caption" color="error.main" sx={{ overflowWrap: 'anywhere' }}>
                {connector.errorCode}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

export function WorkplaceSafetyReceiptEvidence({
  receipt,
}: {
  receipt: WorkplaceSafetyCommandReceipt;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}>
      <Typography variant="body2" fontWeight="fontWeightBold">
        {t(`workplace.safety.commandStates.${receipt.state}`)}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', overflowWrap: 'anywhere' }}
      >
        {t('workplace.safety.receipt', {
          command: receipt.commandId,
          correlation: receipt.correlationId,
          state: t(`workplace.safety.commandStates.${receipt.state}`),
        })}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {formatDate(receipt.acceptedAt, { dateStyle: 'short', timeStyle: 'short' }, locale)}
      </Typography>
    </Box>
  );
}
