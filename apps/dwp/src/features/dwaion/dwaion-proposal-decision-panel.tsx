import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Clock3, ShieldCheck, X } from 'lucide-react';
import {
  ActionButton,
  ConfirmDialog,
  foundationTokens,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  proposalCanDecide,
  proposalCanSnoozeUntil,
  proposalSnoozeTime,
  proposalTimeZone,
} from './dwaion-proposal-model';

import type { DwaionProposal } from '@dwp-frontend/shared-utils';

export function DwaionProposalDecisionPanel({
  proposal,
  busy,
  locale,
  onAccept,
  onSnooze,
  onDismiss,
}: {
  proposal: DwaionProposal;
  busy: boolean;
  locale: 'ko' | 'en';
  onAccept: (proposal: DwaionProposal) => void;
  onSnooze: (proposal: DwaionProposal, until: string) => void;
  onDismiss: (proposal: DwaionProposal) => void;
}) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const [snoozeAnchor, setSnoozeAnchor] = useState<HTMLElement | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reviewTime, setReviewTime] = useState(Date.now);
  const timeZone = proposalTimeZone();
  const reviewDate = new Date(reviewTime);
  const actionable = proposalCanDecide(proposal, reviewDate);
  const undecided = proposal.state === 'PENDING' || proposal.state === 'SNOOZED';
  const snoozeOptions = (['TWO_HOURS', 'TOMORROW', 'NEXT_WEEK'] as const).map((option) => ({
    option,
    until: proposalSnoozeTime(option, reviewDate, timeZone),
  }));

  useEffect(() => {
    setSnoozeAnchor(null);
    setDismissOpen(false);
    setReviewTime(Date.now());
    const delay = Date.parse(proposal.expiresAt) - Date.now();
    if (delay <= 0) return undefined;
    const timer = window.setTimeout(
      () => setReviewTime(Date.now()),
      Math.min(delay + 1, 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [proposal.expiresAt, proposal.proposalId]);

  const decide = (callback: (value: DwaionProposal) => void) => {
    setReviewTime(Date.now());
    if (proposalCanDecide(proposal)) callback(proposal);
  };
  const chooseSnooze = (until: string) => {
    setSnoozeAnchor(null);
    setReviewTime(Date.now());
    if (proposalCanSnoozeUntil(proposal, until)) onSnooze(proposal, until);
  };

  return (
    <>
      <Paper
        component="section"
        aria-label={t('dwaionProposals.detail.decisionTitle')}
        data-testid="dwaion-proposal-mobile-decisions"
        elevation={8}
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          zIndex: (theme) => theme.zIndex.appBar + 1,
          insetInline: 0,
          bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          px: 2,
          py: 1.25,
          borderRadius: 0,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {undecided ? (
          <>
            {!actionable && (
              <InlineFeedback severity="warning" sx={{ mb: 1 }}>
                {t('dwaionProposals.detail.validityEnded')}
              </InlineFeedback>
            )}
            <ActionButton
              intent="primary"
              fullWidth
              startIcon={<Check size={16} aria-hidden="true" />}
              endIcon={<ArrowRight size={16} aria-hidden="true" />}
              loading={busy}
              disabled={!actionable}
              loadingLabel={t('dwaionProposals.actions.saving')}
              onClick={() => decide(onAccept)}
              sx={{ minHeight: 48 }}
            >
              {t('dwaionProposals.actions.accept')}
            </ActionButton>
            <Stack direction="row" gap={1} sx={{ mt: 1 }}>
              <ActionButton
                fullWidth
                startIcon={<Clock3 size={16} aria-hidden="true" />}
                disabled={busy || !actionable}
                onClick={(event) => {
                  setReviewTime(Date.now());
                  setSnoozeAnchor(event.currentTarget);
                }}
                sx={{ minHeight: 44 }}
              >
                {t('dwaionProposals.actions.snooze')}
              </ActionButton>
              <ActionButton
                intent="quiet"
                fullWidth
                startIcon={<X size={16} aria-hidden="true" />}
                disabled={busy || !actionable}
                onClick={() => setDismissOpen(true)}
                sx={{ minHeight: 44 }}
              >
                {t('dwaionProposals.actions.dismiss')}
              </ActionButton>
            </Stack>
          </>
        ) : proposal.state === 'ACCEPTED' && proposal.actionKey ? (
          <ActionButton
            intent="primary"
            fullWidth
            endIcon={<ArrowRight size={16} aria-hidden="true" />}
            onClick={() => navigate('/dwaion/actions')}
          >
            {t('dwaionProposals.actions.openReview')}
          </ActionButton>
        ) : (
          <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="center">
            <CheckCircle2 size={18} color="var(--dwp-product-secondary)" aria-hidden="true" />
            <Typography variant="body2" color="text.secondary">
              {t(`dwaionProposals.states.${proposal.state}`)}
            </Typography>
          </Stack>
        )}
      </Paper>

      <Paper
        component="aside"
        aria-labelledby="dwaion-proposal-decision-title"
        variant="outlined"
        sx={{
          display: { xs: 'none', md: 'block' },
          position: { lg: 'sticky' },
          top: { lg: 16 },
          overflow: 'hidden',
          borderColor: 'divider',
          boxShadow: (theme) => ({ xs: 0, lg: theme.shadows[3] }),
        }}
      >
        <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.8}>
              <Box
                aria-hidden="true"
                sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main' }}
              />
              <Typography id="dwaion-proposal-decision-title" component="h2" variant="h6">
                {t('dwaionProposals.detail.decisionTitle')}
              </Typography>
            </Stack>
            <Chip size="small" variant="outlined" label={t('dwaionProposals.detail.reviewOnly')} />
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75, lineHeight: 'typography.body2.lineHeight' }}
          >
            {t('dwaionProposals.detail.decisionDescription')}
          </Typography>
        </Box>

        <Stack gap={2.5} sx={{ p: { xs: 2, md: 2.5 } }}>
          {undecided ? (
            <>
              <Box
                sx={{
                  p: 1.75,
                  borderRadius:
                    foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
                  bgcolor: 'var(--dwp-product-soft)',
                }}
              >
                <Stack direction="row" alignItems="center" gap={1}>
                  <DecisionIndex>A</DecisionIndex>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
                      {t('dwaionProposals.detail.acceptTitle')}
                    </Typography>
                    <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
                      {t('dwaionProposals.detail.recommended')}
                    </Typography>
                  </Box>
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1, lineHeight: 'typography.body2.lineHeight' }}
                >
                  {t('dwaionProposals.actions.reviewBoundary')}
                </Typography>
                <ActionButton
                  intent="primary"
                  fullWidth
                  startIcon={<Check size={16} aria-hidden="true" />}
                  endIcon={<ArrowRight size={16} aria-hidden="true" />}
                  loading={busy}
                  disabled={!actionable}
                  loadingLabel={t('dwaionProposals.actions.saving')}
                  onClick={() => decide(onAccept)}
                  sx={{ mt: 1.5, minHeight: 48 }}
                >
                  {t('dwaionProposals.actions.accept')}
                </ActionButton>
              </Box>

              <DecisionSection index="B" title={t('dwaionProposals.actions.snooze')}>
                <Typography variant="body2" color="text.secondary">
                  {t('dwaionProposals.detail.snoozeDescription', { zone: timeZone })}
                </Typography>
                <ActionButton
                  fullWidth
                  startIcon={<Clock3 size={16} aria-hidden="true" />}
                  disabled={busy || !actionable}
                  onClick={(event) => {
                    setReviewTime(Date.now());
                    setSnoozeAnchor(event.currentTarget);
                  }}
                  sx={{ mt: 1.25, minHeight: 44 }}
                >
                  {t('dwaionProposals.actions.snooze')}
                </ActionButton>
              </DecisionSection>

              <DecisionSection index="C" title={t('dwaionProposals.actions.dismiss')}>
                <Typography variant="body2" color="text.secondary">
                  {t('dwaionProposals.detail.dismissDescription')}
                </Typography>
                <ActionButton
                  intent="quiet"
                  fullWidth
                  startIcon={<X size={16} aria-hidden="true" />}
                  disabled={busy || !actionable}
                  onClick={() => setDismissOpen(true)}
                  sx={{ mt: 1.25, minHeight: 44 }}
                >
                  {t('dwaionProposals.actions.dismiss')}
                </ActionButton>
              </DecisionSection>

              {!actionable && (
                <InlineFeedback severity="warning">
                  {t('dwaionProposals.detail.validityEnded')}
                </InlineFeedback>
              )}
            </>
          ) : proposal.state === 'ACCEPTED' && proposal.actionKey ? (
            <Stack gap={1.25} alignItems="stretch">
              <Stack direction="row" spacing={0.8} alignItems="center">
                <CheckCircle2 size={18} color="var(--dwp-product-secondary)" aria-hidden="true" />
                <Typography variant="subtitle1" fontWeight="fontWeightBold">
                  {t('dwaionProposals.detail.decisionRecorded', {
                    state: t(`dwaionProposals.states.${proposal.state}`),
                  })}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {t('dwaionProposals.actions.reviewBoundary')}
              </Typography>
              <ActionButton
                intent="primary"
                fullWidth
                endIcon={<ArrowRight size={16} aria-hidden="true" />}
                onClick={() => navigate('/dwaion/actions')}
              >
                {t('dwaionProposals.actions.openReview')}
              </ActionButton>
            </Stack>
          ) : (
            <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="center">
              <CheckCircle2 size={18} color="var(--dwp-product-secondary)" aria-hidden="true" />
              <Typography variant="body2" color="text.secondary">
                {t(`dwaionProposals.states.${proposal.state}`)}
              </Typography>
            </Stack>
          )}

          <Box sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="flex-start" gap={0.75}>
              <ShieldCheck size={16} color="var(--dwp-product-secondary)" aria-hidden="true" />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ lineHeight: 'typography.caption.lineHeight' }}
              >
                {t('dwaionProposals.detail.decisionAudit', {
                  revision: proposal.revision,
                  at: formatDate(
                    proposal.expiresAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    locale
                  ),
                })}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Menu
        anchorEl={snoozeAnchor}
        open={Boolean(snoozeAnchor)}
        onClose={() => setSnoozeAnchor(null)}
      >
        <ListSubheader
          role="presentation"
          sx={{
            px: 2,
            py: 1,
            maxWidth: 320,
            typography: 'caption',
            color: 'text.secondary',
            whiteSpace: 'normal',
            lineHeight: 'typography.caption.lineHeight',
          }}
        >
          {t('dwaionProposals.snooze.window', { zone: timeZone })}
        </ListSubheader>
        {snoozeOptions.map(({ option, until }) => (
          <MenuItem
            key={option}
            disabled={!proposalCanSnoozeUntil(proposal, until, reviewDate)}
            onClick={() => chooseSnooze(until)}
            sx={{ minHeight: 44, whiteSpace: 'normal' }}
          >
            <Box>
              <Typography variant="body2">{t(`dwaionProposals.snooze.${option}`)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(until, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
      <ConfirmDialog
        open={dismissOpen && actionable}
        title={t('dwaionProposals.dismiss.title')}
        description={t('dwaionProposals.dismiss.description')}
        cancelLabel={t('dwaionProposals.dismiss.cancel')}
        confirmLabel={t('dwaionProposals.dismiss.confirm')}
        confirmingLabel={t('dwaionProposals.actions.saving')}
        busy={busy}
        onClose={() => setDismissOpen(false)}
        onConfirm={() => {
          setDismissOpen(false);
          decide(onDismiss);
        }}
      />
    </>
  );
}

function DecisionSection({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.75 }}>
        <DecisionIndex muted>{index}</DecisionIndex>
        <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

function DecisionIndex({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        width: 28,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        borderRadius: '50%',
        bgcolor: muted ? 'action.hover' : 'primary.main',
        color: muted ? 'text.secondary' : 'primary.contrastText',
        fontSize: (theme) => theme.typography.pxToRem(12),
        fontWeight: 'fontWeightBold',
      }}
    >
      {children}
    </Box>
  );
}
