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
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  EMPTY_NOTIFICATION_FILTERS,
  hasNotificationFilters,
  NOTIFICATION_REASONS,
} from './notification-filter-model';
import type { CenterFilters } from './notification-filter-model';
import type {
  NotificationSummary,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

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
  onViewChange,
  onChange,
}: {
  view: NotificationView;
  filters: CenterFilters;
  summary?: NotificationSummary;
  appOptions: Array<[string, string]>;
  onViewChange: (view: NotificationView) => void;
  onChange: (filters: CenterFilters) => void;
}) {
  const { t } = useTranslation('notifications');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const update = (patch: Partial<CenterFilters>) => onChange({ ...filters, ...patch });
  return (
    <Box component="section" aria-label={t('workbench.filters.label')} sx={{ mt: 2 }}>
      <Select
        value={view}
        size="small"
        fullWidth
        onChange={(event) => onViewChange(event.target.value as NotificationView)}
        inputProps={{ 'aria-label': t('center.viewsLabel') }}
        sx={{ display: { xs: 'flex', md: 'none' }, minHeight: 44 }}
      >
        {VIEWS.map(({ key }) => (
          <MenuItem key={key} value={key}>
            {t(`views.${key}`)}
          </MenuItem>
        ))}
      </Select>
      <Stack
        component="nav"
        aria-label={t('center.viewsLabel')}
        direction="row"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
          gap: 0.5,
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
              minHeight: 44,
              flexShrink: 0,
              gap: 0.75,
              borderRadius: 0,
              borderBottom: 2,
              borderColor: view === key ? 'primary.main' : 'transparent',
              color: view === key ? 'primary.main' : 'text.secondary',
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
                  borderRadius: 'shape.borderRadius',
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
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(220px, 1fr) auto' },
          gap: 1,
          py: 1.5,
        }}
      >
        <FormField
          value={filters.query}
          onChange={(event) => update({ query: event.target.value })}
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
        <ActionButton
          intent="secondary"
          startIcon={<SlidersHorizontal size={17} />}
          onClick={() => setFiltersOpen(true)}
          sx={{ display: { xs: 'flex', md: 'none' }, minHeight: 44 }}
        >
          {t('filters.open')}
        </ActionButton>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>{renderFilters()}</Box>
      </Box>
      <Drawer
        anchor="bottom"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        slotProps={{ paper: { 'aria-label': t('filters.open') } }}
      >
        <Box sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography component="h2" variant="subtitle1">
              {t('filters.open')}
            </Typography>
            <ActionIconButton label={t('filters.close')} onClick={() => setFiltersOpen(false)}>
              <X size={18} />
            </ActionIconButton>
          </Stack>
          {renderFilters()}
        </Box>
      </Drawer>
    </Box>
  );

  function renderFilters() {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Select
          value={filters.readState}
          onChange={(event) =>
            update({ readState: event.target.value as CenterFilters['readState'] })
          }
          size="small"
          inputProps={{ 'aria-label': t('filters.readState') }}
          sx={{ flexGrow: { xs: 1, md: 0 }, minWidth: 120 }}
        >
          {(['ALL', 'UNREAD', 'READ'] as const).map((state) => (
            <MenuItem key={state} value={state}>
              {t(`filters.read.${state}`)}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={filters.appKey}
          onChange={(event) => update({ appKey: event.target.value })}
          size="small"
          displayEmpty
          inputProps={{ 'aria-label': t('filters.app') }}
          sx={{ flexGrow: { xs: 1, md: 0 }, minWidth: 124, maxWidth: '100%' }}
        >
          <MenuItem value="">{t('filters.allApps')}</MenuItem>
          {appOptions.map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {t(`sources.${key.toLowerCase()}`, { defaultValue: label })}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={filters.reason}
          disabled={view === 'MENTIONS'}
          onChange={(event) => update({ reason: event.target.value as CenterFilters['reason'] })}
          size="small"
          inputProps={{ 'aria-label': t('filters.reason') }}
          sx={{ flexGrow: { xs: 1, md: 0 }, minWidth: 144, maxWidth: '100%' }}
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
          value={filters.priority}
          onChange={(event) =>
            update({ priority: event.target.value as CenterFilters['priority'] })
          }
          size="small"
          inputProps={{ 'aria-label': t('filters.priority') }}
          sx={{ flexGrow: { xs: 1, md: 0 }, minWidth: 124 }}
        >
          {(['ALL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'] as const).map((priority) => (
            <MenuItem key={priority} value={priority}>
              {priority === 'ALL' ? t('filters.allPriorities') : t(`priority.${priority}`)}
            </MenuItem>
          ))}
        </Select>
        <ActionIconButton
          label={t('filters.reset')}
          disabled={!hasNotificationFilters(filters)}
          onClick={() => onChange({ ...EMPTY_NOTIFICATION_FILTERS })}
          size="small"
        >
          <RotateCcw size={17} />
        </ActionIconButton>
      </Box>
    );
  }
}
