import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  Pencil,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { HomeAudienceProfile, HomeContentAlignment } from '@dwp-frontend/shared-utils';
import type { FlowHomeHealth, FlowHomeHealthDomain, FlowHomeHealthIssue } from './flow-home-health';
import { FlowHomeStatusChip, type FlowHomeContextMetrics } from './flow-home-status-chip';

export type FlowHomePriorityAction = Readonly<{
  title: string;
  detail: string;
  route: string;
  source: string;
  dueAt?: string | null;
}>;

export type FlowHomeLinkedEvent = Readonly<{
  title: string;
  route: string;
  startsAt: string;
  location?: string | null;
}>;

type FlowHomeContextProps = {
  audience: HomeAudienceProfile;
  currentDate: string;
  headline: string;
  subheadline: string;
  updatedAt: string;
  contentAlignment: HomeContentAlignment;
  health: FlowHomeHealth;
  metrics: FlowHomeContextMetrics;
  priorityAction?: FlowHomePriorityAction;
  linkedEvent?: FlowHomeLinkedEvent;
  editing: boolean;
  customizationEnabled: boolean;
  customizationBusy: boolean;
  retrying: boolean;
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
  if (!firstIssue) return t('flow.context.health.availableApps');
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
  contentAlignment,
  health,
  metrics,
  priorityAction,
  linkedEvent,
  editing,
  customizationEnabled,
  customizationBusy,
  retrying,
  compact = false,
  priorityCompact = false,
  onEdit,
  onOpenStudio,
  onRetry,
}: FlowHomeContextProps) {
  const { t } = useTranslation('home');
  const [editAnchor, setEditAnchor] = useState<HTMLElement | null>(null);
  const [healthAnchor, setHealthAnchor] = useState<HTMLElement | null>(null);
  const copyOnRight = contentAlignment === 'RIGHT' && !compact;
  const copyCentered = contentAlignment === 'CENTER' && !compact;
  const degraded =
    health.state === 'DELAYED' || health.state === 'PARTIAL' || health.state === 'UNAVAILABLE';
  const canEditLayout = customizationEnabled && Boolean(onEdit);
  const hasEditHub = canEditLayout || Boolean(onOpenStudio);

  return (
    <Box
      component="header"
      data-testid="flow-home-context"
      data-flow-context-side={copyOnRight ? 'right' : 'left'}
      data-flow-context-alignment={contentAlignment.toLowerCase()}
      data-flow-context-composition={priorityAction ? 'priority-action' : 'inline-greeting'}
      sx={{
        position: 'relative',
        width: 1,
        minWidth: 0,
        minHeight: compact ? 0 : { xs: 180, sm: 232, md: 274 },
        px: compact ? 0.5 : { xs: 1, sm: 1.5, md: 0.5 },
        py: compact ? 0.25 : { xs: 1, sm: 1.5, md: 1 },
        display: 'grid',
        gridTemplateColumns: compact
          ? 'minmax(0, 1fr)'
          : {
              xs: 'minmax(0, 1fr)',
              md: copyOnRight
                ? 'minmax(340px, 0.62fr) minmax(0, 1.38fr)'
                : 'minmax(0, 1.38fr) minmax(340px, 0.62fr)',
              xl: copyOnRight
                ? 'minmax(390px, 0.68fr) minmax(0, 1.32fr)'
                : 'minmax(0, 1.32fr) minmax(390px, 0.68fr)',
            },
        gridTemplateAreas: compact
          ? '"copy" "status" "controls"'
          : {
              xs: '"copy" "status" "controls"',
              md: copyOnRight
                ? '"status copy" "status controls"'
                : '"copy status" "controls status"',
            },
        columnGap: { md: 2.5, lg: 3.5 },
        rowGap: { xs: 1, sm: 1.25, md: 1.5 },
        alignItems: { xs: 'start', md: 'stretch' },
        color: '#F8FAFC',
        '[data-flow-large-text="true"] &': {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateAreas: '"copy" "status" "controls"',
        },
        '@media (forced-colors: active)': { color: 'CanvasText' },
      }}
    >
      <Box
        data-flow-context-copy
        sx={{
          minWidth: 0,
          gridArea: 'copy',
          justifySelf: copyOnRight ? { md: 'end' } : 'start',
          width: 1,
          alignSelf: 'start',
          textAlign: { xs: 'left', md: copyOnRight ? 'right' : copyCentered ? 'center' : 'left' },
          '[data-flow-large-text="true"] &': {
            gridArea: 'copy',
            justifySelf: 'start',
            textAlign: 'left',
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={{
            xs: 'flex-start',
            md: copyOnRight ? 'flex-end' : copyCentered ? 'center' : 'flex-start',
          }}
          gap={1}
          flexWrap="wrap"
          sx={{ display: priorityCompact ? 'none' : 'flex' }}
        >
          <Typography
            variant="overline"
            fontWeight={700}
            sx={{
              color: 'rgba(248,250,252,0.76)',
              fontSize: '0.6875rem',
              letterSpacing: '0.02em',
              lineHeight: 1.3,
            }}
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
              height: 20,
              fontSize: '0.625rem',
              bgcolor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.18)',
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
            mt: { xs: 0.25, md: 0.75 },
            maxWidth: 880,
            fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem', xl: '2rem' },
            fontWeight: 760,
            lineHeight: 1.18,
            letterSpacing: '-0.026em',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
          }}
        >
          {priorityAction?.title ?? headline}
        </Typography>
        <Typography
          data-flow-context-description
          variant="body2"
          sx={{
            mt: { xs: 0.6, md: 1 },
            maxWidth: 780,
            color: 'rgba(248,250,252,0.84)',
            fontSize: { xs: '0.75rem', md: '0.875rem' },
            lineHeight: 1.55,
            px: { xs: 1.25, md: 1.5 },
            py: { xs: 1, md: 1.25 },
            border: 1,
            borderColor: (theme) => alpha(theme.palette.common.white, 0.16),
            borderRadius: foundationTokens.home.radius.control,
            bgcolor: (theme) => alpha(theme.palette.common.white, 0.09),
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {priorityAction?.detail ?? subheadline}
        </Typography>
        {priorityAction && (
          <Stack
            data-flow-primary-action
            direction="row"
            alignItems="center"
            gap={1}
            flexWrap="wrap"
            sx={{
              mt: { xs: 1.25, md: 1.75 },
              '[data-flow-primary-action-cta]': {
                minHeight: { xs: 48, md: 46 },
              },
              '@media (max-width: 599.95px)': {
                alignItems: 'stretch',
                '& [data-flow-primary-action-cta]': {
                  width: '100%',
                  justifyContent: 'center',
                },
              },
            }}
          >
            <Chip
              size="small"
              icon={<BriefcaseBusiness size={14} aria-hidden="true" />}
              label={t('flow.now.title')}
              sx={{
                color: foundationTokens.home.color.heroChipText,
                bgcolor: foundationTokens.home.color.heroActionSurface,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
            {priorityAction.dueAt && (
              <Typography variant="caption" sx={{ color: foundationTokens.home.color.heroMuted86 }}>
                {t('flow.now.due', {
                  time: formatDate(priorityAction.dueAt, {
                    dateStyle: priorityCompact ? undefined : 'short',
                    timeStyle: 'short',
                  }),
                })}
              </Typography>
            )}
            <ActionButton
              component={Link}
              to={priorityAction.route}
              data-flow-primary-action-cta
              intent="primary"
              size="small"
              endIcon={<ArrowRight size={16} aria-hidden="true" />}
              sx={{
                minHeight: 44,
                px: { xs: 2, md: 2.5 },
                bgcolor: foundationTokens.home.color.heroActionSurface,
                color: foundationTokens.home.color.heroActionText,
                fontWeight: foundationTokens.home.typography.weightEmphasis,
                '&:hover': { bgcolor: foundationTokens.home.color.heroActionHover },
              }}
            >
              {t('flow.now.openInSource', { source: priorityAction.source })}
            </ActionButton>
          </Stack>
        )}
      </Box>

      <Box
        data-flow-context-status-slot
        sx={{
          minWidth: 0,
          width: 1,
          maxWidth: compact ? '100%' : { xs: '100%', md: 'none' },
          gridArea: 'status',
          justifySelf: { xs: 'stretch', md: 'center' },
          alignSelf: { xs: 'start', md: 'stretch' },
          '[data-flow-large-text="true"] &': {
            gridArea: 'status',
            justifySelf: 'stretch',
            maxWidth: '100%',
          },
        }}
      >
        <Stack gap={1} sx={{ width: 1, height: 1, justifyContent: 'center' }}>
          {linkedEvent && !priorityCompact && (
            <Box
              component={Link}
              to={linkedEvent.route}
              data-flow-linked-calendar-context
              sx={{
                minHeight: { xs: 70, md: 126 },
                px: { xs: 1.25, md: 2 },
                py: { xs: 0.75, md: 1.5 },
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                gap: 1,
                alignItems: 'center',
                color: foundationTokens.home.color.heroOn,
                textDecoration: 'none',
                bgcolor: foundationTokens.home.color.heroLinkedSurface,
                border: 1,
                borderColor: foundationTokens.home.color.heroLinkedBorder,
                borderRadius: foundationTokens.home.radius.heroSurface,
                '&:hover': { bgcolor: foundationTokens.home.color.heroLinkedHover },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: foundationTokens.home.color.heroFocus,
                  outlineOffset: 2,
                },
                '@media (forced-colors: active)': {
                  color: 'LinkText',
                  bgcolor: 'Canvas',
                  borderColor: 'CanvasText',
                },
              }}
            >
              <CalendarDays size={20} aria-hidden="true" />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.78 }}>
                  {t('flow.context.linkedCalendar')}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={foundationTokens.home.typography.weightBold}
                  noWrap
                >
                  {linkedEvent.title}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.84 }} noWrap>
                  {formatDate(linkedEvent.startsAt, { timeStyle: 'short' })}
                  {linkedEvent.location ? ` · ${linkedEvent.location}` : ''}
                </Typography>
              </Box>
            </Box>
          )}
          <FlowHomeStatusChip metrics={metrics} />
        </Stack>
      </Box>

      <Stack
        data-flow-context-controls
        direction="row"
        alignItems="center"
        justifyContent={
          compact ? 'flex-start' : copyOnRight ? { md: 'flex-start' } : { md: 'flex-end' }
        }
        gap={0.75}
        flexWrap={compact ? 'wrap' : { xs: 'wrap', md: 'nowrap' }}
        sx={{
          minWidth: 0,
          gridArea: 'controls',
          justifySelf: compact ? 'stretch' : { xs: 'stretch', md: copyOnRight ? 'start' : 'end' },
          alignSelf: { xs: 'start', md: 'end' },
          maxWidth: compact ? '100%' : { md: '100%' },
          '[data-flow-large-text="true"] &': {
            gridArea: 'controls',
            justifySelf: 'start',
            maxWidth: '100%',
            flexWrap: 'wrap',
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={0.65}
          sx={{ minHeight: 24, whiteSpace: 'nowrap', color: 'rgba(248,250,252,0.76)' }}
          role="status"
          aria-live="polite"
        >
          <Clock3 size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
          <Typography variant="caption">
            {t('flow.context.updated', { time: updatedAt })}
          </Typography>
        </Stack>
        {!editing && hasEditHub && (
          <Box
            data-home-edit-hub
            sx={{
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'stretch',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.06)',
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
                minWidth: 44,
                px: { xs: 1, md: 0.75, xl: 1 },
                color: '#F8FAFC',
                border: 0,
                borderRadius: canEditLayout && onOpenStudio ? '7px 0 0 7px' : 1.75,
                bgcolor: 'transparent',
                '& .MuiButton-startIcon': { mr: { xs: 0.5, md: 0, xl: 0.5 } },
                '&:focus-visible': { outline: '2px solid #93C5FD', outlineOffset: -2 },
                '@media (forced-colors: active)': { color: 'CanvasText' },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'inline', md: 'none', xl: 'inline' } }}>
                {t('flow.context.editHub')}
              </Box>
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
          aria-busy={retrying ? 'true' : undefined}
          sx={{
            minWidth: 0,
            gridColumn: '1 / -1',
            gridRow: 'auto',
            justifySelf: { xs: 'stretch', md: copyOnRight ? 'start' : 'end' },
            width: 1,
            minHeight: 44,
            px: 0.5,
            py: 0,
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
            startIcon={<RefreshCw size={14} aria-hidden="true" />}
            loading={retrying}
            loadingLabel={t('flow.context.health.refreshing')}
            onClick={onRetry}
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
            sx: {
              minWidth: 'min(320px, calc(100vw - 24px))',
              maxWidth: 'min(420px, calc(100vw - 24px))',
            },
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
