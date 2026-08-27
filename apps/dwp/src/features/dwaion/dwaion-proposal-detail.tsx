import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ActionButton, ActionIconButton, ConfirmDialog } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { proposalCanDecide, proposalSnoozeTime } from './dwaion-proposal-model';

import type { ProposalSnoozeOption } from './dwaion-proposal-model';
import type { DwaionProposal } from '@dwp-frontend/shared-utils';

export function DwaionProposalDetail({
  proposal,
  open,
  busy,
  locale,
  onClose,
  onAccept,
  onSnooze,
  onDismiss,
}: {
  proposal: DwaionProposal | null;
  open: boolean;
  busy: boolean;
  locale: 'ko' | 'en';
  onClose: () => void;
  onAccept: (proposal: DwaionProposal) => void;
  onSnooze: (proposal: DwaionProposal, until: string) => void;
  onDismiss: (proposal: DwaionProposal) => void;
}) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const [snoozeAnchor, setSnoozeAnchor] = useState<HTMLElement | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const actionable = proposal ? proposalCanDecide(proposal) : false;
  const chooseSnooze = (option: ProposalSnoozeOption) => {
    setSnoozeAnchor(null);
    if (proposal) onSnooze(proposal, proposalSnoozeTime(option));
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open && Boolean(proposal)}
        onClose={busy ? undefined : onClose}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 460 },
              maxWidth: '100vw',
              borderLeft: 1,
              borderColor: 'divider',
              boxShadow: '0 16px 42px rgba(15, 23, 42, 0.14)',
            },
          },
        }}
      >
        {proposal && (
          <Stack sx={{ minHeight: '100%', p: { xs: 2, sm: 2.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Bot size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
                <Typography variant="overline" fontWeight={850} color="text.secondary">
                  {t('dwaionProposals.detail.agentProposal')}
                </Typography>
              </Stack>
              <ActionIconButton
                label={t('dwaionProposals.detail.close')}
                tooltipPlacement="bottom"
                onClick={onClose}
                disabled={busy}
              >
                <X size={18} aria-hidden="true" />
              </ActionIconButton>
            </Stack>

            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={0.75} flexWrap="wrap">
                <Chip size="small" label={t(`dwaionProposals.kinds.${proposal.kind}`)} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`dwaionProposals.states.${proposal.state}`)}
                />
              </Stack>
              <Typography component="h2" variant="h5" fontWeight={850} sx={{ mt: 1.5 }}>
                {proposal.content.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, lineHeight: 1.65 }}>
                {proposal.content.summary}
              </Typography>
            </Box>

            <Divider sx={{ my: 2.5 }} />
            <DetailSection title={t('dwaionProposals.detail.why')}>
              <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                {proposal.content.rationale}
              </Typography>
            </DetailSection>

            <DetailSection title={t('dwaionProposals.detail.evidence')}>
              {proposal.content.evidence?.length ? (
                <Stack gap={1}>
                  {proposal.content.evidence.map((evidence) => (
                    <Stack
                      key={`${evidence.sourceType}:${evidence.referenceId}`}
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                    >
                      <ShieldCheck
                        size={16}
                        color="var(--dwp-product-secondary)"
                        aria-hidden="true"
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {evidence.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {evidence.sourceType} · {evidence.referenceId}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('dwaionProposals.detail.noEvidence')}
                </Typography>
              )}
            </DetailSection>

            <DetailSection title={t('dwaionProposals.detail.timing')}>
              <Stack component="dl" gap={0.8} sx={{ m: 0 }}>
                <DetailTerm
                  label={t('dwaionProposals.detail.proposedAt')}
                  value={formatDate(
                    proposal.proposedAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    locale
                  )}
                />
                <DetailTerm
                  label={t('dwaionProposals.detail.expiresAt')}
                  value={formatDate(
                    proposal.expiresAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    locale
                  )}
                />
              </Stack>
            </DetailSection>

            <Box sx={{ flex: 1, minHeight: 24 }} />
            <Box
              sx={{
                position: 'sticky',
                bottom: 0,
                bgcolor: 'background.paper',
                pt: 1.5,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              {actionable ? (
                <>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <ActionButton
                      intent="primary"
                      fullWidth
                      startIcon={<Check size={16} aria-hidden="true" />}
                      loading={busy}
                      loadingLabel={t('dwaionProposals.actions.saving')}
                      onClick={() => onAccept(proposal)}
                    >
                      {t('dwaionProposals.actions.accept')}
                    </ActionButton>
                    <ActionButton
                      fullWidth
                      startIcon={<Clock3 size={16} aria-hidden="true" />}
                      disabled={busy}
                      onClick={(event) => setSnoozeAnchor(event.currentTarget)}
                    >
                      {t('dwaionProposals.actions.snooze')}
                    </ActionButton>
                  </Stack>
                  <ActionButton
                    intent="quiet"
                    fullWidth
                    disabled={busy}
                    onClick={() => setDismissOpen(true)}
                    sx={{ mt: 0.5 }}
                  >
                    {t('dwaionProposals.actions.dismiss')}
                  </ActionButton>
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
                <Stack
                  direction="row"
                  spacing={0.8}
                  alignItems="center"
                  justifyContent="center"
                  sx={{ py: 1 }}
                >
                  <CheckCircle2 size={16} color="var(--dwp-product-secondary)" aria-hidden="true" />
                  <Typography variant="body2" color="text.secondary">
                    {t(`dwaionProposals.states.${proposal.state}`)}
                  </Typography>
                </Stack>
              )}
              {proposal.actionKey && actionable && (
                <Stack
                  direction="row"
                  spacing={0.6}
                  alignItems="center"
                  justifyContent="center"
                  sx={{ mt: 1 }}
                >
                  <ExternalLink size={13} aria-hidden="true" />
                  <Typography variant="caption" color="text.secondary">
                    {t('dwaionProposals.actions.reviewBoundary')}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </Drawer>

      <Menu
        anchorEl={snoozeAnchor}
        open={Boolean(snoozeAnchor)}
        onClose={() => setSnoozeAnchor(null)}
      >
        {(['TWO_HOURS', 'TOMORROW', 'NEXT_WEEK'] as const).map((option) => (
          <MenuItem key={option} onClick={() => chooseSnooze(option)}>
            {t(`dwaionProposals.snooze.${option}`)}
          </MenuItem>
        ))}
      </Menu>
      <ConfirmDialog
        open={dismissOpen}
        title={t('dwaionProposals.dismiss.title')}
        description={t('dwaionProposals.dismiss.description')}
        cancelLabel={t('dwaionProposals.dismiss.cancel')}
        confirmLabel={t('dwaionProposals.dismiss.confirm')}
        confirmingLabel={t('dwaionProposals.actions.saving')}
        busy={busy}
        onClose={() => setDismissOpen(false)}
        onConfirm={() => {
          setDismissOpen(false);
          if (proposal) onDismiss(proposal);
        }}
      />
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 2.5 }}>
      <Typography component="h3" variant="subtitle2" fontWeight={850} sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 1.5 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" fontWeight={650} sx={{ m: 0 }}>
        {value}
      </Typography>
    </Box>
  );
}
