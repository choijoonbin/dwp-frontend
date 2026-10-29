import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AtSign,
  Bookmark,
  CheckCheck,
  Clock3,
  Inbox,
  Search,
  SlidersHorizontal,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';
import { ActionButton, ActionIconButton, FormField } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Checkbox from '@mui/material/Checkbox';
import Drawer from '@mui/material/Drawer';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  EMPTY_NOTIFICATION_FILTERS,
  canonicalNotificationContextFilters,
  canonicalNotificationIncludedTypes,
  hasNotificationFilters,
  MAX_NOTIFICATION_CONTEXT_FILTERS,
  MAX_NOTIFICATION_INCLUDED_TYPES,
  NOTIFICATION_INCLUDED_TYPES,
  NOTIFICATION_REASONS,
  notificationFiltersForView,
} from './notification-filter-model';
import type {
  CenterFilters,
  NotificationContextOption,
  NotificationIncludedType,
} from './notification-filter-model';
import type {
  NotificationSummary,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';
import type { ReactNode } from 'react';

const VIEWS = [
  { key: 'ALL', icon: Inbox },
  { key: 'PRIORITY', icon: Zap },
  { key: 'MENTIONS', icon: AtSign },
  { key: 'SAVED', icon: Bookmark },
  { key: 'SNOOZED', icon: Clock3 },
  { key: 'DONE', icon: CheckCheck },
] as const;

export function NotificationFilterBar({
  view,
  filters,
  summary,
  appOptions,
  contextOptions,
  savedViewControl,
  onViewChange,
  onChange,
}: {
  view: NotificationView;
  filters: CenterFilters;
  summary?: NotificationSummary;
  appOptions: Array<[string, string]>;
  contextOptions: NotificationContextOption[];
  savedViewControl?: ReactNode;
  onViewChange: (view: NotificationView) => void;
  onChange: (filters: CenterFilters) => void;
}) {
  const { t } = useTranslation('notifications');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<CenterFilters | null>(null);
  const activeFilterCount = countAdvancedNotificationFilters(filters);
  const cloneFilters = (value: CenterFilters): CenterFilters => ({
    ...value,
    includedTypes: [...value.includedTypes],
    contextFilters: value.contextFilters.map((context) => ({ ...context })),
  });
  const openFilters = () => {
    setFilterDraft(cloneFilters(filters));
    setFiltersOpen(true);
  };
  const discardFilterDraft = () => {
    setFiltersOpen(false);
    setFilterDraft(null);
  };
  const applyFilterDraft = () => {
    if (!filterDraft) return;
    const includedTypes = canonicalNotificationIncludedTypes(filterDraft.includedTypes);
    const contextFilters = canonicalNotificationContextFilters(filterDraft.contextFilters);
    if (!includedTypes || !contextFilters) return;
    onChange(
      notificationFiltersForView(
        {
          ...filterDraft,
          includedTypes,
          contextFilters,
        },
        view
      )
    );
    discardFilterDraft();
  };
  const contextOptionsWithCurrent = [...contextOptions];
  for (const context of filters.contextFilters) {
    if (!contextOptionsWithCurrent.some((option) => contextId(option) === contextId(context))) {
      contextOptionsWithCurrent.unshift({ ...context, label: context.label || context.key });
    }
  }
  return (
    <Box
      component="section"
      aria-label={t('workbench.filters.label')}
      sx={{
        mt: 1.25,
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        bgcolor: 'background.paper',
        boxShadow: 'var(--notification-panel-shadow)',
        overflow: 'hidden',
      }}
    >
      <Stack
        component="nav"
        aria-label={t('center.viewsLabel')}
        direction="row"
        sx={{
          display: { xs: 'flex', md: 'none' },
          gap: 0.5,
          p: 1,
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {VIEWS.map(({ key, icon: Icon }) => (
          <ActionButton
            key={key}
            intent="quiet"
            size="small"
            startIcon={<Icon size={15} />}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => onViewChange(key)}
            sx={{
              minHeight: 34,
              flexShrink: 0,
              px: 1,
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              bgcolor: view === key ? 'primary.main' : 'action.hover',
              color: view === key ? 'primary.contrastText' : 'text.secondary',
              '&:hover': { bgcolor: view === key ? 'primary.dark' : 'action.selected' },
            }}
          >
            {t(`views.${key}`)}
            {summary ? summary.viewCounts[key] : null}
          </ActionButton>
        ))}
      </Stack>
      <Stack
        component="nav"
        aria-label={t('center.viewsLabel')}
        direction="row"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
          gap: 0.75,
          p: 1,
        }}
      >
        {VIEWS.map(({ key, icon: Icon }) => (
          <ActionButton
            key={key}
            intent="quiet"
            startIcon={<Icon size={16} />}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => onViewChange(key)}
            sx={{
              minHeight: 36,
              flexShrink: 0,
              gap: 0.75,
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              bgcolor: view === key ? 'primary.main' : 'action.hover',
              color: view === key ? 'primary.contrastText' : 'text.secondary',
              '&:hover': { bgcolor: view === key ? 'primary.dark' : 'action.selected' },
            }}
          >
            {t(`views.${key}`)}
            {summary && (
              <Typography
                component="span"
                variant="caption"
                title={t('filters.viewCount', { count: summary.viewCounts[key] })}
                sx={{
                  fontVariantNumeric: 'tabular-nums',
                  px: 0.75,
                  borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                  bgcolor: view === key ? 'action.selected' : 'action.hover',
                }}
              >
                {summary.viewCounts[key]}
              </Typography>
            )}
          </ActionButton>
        ))}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr) auto auto',
            md: 'minmax(220px, 1fr) auto',
          },
          gap: 1,
          p: 1.25,
        }}
      >
        <FormField
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder={t('center.searchPlaceholder')}
          slotProps={{
            htmlInput: { 'aria-label': t('home.searchLabel') },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 0 }}
        />
        <ActionIconButton
          label={`${t('filters.open')}${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
          onClick={openFilters}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, width: 40, height: 40 }}
        >
          <Badge
            color="primary"
            badgeContent={activeFilterCount}
            invisible={activeFilterCount === 0}
            max={9}
          >
            <SlidersHorizontal size={17} />
          </Badge>
        </ActionIconButton>
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            gridColumn: { md: '1 / -1' },
            gridRow: { md: 2 },
          }}
        >
          {renderFilters(filters, (patch) => onChange({ ...filters, ...patch }))}
        </Box>
        {savedViewControl && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gridColumn: { md: 2 },
              gridRow: { md: 1 },
            }}
          >
            {savedViewControl}
          </Box>
        )}
      </Box>
      <Drawer
        anchor="bottom"
        open={filtersOpen}
        onClose={discardFilterDraft}
        slotProps={{
          paper: {
            'aria-label': t('filters.open'),
            sx: {
              maxHeight: 'min(82dvh, 620px)',
              borderTopLeftRadius: foundationTokens.radius.surface * 3,
              borderTopRightRadius: foundationTokens.radius.surface * 3,
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto' }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 36,
              height: 4,
              borderRadius: foundationTokens.radius.compact,
              bgcolor: 'divider',
              mx: 'auto',
              mt: 1,
            }}
          />
          <Box sx={{ p: 2, overflowY: 'auto' }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography component="h2" variant="subtitle1">
                {t('filters.open')}
              </Typography>
              <ActionIconButton label={t('filters.close')} onClick={discardFilterDraft}>
                <X size={18} />
              </ActionIconButton>
            </Stack>
            {filterDraft &&
              renderFilters(filterDraft, (patch) =>
                setFilterDraft((current) => (current ? { ...current, ...patch } : current))
              )}
          </Box>
          <Box
            sx={{
              p: 2,
              pt: 1.25,
              pb: 'max(16px, env(safe-area-inset-bottom))',
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <ActionButton intent="primary" onClick={applyFilterDraft} sx={{ width: 1 }}>
              {t('filters.apply')}
            </ActionButton>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );

  function renderFilters(
    currentFilters: CenterFilters,
    updateFilters: (patch: Partial<CenterFilters>) => void
  ) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
            xl: 'repeat(8, minmax(0, 1fr))',
          },
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
        }}
      >
        <Select
          value={currentFilters.readState}
          onChange={(event) =>
            updateFilters({ readState: event.target.value as CenterFilters['readState'] })
          }
          size="small"
          inputProps={{ 'aria-label': t('filters.readState') }}
          sx={{ width: 1, minWidth: 0 }}
        >
          {(['ALL', 'UNREAD', 'READ'] as const).map((state) => (
            <MenuItem key={state} value={state}>
              {t(`filters.read.${state}`)}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={currentFilters.appKey}
          onChange={(event) => updateFilters({ appKey: event.target.value })}
          size="small"
          displayEmpty
          inputProps={{ 'aria-label': t('filters.app') }}
          sx={{ width: 1, minWidth: 0 }}
        >
          <MenuItem value="">{t('filters.allApps')}</MenuItem>
          {appOptions.map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {t(`sources.${key.toLowerCase()}`, { defaultValue: label })}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={currentFilters.attentionEffect}
          onChange={(event) =>
            updateFilters({
              attentionEffect: event.target.value as CenterFilters['attentionEffect'],
            })
          }
          size="small"
          inputProps={{
            'aria-label': t('filters.attentionEffect'),
          }}
          sx={{ width: 1, minWidth: 0 }}
        >
          <MenuItem value="ALL">{t('filters.allAttention')}</MenuItem>
          <MenuItem value="PRIORITIZE">{t('filters.prioritized')}</MenuItem>
        </Select>
        <Select
          value={currentFilters.reason}
          disabled={view === 'MENTIONS'}
          onChange={(event) =>
            updateFilters({
              reason: event.target.value as CenterFilters['reason'],
              includedTypes: [],
            })
          }
          size="small"
          inputProps={{ 'aria-label': t('filters.reason') }}
          sx={{ width: 1, minWidth: 0 }}
        >
          <MenuItem value="ALL">
            {view === 'MENTIONS' ? t('reason.MENTION') : t('filters.allReasons')}
          </MenuItem>
          {NOTIFICATION_REASONS.map((reason) => (
            <MenuItem key={reason} value={reason}>
              {t(`reason.${reason}`)}
            </MenuItem>
          ))}
        </Select>
        <Select
          multiple
          value={currentFilters.includedTypes}
          disabled={view === 'MENTIONS'}
          onChange={(event) => {
            const values = Array.isArray(event.target.value)
              ? (event.target.value as NotificationIncludedType[])
              : (String(event.target.value).split(',') as NotificationIncludedType[]);
            updateFilters({
              reason: 'ALL',
              includedTypes: values.slice(0, MAX_NOTIFICATION_INCLUDED_TYPES),
            });
          }}
          renderValue={(selected) =>
            selected.length === 0
              ? t('filters.allTypes')
              : selected.map(includedTypeLabel).join(', ')
          }
          size="small"
          displayEmpty
          inputProps={{
            'aria-label': t('filters.includedTypes'),
          }}
          sx={{ width: 1, minWidth: 0 }}
        >
          {NOTIFICATION_INCLUDED_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              <Checkbox size="small" checked={currentFilters.includedTypes.includes(type)} />
              {includedTypeLabel(type)}
            </MenuItem>
          ))}
        </Select>
        <Select
          multiple
          value={currentFilters.contextFilters.map(contextId)}
          onChange={(event) => {
            const values = Array.isArray(event.target.value)
              ? event.target.value
              : String(event.target.value).split(',');
            updateFilters({
              contextFilters: contextOptionsWithCurrent
                .filter((option) => values.includes(contextId(option)))
                .slice(0, MAX_NOTIFICATION_CONTEXT_FILTERS),
            });
          }}
          renderValue={(selected) =>
            selected.length === 0
              ? t('filters.allContexts')
              : selected
                  .map(
                    (identity) =>
                      contextOptionsWithCurrent.find((option) => contextId(option) === identity)
                        ?.label ||
                      contextOptionsWithCurrent.find((option) => contextId(option) === identity)
                        ?.key ||
                      identity
                  )
                  .join(', ')
          }
          size="small"
          displayEmpty
          inputProps={{ 'aria-label': t('filters.context') }}
          sx={{ width: 1, minWidth: 0 }}
        >
          {contextOptionsWithCurrent.map((option) => (
            <MenuItem
              key={contextId(option)}
              value={contextId(option)}
              disabled={
                currentFilters.contextFilters.length >= MAX_NOTIFICATION_CONTEXT_FILTERS &&
                !currentFilters.contextFilters.map(contextId).includes(contextId(option))
              }
            >
              <Checkbox
                size="small"
                checked={currentFilters.contextFilters.map(contextId).includes(contextId(option))}
              />
              {option.label || option.key}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={currentFilters.priority}
          onChange={(event) =>
            updateFilters({ priority: event.target.value as CenterFilters['priority'] })
          }
          size="small"
          inputProps={{ 'aria-label': t('filters.priority') }}
          sx={{ width: 1, minWidth: 0 }}
        >
          {(['ALL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'] as const).map((priority) => (
            <MenuItem key={priority} value={priority}>
              {priority === 'ALL' ? t('filters.allPriorities') : t(`priority.${priority}`)}
            </MenuItem>
          ))}
        </Select>
        <ActionIconButton
          label={t('filters.reset')}
          disabled={!hasNotificationFilters(currentFilters)}
          onClick={() => updateFilters(cloneFilters(EMPTY_NOTIFICATION_FILTERS))}
          size="small"
        >
          <RotateCcw size={17} />
        </ActionIconButton>
      </Box>
    );
  }

  function includedTypeLabel(type: NotificationIncludedType): string {
    return type === 'ASSIGNED' ? t('reason.ROLE') : t(`reason.${type}`, { defaultValue: type });
  }
}

function countAdvancedNotificationFilters(filters: CenterFilters): number {
  return [
    filters.readState !== 'ALL',
    Boolean(filters.appKey),
    filters.attentionEffect !== 'ALL',
    filters.reason !== 'ALL',
    filters.includedTypes.length > 0,
    filters.contextFilters.length > 0,
    filters.priority !== 'ALL',
  ].filter(Boolean).length;
}

function contextId(context: NotificationContextOption): string {
  return `${context.kind}:${encodeURIComponent(context.key)}`;
}
