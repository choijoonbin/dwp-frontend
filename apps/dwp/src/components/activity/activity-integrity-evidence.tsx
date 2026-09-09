import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { foundationTokens, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { HttpError } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkspaceActivityEvidence } from '@dwp-frontend/shared-utils';

const accessibleFeedbackSx = {
  color: 'text.primary',
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  '& .MuiAlert-icon': { color: 'text.primary' },
} as const;

export function ActivityIntegrityEvidence({
  query,
  density = 'default',
}: {
  query: UseQueryResult<WorkspaceActivityEvidence, Error>;
  density?: 'default' | 'compact';
}) {
  const { t } = useTranslation('work');
  if (query.isLoading) {
    return <LoadingState label={t('activityFoundation.detail.integrity.loading')} size="compact" />;
  }
  if (query.isError || !query.data) {
    const notFound = query.error instanceof HttpError && query.error.status === 404;
    const restricted = query.error instanceof HttpError && query.error.status === 403;
    const state = restricted ? 'RESTRICTED' : notFound ? 'NOT_COLLECTED' : 'UNAVAILABLE';
    return (
      <InlineFeedback
        severity="warning"
        title={t(`activityFoundation.detail.integrity.errors.${state}.title`)}
        sx={accessibleFeedbackSx}
      >
        {t(`activityFoundation.detail.integrity.errors.${state}.description`)}
      </InlineFeedback>
    );
  }
  const evidence = query.data;
  // Keep rendering fail-closed even if a caller bypasses the API validator with contradictory data.
  const restricted = evidence.auditAccess === 'RESTRICTED';
  const integrityStatus = restricted ? 'UNAVAILABLE' : evidence.integrityStatus;
  const severity =
    integrityStatus === 'VERIFIED' ? 'success' : integrityStatus === 'FAILED' ? 'error' : 'warning';
  return (
    <Stack gap={density === 'compact' ? 0.65 : 1.25} data-integrity-status={integrityStatus}>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        <Chip
          size="small"
          variant="outlined"
          color={evidence.linkStatus === 'LINKED' ? 'info' : 'default'}
          label={t(`activityFoundation.detail.integrity.link.${evidence.linkStatus}`)}
          sx={{ color: 'text.primary' }}
        />
        <Chip
          size="small"
          variant="outlined"
          color={severity}
          label={t(`activityFoundation.detail.integrity.status.${integrityStatus}`)}
          sx={{ color: 'text.primary' }}
        />
        {restricted && (
          <Chip
            size="small"
            variant="outlined"
            label={t('activityFoundation.detail.integrity.restricted')}
            sx={{ color: 'text.primary' }}
          />
        )}
      </Stack>
      <InlineFeedback
        severity={severity}
        title={t(`activityFoundation.detail.integrity.result.${integrityStatus}.title`)}
        sx={{
          ...accessibleFeedbackSx,
          ...(density === 'compact'
            ? {
                px: 0.75,
                py: 0.25,
                '& .MuiAlert-icon': { color: 'text.primary', mr: 0.75, py: 0.25 },
                '& .MuiAlert-message': { py: 0.25 },
              }
            : {}),
        }}
      >
        {density === 'compact'
          ? null
          : t(`activityFoundation.detail.integrity.result.${integrityStatus}.description`)}
      </InlineFeedback>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns:
            density === 'compact' ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
          gap: density === 'compact' ? 0.5 : 0.75,
        }}
      >
        <EvidenceField
          label={t('activityFoundation.detail.integrity.observedAt')}
          value={formatDate(evidence.observedAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
        {!restricted && evidence.verifiedAt && (
          <EvidenceField
            label={t('activityFoundation.detail.integrity.verifiedAt')}
            value={formatDate(evidence.verifiedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          />
        )}
        {!restricted && evidence.recordHash && evidence.hashAlgorithm && (
          <EvidenceField
            label={t('activityFoundation.detail.integrity.recordHash', {
              algorithm: evidence.hashAlgorithm,
            })}
            value={evidence.recordHash}
            mono
            compact={density === 'compact'}
          />
        )}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ display: density === 'compact' ? 'none' : 'block' }}
      >
        {t('activityFoundation.detail.integrity.scopeNotice')}
      </Typography>
    </Stack>
  );
}

function EvidenceField({
  label,
  value,
  mono = false,
  compact = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  compact?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="caption"
        sx={{
          m: 0,
          mt: 0.2,
          overflowWrap: 'anywhere',
          fontFamily: mono ? foundationTokens.font.mono : undefined,
          ...(compact
            ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
            : {}),
        }}
        title={compact ? value : undefined}
      >
        {value}
      </Typography>
    </Box>
  );
}
