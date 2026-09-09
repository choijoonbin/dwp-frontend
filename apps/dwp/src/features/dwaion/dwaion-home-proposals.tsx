import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Inbox, ShieldCheck } from 'lucide-react';
import {
  formatDate,
  resolveSupportedLocale,
  useDisplayDictionary,
} from '@dwp-frontend/shared-i18n';
import type { DwaionProposal } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { proposalIsHighPriority } from './dwaion-proposal-model';
import type { HomeLoadState } from './dwaion-home-model';
import { DwaionHomeResource, DwaionHomeSection, HOME_INTERACTION } from './dwaion-home-surfaces';

export function DwaionHomeProposals({
  items,
  state,
  onRetry,
}: {
  items: DwaionProposal[];
  state: HomeLoadState;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation('work');
  const navigate = useNavigate();
  const display = useDisplayDictionary();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);

  if (state === 'ready' && items.length === 0) return null;

  return (
    <Box
      sx={{
        mt: { xs: 2, md: 3 },
        p: { xs: 1.5, md: 2 },
        bgcolor: 'var(--dwp-product-soft)',
        border: 1,
        borderColor: 'primary.light',
        borderRadius: (theme) => ({ xs: Number(theme.shape.borderRadius) * 2 + 'px', md: 0 }),
      }}
      data-testid="dwaion-home-proposals"
    >
      <DwaionHomeSection
        title={t('dwaionHome.proposals.title')}
        description={t('dwaionHome.proposals.description')}
        actionLabel={t('dwaionHome.proposals.open')}
        onAction={() => navigate('/dwaion/proposals')}
      >
        <DwaionHomeResource state={state} onRetry={onRetry}>
          <Box
            component="ul"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: 1,
              listStyle: 'none',
              p: 0,
              m: 0,
            }}
          >
            {items.slice(0, 1).map((proposal) => (
              <Box component="li" key={proposal.proposalId} sx={{ minWidth: 0 }}>
                <ButtonBase
                  component={RouterLink}
                  to={`/dwaion/proposals?proposal=${encodeURIComponent(proposal.proposalId)}`}
                  sx={{
                    ...HOME_INTERACTION,
                    width: 1,
                    minWidth: 0,
                    minHeight: { xs: 0, md: 132 },
                    display: 'flex',
                    flexWrap: { xs: 'wrap', md: 'nowrap' },
                    alignItems: 'stretch',
                    gap: 1.5,
                    p: { xs: 1.5, md: 1.75 },
                    border: 1,
                    borderColor: proposalIsHighPriority(proposal) ? 'warning.main' : 'divider',
                    borderInlineStart: 4,
                    borderInlineStartColor: proposalIsHighPriority(proposal)
                      ? 'warning.main'
                      : 'var(--dwp-product-accent)',
                    borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    textAlign: 'left',
                    '&:hover': {
                      bgcolor: 'action.hover',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 36,
                      height: 36,
                      flex: '0 0 auto',
                      placeItems: 'center',
                      borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                      bgcolor: 'var(--dwp-product-soft)',
                      color: 'var(--dwp-product-accent)',
                      display: { xs: 'none', md: 'grid' },
                    }}
                  >
                    <Inbox size={18} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack
                      direction="row"
                      gap={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                      sx={{ display: { xs: 'none', md: 'flex' } }}
                    >
                      <Chip
                        size="small"
                        variant="outlined"
                        color={proposalIsHighPriority(proposal) ? 'warning' : 'default'}
                        label={t(`dwaionProposals.priorities.${proposal.priority}`)}
                        sx={{ height: 22 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {t(`dwaionProposals.kinds.${proposal.kind}`)}
                      </Typography>
                    </Stack>
                    <Typography
                      component="h3"
                      variant="body2"
                      fontWeight="fontWeightBold"
                      sx={{ mt: 0.75, overflowWrap: 'anywhere' }}
                    >
                      {proposal.content.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        mt: 0.35,
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                      }}
                    >
                      {proposal.content.rationale || proposal.content.summary}
                    </Typography>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      gap={{ xs: 0.4, sm: 1.25 }}
                      alignItems={{ sm: 'center' }}
                      sx={{ mt: 1, display: { xs: 'none', md: 'flex' } }}
                    >
                      <Stack direction="row" gap={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <ShieldCheck size={13} aria-hidden="true" />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {proposal.content.evidence?.[0]?.sourceType
                            ? display('sourceTypes', proposal.content.evidence[0].sourceType)
                            : t('dwaionHome.proposals.noSource')}
                        </Typography>
                      </Stack>
                      <Stack direction="row" gap={0.5} alignItems="center">
                        <CalendarClock size={13} aria-hidden="true" />
                        <Typography variant="caption" color="text.secondary">
                          {t('dwaionHome.proposals.expires', {
                            at: formatDate(
                              proposal.expiresAt,
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                              locale
                            ),
                          })}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                  <Stack
                    direction="row"
                    gap={0.5}
                    alignItems="center"
                    alignSelf="center"
                    sx={{
                      color: { xs: 'primary.contrastText', md: 'primary.main' },
                      bgcolor: { xs: 'primary.main', md: 'transparent' },
                      width: { xs: 1, md: 'auto' },
                      minHeight: { xs: 44, md: 0 },
                      px: { xs: 1.5, md: 0 },
                      mt: { xs: 0.5, md: 0 },
                      borderRadius: (theme) => ({
                        xs: Number(theme.shape.borderRadius) * 1 + 'px',
                        md: 0,
                      }),
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight="fontWeightBold"
                      sx={{
                        display: 'block',
                        fontSize: { xs: 'body2.fontSize', md: 'caption.fontSize' },
                      }}
                    >
                      {t('dwaionHome.proposals.review')}
                    </Typography>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Stack>
                </ButtonBase>
              </Box>
            ))}
          </Box>
        </DwaionHomeResource>
      </DwaionHomeSection>
    </Box>
  );
}
