import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export type HcmVisualTone = 'teal' | 'blue' | 'violet' | 'coral' | 'amber';

export const hcmToneColor: Record<HcmVisualTone, string> = {
  teal: '#0B756B',
  blue: '#2458B8',
  violet: '#7656C7',
  coral: '#B23A55',
  amber: '#854600',
};

export function HcmSectionSurface({
  eyebrow,
  title,
  meta,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={(theme) => ({
        minWidth: 0,
        height: '100%',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? alpha('#FFFFFF', 0.11) : '#DEE7E5',
        borderRadius: 1,
        bgcolor: 'background.paper',
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 10px 28px rgba(0,0,0,0.14)'
            : '0 8px 24px rgba(33, 67, 61, 0.055)',
      })}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={2}
        sx={{ px: { xs: 2, md: 2.4 }, pt: 2.2, pb: 1.35 }}
      >
        <Box minWidth={0}>
          {eyebrow && (
            <Typography
              variant="overline"
              sx={{ color: 'var(--dwp-product-accent)', fontWeight: 780 }}
            >
              {eyebrow}
            </Typography>
          )}
          <Typography component="h2" variant="h6" fontWeight={780}>
            {title}
          </Typography>
          {meta && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {meta}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

export function HcmActionTile({
  icon: Icon,
  label,
  description,
  tone,
  featured = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  tone: HcmVisualTone;
  featured?: boolean;
  onClick: () => void;
}) {
  const color = hcmToneColor[tone];

  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      sx={(theme) => ({
        minHeight: { xs: 92, md: 104 },
        p: { xs: 1.4, md: 1.65 },
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 1.25,
        textAlign: 'left',
        borderRadius: 2,
        border: '1px solid',
        borderColor:
          theme.palette.mode === 'dark'
            ? alpha(color, featured ? 0.46 : 0.22)
            : alpha(color, featured ? 0.26 : 0.12),
        bgcolor:
          theme.palette.mode === 'dark'
            ? alpha(color, featured ? 0.2 : 0.09)
            : alpha(color, featured ? 0.095 : 0.035),
        transition: theme.transitions.create(['transform', 'box-shadow', 'background-color'], {
          duration: 180,
        }),
        '&:hover': {
          transform: 'translateY(-3px)',
          bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.28 : 0.12),
          boxShadow: `0 12px 26px ${alpha(color, 0.14)}`,
        },
        '&:focus-visible': {
          outline: `3px solid ${color}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
      })}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 42,
          height: 42,
          flex: '0 0 42px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1.5,
          color: featured ? '#FFFFFF' : color,
          bgcolor: featured ? color : alpha(color, 0.12),
          boxShadow: featured ? `0 8px 18px ${alpha(color, 0.22)}` : 'none',
        }}
      >
        <Icon size={20} strokeWidth={1.9} />
      </Box>
      <Box minWidth={0} flex={1}>
        <Typography variant="body2" fontWeight={760} sx={{ lineHeight: 1.35 }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.45, display: 'block', lineHeight: 1.45 }}
        >
          {description}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

export function HcmProgressRing({
  value,
  label,
  caption,
  tone = 'teal',
  size = 112,
  inverse = false,
}: {
  value: number;
  label: string;
  caption: string;
  tone?: HcmVisualTone;
  size?: number;
  inverse?: boolean;
}) {
  const normalized = Math.max(0, Math.min(100, value));
  const color = hcmToneColor[tone];

  return (
    <Box
      role="meter"
      aria-label={caption}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalized)}
      sx={{
        width: size,
        height: size,
        position: 'relative',
        flex: `0 0 ${size}px`,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        background: inverse
          ? `conic-gradient(#76E0D1 ${normalized * 3.6}deg, rgba(255,255,255,0.16) 0deg)`
          : `conic-gradient(${color} ${normalized * 3.6}deg, ${alpha(color, 0.12)} 0deg)`,
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 9,
          borderRadius: '50%',
          bgcolor: inverse ? '#124B47' : 'background.paper',
        },
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', px: 1 }}>
        <Typography
          component="p"
          sx={{
            color: inverse ? '#FFFFFF' : 'text.primary',
            fontSize: size >= 100 ? '1.35rem' : '1rem',
            lineHeight: 1.1,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: inverse ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}
        >
          {caption}
        </Typography>
      </Box>
    </Box>
  );
}

export function HcmInsightCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  visual,
  footer,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: HcmVisualTone;
  visual?: ReactNode;
  footer?: ReactNode;
  onClick: () => void;
}) {
  const color = hcmToneColor[tone];

  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      sx={(theme) => ({
        width: 1,
        minWidth: 0,
        minHeight: 190,
        height: 1,
        p: { xs: 1.75, md: 2 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        textAlign: 'left',
        overflow: 'hidden',
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(color, theme.palette.mode === 'dark' ? 0.32 : 0.13),
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.14 : 0.045),
        transition: theme.transitions.create(['transform', 'box-shadow', 'border-color'], {
          duration: 180,
        }),
        '&:hover': {
          transform: 'translateY(-3px)',
          borderColor: alpha(color, 0.46),
          boxShadow: `0 15px 34px ${alpha(color, 0.13)}`,
        },
        '&:focus-visible': {
          outline: `3px solid ${color}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
      })}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Box sx={{ display: 'inline-flex', color }}>
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
            </Box>
            <Typography variant="caption" color="text.secondary" fontWeight={680}>
              {label}
            </Typography>
          </Stack>
          <Typography
            component="p"
            sx={{
              mt: 1.1,
              fontSize: { xs: '1.65rem', md: '1.85rem' },
              lineHeight: 1.05,
              fontWeight: 810,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.7, display: 'block' }}>
            {detail}
          </Typography>
        </Box>
        {visual}
      </Stack>
      {footer && <Box sx={{ mt: 2 }}>{footer}</Box>}
    </ButtonBase>
  );
}

export function HcmSegmentBar({
  segments,
  label,
}: {
  segments: Array<{ value: number; color: string }>;
  label: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  );

  return (
    <Stack
      role="img"
      aria-label={label}
      direction="row"
      gap="3px"
      sx={{ height: 7, overflow: 'hidden', borderRadius: 1, bgcolor: 'action.hover' }}
    >
      {segments.map((segment, index) => (
        <Box
          key={`${segment.color}-${index}`}
          sx={{
            width: `${(Math.max(0, segment.value) / total) * 100}%`,
            minWidth: segment.value > 0 ? 3 : 0,
            bgcolor: segment.color,
          }}
        />
      ))}
    </Stack>
  );
}

export function HcmToolLink({
  icon: Icon,
  label,
  description,
  badge,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={(theme) => ({
        width: 1,
        minHeight: 68,
        px: 1.4,
        py: 1.15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.15,
        textAlign: 'left',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        transition: theme.transitions.create(['border-color', 'background-color', 'transform'], {
          duration: 120,
        }),
        '&:hover': {
          borderColor: alpha(hcmToneColor.teal, 0.42),
          bgcolor: alpha(hcmToneColor.teal, theme.palette.mode === 'dark' ? 0.1 : 0.035),
          transform: 'translateY(-1px)',
        },
        '&:focus-visible': {
          outline: `3px solid ${hcmToneColor.teal}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
      })}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 36,
          height: 36,
          flex: '0 0 36px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: hcmToneColor.teal,
          bgcolor: alpha(hcmToneColor.teal, 0.09),
        }}
      >
        <Icon size={18} strokeWidth={1.9} />
      </Box>
      <Box minWidth={0} flex={1}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.7} minWidth={0}>
          <Typography variant="body2" fontWeight={760} sx={{ overflowWrap: 'anywhere' }}>
            {label}
          </Typography>
          {badge && (
            <Chip
              size="small"
              label={badge}
              sx={{
                height: 'auto',
                minHeight: 20,
                fontSize: '0.66rem',
                flex: '0 0 auto',
                '& .MuiChip-label': { py: 0.15 },
              }}
            />
          )}
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.2, display: 'block', lineHeight: 1.4 }}
        >
          {description}
        </Typography>
      </Box>
      <Box component="span" aria-hidden="true" sx={{ color: 'text.secondary', fontSize: 18 }}>
        ›
      </Box>
    </ButtonBase>
  );
}

export function HcmAttentionItem({
  icon: Icon,
  title,
  description,
  value,
  actionLabel,
  priority = 'attention',
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  value: string;
  actionLabel: string;
  priority?: 'critical' | 'attention' | 'routine';
  onClick: () => void;
}) {
  const color =
    priority === 'critical'
      ? hcmToneColor.coral
      : priority === 'routine'
        ? hcmToneColor.blue
        : hcmToneColor.amber;

  return (
    <ButtonBase
      onClick={onClick}
      sx={(theme) => ({
        width: 1,
        minHeight: 78,
        px: { xs: 1.25, sm: 1.5 },
        py: 1.2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        textAlign: 'left',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? alpha(color, 0.34) : alpha(color, 0.2),
        borderLeft: `3px solid ${color}`,
        borderRadius: 1,
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.09 : 0.025),
        transition: theme.transitions.create(['background-color', 'border-color'], {
          duration: 120,
        }),
        '&:hover': {
          bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.16 : 0.065),
          borderColor: alpha(color, 0.42),
        },
        '&:focus-visible': {
          outline: `3px solid ${color}`,
          outlineOffset: 2,
        },
      })}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 38,
          height: 38,
          flex: '0 0 38px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color,
          bgcolor: alpha(color, 0.11),
        }}
      >
        <Icon size={19} strokeWidth={1.9} />
      </Box>
      <Box minWidth={0} flex={1}>
        <Typography variant="body2" fontWeight={780} sx={{ wordBreak: 'keep-all' }}>
          {title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.25, display: 'block', lineHeight: 1.45, wordBreak: 'keep-all' }}
        >
          {description}
        </Typography>
      </Box>
      <Stack alignItems="flex-end" gap={0.45} sx={{ flex: '0 0 auto' }}>
        <Typography variant="caption" fontWeight={780} sx={{ color }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {actionLabel} →
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

export function HcmStageRail({
  label,
  stages,
}: {
  label: string;
  stages: Array<{
    label: string;
    detail: string;
    state: 'completed' | 'current' | 'upcoming';
  }>;
}) {
  return (
    <Box
      component="ol"
      aria-label={label}
      sx={{
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: `repeat(${stages.length}, minmax(0, 1fr))` },
        gap: { xs: 0.8, sm: 0 },
        listStyle: 'none',
      }}
    >
      {stages.map((stage, index) => {
        const completed = stage.state === 'completed';
        const current = stage.state === 'current';
        return (
          <Box
            component="li"
            key={`${stage.label}-${index}`}
            aria-current={current ? 'step' : undefined}
            sx={{
              position: 'relative',
              minWidth: 0,
              pr: { sm: index < stages.length - 1 ? 1 : 0 },
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.8}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 22,
                  height: 22,
                  flex: '0 0 22px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  color: completed || current ? '#FFFFFF' : 'text.secondary',
                  bgcolor: completed
                    ? hcmToneColor.teal
                    : current
                      ? hcmToneColor.blue
                      : 'action.selected',
                  fontSize: '0.69rem',
                  fontWeight: 800,
                }}
              >
                {completed ? '✓' : index + 1}
              </Box>
              {index < stages.length - 1 && (
                <Box
                  aria-hidden="true"
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    position: 'absolute',
                    top: 10,
                    left: 30,
                    right: 7,
                    height: 2,
                    bgcolor: completed ? alpha(hcmToneColor.teal, 0.55) : 'divider',
                  }}
                />
              )}
            </Stack>
            <Typography variant="body2" fontWeight={760} sx={{ mt: 0.8 }}>
              {stage.label}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.15 }}
            >
              {stage.detail}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
