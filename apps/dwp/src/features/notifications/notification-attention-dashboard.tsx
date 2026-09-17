import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellRing,
  CalendarPlus,
  CirclePause,
  CirclePlay,
  Eye,
  LockKeyhole,
  MessageSquareMore,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  UserRoundCheck,
  VolumeX,
} from 'lucide-react';

import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { InlineFeedback } from '@dwp-frontend/design-system/components/inline-feedback/inline-feedback';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system/components/states/state-panels';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate } from '@dwp-frontend/shared-i18n/lib/formatters';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  hasBlockingAttentionConflict,
  resolveAttentionRuleLimit,
  resolveAttentionRuleState,
  validNotificationAttentionCount,
} from './notification-attention-model';

import type { LucideIcon } from 'lucide-react';
import type {
  NotificationAttentionDataState,
  NotificationAttentionRule,
  NotificationAttentionRuleKind,
  NotificationAttentionRuleLimit,
  NotificationAttentionSummary,
} from './notification-attention-model';

const RULE_KINDS: NotificationAttentionRuleKind[] = [
  'VIP',
  'FOLLOW_CONTEXT',
  'MUTE_SCOPE',
  'TOPIC_WATCH',
];

const RULE_KIND_PRESENTATION: Record<
  NotificationAttentionRuleKind,
  { icon: LucideIcon; color: string; softColor: string }
> = {
  VIP: { icon: UserRoundCheck, color: 'primary.main', softColor: 'primary.50' },
  FOLLOW_CONTEXT: { icon: MessageSquareMore, color: 'info.dark', softColor: 'info.50' },
  MUTE_SCOPE: { icon: VolumeX, color: 'error.main', softColor: 'error.50' },
  TOPIC_WATCH: { icon: Tag, color: 'secondary.main', softColor: 'secondary.50' },
};

function dateLabel(value: string): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}

function RuleSummaryTiles({
  summary,
  selectedKind,
  onSelect,
}: {
  summary?: NotificationAttentionSummary | null;
  selectedKind: NotificationAttentionRuleKind | 'ALL';
  onSelect: (kind: NotificationAttentionRuleKind) => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box
      component="ul"
      aria-label={t('attention.summaryLabel')}
      sx={{
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        gap: 1,
        listStyle: 'none',
      }}
    >
      {RULE_KINDS.map((kind) => {
        const item = RULE_KIND_PRESENTATION[kind];
        const Icon = item.icon;
        const value = summary?.[kind];
        const selected = selectedKind === kind;
        return (
          <Box component="li" key={kind} minWidth={0}>
            <ButtonBase
              aria-pressed={selected}
              aria-label={`${t(`attention.kinds.${kind}.label`)}: ${
                validNotificationAttentionCount(value) ? value : t('attention.unavailable')
              }`}
              onClick={() => onSelect(kind)}
              sx={{
                width: '100%',
                minHeight: { xs: 84, md: 104 },
                p: { xs: 1.25, md: 1.5 },
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr)',
                gap: 1,
                alignItems: 'start',
                textAlign: 'left',
                border: 1,
                borderColor: selected ? item.color : 'divider',
                borderRadius: foundationTokens.radius.surface,
                bgcolor: selected ? item.softColor : 'background.paper',
                boxShadow: selected ? 1 : 0,
                '&:hover': { borderColor: item.color, bgcolor: item.softColor },
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  color: item.color,
                  bgcolor: item.softColor,
                  borderRadius: foundationTokens.radius.control,
                }}
              >
                <Icon size={18} strokeWidth={1.9} />
              </Box>
              <Box minWidth={0}>
                <Typography component="span" variant="caption" color="text.secondary">
                  {t(`attention.kinds.${kind}.label`)}
                </Typography>
                <Typography
                  component="p"
                  variant="h5"
                  sx={{ m: 0, mt: 0.25, color: item.color, fontVariantNumeric: 'tabular-nums' }}
                >
                  {validNotificationAttentionCount(value) ? value : t('attention.unavailable')}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', md: 'block' }, mt: 0.25, overflowWrap: 'anywhere' }}
                >
                  {t(`attention.kinds.${kind}.description`)}
                </Typography>
              </Box>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}

function RuleKindSelector({
  value,
  onChange,
}: {
  value: NotificationAttentionRuleKind | 'ALL';
  onChange: (value: NotificationAttentionRuleKind | 'ALL') => void;
}) {
  const { t } = useTranslation('notifications');
  const items: Array<{ value: NotificationAttentionRuleKind | 'ALL'; label: string }> = [
    { value: 'ALL', label: t('attention.filters.all') },
    ...RULE_KINDS.map((kind) => ({ value: kind, label: t(`attention.kinds.${kind}.short`) })),
  ];
  return (
    <Box
      role="group"
      aria-label={t('attention.filters.category')}
      sx={{ display: 'flex', gap: 0.5, minWidth: 0, overflowX: 'auto', pb: 0.25 }}
    >
      {items.map((item) => {
        const selected = value === item.value;
        return (
          <ButtonBase
            key={item.value}
            aria-pressed={selected}
            onClick={() => onChange(item.value)}
            sx={{
              flex: '0 0 auto',
              minHeight: 34,
              px: 1.25,
              typography: 'caption',
              fontWeight: selected ? 'fontWeightBold' : 'fontWeightMedium',
              color: selected ? 'primary.contrastText' : 'text.secondary',
              bgcolor: selected ? 'primary.main' : 'background.paper',
              border: 1,
              borderColor: selected ? 'primary.main' : 'divider',
              borderRadius: foundationTokens.radius.control,
              '&:hover': { bgcolor: selected ? 'primary.dark' : 'action.hover' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
            }}
          >
            {item.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

function RuleStatusChip({ state }: { state: NotificationAttentionRule['state'] }) {
  const { t } = useTranslation('notifications');
  return (
    <Chip
      size="small"
      variant={state === 'ENABLED' ? 'filled' : 'outlined'}
      color={state === 'ENABLED' ? 'success' : state === 'EXPIRED' ? 'default' : 'warning'}
      label={t(`attention.states.${state}`)}
      sx={{ height: 22, '& .MuiChip-label': { px: 0.75 } }}
    />
  );
}

function RuleIcon({ rule }: { rule: NotificationAttentionRule }) {
  const item = RULE_KIND_PRESENTATION[rule.kind];
  const Icon = item.icon;
  return (
    <Avatar
      aria-hidden="true"
      sx={{
        width: 36,
        height: 36,
        color: item.color,
        bgcolor: item.softColor,
        borderRadius: rule.kind === 'VIP' ? '50%' : foundationTokens.radius.control,
        typography: 'body2',
        fontWeight: 'fontWeightBold',
      }}
    >
      {rule.kind === 'VIP' ? rule.label.trim().slice(0, 1).toLocaleUpperCase() : <Icon size={18} />}
    </Avatar>
  );
}

type RuleActionProps = {
  rule: NotificationAttentionRule;
  state: NotificationAttentionRule['state'];
  mutationsDisabled: boolean;
  onEdit?: (rule: NotificationAttentionRule) => void;
  onDelete?: (rule: NotificationAttentionRule) => void;
  onPause?: (rule: NotificationAttentionRule) => void;
  onResume?: (rule: NotificationAttentionRule) => void;
  onExtend?: (rule: NotificationAttentionRule) => void;
};

function RuleActions({
  rule,
  state,
  mutationsDisabled,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onExtend,
}: RuleActionProps) {
  const { t } = useTranslation('notifications');
  const actions = [
    rule.actions.canEdit && onEdit
      ? { label: t('actions.edit'), icon: Pencil, run: () => onEdit(rule), danger: false }
      : null,
    state === 'ENABLED' && rule.actions.canPause && onPause
      ? {
          label: t('attention.actions.pause'),
          icon: CirclePause,
          run: () => onPause(rule),
          danger: false,
        }
      : null,
    state === 'PAUSED' && rule.actions.canResume && onResume
      ? {
          label: t('attention.actions.resume'),
          icon: CirclePlay,
          run: () => onResume(rule),
          danger: false,
        }
      : null,
    rule.actions.canExtend && onExtend
      ? {
          label: t('attention.actions.extend'),
          icon: CalendarPlus,
          run: () => onExtend(rule),
          danger: false,
        }
      : null,
    rule.actions.canDelete && onDelete
      ? { label: t('actions.delete'), icon: Trash2, run: () => onDelete(rule), danger: true }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    icon: LucideIcon;
    run: () => void;
    danger: boolean;
  }>;
  if (actions.length === 0) return null;
  return (
    <Stack
      direction="row"
      gap={0.25}
      aria-label={t('attention.ruleActions')}
      sx={{
        gridColumn: { xs: '1 / -1', sm: 'auto' },
        justifySelf: { xs: 'end', sm: 'auto' },
      }}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <ActionIconButton
            key={action.label}
            label={action.label}
            size="small"
            intent={action.danger ? 'danger' : 'default'}
            disabled={mutationsDisabled}
            onClick={action.run}
            sx={action.danger ? undefined : { color: 'text.secondary' }}
          >
            <Icon size={16} />
          </ActionIconButton>
        );
      })}
    </Stack>
  );
}

function AttentionRuleRow({
  rule,
  now,
  compact,
  managedLabel,
  mutationsDisabled,
  ...actions
}: {
  rule: NotificationAttentionRule;
  now: number;
  compact: boolean;
  managedLabel: string;
  mutationsDisabled: boolean;
} & Omit<RuleActionProps, 'rule' | 'state' | 'mutationsDisabled'>) {
  const { t } = useTranslation('notifications');
  const state = resolveAttentionRuleState(rule, now);
  const blockingConflict = hasBlockingAttentionConflict(rule);
  const showScope = rule.scopeLabel.trim() !== rule.label.trim();
  return (
    <Box
      component="article"
      data-rule-id={rule.ruleId}
      sx={{
        minWidth: 0,
        px: { xs: 1.25, sm: 1.5 },
        py: 1.4,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '36px minmax(0, 1fr)',
            sm: '36px minmax(0, 1fr) auto',
          },
          gap: 1,
          alignItems: 'start',
        }}
      >
        <RuleIcon rule={rule} />
        <Box minWidth={0}>
          <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap">
            <Typography component="h4" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {rule.label}
            </Typography>
            <RuleStatusChip state={state} />
            {rule.managed && (
              <Tooltip title={`${rule.managed.ownerLabel}: ${rule.managed.reason}`}>
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<LockKeyhole size={13} />}
                  label={managedLabel}
                  sx={{ height: 22 }}
                />
              </Tooltip>
            )}
          </Stack>
          {showScope && (
            <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
              {rule.scopeLabel}
            </Typography>
          )}
          <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.65 }}>
            <Chip size="small" variant="outlined" label={t(`attention.effects.${rule.effect}`)} />
            <Chip size="small" variant="outlined" label={rule.sourceLabel} />
          </Stack>
        </Box>
        <RuleActions rule={rule} state={state} mutationsDisabled={mutationsDisabled} {...actions} />
      </Box>

      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1,
          ml: { xs: 0, sm: 5.5 },
          display: 'grid',
          gridTemplateColumns: compact
            ? 'minmax(0, 1fr)'
            : { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 0.75,
          '& dt': { color: 'text.secondary' },
          '& dd': { m: 0, overflowWrap: 'anywhere' },
        }}
      >
        <Box>
          <Typography component="dt" variant="caption">
            {t('attention.fields.channels')}
          </Typography>
          <Typography component="dd" variant="caption">
            {rule.channelLabels.length > 0
              ? rule.channelLabels.join(', ')
              : t('attention.fields.noChannelOverride')}
          </Typography>
        </Box>
        {rule.startsAt && (
          <Box>
            <Typography component="dt" variant="caption">
              {t('attention.dialog.startsAt')}
            </Typography>
            <Typography component="dd" variant="caption">
              {dateLabel(rule.startsAt)}
            </Typography>
          </Box>
        )}
        <Box>
          <Typography component="dt" variant="caption">
            {t('attention.fields.expiry')}
          </Typography>
          <Typography component="dd" variant="caption">
            {rule.expiresAt ? dateLabel(rule.expiresAt) : t('attention.fields.noExpiry')}
          </Typography>
        </Box>
      </Box>

      {rule.managed && (
        <Box
          sx={{
            mt: 1,
            ml: { xs: 0, sm: 5.5 },
            px: 1,
            py: 0.75,
            bgcolor: 'action.hover',
            borderLeft: 3,
            borderColor: 'warning.main',
          }}
        >
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
            <LockKeyhole size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} aria-hidden />
            {rule.managed.reason} ·{' '}
            {rule.managed.exceptionAllowed
              ? t('attention.managed.exceptionAllowed')
              : t('attention.managed.noException')}
          </Typography>
        </Box>
      )}
      {rule.conflicts?.map((conflict) => (
        <InlineFeedback
          key={conflict.conflictId}
          severity={
            conflict.severity === 'BLOCKING'
              ? 'error'
              : conflict.severity === 'WARNING'
                ? 'warning'
                : 'info'
          }
          sx={{ mt: 1, ml: { xs: 0, sm: 5.5 } }}
        >
          {conflict.message}
        </InlineFeedback>
      ))}
      {blockingConflict && (
        <Typography
          variant="caption"
          color="error.main"
          sx={{ display: 'block', mt: 0.5, ml: { xs: 0, sm: 5.5 } }}
        >
          {t('attention.blockingConflict')}
        </Typography>
      )}
    </Box>
  );
}

function AttentionRuleGroup({
  kind,
  rules,
  compact,
  rowProps,
}: {
  kind: NotificationAttentionRuleKind;
  rules: readonly NotificationAttentionRule[];
  compact: boolean;
  rowProps: Omit<Parameters<typeof AttentionRuleRow>[0], 'rule' | 'compact'>;
}) {
  const { t } = useTranslation('notifications');
  const item = RULE_KIND_PRESENTATION[kind];
  const Icon = item.icon;
  return (
    <Box
      component="section"
      data-rule-group={kind}
      aria-labelledby={`attention-rule-group-${kind}`}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Box aria-hidden="true" sx={{ color: item.color, display: 'grid', placeItems: 'center' }}>
            <Icon size={18} strokeWidth={1.9} />
          </Box>
          <Typography id={`attention-rule-group-${kind}`} component="h3" variant="subtitle1">
            {t(`attention.kinds.${kind}.label`)}
          </Typography>
          <Chip size="small" label={rules.length} sx={{ ml: 'auto' }} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {t(`attention.kinds.${kind}.description`)}
        </Typography>
      </Box>
      {rules.map((rule) => (
        <AttentionRuleRow key={rule.ruleId} rule={rule} compact={compact} {...rowProps} />
      ))}
    </Box>
  );
}

export type NotificationAttentionDashboardProps = {
  summary?: NotificationAttentionSummary | null;
  rules: readonly NotificationAttentionRule[];
  state: NotificationAttentionDataState;
  ruleLimit?: NotificationAttentionRuleLimit | null;
  selectedKind: NotificationAttentionRuleKind | 'ALL';
  searchQuery: string;
  diagnostics?: ReactNode;
  now?: number;
  onSelectedKindChange: (value: NotificationAttentionRuleKind | 'ALL') => void;
  onSearchQueryChange: (value: string) => void;
  onAddRule?: () => void;
  onRetry?: () => void;
  onEditRule?: (rule: NotificationAttentionRule) => void;
  onDeleteRule?: (rule: NotificationAttentionRule) => void;
  onPauseRule?: (rule: NotificationAttentionRule) => void;
  onResumeRule?: (rule: NotificationAttentionRule) => void;
  onExtendRule?: (rule: NotificationAttentionRule) => void;
};

export function NotificationAttentionDashboard({
  summary,
  rules,
  state,
  ruleLimit,
  selectedKind,
  searchQuery,
  diagnostics,
  now = Date.now(),
  onSelectedKindChange,
  onSearchQueryChange,
  onAddRule,
  onRetry,
  onEditRule,
  onDeleteRule,
  onPauseRule,
  onResumeRule,
  onExtendRule,
}: NotificationAttentionDashboardProps) {
  const { t } = useTranslation('notifications');
  const titleId = useId();
  const limit = resolveAttentionRuleLimit(ruleLimit);
  const mutationsDisabled = ['LOADING', 'OFFLINE', 'ERROR'].includes(state.kind);
  const canAdd = Boolean(onAddRule) && !limit.reached && !mutationsDisabled;
  const visibleSummary = ['LOADING', 'ERROR'].includes(state.kind) ? null : summary;
  const visibleKinds = RULE_KINDS.filter(
    (kind) =>
      (selectedKind === 'ALL' || selectedKind === kind) && rules.some((rule) => rule.kind === kind)
  );
  const rowProps = {
    now,
    onEdit: onEditRule,
    onDelete: onDeleteRule,
    onPause: onPauseRule,
    onResume: onResumeRule,
    onExtend: onExtendRule,
    managedLabel: t('preferences.managed'),
    mutationsDisabled,
  };
  const renderGroup = (kind: NotificationAttentionRuleKind, compact: boolean) =>
    visibleKinds.includes(kind) ? (
      <AttentionRuleGroup
        key={kind}
        kind={kind}
        compact={compact}
        rules={rules.filter((rule) => rule.kind === kind)}
        rowProps={rowProps}
      />
    ) : null;

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="notification-attention-dashboard"
      sx={{
        minWidth: 0,
        containerType: 'inline-size',
        '& .MuiChip-outlinedWarning': { color: 'text.primary', borderColor: 'warning.dark' },
        '& .MuiChip-outlinedInfo': { color: 'text.primary', borderColor: 'info.dark' },
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': { transition: 'none !important' },
        },
        '@media (forced-colors: active)': {
          '& [class*="MuiChip"]': { border: '1px solid CanvasText' },
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1.25}
        sx={{ mb: 1.5 }}
      >
        <Box minWidth={0}>
          <Typography id={titleId} component="h2" variant="h5">
            {t('attention.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('attention.description')}
          </Typography>
        </Box>
        {onAddRule && (
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<Plus size={16} />}
            disabled={!canAdd}
            onClick={onAddRule}
            sx={{
              flexShrink: 0,
              whiteSpace: 'nowrap',
              alignSelf: { xs: 'stretch', sm: 'flex-start' },
            }}
          >
            {t('attention.add')}
          </ActionButton>
        )}
      </Stack>

      <RuleSummaryTiles
        summary={visibleSummary}
        selectedKind={selectedKind}
        onSelect={(kind) => onSelectedKindChange(selectedKind === kind ? 'ALL' : kind)}
      />

      {diagnostics && <Box sx={{ mt: 1.5 }}>{diagnostics}</Box>}

      <Box
        sx={{
          my: 1.5,
          p: 1,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(240px, 320px)' },
          gap: 1,
          alignItems: 'center',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface,
          bgcolor: 'background.paper',
        }}
      >
        <RuleKindSelector value={selectedKind} onChange={onSelectedKindChange} />
        <FormField
          size="small"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          label={t('attention.search')}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} aria-hidden />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {!limit.valid && (
        <InlineFeedback severity="error" sx={{ mb: 1 }}>
          {t('attention.capacityUnavailable')}
        </InlineFeedback>
      )}
      {ruleLimit && limit.valid && limit.reached && (
        <InlineFeedback severity="warning" sx={{ mb: 1 }}>
          {ruleLimit.message ??
            t('attention.capacityReached', { used: ruleLimit.used, limit: ruleLimit.limit })}
        </InlineFeedback>
      )}
      {state.kind === 'PARTIAL' && (
        <InlineFeedback severity="warning" sx={{ mb: 1 }}>
          {state.message}
        </InlineFeedback>
      )}
      {state.kind === 'OFFLINE' && (
        <InlineFeedback severity="warning" sx={{ mb: 1 }}>
          {state.message}
        </InlineFeedback>
      )}

      {state.kind === 'LOADING' ? (
        <LoadingState
          label={t('states.loadingPreferences')}
          variant="skeleton"
          skeletonRows={4}
          skeletonHeight={112}
          embedded
        />
      ) : state.kind === 'ERROR' ? (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.radius.surface,
            bgcolor: 'background.paper',
          }}
        >
          <ErrorState
            title={t('states.preferencesErrorTitle')}
            description={state.message}
            retryLabel={onRetry ? t('actions.retry') : undefined}
            onRetry={onRetry}
            size="compact"
          />
        </Box>
      ) : state.kind === 'EMPTY' || rules.length === 0 ? (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.radius.surface,
            bgcolor: 'background.paper',
          }}
        >
          <EmptyState
            icon={searchQuery ? <Search size={28} /> : <Eye size={28} />}
            title={searchQuery ? t('attention.noMatchTitle') : t('attention.emptyTitle')}
            description={
              state.kind === 'EMPTY' && state.message
                ? state.message
                : searchQuery
                  ? t('attention.noMatchDescription')
                  : t('attention.emptyDescription')
            }
            size="compact"
          />
        </Box>
      ) : selectedKind === 'ALL' ? (
        <Box
          aria-label={t('attention.ruleListLabel')}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <Stack gap={1.5} minWidth={0}>
            {renderGroup('VIP', false)}
            {renderGroup('FOLLOW_CONTEXT', false)}
          </Stack>
          <Stack gap={1.5} minWidth={0}>
            {renderGroup('MUTE_SCOPE', true)}
            {renderGroup('TOPIC_WATCH', true)}
          </Stack>
        </Box>
      ) : (
        <Box sx={{ maxWidth: 960 }}>{renderGroup(selectedKind, false)}</Box>
      )}

      <Stack
        direction="row"
        gap={0.75}
        alignItems="center"
        sx={{ mt: 1.25, color: 'text.secondary' }}
      >
        <BellRing size={14} aria-hidden />
        <Typography variant="caption">
          {limit.valid && ruleLimit
            ? t('attention.capacityUsed', { used: ruleLimit.used, limit: ruleLimit.limit })
            : t('attention.capacityUnavailableShort')}
        </Typography>
      </Stack>
    </Box>
  );
}
