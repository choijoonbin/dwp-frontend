import { useTranslation } from 'react-i18next';
import { Search, Sparkles, Users, Zap } from 'lucide-react';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import { ErrorState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionWorkspaceComposer } from './dwaion-workspace-composer';
import { HOME_INTERACTION } from './dwaion-home-surfaces';

const QUICK_PROMPTS = [
  { key: 'brief', icon: Zap, color: 'warning.main' },
  { key: 'blockers', icon: Search, color: 'info.main' },
  { key: 'meeting', icon: Users, color: 'success.main' },
] as const;

export function DwaionHomeQuestion({
  value,
  loading,
  failed,
  onChange,
  onStart,
}: {
  value: string;
  loading: boolean;
  failed: boolean;
  onChange: (value: string) => void;
  onStart: (value: string) => void;
}) {
  const { t } = useTranslation('work');
  return (
    <Box
      component="section"
      aria-label={t('dwaionHome.askTitle')}
      sx={{
        mt: { xs: 2, md: 2.5 },
        p: { xs: 1.5, md: 2.5 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 2}px`,
        boxShadow: 'none',
        '& [data-testid="dwaion-workspace-composer"]': { boxShadow: 'none' },
        '@media (max-width: 899.95px)': {
          '& [data-testid="dwaion-workspace-composer"]': {
            border: 0,
            boxShadow: 'none',
            p: 0,
            borderRadius: 0,
          },
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        gap={1}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        mb={1.5}
        sx={{ display: { xs: 'none', md: 'flex' } }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Sparkles size={16} aria-hidden="true" />
          <Typography
            id="dwaion-home-question"
            component="h2"
            variant="subtitle2"
            fontWeight="fontWeightBold"
          >
            {t('dwaionHome.askTitle')}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t('dwaionHome.askDescription')}
        </Typography>
      </Stack>
      <DwaionWorkspaceComposer
        presentation="home"
        value={value}
        loading={loading}
        onChange={onChange}
        onSubmit={() => onStart(value)}
      />
      {failed && <ErrorState size="compact" title={t('dwaionHome.launchUnavailable')} />}
      <Stack
        direction="row"
        gap={{ xs: 0.75, md: 1 }}
        useFlexGap
        flexWrap={{ xs: 'nowrap', md: 'wrap' }}
        sx={{
          mt: { xs: 1.25, md: 1.5 },
          pt: { xs: 1.25, md: 0 },
          borderTop: { xs: 1, md: 0 },
          borderColor: 'divider',
          overflowX: { xs: 'auto', md: 'visible' },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {QUICK_PROMPTS.map(({ key, icon: Icon, color }) => (
          <ActionButton
            key={key}
            intent="quiet"
            size="small"
            disabled={loading}
            aria-label={t(`askPage.modes.items.${key}.title`)}
            startIcon={<Icon size={15} />}
            onClick={() => onStart(t(`askPage.modes.items.${key}.prompt`))}
            sx={{
              ...HOME_INTERACTION,
              color: 'text.primary',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              minHeight: 44,
              borderRadius: foundationTokens.radius.control + 'px',
              flexShrink: 0,
              px: 1.25,
              '& .MuiButton-startIcon': { color },
              '&:active': { transform: 'scale(.98)' },
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
                '&:active': { transform: 'none' },
              },
            }}
          >
            {t(`askPage.modes.items.${key}.title`)}
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              aria-hidden="true"
              sx={{ ml: 1, display: { xs: 'none', xl: 'inline' } }}
            >
              {t(`dwaionHome.prompts.${key}`)}
            </Typography>
          </ActionButton>
        ))}
      </Stack>
    </Box>
  );
}
