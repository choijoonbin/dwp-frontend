import { ChevronRight } from 'lucide-react';
import { PageCanvas, SectionHeader } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Theme } from '@mui/material/styles';

export type CalendarCanvasArchetype =
  'temporal' | 'command' | 'queue' | 'coach' | 'policy' | 'master-detail';

export function CalendarCanvas({
  archetype,
  children,
  topInset = 'standard',
}: {
  archetype: CalendarCanvasArchetype;
  children: ReactNode;
  topInset?: 'standard' | 'compact';
}) {
  return (
    <PageCanvas topInset={topInset}>
      <Box data-calendar-canvas={archetype} sx={{ width: 1, minWidth: 0 }}>
        {children}
      </Box>
    </PageCanvas>
  );
}

export type CalendarExperienceTone =
  'primary' | 'info' | 'success' | 'warning' | 'error' | 'neutral';

function toneColor(theme: Theme, tone: CalendarExperienceTone) {
  return tone === 'neutral' ? theme.palette.text.secondary : theme.palette[tone].main;
}

export function CalendarSignal({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'primary',
  progress,
  progressLabel,
  selected,
  compact = false,
  onClick,
  actionLabel,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: LucideIcon;
  tone?: CalendarExperienceTone;
  progress?: number;
  progressLabel?: string;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const safeProgress =
    progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(progress)));
  const isSelected = selected ?? false;
  const valueText = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const accessibleLabel = [label, valueText, detail, actionLabel]
    .filter((part, index, values) => Boolean(part) && values.indexOf(part) === index)
    .join('. ');
  const content = (
    <Box
      sx={{
        minWidth: 0,
        width: 1,
        p: compact ? { xs: 1.35, sm: 1.5 } : { xs: 1.75, md: 2 },
        textAlign: 'left',
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.25}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ display: 'block', letterSpacing: '0.01em' }}
          >
            {label}
          </Typography>
          <Typography
            component="p"
            sx={{
              mt: 0.35,
              fontSize: compact ? { xs: '1.35rem', md: '1.5rem' } : { xs: '1.6rem', md: '1.85rem' },
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </Typography>
        </Box>
        <Box
          aria-hidden="true"
          sx={(theme) => {
            const color = toneColor(theme, tone);
            return {
              width: compact ? 32 : 38,
              height: compact ? 32 : 38,
              flex: `0 0 ${compact ? 32 : 38}px`,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 0.75,
              color,
              bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.2 : 0.1),
              '@media (forced-colors: active)': {
                border: '1px solid CanvasText',
                backgroundColor: 'Canvas',
                color: 'CanvasText',
              },
            };
          }}
        >
          <Icon size={compact ? 16 : 18} strokeWidth={1.9} />
        </Box>
      </Stack>
      <Stack
        direction="row"
        alignItems="flex-end"
        justifyContent="space-between"
        gap={1}
        sx={{ mt: 1 }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', lineHeight: 1.45 }}
        >
          {detail}
        </Typography>
        {onClick && <ChevronRight size={15} aria-hidden="true" />}
      </Stack>
      {safeProgress !== undefined && (
        <Box sx={{ mt: 1.25 }}>
          <Box
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safeProgress}
            aria-label={progressLabel ?? label}
            sx={(theme) => ({
              height: 6,
              overflow: 'hidden',
              borderRadius: 999,
              bgcolor: alpha(toneColor(theme, tone), theme.palette.mode === 'dark' ? 0.2 : 0.12),
              '@media (forced-colors: active)': {
                border: '1px solid CanvasText',
                backgroundColor: 'Canvas',
              },
            })}
          >
            <Box
              sx={(theme) => ({
                width: `${safeProgress}%`,
                height: 1,
                borderRadius: 999,
                bgcolor: toneColor(theme, tone),
                transition: theme.transitions.create('width', {
                  duration: theme.transitions.duration.shorter,
                }),
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                '@media (forced-colors: active)': { backgroundColor: 'Highlight' },
              })}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
  const surfaceSx = (theme: Theme) => {
    const color = toneColor(theme, tone);
    return {
      width: 1,
      minWidth: 0,
      height: 1,
      display: 'block',
      position: 'relative',
      overflow: 'hidden',
      border: 1,
      borderColor: isSelected ? alpha(color, 0.52) : alpha(theme.palette.divider, 0.72),
      borderRadius: 1.25,
      color: 'text.primary',
      bgcolor: isSelected
        ? alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055)
        : 'background.paper',
      boxShadow: 'none',
      transition: theme.transitions.create(['background-color', 'border-color'], {
        duration: theme.transitions.duration.shorter,
      }),
      '&::before': {
        content: '""',
        position: 'absolute',
        insetInlineStart: 0,
        top: 12,
        bottom: 12,
        width: 3,
        borderRadius: '0 999px 999px 0',
        bgcolor: alpha(color, 0.74),
      },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      '@media (forced-colors: active)': {
        borderColor: 'CanvasText',
        backgroundColor: 'Canvas',
        backgroundImage: 'none',
        outline: isSelected ? '2px solid Highlight' : 'none',
        outlineOffset: -2,
        '&::before': { backgroundColor: 'Highlight' },
      },
    };
  };

  if (!onClick) return <Box sx={surfaceSx}>{content}</Box>;
  return (
    <ButtonBase
      aria-label={accessibleLabel}
      aria-pressed={selected === undefined ? undefined : selected}
      onClick={onClick}
      sx={(theme) => ({
        ...surfaceSx(theme),
        '&:hover': {
          borderColor: alpha(toneColor(theme, tone), 0.62),
          bgcolor: alpha(toneColor(theme, tone), theme.palette.mode === 'dark' ? 0.1 : 0.045),
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      })}
    >
      {content}
    </ButtonBase>
  );
}

export function CalendarRecommendationRow({
  label,
  title,
  description,
  icon: Icon,
  tone = 'primary',
  onClick,
  actionLabel,
}: {
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone?: CalendarExperienceTone;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const accessibleLabel = [label, title, description, actionLabel].filter(Boolean).join('. ');
  const content = (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: 1, minWidth: 0, p: 2 }}>
      <Box
        aria-hidden="true"
        sx={(theme) => {
          const color = toneColor(theme, tone);
          return {
            width: 38,
            height: 38,
            flex: '0 0 38px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            color,
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.18 : 0.09),
            '@media (forced-colors: active)': {
              border: '1px solid CanvasText',
              color: 'CanvasText',
              backgroundColor: 'Canvas',
            },
          };
        }}
      >
        <Icon size={18} strokeWidth={1.9} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Typography fontWeight={700} sx={{ mt: 0.25 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, lineHeight: 1.55 }}>
          {description}
        </Typography>
      </Box>
      {onClick && (
        <Stack direction="row" spacing={0.5} alignItems="center" color="primary.main">
          {actionLabel && (
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}
            >
              {actionLabel}
            </Typography>
          )}
          <ChevronRight size={17} aria-hidden="true" />
        </Stack>
      )}
    </Stack>
  );
  const surfaceSx = (theme: Theme) => ({
    width: 1,
    minWidth: 0,
    display: 'block',
    color: 'text.primary',
    textAlign: 'left',
    transition: theme.transitions.create(['background-color', 'transform'], {
      duration: theme.transitions.duration.shorter,
    }),
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    '@media (forced-colors: active)': {
      color: 'CanvasText',
      backgroundColor: 'Canvas',
    },
  });

  if (!onClick) return <Box sx={surfaceSx}>{content}</Box>;
  return (
    <ButtonBase
      aria-label={accessibleLabel}
      onClick={onClick}
      sx={(theme) => ({
        ...surfaceSx(theme),
        '&:hover': {
          bgcolor: alpha(toneColor(theme, tone), theme.palette.mode === 'dark' ? 0.11 : 0.045),
          transform: 'translateX(2px)',
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      })}
    >
      {content}
    </ButtonBase>
  );
}

export type CalendarWeekBalanceDay = Readonly<{
  key: string;
  label: string;
  meetingMinutes: number;
  focusMinutes: number;
  loadPercent: number;
}>;

export function CalendarWeekBalanceRail({
  days,
  meetingLabel,
  focusLabel,
  utilizationLabel,
}: {
  days: readonly CalendarWeekBalanceDay[];
  meetingLabel: string;
  focusLabel: string;
  utilizationLabel: (day: CalendarWeekBalanceDay) => string;
}) {
  const maximum = Math.max(
    480,
    ...days.map((day) => Math.max(0, day.meetingMinutes) + Math.max(0, day.focusMinutes))
  );
  return (
    <Box>
      <Stack component="ul" spacing={1.35} sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {days.map((day) => {
          const meetingWidth = (Math.max(0, day.meetingMinutes) * 100) / maximum;
          const focusWidth = (Math.max(0, day.focusMinutes) * 100) / maximum;
          return (
            <Box
              component="li"
              key={day.key}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '72px minmax(0, 1fr)',
                  sm: '96px minmax(0, 1fr) auto',
                },
                columnGap: 1.25,
                rowGap: 0.4,
                alignItems: 'center',
              }}
            >
              <Typography variant="body2" fontWeight={600} noWrap>
                {day.label}
              </Typography>
              <Box
                role="img"
                aria-label={`${day.label}, ${utilizationLabel(day)}, ${meetingLabel} ${day.meetingMinutes}, ${focusLabel} ${day.focusMinutes}`}
                sx={(theme) => ({
                  height: 10,
                  display: 'flex',
                  overflow: 'hidden',
                  borderRadius: 999,
                  bgcolor: alpha(theme.palette.text.secondary, 0.1),
                  outline: day.loadPercent > 100 ? `1px solid ${theme.palette.error.main}` : 'none',
                  outlineOffset: 2,
                  '@media (forced-colors: active)': {
                    border: '1px solid CanvasText',
                    backgroundColor: 'Canvas',
                    outlineColor: day.loadPercent > 100 ? 'Highlight' : 'CanvasText',
                  },
                })}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    width: `${meetingWidth}%`,
                    bgcolor: 'primary.main',
                    '@media (forced-colors: active)': { backgroundColor: 'Highlight' },
                  }}
                />
                <Box
                  aria-hidden="true"
                  sx={{
                    width: `${focusWidth}%`,
                    bgcolor: 'success.main',
                    '@media (forced-colors: active)': { backgroundColor: 'CanvasText' },
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                color={day.loadPercent > 100 ? 'error.main' : 'text.secondary'}
                fontWeight={600}
                sx={{ gridColumn: { xs: '2', sm: 'auto' }, fontVariantNumeric: 'tabular-nums' }}
              >
                {utilizationLabel(day)}
              </Typography>
            </Box>
          );
        })}
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mt: 1.35, pl: { xs: '84px', sm: '108px' } }}>
        {[
          [meetingLabel, 'primary.main'],
          [focusLabel, 'success.main'],
        ].map(([label, color]) => (
          <Stack key={label} direction="row" spacing={0.6} alignItems="center">
            <Box
              aria-hidden="true"
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }}
            />
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export function CalendarSectionHeader({
  icon,
  title,
  description,
  meta,
  action,
  id,
  padded = true,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  id?: string;
  padded?: boolean;
}) {
  const headerMeta = action ? (
    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
      {meta}
      {action}
    </Stack>
  ) : (
    meta
  );
  return (
    <Box sx={padded ? { px: { xs: 2, md: 2.5 }, py: { xs: 1.75, md: 2 } } : undefined}>
      <SectionHeader id={id} icon={icon} title={title} meta={headerMeta} />
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.6, ml: { xs: 0, sm: 4.75 }, maxWidth: 760, lineHeight: 1.55 }}
        >
          {description}
        </Typography>
      )}
    </Box>
  );
}
