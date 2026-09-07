import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  AlertTriangle,
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

import type { HomeAudienceProfile, HomeContentAlignment } from '@dwp-frontend/shared-utils';
import type { FlowHomeHealth, FlowHomeHealthDomain, FlowHomeHealthIssue } from './flow-home-health';
import { FlowHomeStatusChip, type FlowHomeContextMetrics } from './flow-home-status-chip';

type FlowHomeContextProps = {
  audience: HomeAudienceProfile;
  currentDate: string;
  headline: string;
  subheadline: string;
  updatedAt: string;
  contentAlignment: HomeContentAlignment;
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
  contentAlignment,
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
      data-flow-context-composition="inline-greeting"
      sx={{
        position: 'relative',
        width: 1,
        minWidth: 0,
        px: compact ? 0.5 : { xs: 0.5, md: 0 },
        py: compact ? 0.25 : { xs: 0.25, md: 0.5 },
        display: 'grid',
        gridTemplateColumns: compact
          ? 'minmax(0, 1fr)'
          : {
              xs: 'minmax(0, 1fr)',
              md: copyOnRight
                ? 'auto minmax(280px, 360px) minmax(0, 1fr)'
                : 'minmax(0, 1fr) minmax(280px, 360px) auto',
              lg: copyOnRight
                ? 'auto minmax(300px, 390px) minmax(0, 1fr)'
                : 'minmax(0, 1fr) minmax(300px, 390px) auto',
            },
        columnGap: { md: 1.5, lg: 2 },
        rowGap: { xs: 0.75, sm: 1 },
        alignItems: 'center',
        color: '#F8FAFC',
        '[data-flow-large-text="true"] &': { gridTemplateColumns: 'minmax(0, 1fr)' },
        '@media (forced-colors: active)': { color: 'CanvasText' },
      }}
    >
      <Box
        data-flow-context-copy
        sx={{
          minWidth: 0,
          gridColumn: compact ? '1' : { xs: '1', md: copyOnRight ? '3' : '1' },
          gridRow: compact ? 'auto' : { md: '1' },
          justifySelf: copyOnRight ? { md: 'end' } : 'start',
          width: 1,
          textAlign: { xs: 'left', md: copyOnRight ? 'right' : copyCentered ? 'center' : 'left' },
          '[data-flow-large-text="true"] &': {
            gridColumn: '1',
            gridRow: 'auto',
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
            mt: 0.25,
            maxWidth: 880,
            fontSize: { xs: '1.25rem', md: '1.375rem', lg: '1.5rem' },
            fontWeight: 720,
            lineHeight: 1.2,
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
            fontSize: '0.75rem',
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
        data-flow-context-status-slot
        sx={{
          minWidth: 0,
          width: 1,
          maxWidth: compact ? '100%' : { xs: '100%', md: 390 },
          gridColumn: compact ? '1' : { xs: '1', md: '2' },
          gridRow: compact ? 'auto' : { md: '1' },
          justifySelf: { xs: 'stretch', md: 'center' },
          '[data-flow-large-text="true"] &': {
            gridColumn: '1',
            gridRow: 'auto',
            justifySelf: 'stretch',
            maxWidth: '100%',
          },
        }}
      >
        <FlowHomeStatusChip metrics={metrics} />
      </Box>

      <Stack
        data-flow-context-controls
        direction="row"
        alignItems="center"
        justifyContent={
          compact ? 'flex-start' : copyOnRight ? { md: 'flex-start' } : { md: 'flex-end' }
        }
        gap={0.75}
        flexWrap="wrap"
        sx={{
          minWidth: 0,
          gridColumn: compact ? '1' : { xs: '1', md: copyOnRight ? '1' : '3' },
          gridRow: compact ? 'auto' : { md: '1' },
          justifySelf: compact ? 'stretch' : { xs: 'stretch', md: copyOnRight ? 'start' : 'end' },
          alignSelf: { md: 'center' },
          maxWidth: compact ? '100%' : { md: 260 },
          '[data-flow-large-text="true"] &': {
            gridColumn: '1',
            gridRow: 'auto',
            justifySelf: 'start',
            maxWidth: '100%',
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
          {health.state === 'REFRESHING' ? (
            <CircularProgress size={14} thickness={5} color="inherit" aria-hidden="true" />
          ) : (
            <Clock3 size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
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
          aria-busy={health.refreshing ? 'true' : undefined}
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
