import { BadgeCheck, UserRoundCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { approvalCompletedDecisionRecord } from './approval-completed-decision';
import { ApprovalSurface, StatusChip } from './approval-ui';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

export function ApprovalCompletedDecisionEvidence({ detail }: { detail: ApprovalTaskDetail }) {
  const { t, i18n } = useTranslation('approvals');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const record = approvalCompletedDecisionRecord(detail);

  return (
    <ApprovalSurface
      title={t('completed.evidence.title')}
      meta={t('completed.evidence.meta')}
      action={record ? <StatusChip status={record.decision} /> : undefined}
    >
      {!record ? (
        <Box sx={{ p: 2 }}>
          <InlineFeedback severity="warning">{t('completed.evidence.unavailable')}</InlineFeedback>
        </Box>
      ) : (
        <>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
            }}
          >
            <EvidenceCell
              label={t('completed.evidence.actor')}
              value={
                record.event.actorDisplayName?.trim() ||
                record.event.actorId?.trim() ||
                t('completed.evidence.actorUnavailable')
              }
              icon={<UserRoundCheck size={16} aria-hidden="true" />}
            />
            <EvidenceCell
              label={t('completed.evidence.mode')}
              value={t(
                record.event.delegated
                  ? 'completed.evidence.delegated'
                  : 'completed.evidence.direct'
              )}
              icon={<BadgeCheck size={16} aria-hidden="true" />}
            />
            <EvidenceCell
              label={t('completed.evidence.decidedAt')}
              value={formatDate(
                record.event.occurredAt,
                { dateStyle: 'medium', timeStyle: 'short' },
                locale
              )}
            />
            <EvidenceCell
              label={t('completed.evidence.eventId')}
              value={record.event.eventId}
              mono
            />
          </Box>
          {record.event.message?.trim() ? (
            <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                {t('completed.evidence.comment')}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                {record.event.message.trim()}
              </Typography>
            </Box>
          ) : null}
        </>
      )}
    </ApprovalSurface>
  );
}

function EvidenceCell({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Stack component="dt" direction="row" alignItems="center" gap={0.6} color="text.secondary">
        {icon}
        <Typography variant="caption">{label}</Typography>
      </Stack>
      <Typography
        component="dd"
        variant="body2"
        fontWeight="fontWeightBold"
        sx={{
          m: 0,
          mt: 0.45,
          overflowWrap: 'anywhere',
          fontFamily: mono ? foundationTokens.font.mono : undefined,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
