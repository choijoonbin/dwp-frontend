import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Pencil,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HomeAudienceProfile, HomeBackgroundPosition } from '@dwp-frontend/shared-utils';
import type { FlowHomeHealth, FlowHomeHealthDomain, FlowHomeHealthIssue } from './flow-home-health';

type FlowHomeContextMetrics = Readonly<{
  action: number;
  timeline: number;
  response: number;
}>;

type FlowHomeContextProps = {
  audience: HomeAudienceProfile;
  currentDate: string;
  headline: string;
  subheadline: string;
  updatedAt: string;
  backgroundPosition: HomeBackgroundPosition;
  health: FlowHomeHealth;
  metrics: FlowHomeContextMetrics;
  editing: boolean;
  customizationEnabled: boolean;
  customizationBusy: boolean;
  compact?: boolean;
  priorityCompact?: boolean;
  onEdit?: () => void;
  onOpenStudio?: () => void;
  onRetry: () => void;
};

function healthDomainLabel(domain: FlowHomeHealthDomain, t: TFunction<'home'>): string {
  return t(`flow.context.domains.${domain}`);
}

function issueLabel(issue: FlowHomeHealthIssue, t: TFunction<'home'>): string {
  const domain = healthDomainLabel(issue.domain, t);
  if (issue.state === 'DELAYED') {
    return t('flow.context.health.detailDelayed', { domain, count: issue.lagMinutes ?? 1 });
  }
  if (issue.state === 'PARTIAL') return t('flow.context.health.detailPartial', { domain });
  return t('flow.context.health.detailUnavailable', { domain });
}

function healthMessage(health: FlowHomeHealth, t: TFunction<'home'>): string {
  if (health.state === 'UNAVAILABLE') return t('flow.context.health.overviewUnavailable');
  const [firstIssue] = health.issues;
  if (!firstIssue) return t('flow.context.health.refreshing');
  const domain = healthDomainLabel(firstIssue.domain, t);
  if (health.issues.length === 1) {
    if (firstIssue.state === 'DELAYED') {
      return t('flow.context.health.singleDelayed', {
        domain,
        count: firstIssue.lagMinutes ?? 1,
      });
    }
    if (firstIssue.state === 'PARTIAL') return t('flow.context.health.singlePartial', { domain });
    return t('flow.context.health.singleUnavailable', { domain });
  }
  const visibleDomains = health.issues
    .slice(0, 2)
    .map((issue) => healthDomainLabel(issue.domain, t))
    .join('·');
  const remaining = Math.max(0, health.issues.length - 2);
  return remaining > 0
    ? t('flow.context.health.multipleWithMore', { domains: visibleDomains, count: remaining })
    : t('flow.context.health.multiple', { domains: visibleDomains });
}

export function FlowHomeContext({
  audience,
  currentDate,
  headline,
  subheadline,
  updatedAt,
  backgroundPosition,
  health,
  metrics,
  editing,
  customizationEnabled,
  customizationBusy,
  compact = false,
  priorityCompact = false,
  onEdit,
  onOpenStudio,
  onRetry,
}: FlowHomeContextProps) {
  const { t } = useTranslation('home');
  const [editAnchor, setEditAnchor] = useState<HTMLElement | null>(null);
  const [healthAnchor, setHealthAnchor] = useState<HTMLElement | null>(null);
  const copyOnRight = backgroundPosition === 'LEFT' && !compact;
  const degraded =
    health.state === 'DELAYED' || health.state === 'PARTIAL' || health.state === 'UNAVAILABLE';
  const metricItems = [
    { key: 'action', value: metrics.action, icon: ListTodo },
    { key: 'timeline', value: metrics.timeline, icon: CalendarRange },
    { key: 'response', value: metrics.response, icon: Inbox },
  ] as const;
  const canEditLayout = customizationEnabled && Boolean(onEdit);
  const hasEditHub = canEditLayout || Boolean(onOpenStudio);

  return (
    <Box
      component="header"
      data-testid="flow-home-context"
      data-flow-context-side={copyOnRight ? 'right' : 'left'}
      sx={{
        position: 'relative',
        width: 1,
        minWidth: 0,
        px: compact ? 0.5 : { xs: 0.5, md: 0 },
        py: compact ? 0.25 : { xs: 0.25, md: 0.5 },
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(12, minmax(0, 1fr))' },
        columnGap: { md: 2 },
        rowGap: { xs: 0.75, sm: 1 },
        alignItems: 'center',
        color: '#F8FAFC',
        '@media (forced-colors: active)': { color: 'CanvasText' },
      }}
    >
      <Box
        data-flow-context-copy
        sx={{
          minWidth: 0,
          gridColumn: copyOnRight ? { xs: '1', md: '6 / 13' } : { xs: '1', md: '1 / 8' },
          gridRow: { md: '1' },
          justifySelf: copyOnRight ? { md: 'end' } : 'start',
          textAlign: copyOnRight ? { md: 'right' } : 'left',
          textShadow: '0 2px 12px rgba(0,0,0,0.38)',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={copyOnRight ? { md: 'flex-end' } : 'flex-start'}
          gap={1}
          flexWrap="wrap"
          sx={{ display: priorityCompact ? 'none' : 'flex' }}
        >
          <Typography
            variant="overline"
            fontWeight={700}
            sx={{ color: 'rgba(248,250,252,0.84)', letterSpacing: '0.035em', lineHeight: 1.4 }}
          >
            {currentDate}
          </Typography>
          <Chip
            size="small"
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            label={t(`dayRail.audience.${audience.toLowerCase()}`)}
            variant="outlined"
            sx={{
              color: '#F8FAFC',
              bgcolor: 'rgba(5,15,35,0.46)',
              borderColor: 'rgba(255,255,255,0.4)',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          {editing && (
            <Chip
              size="small"
              label={t('flow.context.editing')}
              sx={{ color: '#07111F', bgcolor: '#E9F0FF', fontWeight: 700 }}
            />
          )}
        </Stack>
        <Typography
          component="h1"
          sx={{
            mt: 0.25,
            maxWidth: 880,
            fontSize: compact ? 24 : { xs: 25, sm: 26, md: 28, lg: 30, xl: 32 },
            fontWeight: 720,
            lineHeight: 1.08,
            letterSpacing: '-0.022em',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
          }}
        >
          {headline}
        </Typography>
        <Typography
          data-flow-context-description
          variant="body2"
          sx={{
            mt: 0.35,
            maxWidth: 780,
            color: 'rgba(248,250,252,0.84)',
            lineHeight: 1.35,
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            display: priorityCompact ? 'none' : '-webkit-box',
            overflow: 'hidden',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {subheadline}
        </Typography>
      </Box>

      <Box
        component="ul"
        data-flow-context-metrics
        aria-label={t('flow.context.metrics.label')}
        sx={{
          p: 0,
          m: 0,
          listStyle: 'none',
          minWidth: 0,
          gridColumn: copyOnRight ? { xs: '1', md: '6 / 13' } : { xs: '1', md: '1 / 8' },
          gridRow: { md: '2' },
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 0.75,
          maxWidth: 680,
          width: 1,
          justifySelf: copyOnRight ? { md: 'end' } : 'start',
          '& > :last-child': { gridColumn: { xs: '1 / -1', sm: 'auto' } },
        }}
      >
        {metricItems.map(({ key, value, icon: Icon }) => (
          <Box
            component="li"
            key={key}
            data-flow-context-metric={key}
            sx={{
              minWidth: 0,
              minHeight: 44,
              px: 1,
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 2.5,
              bgcolor: 'rgba(3,12,28,0.52)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              '@media (prefers-reduced-transparency: reduce)': {
                bgcolor: '#10284D',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
              '@media (forced-colors: active)': {
                bgcolor: 'Canvas',
                borderColor: 'CanvasText',
              },
            }}
          >
            <Icon size={16} aria-hidden="true" />
            <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography component="span" sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>
                {formatNumber(value)}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                sx={{ color: 'rgba(248,250,252,0.76)', whiteSpace: 'nowrap' }}
              >
                {t(`flow.context.metrics.${key}`)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Stack
        data-flow-context-controls
        direction="row"
        alignItems="center"
        justifyContent={copyOnRight ? { md: 'flex-start' } : { md: 'flex-end' }}
        gap={0.75}
        flexWrap="wrap"
        sx={{
          minWidth: 0,
          gridColumn: copyOnRight ? { xs: '1', md: '1 / 6' } : { xs: '1', md: '8 / 13' },
          gridRow: { md: '1 / span 2' },
          justifySelf: { xs: 'stretch', md: copyOnRight ? 'start' : 'end' },
          alignSelf: { md: 'center' },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={0.65}
          sx={{ minHeight: 44, color: 'rgba(248,250,252,0.82)' }}
          role="status"
          aria-live="polite"
        >
          {health.state === 'REFRESHING' ? (
            <CircularProgress size={14} thickness={5} color="inherit" aria-hidden="true" />
          ) : (
            <Clock3 size={15} aria-hidden="true" />
          )}
          <Typography variant="caption">
            {health.state === 'REFRESHING'
              ? t('flow.context.health.refreshing')
              : t('flow.context.updated', { time: updatedAt })}
          </Typography>
        </Stack>
        {!editing && hasEditHub && (
          <Box
            data-home-edit-hub
            sx={{
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'stretch',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: 2,
              bgcolor: 'rgba(3,12,28,0.42)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
              '@media (forced-colors: active)': {
                color: 'CanvasText',
                bgcolor: 'Canvas',
                borderColor: 'CanvasText',
              },
            }}
          >
            <ActionButton
              data-home-edit-trigger
              intent="quiet"
              size="small"
              startIcon={<Pencil size={15} aria-hidden="true" />}
              onClick={canEditLayout ? onEdit : onOpenStudio}
              disabled={customizationBusy}
              aria-label={t('flow.context.editHub')}
              title={t('flow.context.editHub')}
              sx={{
                minHeight: 44,
                color: '#F8FAFC',
                border: 0,
                borderRadius: canEditLayout && onOpenStudio ? '7px 0 0 7px' : 1.75,
                bgcolor: 'transparent',
                '&:focus-visible': { outline: '2px solid #93C5FD', outlineOffset: -2 },
                '@media (forced-colors: active)': { color: 'CanvasText' },
              }}
            >
              {t('flow.context.editHub')}
            </ActionButton>
            {canEditLayout && onOpenStudio && (
              <ButtonBase
                onClick={(event) => setEditAnchor(event.currentTarget)}
                disabled={customizationBusy}
                aria-haspopup="menu"
                aria-expanded={editAnchor ? 'true' : undefined}
                aria-label={t('flow.context.editOptions')}
                title={t('flow.context.editOptions')}
                sx={{
                  minWidth: 44,
                  minHeight: 44,
                  color: '#F8FAFC',
                  borderInlineStart: '1px solid rgba(255,255,255,0.28)',
                  borderRadius: '0 7px 7px 0',
                  '&:focus-visible': { outline: '2px solid #93C5FD', outlineOffset: -2 },
                  '@media (forced-colors: active)': { color: 'CanvasText' },
                }}
              >
                <ChevronDown size={15} aria-hidden="true" />
              </ButtonBase>
            )}
          </Box>
        )}
      </Stack>

      {degraded && (
        <Box
          data-flow-health-strip
          data-flow-health-state={health.state.toLowerCase()}
          data-flow-health-domains={health.issues.map((issue) => issue.domain).join(',')}
          role="status"
          aria-live="polite"
          sx={{
            minWidth: 0,
            gridColumn: '1 / -1',
            minHeight: 44,
            px: 0.75,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            border: '1px solid rgba(255,211,138,0.42)',
            borderRadius: 2.5,
            bgcolor: 'rgba(52,31,5,0.7)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            '@media (prefers-reduced-transparency: reduce)': {
              bgcolor: '#3B2608',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            },
            '@media (forced-colors: active)': {
              bgcolor: 'Canvas',
              borderColor: 'CanvasText',
            },
          }}
        >
          <ButtonBase
            onClick={(event) => setHealthAnchor(event.currentTarget)}
            aria-label={t('flow.context.health.openDetails')}
            aria-controls={healthAnchor ? 'flow-home-health-details' : undefined}
            aria-expanded={healthAnchor ? 'true' : undefined}
            sx={{
              minWidth: 0,
              width: 1,
              minHeight: 44,
              flex: '1 1 auto',
              overflow: 'hidden',
              px: 0.5,
              justifyContent: 'flex-start',
              gap: 0.75,
              borderRadius: 2,
              color: '#FFF3D6',
              textAlign: 'left',
              '&:focus-visible': { outline: '2px solid #FDE68A', outlineOffset: 1 },
              '@media (forced-colors: active)': { color: 'CanvasText' },
            }}
          >
            <AlertTriangle size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
            <Typography
              variant="caption"
              sx={{
                minWidth: 0,
                flex: '1 1 auto',
                fontWeight: 650,
                wordBreak: 'keep-all',
                textAlign: 'left',
              }}
            >
              {healthMessage(health, t)}
            </Typography>
            <ChevronDown size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
          </ButtonBase>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={
              health.refreshing ? (
                <CircularProgress size={14} thickness={5} color="inherit" aria-hidden="true" />
              ) : (
                <RefreshCw size={14} aria-hidden="true" />
              )
            }
            onClick={onRetry}
            disabled={health.refreshing}
            aria-busy={health.refreshing ? 'true' : undefined}
            aria-label={t('flow.context.health.retry')}
            title={t('flow.context.health.retry')}
            sx={{
              minWidth: 44,
              minHeight: 44,
              flex: '0 0 auto',
              color: '#FFF8E7',
              '@media (forced-colors: active)': { color: 'CanvasText' },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
              {t('flow.context.health.retry')}
            </Box>
          </ActionButton>
        </Box>
      )}

      <Menu
        anchorEl={editAnchor}
        open={Boolean(editAnchor)}
        onClose={() => setEditAnchor(null)}
        MenuListProps={{ 'aria-label': t('flow.context.editHub') }}
      >
        {canEditLayout && (
          <MenuItem
            data-home-edit-layout
            onClick={() => {
              setEditAnchor(null);
              onEdit?.();
            }}
          >
            <ListItemIcon>
              <LayoutDashboard size={18} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText
              primary={t('flow.context.editLayout')}
              secondary={t('flow.context.editLayoutDescription')}
            />
          </MenuItem>
        )}
        {onOpenStudio && (
          <MenuItem
            data-home-edit-settings
            onClick={() => {
              setEditAnchor(null);
              onOpenStudio();
            }}
          >
            <ListItemIcon>
              <SlidersHorizontal size={18} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText
              primary={t('flow.context.editSettings')}
              secondary={t('flow.context.editSettingsDescription')}
            />
          </MenuItem>
        )}
      </Menu>

      <Popover
        id="flow-home-health-details"
        anchorEl={healthAnchor}
        open={Boolean(healthAnchor)}
        onClose={() => setHealthAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'region',
            'aria-label': t('flow.context.health.details'),
            sx: { minWidth: 320, maxWidth: 'min(420px, calc(100vw - 24px))' },
          },
        }}
      >
        <List disablePadding aria-label={t('flow.context.health.details')}>
          <ListItem sx={{ py: 1, alignItems: 'flex-start' }}>
            <ListItemIcon>
              <CheckCircle2 size={18} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText
              primary={t('flow.context.health.availableApps')}
              secondary={t('flow.context.health.asOf', { time: updatedAt })}
            />
          </ListItem>
          {health.issues.map((issue) => (
            <ListItem
              key={`${issue.domain}-${issue.state}`}
              sx={{ py: 1, alignItems: 'flex-start' }}
            >
              <ListItemIcon>
                <AlertTriangle size={18} aria-hidden="true" />
              </ListItemIcon>
              <ListItemText
                primary={healthDomainLabel(issue.domain, t)}
                secondary={issueLabel(issue, t)}
              />
            </ListItem>
          ))}
        </List>
      </Popover>
    </Box>
  );
}
