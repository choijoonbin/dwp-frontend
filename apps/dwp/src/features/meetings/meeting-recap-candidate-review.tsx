import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import { ArrowRight } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MeetingIntelligenceCitationList } from './meeting-intelligence-citations';
import type { MeetingRecapActionCandidate } from './meeting-recap-candidate-model';

export function MeetingRecapCandidateReview({
  open,
  candidate,
  report,
  onClose,
}: {
  open: boolean;
  candidate?: MeetingRecapActionCandidate;
  report?: VideoMeetingIntelligenceReport | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const item = candidate ? report?.analysis?.actionItems[candidate.actionItemIndex] : null;
  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      title={t('followUps.candidates.reviewTitle')}
      description={t('followUps.candidates.reviewHint')}
      closeLabel={t('followUps.candidates.closeReview')}
      contentDividers
    >
      <Stack gap={2} data-testid="meeting-recap-candidate-review">
        {item && candidate ? (
          <>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('designReview.recap.candidateSourceVersion', {
                  version: candidate.sourceVersion,
                })}
              </Typography>
              <Typography component="h3" variant="h6" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
                {item.text}
              </Typography>
            </Box>
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
            <Typography variant="body2" color="text.secondary">
              {t('designReview.recap.candidateMetadataPending')}
            </Typography>
          </>
        ) : (
          <Typography role="status">
            {t('designReview.recap.candidateReferenceUnavailable')}
          </Typography>
        )}
        <ActionButton
          intent="primary"
          disabled={!item || !candidate}
          endIcon={<ArrowRight size={16} aria-hidden="true" />}
          onClick={() => {
            if (!item || !candidate) return;
            onClose();
            navigate(
              `/meetings/follow-ups?${new URLSearchParams({
                scope: 'CANDIDATES',
                candidateId: candidate.candidateId,
              })}`
            );
          }}
        >
          {t('followUps.candidates.continueCreation')}
        </ActionButton>
      </Stack>
    </ContentDialog>
  );
}
