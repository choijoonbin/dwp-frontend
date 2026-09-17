import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import type { NormalizedHomeContribution } from '../contributions';
import {
  HOME_WORK_FILTERS,
  homeWorkActionFilterCounts,
  type HomeWorkActionCta,
  type HomeWorkFilter,
} from './home-work-action-policy';

export function HomeWorkActionCtaCue({
  cta,
  label,
  featuredCue,
}: Readonly<{
  cta: HomeWorkActionCta;
  label: string;
  featuredCue: boolean;
}>) {
  return (
    <Box
      component="span"
      data-home-work-cta={cta}
      sx={{
        minHeight: 36,
        px: 1.25,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        justifySelf: 'end',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 'var(--home-radius-item)',
        color: 'primary.main',
        bgcolor: 'background.paper',
        fontSize: foundationTokens.workplace.typography.label.fontSize,
        fontWeight: foundationTokens.workplace.typography.pageTitle.fontWeight,
        lineHeight: foundationTokens.workplace.typography.label.lineHeight,
        whiteSpace: 'nowrap',
        '@container home-purpose-widget (max-width: 520px)': {
          gridColumn: featuredCue ? '3 / -1' : '2 / -1',
          justifySelf: 'end',
          mt: 0.25,
        },
        "[data-flow-large-text='true'] &": {
          minHeight: 44,
          whiteSpace: 'normal',
          textAlign: 'start',
        },
        '@media (forced-colors: active)': {
          color: 'LinkText',
          borderColor: 'LinkText',
          bgcolor: 'Canvas',
          forcedColorAdjust: 'none',
        },
      }}
    >
      {label}
      <ArrowRight size={14} aria-hidden="true" />
    </Box>
  );
}

export function HomeWorkActionFilterTabs({
  items,
  value,
  onChange,
}: Readonly<{
  items: readonly NormalizedHomeContribution[];
  value: HomeWorkFilter;
  onChange: (value: HomeWorkFilter) => void;
}>) {
  const { t } = useTranslation('home');
  const counts = homeWorkActionFilterCounts(items);
  return (
    <Box
      sx={{
        mt: 0.75,
        mx: -0.5,
        minWidth: 0,
        "[data-workspace-widget-content-state='editing-preview'] &": { display: 'none' },
      }}
    >
      <Tabs
        value={value}
        onChange={(_event, nextValue) => onChange(nextValue as HomeWorkFilter)}
        aria-label={t('flow.purpose.action.filters.label')}
        variant="scrollable"
        scrollButtons={false}
        allowScrollButtonsMobile
        data-home-work-filters
        sx={{
          minHeight: 44,
          borderBlockEnd: 1,
          borderColor: 'divider',
          '& .MuiTabs-flexContainer': { gap: 0.25 },
          '& .MuiTab-root': {
            minWidth: 'max-content',
            minHeight: 44,
            px: 1.25,
            py: 0.5,
            textTransform: 'none',
            color: 'text.secondary',
            fontSize: foundationTokens.workplace.typography.label.fontSize,
            fontWeight: foundationTokens.workplace.typography.pageTitle.fontWeight,
          },
          '& .Mui-selected': { color: 'primary.main' },
          '& .MuiTabs-indicator': { height: 3 },
          '@container home-purpose-widget (max-width: 420px)': {
            minHeight: 56,
            '& .MuiTabs-scroller': { overflow: 'visible !important' },
            '& .MuiTabs-flexContainer': {
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 0,
            },
            '& .MuiTab-root': { minWidth: 0, width: '100%', minHeight: 56, px: 0.25 },
            '& [data-home-work-filter-label]': {
              width: '100%',
              flexDirection: 'column',
              gap: 0.1,
              lineHeight: foundationTokens.workplace.typography.label.lineHeight,
              whiteSpace: 'normal',
              wordBreak: 'keep-all',
            },
            '& .MuiTabs-indicator': { display: 'none' },
            '& .Mui-selected': {
              borderBlockEnd: 3,
              borderBlockEndColor: 'currentColor',
            },
          },
          '@media (forced-colors: active)': {
            borderColor: 'CanvasText',
            '& .MuiTabs-indicator': { backgroundColor: 'Highlight' },
            '& .Mui-selected': { outline: '2px solid Highlight', outlineOffset: -2 },
          },
        }}
      >
        {HOME_WORK_FILTERS.map((filter) => {
          const label = t(`flow.purpose.action.filters.${filter}`);
          const count = counts[filter];
          return (
            <Tab
              key={filter}
              id={`flow-purpose-action-filter-${filter}`}
              aria-controls="flow-purpose-action-filter-panel"
              aria-label={t('flow.purpose.action.filters.tabLabel', { label, count })}
              value={filter}
              label={
                <Stack
                  component="span"
                  direction="row"
                  alignItems="center"
                  gap={0.6}
                  data-home-work-filter-label
                >
                  <Box component="span">{label}</Box>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      minWidth: 20,
                      px: 0.55,
                      py: 0.1,
                      borderRadius: foundationTokens.radius.surface * 125 + 'px',
                      bgcolor: 'action.selected',
                      color: 'text.primary',
                      fontSize: foundationTokens.workplace.typography.caption.fontSize,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: foundationTokens.workplace.typography.caption.lineHeight,
                      '@media (forced-colors: active)': {
                        border: '1px solid CanvasText',
                        bgcolor: 'Canvas',
                      },
                    }}
                  >
                    {count}
                  </Box>
                </Stack>
              }
            />
          );
        })}
      </Tabs>
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          p: 0,
          m: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {t('flow.purpose.action.filters.resultCount', {
          label: t(`flow.purpose.action.filters.${value}`),
          count: counts[value],
        })}
      </Box>
    </Box>
  );
}

export function HomePurposeAllRouteButton({
  sectionKey,
  route,
  overflow,
}: Readonly<{
  sectionKey: 'action' | 'timeline' | 'response' | 'request' | 'pulse';
  route: string;
  overflow: number;
}>) {
  const { t } = useTranslation('home');
  const workHub = sectionKey === 'action' && route === '/work/queue';
  const label = workHub
    ? t('flow.purpose.action.openWorkHub')
    : overflow > 0
      ? t('flow.purpose.viewAllWithCount', { count: overflow })
      : t('flow.viewAll');
  return (
    <ActionButton
      component={Link}
      to={route}
      intent="quiet"
      size="small"
      endIcon={<ArrowRight size={15} aria-hidden="true" />}
      aria-label={label}
      data-home-purpose-all-route={sectionKey}
      sx={{
        minHeight: 44,
        px: 1,
        whiteSpace: 'nowrap',
        borderColor: 'transparent',
        bgcolor: 'transparent',
        '@container home-purpose-widget (max-width: 520px)': {
          px: 0.5,
          fontSize: foundationTokens.workplace.typography.label.fontSize,
        },
      }}
    >
      {label}
    </ActionButton>
  );
}
