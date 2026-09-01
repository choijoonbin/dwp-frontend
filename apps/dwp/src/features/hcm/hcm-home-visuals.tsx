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
