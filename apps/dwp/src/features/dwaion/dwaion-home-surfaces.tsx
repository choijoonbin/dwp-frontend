import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { ActionButton, ErrorState, LoadingState } from '@dwp-frontend/design-system';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HomeLoadState } from './dwaion-home-model';

export const HOME_INTERACTION = {
  transition: (theme: Theme) =>
    theme.transitions.create(['background-color', 'border-color', 'box-shadow', 'transform'], {
      duration: theme.transitions.duration.shorter,
    }),
  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
  '&:focus-visible, &.Mui-focusVisible': {
    outline: '2px solid',
    outlineColor: 'primary.main',
    outlineOffset: 3,
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
  '@media (forced-colors: active)': { border: '1px solid CanvasText', boxShadow: 'none' },
} as const;

export function DwaionHomeSection({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        minWidth: 0,
        p: { xs: 1.5, md: 2 },
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1.5}px`,
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={1}
        mb={1.5}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h2"
            variant="h6"
            fontWeight="fontWeightBold"
            sx={{
              fontSize: { xs: 'body1.fontSize', md: 'h5.fontSize' },
              lineHeight: 'h3.lineHeight',
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.4, display: { xs: 'none', md: 'block' } }}
          >
            {description}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={14} />}
          onClick={onAction}
          sx={{ flexShrink: 0, minHeight: { xs: 36, md: 40 }, px: { xs: 0.5, md: 1 } }}
        >
          {actionLabel}
        </ActionButton>
      </Stack>
      {children}
    </Box>
  );
}

export function DwaionHomeResource({
  state,
  onRetry,
  children,
}: {
  state: HomeLoadState;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('work');
  if (state === 'loading')
    return (
      <LoadingState
        embedded
        variant="skeleton"
        skeletonRows={3}
        skeletonHeight={76}
        label={t('dwaionHome.loading')}
      />
    );
  if (state === 'error')
    return (
      <ErrorState
        size="compact"
        title={t('dwaionHome.resourceError')}
        retryLabel={t('dwaionHome.retry')}
        onRetry={onRetry}
      />
    );
  return children;
}
