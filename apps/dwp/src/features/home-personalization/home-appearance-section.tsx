import { useTranslation } from 'react-i18next';
import { Check, Focus, LayoutDashboard, Maximize2 } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { StudioSectionHeading } from './home-studio-sections';

import type { HomePresentation, HomeView } from '@dwp-frontend/shared-utils';

const appearanceOptions: readonly {
  value: HomePresentation;
  icon: typeof LayoutDashboard;
}[] = [
  { value: 'focused', icon: Focus },
  { value: 'balanced', icon: LayoutDashboard },
  { value: 'expressive', icon: Maximize2 },
];

export function HomeAppearanceSection({
  view,
  busy,
  onChange,
}: {
  view: HomeView | null;
  busy: boolean;
  onChange: (presentation: HomePresentation) => void;
}) {
  const { t } = useTranslation('homeStudio');
  const selected = view?.layout.presentation ?? 'balanced';

  return (
    <>
      <StudioSectionHeading
        title={t('appearance.title')}
        description={t('appearance.description')}
      />
      <Box
        role="radiogroup"
        aria-label={t('appearance.title')}
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}
      >
        {appearanceOptions.map(({ value, icon: Icon }, optionIndex) => {
          const active = value === selected;
          return (
            <ButtonBase
              key={value}
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-appearance-option={value}
              disabled={busy || !view}
              onClick={() => {
                if (!active) onChange(value);
              }}
              onKeyDown={(event) => {
                const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const lastIndex = appearanceOptions.length - 1;
                const nextIndex =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? lastIndex
                      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? (optionIndex - 1 + appearanceOptions.length) % appearanceOptions.length
                        : (optionIndex + 1) % appearanceOptions.length;
                const next = appearanceOptions[nextIndex];
                const nodes = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
                  '[data-appearance-option]'
                );
                nodes?.[nextIndex]?.focus();
                if (next && next.value !== selected) onChange(next.value);
              }}
              sx={{
                minHeight: 188,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                gap: 1.5,
                border: active ? 2 : 1,
                borderColor: active ? 'primary.main' : 'divider',
                borderRadius: 3,
                textAlign: 'left',
                bgcolor: active ? 'action.selected' : 'background.paper',
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                aria-hidden="true"
                data-appearance-preview={value}
                sx={(theme) => ({
                  width: 1,
                  height: 84,
                  p: 0.75,
                  display: 'flex',
                  alignItems: 'stretch',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: theme.palette.mode === 'dark' ? '#0D131C' : '#F3F5F7',
                })}
              >
                <Box
                  sx={(theme) => ({
                    width: value === 'focused' ? '68%' : value === 'balanced' ? '86%' : '100%',
                    p: value === 'focused' ? 0.75 : 0.5,
                    display: 'grid',
                    gridTemplateColumns: value === 'expressive' ? '1.35fr 1fr 1fr' : '2fr 1fr',
                    gap: value === 'focused' ? 0.5 : 0.75,
                    borderRadius: 1.25,
                    bgcolor: 'background.paper',
                    boxShadow:
                      value === 'focused'
                        ? `0 0 0 1px ${alpha(theme.palette.divider, 0.7)}`
                        : 'none',
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      borderInlineStart: 3,
                      borderColor: 'primary.main',
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                    })}
                  />
                  <Stack gap={0.5}>
                    <Box
                      sx={{ flex: 1, borderRadius: 0.75, bgcolor: 'primary.main', opacity: 0.78 }}
                    />
                    <Box sx={{ flex: 1, borderRadius: 0.75, bgcolor: 'action.hover' }} />
                  </Stack>
                  {value === 'expressive' && (
                    <Stack gap={0.5}>
                      <Box sx={{ flex: 1, borderRadius: 0.75, bgcolor: 'action.selected' }} />
                      <Box sx={{ flex: 1, borderRadius: 0.75, bgcolor: 'action.hover' }} />
                    </Stack>
                  )}
                </Box>
              </Box>
              <Stack direction="row" alignItems="center" gap={1}>
                <Icon size={18} aria-hidden="true" />
                <Typography component="span" variant="subtitle1" fontWeight={750}>
                  {t(`appearance.options.${value}.title`)}
                </Typography>
                {active && <Check size={17} aria-label={t('appearance.selected')} />}
              </Stack>
              <Typography component="span" variant="body2" color="text.secondary">
                {t(`appearance.options.${value}.description`)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
      <Alert severity="info" sx={{ mt: 3 }}>
        {t('appearance.safety')}
      </Alert>
    </>
  );
}
