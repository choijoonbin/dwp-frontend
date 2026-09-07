import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarCheck2,
  CircleAlert,
  ClipboardList,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { ActionButton, ErrorState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import type { WorkspaceWorkItem } from '@dwp-frontend/shared-utils';
import type { AskCitationSourceType } from '@dwp-frontend/shared-utils';
import type { DwaionModeKey } from './dwaion-workspace-model';

import { DwaionWorkspaceComposer } from './dwaion-workspace-composer';

type DwaionWorkspaceStartProps = {
  expert?: boolean;
  firstName?: string;
  query: string;
  loading: boolean;
  workLoading: boolean;
  workError: boolean;
  workItems: WorkspaceWorkItem[];
  sourceScopes: AskCitationSourceType[];
  availableSources: AskCitationSourceType[];
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onChooseMode: (mode: DwaionModeKey, prompt: string) => void;
  onOpenWork: (item: WorkspaceWorkItem) => void;
  onRetryWork: () => void;
  onToggleSource: (source: AskCitationSourceType) => void;
  onCancel: () => void;
};

const modes: ReadonlyArray<{
  key: DwaionModeKey;
  icon: typeof ClipboardList;
  tone: 'primary' | 'error' | 'success' | 'secondary';
}> = [
  { key: 'brief', icon: ClipboardList, tone: 'primary' },
  { key: 'blockers', icon: CircleAlert, tone: 'error' },
  { key: 'meeting', icon: CalendarCheck2, tone: 'success' },
  { key: 'access', icon: KeyRound, tone: 'secondary' },
];

export function DwaionWorkspaceStart({
  expert = false,
  firstName,
  query,
  loading,
  workLoading,
  workError,
  workItems,
  sourceScopes,
  availableSources,
  onQueryChange,
  onSubmit,
  onChooseMode,
  onOpenWork,
  onRetryWork,
  onToggleSource,
  onCancel,
}: DwaionWorkspaceStartProps) {
  const { t } = useTranslation('work');
  const theme = useTheme();

  return (
    <Box>
      <Stack
        direction="row"
        gap={2}
        alignItems="center"
        sx={{ px: { xs: 1.5, sm: 2 }, py: 2, mb: 2, bgcolor: 'action.selected', borderRadius: 1 }}
      >
        <Box
          component="img"
          src="/assets/assistants/dwaion-link-v1.png"
          alt=""
          sx={{ width: 52, height: 52, objectFit: 'contain', flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="primary.main"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
          >
            <Sparkles size={14} />
            {t(expert ? 'askPage.approvalExpert.welcome.eyebrow' : 'askPage.welcome.eyebrow')}
          </Typography>
          <Typography component="h2" variant="h5" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
            {firstName
              ? t(expert ? 'askPage.approvalExpert.welcome.title' : 'askPage.welcome.title', {
                  name: firstName,
                })
              : t(
                  expert
                    ? 'askPage.approvalExpert.welcome.titleFallback'
                    : 'askPage.welcome.titleFallback'
                )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t(
              expert ? 'askPage.approvalExpert.welcome.description' : 'askPage.welcome.description'
            )}
          </Typography>
        </Box>
      </Stack>
      <DwaionWorkspaceComposer
        value={query}
        loading={loading}
        presentation="home"
        sourceScopes={sourceScopes}
        availableSources={availableSources}
        onToggleSource={onToggleSource}
        onCancel={onCancel}
        onChange={onQueryChange}
        onSubmit={onSubmit}
      />

      <Box component="section" aria-labelledby="dwaion-modes-heading" sx={{ mt: 3.5 }}>
        <Typography id="dwaion-modes-heading" component="h2" variant="subtitle1" fontWeight={800}>
          {t(expert ? 'askPage.approvalExpert.modes.title' : 'askPage.modes.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {t(expert ? 'askPage.approvalExpert.modes.description' : 'askPage.modes.description')}
        </Typography>
        <Box
          sx={{
            mt: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {modes.map(({ key, icon: Icon, tone: paletteKey }) => {
            const tone = theme.palette[paletteKey].main;
            const itemKey = expert
              ? `askPage.approvalExpert.modes.items.${key}`
              : `askPage.modes.items.${key}`;
            const prompt = t(`${itemKey}.prompt`);
            return (
              <ButtonBase
                key={key}
                aria-label={t(`${itemKey}.title`)}
                onClick={() => onChooseMode(key, prompt)}
                sx={{
                  minHeight: 96,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  px: 2,
                  py: 1.75,
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0, 1fr) 20px',
                  gap: 1.25,
                  alignItems: 'center',
                  textAlign: 'left',
                  transition: (theme) =>
                    theme.transitions.create(['border-color', 'box-shadow', 'transform'], {
                      duration: theme.transitions.duration.shorter,
                    }),
                  '&:hover': {
                    borderColor: tone,
                    boxShadow: `0 10px 24px ${alpha(tone, 0.12)}`,
                    transform: 'translateY(-1px)',
                  },
                  '&:focus-visible': { outline: `3px solid ${alpha(tone, 0.3)}`, outlineOffset: 2 },
                  '@media (prefers-reduced-motion: reduce)': {
                    transition: 'none',
                    '&:hover': { transform: 'none' },
                  },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1,
                    bgcolor: alpha(tone, 0.1),
                    color: tone,
                  }}
                >
                  <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h3" variant="subtitle2" fontWeight={800}>
                    {t(`${itemKey}.title`)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.25, lineHeight: 1.45 }}
                  >
                    {t(`${itemKey}.description`)}
                  </Typography>
                </Box>
                <ArrowRight size={17} color={tone} aria-hidden="true" />
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {!expert && (
        <Box component="section" aria-labelledby="dwaion-work-context-heading" sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'end' }}>
            <Box>
              <Typography
                id="dwaion-work-context-heading"
                component="h2"
                variant="subtitle1"
                fontWeight={800}
              >
                {t('askPage.recentContext')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {t('askPage.workContextDescription')}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 1.5, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
            {workLoading ? (
              <Stack spacing={1.25} sx={{ py: 2 }}>
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} variant="rounded" height={44} />
                ))}
              </Stack>
            ) : workError ? (
              <ErrorState
                size="compact"
                title={t('askPage.contextUnavailable')}
                retryLabel={t('dwaionStudio.retry')}
                onRetry={onRetryWork}
              />
            ) : workItems.length ? (
              workItems.map((item, index) => (
                <Box
                  key={item.workItemId}
                  sx={{
                    py: 1.5,
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: '1fr 140px auto' },
                    gap: 1.5,
                    alignItems: 'center',
                    borderTop: index === 0 ? 0 : 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      component="h3"
                      variant="subtitle2"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {item.summary || item.recommendedNext || item.sourceSystem}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ display: { xs: 'none', sm: 'block' } }}
                  >
                    {item.sourceSystem}
                  </Typography>
                  <ActionButton
                    size="small"
                    intent="quiet"
                    endIcon={<ArrowRight size={14} aria-hidden="true" />}
                    onClick={() => onOpenWork(item)}
                  >
                    {t('askPage.openContext')}
                  </ActionButton>
                </Box>
              ))
            ) : (
              <Typography color="text.secondary" sx={{ py: 2.5 }}>
                {t('askPage.contextEmpty')}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
