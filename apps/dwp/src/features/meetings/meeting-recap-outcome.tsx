import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ListChecks, Sparkles } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import type {
  VideoMeetingIntelligenceCitedText,
  VideoMeetingIntelligenceReport,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { MeetingIntelligenceCitationList } from './meeting-intelligence-citations';
import { MeetingRecapAnalysis, OutcomeEmpty } from './meeting-recap-analysis';
import type { PublishedMeetingRecap } from './meeting-recap-intelligence-model';
import { meetingShape, meetingSurface } from './meeting-visual-system';
import {
  projectMeetingRecapActionCandidates,
  meetingRecapCandidateHref,
} from './meeting-recap-candidate-model';
import { MeetingRecapCandidateReview } from './meeting-recap-candidate-review';

export function MeetingRecapOutcome({
  recap,
  report,
  agenda,
  evidence,
  meetingId,
  focusFollowUps = false,
}: {
  recap: PublishedMeetingRecap;
  report?: VideoMeetingIntelligenceReport | null;
  agenda: string | null | undefined;
  evidence: ReactNode;
  meetingId: string;
  focusFollowUps?: boolean;
}) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const compact = useMediaQuery('(max-width: 599px)');
  const followUpsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focusFollowUps) return;
    followUpsRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    followUpsRef.current?.focus({ preventScroll: true });
  }, [focusFollowUps]);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!report || report.legalHold) return;
    const remaining = Date.parse(report.retentionUntil) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [report, now]);
  const analysis = recap.state === 'READY' ? report?.analysis : null;
  const candidates =
    recap.state === 'READY' && recap.reportId === report?.reportId
      ? projectMeetingRecapActionCandidates(meetingId, report, Math.max(now, Date.now()))
      : [];
  const candidateId = params.get('candidateId');
  const selectedCandidate =
    params.get('meeting') === meetingId && params.get('reportId') === report?.reportId
      ? candidates.find((candidate) => candidate.candidateId === candidateId)
      : undefined;
  return (
    <Box
      data-testid="meeting-recap-overview"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,7fr) minmax(320px,5fr)' },
        gridTemplateAreas: {
          xs: '"summary" "actions" "evidence" "analysis"',
          lg: '"summary evidence" "analysis evidence" "actions evidence"',
        },
        gap: { xs: 2, lg: 2.5 },
        alignItems: 'start',
      }}
    >
      <Stack gap={2} sx={{ gridArea: 'summary', minWidth: 0 }}>
        <Box
          component="section"
          sx={(theme) => ({ ...meetingSurface(theme), p: { xs: 2, sm: 2.5 } })}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ mb: 1.5 }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} color="primary.main">
              <Sparkles size={18} aria-hidden="true" />
              <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
                {t('history.recap.intelligence.sections.executiveSummary')}
              </Typography>
            </Stack>
            <Chip
              size="small"
              color={analysis ? 'success' : 'default'}
              label={t(
                analysis
                  ? 'history.recap.intelligence.states.PUBLISHED'
                  : 'history.recap.intelligence.states.UNAVAILABLE'
              )}
            />
          </Stack>
          {analysis ? (
            <CitedOutcome item={analysis.executiveSummary} />
          ) : (
            <InlineFeedback severity="info" title={t('history.recap.ai.unavailableTitle')}>
              <Typography variant="body2">
                {t('history.recap.ai.unavailableDescription')}
              </Typography>
            </InlineFeedback>
          )}
        </Box>
        <Box
          component="section"
          sx={(theme) => ({ ...meetingSurface(theme), p: { xs: 2, sm: 2.5 } })}
        >
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: meetingShape.inset,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <ListChecks size={17} aria-hidden="true" />
            </Box>
            <Typography component="h3" variant="h6" fontWeight="fontWeightBold">
              {t('history.recap.decisionsTitle')} {analysis ? `(${analysis.decisions.length})` : ''}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {t('designReview.recap.citationHint')}
          </Typography>
          <Stack
            component={analysis?.decisions.length ? 'ol' : 'div'}
            gap={1.5}
            sx={{ m: 0, p: 0, listStyle: 'none' }}
          >
            {analysis?.decisions.length ? (
              analysis.decisions.map((item, index) => (
                <Box component="li" key={`${index}-${item.text}`}>
                  <CitedOutcome item={item} index={index + 1} />
                </Box>
              ))
            ) : (
              <OutcomeEmpty text={t('history.recap.decisionsEmpty')} />
            )}
          </Stack>
        </Box>
      </Stack>
      <Box
        component="section"
        id="meeting-recap-follow-ups"
        aria-labelledby="meeting-recap-follow-ups-title"
        ref={followUpsRef}
        tabIndex={-1}
        sx={(theme) => ({
          ...meetingSurface(theme),
          gridArea: 'actions',
          minWidth: 0,
          p: { xs: 2, sm: 2.5 },
          scrollMarginBlockStart: 80,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        })}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 1.5 }}
        >
          <Typography
            id="meeting-recap-follow-ups-title"
            component="h3"
            variant="h6"
            fontWeight="fontWeightBold"
          >
            {t('history.recap.actionsTitle')}
          </Typography>
          <ActionButton
            intent="quiet"
            size="small"
            endIcon={<ArrowRight size={14} aria-hidden="true" />}
            onClick={() => navigate('/meetings/follow-ups?scope=CANDIDATES')}
          >
            {t('designReview.recap.manageFollowUps')}
          </ActionButton>
        </Stack>
        <Stack gap={1.5}>
          {analysis?.actionItems.length ? (
            analysis.actionItems.map((item, index) => {
              const candidate = candidates.find((entry) => entry.actionItemIndex === index);
              return (
                <CitedOutcome
                  key={`${index}-${item.text}`}
                  item={item}
                  action
                  footer={
                    <Stack gap={0.75} sx={{ mt: 1.25 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          candidate
                            ? 'designReview.recap.candidateLocked'
                            : 'designReview.recap.candidateUnavailable'
                        )}
                      </Typography>
                      <ActionButton
                        intent="primary"
                        size="small"
                        disabled={!candidate}
                        sx={{ alignSelf: 'flex-end', minHeight: 44 }}
                        onClick={() => {
                          if (candidate) navigate(meetingRecapCandidateHref(candidate));
                        }}
                      >
                        {t('followUps.candidates.reviewCandidate')}
                      </ActionButton>
                    </Stack>
                  }
                />
              );
            })
          ) : (
            <OutcomeEmpty text={t('history.recap.actionsEmpty')} />
          )}
        </Stack>
      </Box>
      <Box sx={{ gridArea: 'evidence', minWidth: 0 }}>{evidence}</Box>
      <MeetingRecapDetailedAnalysis compact={compact} recap={recap} agenda={agenda} />
      <MeetingRecapCandidateReview
        open={Boolean(candidateId)}
        candidate={selectedCandidate}
        report={report}
        onClose={() => {
          const next = new URLSearchParams(params);
          next.delete('candidateId');
          setParams(next, { replace: true });
        }}
      />
    </Box>
  );
}

function MeetingRecapDetailedAnalysis({
  compact,
  recap,
  agenda,
}: {
  compact: boolean;
  recap: PublishedMeetingRecap;
  agenda: string | null | undefined;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box
      component={compact ? 'details' : 'div'}
      sx={{ gridArea: 'analysis', minWidth: 0 }}
      data-testid="meeting-recap-analysis-disclosure"
    >
      {compact && (
        <Box
          component="summary"
          data-testid="meeting-recap-analysis-toggle"
          sx={{
            py: 1.5,
            px: 1,
            minHeight: 44,
            color: 'primary.main',
            cursor: 'pointer',
            fontWeight: 'fontWeightBold',
          }}
        >
          {t('designReview.recap.showDetailedAnalysis')}
        </Box>
      )}
      {recap.state === 'READY' ? (
        <MeetingRecapAnalysis recap={recap} />
      ) : (
        <Box component="section" sx={(theme) => ({ ...meetingSurface(theme), p: 2.5 })}>
          <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold" sx={{ mb: 1 }}>
            {t('history.recap.agendaTitle')}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {agenda || t('room.agendaEmpty')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function CitedOutcome({
  item,
  index,
  action = false,
  footer,
}: {
  item: VideoMeetingIntelligenceCitedText;
  index?: number;
  action?: boolean;
  footer?: ReactNode;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box
      sx={(theme) => ({
        p: { xs: 1.75, sm: 2 },
        borderRadius: meetingShape.inset,
        bgcolor: alpha(
          action ? theme.palette.success.main : theme.palette.primary.main,
          theme.palette.mode === 'dark' ? 0.12 : 0.055
        ),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.07)}`,
      })}
    >
      {index && (
        <Chip
          size="small"
          color="primary"
          label={t('designReview.recap.decisionNumber', { index: String(index).padStart(2, '0') })}
          sx={{ mb: 1 }}
        />
      )}
      <Typography
        variant="body2"
        fontWeight={index || action ? 'fontWeightBold' : 'fontWeightMedium'}
        sx={{ whiteSpace: 'pre-wrap', lineHeight: 'body2.lineHeight' }}
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
      {footer}
    </Box>
  );
}
