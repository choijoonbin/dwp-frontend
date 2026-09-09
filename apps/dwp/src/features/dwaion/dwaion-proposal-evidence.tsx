import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { CalendarDays, Database, FileText, Mail, ShieldCheck } from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import type { DwaionProposal } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { proposalEvidenceRoute } from './dwaion-proposal-model';

export function DwaionProposalEvidence({
  proposal,
  locale,
  compact = false,
}: {
  proposal: DwaionProposal;
  locale: 'ko' | 'en';
  compact?: boolean;
}) {
  const { t } = useTranslation('work');
  const display = useDisplayDictionary();
  if (!proposal.content.evidence?.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('dwaionProposals.detail.noEvidence')}
      </Typography>
    );
  }
  return (
    <Stack gap={compact ? 1 : 1.5}>
      {proposal.content.evidence.map((evidence) => {
        const route = proposalEvidenceRoute(evidence.route);
        const Icon = sourceIcon(evidence.sourceType);
        return (
          <Stack
            key={`${evidence.sourceType}:${evidence.referenceId}`}
            direction="row"
            gap={1.25}
            alignItems="flex-start"
            sx={{
              p: compact ? 1.1 : 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.radius.surface + 'px',
              bgcolor: 'background.paper',
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: compact ? 30 : 36,
                height: compact ? 30 : 36,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                borderRadius: foundationTokens.radius.surface + 'px',
                bgcolor: 'var(--dwp-product-soft)',
                color: 'primary.main',
              }}
            >
              <Icon size={compact ? 16 : 18} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              {route ? (
                <Link
                  component={RouterLink}
                  to={route}
                  aria-label={t('askPage.openSource', { title: evidence.label })}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: compact ? 32 : 44,
                    fontWeight: 'fontWeightBold',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {evidence.label}
                </Link>
              ) : (
                <Typography
                  variant="body2"
                  fontWeight="fontWeightBold"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {evidence.label}
                </Typography>
              )}
              <Stack direction="row" gap={0.6} useFlexGap flexWrap="wrap" sx={{ mt: 0.35 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={display('sourceTypes', evidence.sourceType)}
                  sx={{ height: 22 }}
                />
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={evidence.referenceId}
                  sx={{
                    height: 22,
                    '& .MuiChip-label': { fontFamily: foundationTokens.font.mono },
                  }}
                />
              </Stack>
              <Typography component="p" variant="caption" color="text.secondary">
                {evidence.occurredAt
                  ? t('dwaionProposals.detail.sourceRecordedAt', {
                      at: formatDate(
                        evidence.occurredAt,
                        { dateStyle: 'medium', timeStyle: 'short' },
                        locale
                      ),
                    })
                  : t('dwaionProposals.detail.sourceTimeUnavailable')}
              </Typography>
              {!route && !compact && (
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.35 }}>
                  <ShieldCheck size={13} aria-hidden="true" />
                  <Typography component="p" variant="caption" color="text.secondary">
                    {t('dwaionProposals.detail.sourceLinkUnavailable')}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}

function sourceIcon(sourceType: string) {
  if (sourceType === 'MAIL') return Mail;
  if (sourceType === 'CALENDAR') return CalendarDays;
  if (sourceType === 'WORK_ITEM') return FileText;
  if (sourceType === 'DATABASE') return Database;
  return ShieldCheck;
}
