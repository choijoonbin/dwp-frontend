import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  FileCheck2,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionProposalDecisionPanel } from './dwaion-proposal-decision-panel';
import { DwaionProposalEvidence } from './dwaion-proposal-evidence';
import { DwaionProposalContextStrip } from './dwaion-proposal-mobile-toolbar';
import { proposalIsHighPriority, proposalTimeZone } from './dwaion-proposal-model';

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
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && proposal) detailRef.current?.focus({ preventScroll: true });
  }, [open, proposal]);

  if (!open || !proposal) return null;

  const timeZone = proposalTimeZone();
  const evidenceCount = proposal.content.evidence?.length ?? 0;

  return (
    <Box
      ref={detailRef}
      role="dialog"
      aria-label={t('dwaionProposals.detail.agentProposal')}
      aria-modal="false"
      tabIndex={-1}
      data-testid="dwaion-proposal-detail-page"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && event.target === event.currentTarget && !busy) onClose();
      }}
      sx={{ outline: 'none', pb: { xs: 16, md: 0 } }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ display: 'none' }}
      >
        <ActionButton
          intent="quiet"
          startIcon={<ArrowLeft size={22} aria-hidden="true" />}
          aria-label={t('dwaionProposals.detail.close')}
          onClick={onClose}
          disabled={busy}
          sx={{
            minHeight: 44,
            px: 0.5,
            fontSize: (theme) => theme.typography.pxToRem(18),
            fontWeight: 'fontWeightBold',
          }}
        >
          {t('dwaionProposals.detail.routeTitle')}
        </ActionButton>
      </Stack>

      <DwaionProposalContextStrip compact />

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        sx={{ display: { xs: 'none', md: 'flex' }, mb: 2 }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('dwaionProposals.title')} · {t('dwaionProposals.detail.routeTitle')}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.35 }}>
            <Bot size={17} color="var(--dwp-product-accent)" aria-hidden="true" />
            <Typography variant="subtitle2" color="text.secondary">
              {t('dwaionProposals.detail.agentProposal')}
            </Typography>
          </Stack>
        </Box>
        <ActionButton
          intent="quiet"
          startIcon={<ArrowLeft size={17} aria-hidden="true" />}
          onClick={onClose}
          disabled={busy}
          sx={{ minHeight: 44 }}
        >
          {t('dwaionProposals.detail.close')}
        </ActionButton>
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        useFlexGap
        flexWrap="wrap"
        sx={{
          display: { xs: 'none', md: 'flex' },
          mb: 1.5,
          px: 1.5,
          py: 0.9,
          borderRadius: foundationTokens.radius.surface + 'px',
          bgcolor: 'action.hover',
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption" sx={{ fontFamily: foundationTokens.font.mono }}>
          #{proposal.proposalId}
        </Typography>
        <Typography variant="caption">·</Typography>
        <Typography variant="caption" sx={{ fontFamily: foundationTokens.font.mono }}>
          {t('dwaionProposals.detail.revision')} #{proposal.revision}
        </Typography>
        <Typography variant="caption">·</Typography>
        <Typography variant="caption">
          {t('dwaionProposals.detail.proposedAt')}:{' '}
          {formatDate(proposal.proposedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
        </Typography>
        <Typography variant="caption">· {timeZone}</Typography>
      </Stack>

      <Paper
        component="header"
        variant="outlined"
        sx={{
          p: { xs: 1.5, sm: 2, lg: 2.25 },
          overflow: 'hidden',
          borderColor: 'divider',
          background:
            'linear-gradient(110deg, var(--mui-palette-background-paper) 58%, var(--dwp-product-soft) 100%)',
          boxShadow: (theme) => theme.shadows[2],
        }}
      >
        <Stack
          direction={{ xs: 'column-reverse', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ lg: 'flex-start' }}
          gap={1.5}
        >
          <Box sx={{ minWidth: 0, maxWidth: 780 }}>
            <Typography
              variant="overline"
              color="primary.main"
              fontWeight="fontWeightBold"
              sx={{ display: { xs: 'none', md: 'block' } }}
            >
              {t('dwaionProposals.detail.decisionTrigger')}
            </Typography>
            <Typography
              component="h1"
              variant="h3"
              fontWeight="fontWeightBold"
              sx={{
                mt: 0.4,
                overflowWrap: 'anywhere',
                fontSize: (theme) => ({
                  xs: theme.typography.pxToRem(26),
                  md: theme.typography.pxToRem(34),
                }),
              }}
            >
              {proposal.content.title}
            </Typography>
          </Box>
          <Stack
            direction="row"
            gap={0.75}
            flexWrap="wrap"
            sx={{
              '& .MuiChip-root': { height: 'auto', minHeight: 28 },
              '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 },
            }}
          >
            <Chip
              size="small"
              color="primary"
              label={t(`dwaionProposals.states.${proposal.state}`)}
            />
            <Chip
              size="small"
              color={proposalIsHighPriority(proposal) ? 'warning' : 'default'}
              label={t('dwaionProposals.detail.priority', {
                priority: t(`dwaionProposals.priorities.${proposal.priority}`),
              })}
            />
            <Chip
              size="small"
              variant="outlined"
              icon={<Clock3 size={14} aria-hidden="true" />}
              label={formatDate(
                proposal.expiresAt,
                { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                locale
              )}
            />
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '40px minmax(0, 1fr)', md: '48px minmax(0, 1fr)' },
            gap: 1.5,
            mt: { xs: 1.75, md: 2 },
            p: { xs: 1.5, md: 2 },
            borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
            bgcolor: 'var(--dwp-product-soft)',
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: { xs: 40, md: 48 },
              height: { xs: 40, md: 48 },
              display: 'grid',
              placeItems: 'center',
              borderRadius: {
                xs: '50%',
                md: foundationTokens.radius.surface + foundationTokens.radius.compact / 2 + 'px',
              },
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <Sparkles size={21} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h2"
              variant="subtitle1"
              color="primary.main"
              fontWeight="fontWeightBold"
            >
              <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
                {t('dwaionProposals.detail.analysisRecommendation')}
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                {t('dwaionProposals.detail.why')}
              </Box>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mt: 0.35,
                lineHeight: 'typography.body1.lineHeight',
                display: { xs: 'none', md: 'block' },
              }}
            >
              {proposal.content.rationale}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: { xs: 0.45, md: 0.6 },
                lineHeight: 'typography.body2.lineHeight',
              }}
            >
              {proposal.content.summary}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 420px' },
          alignItems: 'start',
          gap: { xs: 2, lg: 3 },
          mt: { xs: 2, lg: 3 },
        }}
      >
        <Stack gap={3} sx={{ minWidth: 0 }}>
          <DetailSection
            id="dwaion-proposal-evidence-title"
            title={t('dwaionProposals.detail.evidenceTitle')}
            meta={t('dwaionProposals.evidenceCount', { count: evidenceCount })}
            icon={<ShieldCheck size={22} />}
          >
            <DwaionProposalEvidence proposal={proposal} locale={locale} />
            {evidenceCount < 2 && (
              <Paper
                variant="outlined"
                sx={{ mt: 1.25, p: 1.5, borderStyle: 'dashed', color: 'text.secondary' }}
              >
                <Typography variant="body2">
                  {t('dwaionProposals.detail.additionalEvidenceUnavailable')}
                </Typography>
              </Paper>
            )}
          </DetailSection>

          <DetailSection
            id="dwaion-proposal-impact-title"
            title={t('dwaionProposals.detail.impactTitle')}
            meta={t('dwaionProposals.detail.readOnly')}
            icon={<FileCheck2 size={22} />}
          >
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.5, md: 2 },
                bgcolor: { xs: 'var(--dwp-product-soft)', md: 'background.paper' },
              }}
            >
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 42,
                    height: 42,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius:
                      foundationTokens.radius.surface + foundationTokens.radius.compact / 2 + 'px',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                  }}
                >
                  <CheckCircle2 size={22} />
                </Box>
                <Typography component="h3" variant="h6" fontWeight="fontWeightBold">
                  {t('dwaionProposals.detail.effectTitle')}
                </Typography>
                <Chip size="small" color="success" label={t('dwaionProposals.detail.readOnly')} />
              </Stack>
              <Typography
                variant="body1"
                sx={{ mt: 1.25, lineHeight: 'typography.body1.lineHeight' }}
              >
                {proposal.actionKey
                  ? t('dwaionProposals.preview.reviewAction')
                  : t('dwaionProposals.preview.reviewOnly')}
              </Typography>
              <Stack direction="row" alignItems="flex-start" gap={0.8} sx={{ mt: 1.25 }}>
                <ShieldCheck size={18} color="var(--dwp-product-secondary)" aria-hidden="true" />
                <Typography variant="body2" color="text.primary" fontWeight="fontWeightBold">
                  {t('dwaionProposals.detail.effectSafe')}
                </Typography>
              </Stack>

              <Typography
                component="h3"
                variant="subtitle2"
                color="text.secondary"
                fontWeight="fontWeightBold"
                sx={{ display: { xs: 'none', md: 'block' }, mt: 2, mb: 1 }}
              >
                {t('dwaionProposals.detail.technicalContracts')}
              </Typography>
              <Box
                component="dl"
                sx={{
                  m: 0,
                  display: { xs: 'none', md: 'grid' },
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1.25,
                }}
              >
                <ContractCard
                  label={t('dwaionProposals.preview.nextStep')}
                  value={t(
                    proposal.actionKey
                      ? 'dwaionProposals.preview.reviewAction'
                      : 'dwaionProposals.preview.reviewOnly'
                  )}
                />
                <ContractCard
                  label={t('dwaionProposals.detail.actionContract')}
                  value={proposal.actionKey ?? t('dwaionProposals.detail.noActionContract')}
                />
                <ContractCard
                  label={t('dwaionProposals.detail.agentContract')}
                  value={proposal.agentKey}
                />
              </Box>
              <Stack
                direction="row"
                alignItems="flex-start"
                gap={0.8}
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  mt: 1.5,
                  p: 1.25,
                  borderRadius: foundationTokens.radius.surface + 'px',
                  bgcolor: 'var(--dwp-product-soft)',
                }}
              >
                <ShieldCheck size={17} color="var(--dwp-product-secondary)" aria-hidden="true" />
                <Typography variant="body2" color="text.secondary">
                  {t('dwaionProposals.actions.reviewBoundary')}
                </Typography>
              </Stack>
            </Paper>
          </DetailSection>

          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <DetailSection
              id="dwaion-proposal-savings-title"
              title={t('dwaionProposals.detail.savingsTitle')}
              icon={<Zap size={22} />}
            >
              <Paper
                variant="outlined"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '42px minmax(0, 1fr)',
                  gap: 1.25,
                  alignItems: 'center',
                  p: { xs: 1.5, md: 2 },
                  bgcolor: 'var(--dwp-product-soft)',
                }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 42,
                    height: 42,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: foundationTokens.radius.surface + 'px',
                    bgcolor: 'background.paper',
                    color: 'primary.main',
                  }}
                >
                  <Zap size={22} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" color="primary.main" fontWeight="fontWeightBold">
                    {t('dwaionProposals.detail.savingsUnavailable')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dwaionProposals.detail.savingsDescription')}
                  </Typography>
                </Box>
              </Paper>
            </DetailSection>
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <DetailSection
              id="dwaion-proposal-timing-title"
              title={t('dwaionProposals.detail.timing')}
              icon={<Clock3 size={22} />}
            >
              <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
                <Stack component="dl" gap={1} sx={{ m: 0 }}>
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
                  <DetailTerm label={t('dwaionProposals.detail.timeZoneLabel')} value={timeZone} />
                </Stack>
              </Paper>
            </DetailSection>
          </Box>
        </Stack>

        <DwaionProposalDecisionPanel
          proposal={proposal}
          busy={busy}
          locale={locale}
          onAccept={onAccept}
          onSnooze={onSnooze}
          onDismiss={onDismiss}
        />
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        gap={1}
        sx={{
          display: { xs: 'flex', md: 'none' },
          mt: 3,
          p: 1.25,
          borderRadius:
            foundationTokens.radius.surface + foundationTokens.radius.compact / 2 + 'px',
          bgcolor: 'var(--dwp-product-soft)',
          color: 'text.secondary',
          textAlign: 'center',
        }}
      >
        <FileCheck2 size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
        <Typography variant="body2">{t('dwaionProposals.detail.privacyNotice')}</Typography>
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        sx={{
          display: { xs: 'none', md: 'flex' },
          mt: 3,
          p: 1.5,
          borderRadius:
            foundationTokens.radius.surface + foundationTokens.radius.compact / 2 + 'px',
          bgcolor: 'grey.900',
          color: 'common.white',
        }}
      >
        <ShieldCheck size={19} color={foundationTokens.color.status.success} aria-hidden="true" />
        <Typography variant="body2">{t('dwaionProposals.detail.safeguard')}</Typography>
      </Stack>
    </Box>
  );
}

function DetailSection({
  id,
  title,
  meta,
  icon,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Box aria-hidden="true" sx={{ display: 'grid', color: 'primary.main' }}>
            {icon}
          </Box>
          <Typography id={id} component="h2" variant="h6" fontWeight="fontWeightBold">
            {title}
          </Typography>
        </Stack>
        {meta && <Chip size="small" variant="outlined" label={meta} />}
      </Stack>
      {children}
    </Box>
  );
}

function ContractCard({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        p: 1.4,
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: 'var(--dwp-product-soft)',
        minWidth: 0,
      }}
    >
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight="fontWeightBold"
        sx={{
          m: 0,
          mt: 0.5,
          overflowWrap: 'anywhere',
          lineHeight: 'typography.body2.lineHeight',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 1.5 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" fontWeight="fontWeightBold" sx={{ m: 0 }}>
        {value}
      </Typography>
    </Box>
  );
}
