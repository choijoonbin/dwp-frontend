import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  GlyphSurface,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useId } from 'react';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  AdminV2Fact,
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2Tone,
  AdminV2WorkspaceActions,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

const TONE_COLOR = {
  neutral: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
} as const;

const METRIC_COLOR: Record<AdminV2Tone, 'text.primary' | `${string}.main`> = {
  neutral: 'text.primary',
  info: 'info.main',
  success: 'success.main',
  warning: 'warning.main',
  danger: 'error.main',
};

export function AdminV2StatusPill({ status }: { status: AdminV2Status }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={TONE_COLOR[status.tone]}
      label={status.label}
      sx={{
        maxWidth: 1,
        height: 'auto',
        minHeight: 24,
        '& .MuiChip-label': {
          px: 0.9,
          py: 0.2,
          fontWeight: 'fontWeightBold',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
        },
      }}
    />
  );
}

export function AdminV2WorkspaceFrame({
  header,
  icon: Icon,
  primaryAction,
  children,
}: {
  header: AdminV2WorkspaceHeader;
  icon: LucideIcon;
  primaryAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        width: 1,
        minWidth: 0,
        color: 'text.primary',
        bgcolor: 'background.default',
      }}
    >
      <Stack gap={2.25}>
        <Stack
          component="header"
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" gap={1.25} alignItems="flex-start" minWidth={0}>
            <GlyphSurface size={40} variant="soft">
              <Icon size={20} strokeWidth={1.8} />
            </GlyphSurface>
            <Box minWidth={0}>
              <Typography variant="overline" color="primary.main" fontWeight="fontWeightBold">
                {header.eyebrow}
              </Typography>
              <Typography
                component="h1"
                variant="h5"
                fontWeight="fontWeightBold"
                sx={{ overflowWrap: 'anywhere', wordBreak: 'keep-all' }}
              >
                {header.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.35, maxWidth: 820, overflowWrap: 'anywhere' }}
              >
                {header.description}
              </Typography>
            </Box>
          </Stack>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            gap={1}
            flexShrink={0}
          >
            <Chip
              size="small"
              variant="outlined"
              icon={<ShieldCheck size={15} />}
              label={header.evidenceLabel}
              sx={{ minHeight: 28, '& .MuiChip-label': { fontWeight: 'fontWeightBold' } }}
            />
            {primaryAction}
          </Stack>
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}

export function AdminV2StateBoundary({
  state,
  copy,
  actions,
  children,
}: {
  state: AdminV2SourceState;
  copy: AdminV2StateCopy;
  actions?: AdminV2WorkspaceActions;
  children: ReactNode;
}) {
  if (state === 'loading') {
    return (
      <LoadingState
        label={copy.loadingTitle}
        description={copy.loadingDescription}
        variant="skeleton"
        skeletonHeights={[68, 180, 260]}
        size="page"
      />
    );
  }
  if (state === 'empty') {
    return <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} size="page" />;
  }
  if (state === 'forbidden') {
    return (
      <ErrorState title={copy.forbiddenTitle} description={copy.forbiddenDescription} size="page" />
    );
  }
  if (state === 'unavailable') {
    return (
      <ErrorState
        title={copy.unavailableTitle}
        description={copy.unavailableDescription}
        retryLabel={actions?.onRetry ? copy.retryAction : undefined}
        onRetry={actions?.onRetry}
        size="page"
      />
    );
  }

  const interrupted = state === 'conflict' || state === 'stale';
  return (
    <Stack gap={2}>
      {interrupted ? (
        <InlineFeedback
          severity={state === 'conflict' ? 'error' : 'warning'}
          title={state === 'conflict' ? copy.conflictTitle : copy.staleTitle}
          action={
            state === 'conflict' && actions?.onResolveConflict ? (
              <ActionButton intent="secondary" size="small" onClick={actions.onResolveConflict}>
                {copy.conflictAction}
              </ActionButton>
            ) : state === 'stale' && actions?.onRetry ? (
              <ActionButton intent="secondary" size="small" onClick={actions.onRetry}>
                {copy.staleAction}
              </ActionButton>
            ) : undefined
          }
        >
          {state === 'conflict' ? copy.conflictDescription : copy.staleDescription}
        </InlineFeedback>
      ) : null}
      {children}
    </Stack>
  );
}

export function AdminV2MetricStrip({ metrics }: { metrics: readonly AdminV2Metric[] }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          lg: `repeat(${Math.min(Math.max(metrics.length, 1), 5)}, minmax(0, 1fr))`,
        },
        borderBlock: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {metrics.map((metric, index) => (
        <Box
          key={metric.id}
          sx={{
            minWidth: 0,
            px: { xs: 1.25, sm: 2 },
            py: 1.5,
            borderInlineEnd: { lg: index === metrics.length - 1 ? 0 : 1 },
            borderBlockEnd: { xs: index < metrics.length - 2 ? 1 : 0, lg: 0 },
            borderColor: 'divider',
          }}
        >
          <Typography component="dt" variant="caption" color="text.secondary">
            {metric.label}
          </Typography>
          <Typography
            component="dd"
            variant="h6"
            fontWeight="fontWeightBold"
            color={METRIC_COLOR[metric.tone ?? 'neutral']}
            sx={{ m: 0, mt: 0.25, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
          >
            {metric.value}
          </Typography>
          {metric.helper ? (
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {metric.helper}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export function AdminV2Section({
  title,
  description,
  action,
  children,
  labelledBy,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={labelledBy}
      sx={{ minWidth: 0, bgcolor: 'background.paper', borderBlockStart: 1, borderColor: 'divider' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ px: { xs: 1.5, sm: 2 }, py: 1.4, borderBlockEnd: 1, borderColor: 'divider' }}
      >
        <Box minWidth={0}>
          <Typography
            id={labelledBy}
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {title}
          </Typography>
          {description ? (
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {description}
            </Typography>
          ) : null}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

export function AdminV2FactGrid({ facts }: { facts: readonly AdminV2Fact[] }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
      }}
    >
      {facts.map((fact, index) => (
        <Box
          key={fact.id}
          sx={{
            minWidth: 0,
            px: 1.5,
            py: 1.15,
            borderBlockEnd: 1,
            borderInlineEnd: { sm: index % 2 === 0 ? 1 : 0 },
            borderColor: 'divider',
          }}
        >
          <Typography component="dt" variant="caption" color="text.secondary">
            {fact.label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            fontWeight="fontWeightBold"
            color={METRIC_COLOR[fact.tone ?? 'neutral']}
            sx={{ m: 0, mt: 0.2, overflowWrap: 'anywhere' }}
          >
            {fact.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function AdminV2RecordButton({
  selected,
  title,
  description,
  status,
  meta,
  onClick,
}: {
  selected?: boolean;
  title: string;
  description?: string;
  status?: AdminV2Status;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      sx={(theme) => ({
        width: 1,
        minHeight: 76,
        px: 1.5,
        py: 1.25,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        textAlign: 'start',
        borderBlockEnd: 1,
        borderInlineStart: 3,
        borderColor: 'divider',
        borderInlineStartColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.07) : 'transparent',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.045) },
      })}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {description}
          </Typography>
        ) : null}
        {meta ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}
          >
            {meta}
          </Typography>
        ) : null}
      </Box>
      {status ? <AdminV2StatusPill status={status} /> : <ArrowRight size={16} />}
    </ButtonBase>
  );
}

export function AdminV2GovernedAction({
  desktopLabel,
  mobileLabel,
  mobileReason,
  disabled,
  disabledReason,
  onAction,
  icon,
}: {
  desktopLabel: string;
  mobileLabel: string;
  mobileReason: string;
  disabled?: boolean;
  disabledReason?: string;
  onAction: () => void;
  icon?: ReactNode;
}) {
  const reasonId = useId();
  return (
    <Box minWidth={0}>
      <ActionButton
        intent="primary"
        startIcon={icon}
        disabled={disabled}
        aria-describedby={disabled && disabledReason ? reasonId : undefined}
        onClick={onAction}
        sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
      >
        {desktopLabel}
      </ActionButton>
      {disabled && disabledReason ? (
        <Typography
          id={reasonId}
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' }, mt: 0.5, overflowWrap: 'anywhere' }}
        >
          {disabledReason}
        </Typography>
      ) : null}
      <Stack gap={0.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
        <ActionButton intent="primary" startIcon={icon} disabled fullWidth>
          {mobileLabel}
        </ActionButton>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {mobileReason}
        </Typography>
      </Stack>
    </Box>
  );
}

export function AdminV2ViewTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <Stack
      component="nav"
      direction="row"
      role="tablist"
      aria-label={label}
      sx={{ overflowX: 'auto', borderBlockEnd: 1, borderColor: 'divider' }}
    >
      {options.map((option) => (
        <ButtonBase
          key={option.value}
          role="tab"
          aria-label={option.label}
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          sx={{
            minWidth: 'max-content',
            minHeight: 44,
            px: 1.75,
            borderBlockEnd: 2,
            borderColor: value === option.value ? 'primary.main' : 'transparent',
            color: value === option.value ? 'primary.main' : 'text.secondary',
            fontWeight: 'fontWeightBold',
          }}
        >
          {option.label}
          {option.count != null ? (
            <Box component="span" sx={{ ml: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              {option.count}
            </Box>
          ) : null}
        </ButtonBase>
      ))}
    </Stack>
  );
}

export function AdminV2Timeline({
  items,
}: {
  items: readonly {
    id: string;
    title: string;
    detail: string;
    status: AdminV2Status;
    meta?: string;
  }[];
}) {
  return (
    <Stack component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }} divider={<Divider flexItem />}>
      {items.map((item) => {
        const Icon =
          item.status.tone === 'success'
            ? CheckCircle2
            : item.status.tone === 'danger'
              ? CircleAlert
              : item.status.tone === 'warning'
                ? AlertTriangle
                : Info;
        return (
          <Stack component="li" key={item.id} direction="row" gap={1.25} sx={{ px: 1.5, py: 1.25 }}>
            <GlyphSurface size={30} variant="soft">
              <Icon size={15} />
            </GlyphSurface>
            <Box minWidth={0} flex={1}>
              <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {item.title}
                </Typography>
                <AdminV2StatusPill status={item.status} />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {item.detail}
              </Typography>
              {item.meta ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.35, overflowWrap: 'anywhere' }}
                >
                  {item.meta}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}

export function AdminV2InspectorPaper({ children }: { children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        minWidth: 0,
        overflow: 'hidden',
        borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 2}px`,
        boxShadow: 'none',
      }}
    >
      {children}
    </Paper>
  );
}
