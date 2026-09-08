import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, FileCheck2, RefreshCw } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import type { WorkAssignmentSourceIdentity } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingInsetSurface } from './meeting-visual-system';
import { loadMeetingRecapReport } from './meeting-recap-source';
import { selectMeetingFollowUpEvidence } from './meeting-follow-up-evidence';
import { MeetingIntelligenceCitationList } from './meeting-intelligence-citations';

/** Sensitive source text is fetched explicitly and scoped to an exact authorized report version. */
export function MeetingFollowUpEvidencePanel({
  source,
  version,
  scope,
}: {
  source: WorkAssignmentSourceIdentity;
  version: number;
  scope: string;
}) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [now, setNow] = useState(Date.now);
  const query = useQuery({
    queryKey: [
      'meetings',
      'follow-ups',
      scope,
      'source-evidence',
      source.meetingId,
      source.reportId,
      source.candidateId,
      version,
    ],
    queryFn: () => loadMeetingRecapReport(source.meetingId, source.reportId),
    enabled: opened,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const item =
    opened && !query.isError && !query.isFetching
      ? selectMeetingFollowUpEvidence(query.data, source, version, now)
      : null;
  const sourcePath = `/meetings/history?meeting=${encodeURIComponent(source.meetingId)}&reportId=${encodeURIComponent(source.reportId)}`;
  return (
    <Box
      data-testid="meeting-follow-up-source-evidence"
      sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: 1.75 })}
    >
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1 }}>
        <FileCheck2 size={17} aria-hidden="true" />
        <Typography variant="subtitle2">{t('designReview.followUps.sourceEvidence')}</Typography>
      </Stack>
      {item ? (
        <>
          <Typography
            variant="body2"
            sx={{ lineHeight: 'body2.lineHeight', whiteSpace: 'pre-wrap' }}
          >
            {item.text}
          </Typography>
          <MeetingIntelligenceCitationList
            citations={item.citations}
            labels={{
              citationLabel: (value) => t('history.recap.intelligence.citationLabel', { value }),
              citationDetail: (segmentId, value) =>
                t('history.recap.intelligence.citationDetail', { segmentId, value }),
              citationSeek: (segmentId, value) =>
                t('history.recap.intelligence.citationSeek', { segmentId, value }),
            }}
          />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t(
            opened && !query.isFetching
              ? 'designReview.followUps.sourceUnavailable'
              : 'designReview.followUps.sourceEvidenceHint'
          )}
        </Typography>
      )}
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
        <ActionButton
          intent="secondary"
          size="small"
          loading={query.isFetching}
          startIcon={<RefreshCw size={14} aria-hidden="true" />}
          onClick={() => {
            if (opened) void query.refetch();
            else setOpened(true);
          }}
        >
          {t('designReview.followUps.loadEvidence')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowUpRight size={14} aria-hidden="true" />}
          onClick={() => navigate(sourcePath)}
        >
          {t('followUps.openSource')}
        </ActionButton>
      </Stack>
    </Box>
  );
}
