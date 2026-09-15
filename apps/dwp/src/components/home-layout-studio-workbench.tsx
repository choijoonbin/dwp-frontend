import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Building2,
  CalendarCheck2,
  History,
  MessageSquareText,
  RotateCcw,
  Save,
  Search,
  Undo2,
} from 'lucide-react';
import { ActionButton, ActionIconButton, FormField } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HOME_WIDGET_REGISTRY, reconcileHomeWidgets } from '../features/home/home-widget-registry';
import { HomeOverviewWidget } from '../features/home/home-overview-widget';
import { HomeWidgetErrorBoundary } from '../features/home/runtime/home-content-state';

import type {
  HomeOverview,
  HomeRecommendation,
  HomeView,
  HomeWidgetKey,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { AriaAttributes, ComponentType } from 'react';
import type { HomeWidgetRuntimeDecisions } from '../features/home/runtime/widget-registry-runtime';

type StudioIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  'aria-hidden'?: AriaAttributes['aria-hidden'];
}>;

type StudioCatalogKind = 'native' | 'projection';

type StudioCatalogItem = Readonly<{
  key: string;
  catalogId: string;
  kind: StudioCatalogKind;
  owner: string;
  source: string;
  permission: string;
  supportedWidths: string;
  dataBudget: string;
  targetRegion: string;
  icon: StudioIcon;
}>;

const nativeMetadata: Readonly<
  Record<HomeWidgetKey, Omit<StudioCatalogItem, 'key' | 'catalogId' | 'kind'>>
> = {
  'command-rail': {
    owner: 'DWP Work',
    source: 'home.contributions.action',
    permission: 'APP.WORK:VIEW',
    supportedWidths: '38% / 34% / 28%',
    dataBudget: '30 s freshness · 24 KB',
    targetRegion: 'Priority canvas · lead',
    icon: HOME_WIDGET_REGISTRY[0]!.icon,
  },
  schedule: {
    owner: 'DWP Calendar',
    source: 'home.contributions.timeline',
    permission: 'APP.CALENDAR:VIEW',
    supportedWidths: '38% / 34%',
    dataBudget: '60 s freshness · 16 KB',
    targetRegion: 'Schedule · lead/support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'schedule')!.icon,
  },
  'daily-brief': {
    owner: 'DWP Home',
    source: 'home.recommendations',
    permission: 'HOME:VIEW',
    supportedWidths: '38% / 34% / 28%',
    dataBudget: '5 min freshness · 20 KB',
    targetRegion: 'Brief · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'daily-brief')!.icon,
  },
  focus: {
    owner: 'DWP Services',
    source: 'home.requests',
    permission: 'APP.EMPLOYEE_SERVICES:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: '5 min freshness · 12 KB',
    targetRegion: 'Requests · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'focus')!.icon,
  },
  activity: {
    owner: 'DWP Activity',
    source: 'home.activity',
    permission: 'APP.ACTIVITY:VIEW',
    supportedWidths: '38% / 34%',
    dataBudget: '2 min freshness · 24 KB',
    targetRegion: 'Activity · lead/support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'activity')!.icon,
  },
  'focus-balance': {
    owner: 'DWP Calendar',
    source: 'calendar.focus-insight',
    permission: 'APP.CALENDAR:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: '5 min freshness · 8 KB',
    targetRegion: 'Insight · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'focus-balance')!.icon,
  },
  'meeting-load': {
    owner: 'DWP Calendar',
    source: 'calendar.meeting-load',
    permission: 'APP.CALENDAR:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: '5 min freshness · 8 KB',
    targetRegion: 'Insight · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'meeting-load')!.icon,
  },
};

function nativeCatalogItem(key: HomeWidgetKey, catalogId: string): StudioCatalogItem {
  return { key, catalogId, kind: 'native', ...nativeMetadata[key] };
}

export const HOME_STUDIO_CATALOG: readonly StudioCatalogItem[] = [
  nativeCatalogItem('schedule', 'meetings.next-prep'),
  {
    catalogId: 'meetings.decisions',
    key: 'meetings-prep-decisions',
    kind: 'projection',
    owner: 'DWP Meetings',
    source: 'meetings.decisions',
    permission: 'APP.MEETINGS:VIEW',
    supportedWidths: '38% / 34%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'Meeting preparation · lead',
    icon: CalendarCheck2,
  },
  {
    catalogId: 'space.feed',
    key: 'space-change-feed',
    kind: 'projection',
    owner: 'DWP Space',
    source: 'space.change-feed',
    permission: 'APP.SPACES:VIEW',
    supportedWidths: '38% / 34%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'Collaboration feed · lead',
    icon: MessageSquareText,
  },
  {
    catalogId: 'dwai.artifacts',
    key: 'dwaion-artifact',
    kind: 'projection',
    owner: 'DWAI·ON',
    source: 'dwaion.artifact',
    permission: 'APP.DWAION_ARTIFACTS:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'AI continuation · support',
    icon: Bot,
  },
  {
    catalogId: 'workplace.status',
    key: 'workplace-booking',
    kind: 'projection',
    owner: 'DWP Workplace',
    source: 'workplace.booking',
    permission: 'APP.WORKPLACE:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'Workplace status · support',
    icon: Building2,
  },
  {
    catalogId: 'hr.learning',
    key: 'learning-progress',
    kind: 'projection',
    owner: 'DWP People',
    source: 'hr.edu',
    permission: 'APP.HCM:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'Learning progress · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'focus')!.icon,
  },
  nativeCatalogItem('focus', 'services.requests'),
  nativeCatalogItem('daily-brief', 'security.bulletin'),
  nativeCatalogItem('command-rail', 'home.priority-queue'),
  nativeCatalogItem('activity', 'home.role-activity'),
  nativeCatalogItem('focus-balance', 'calendar.focus-balance'),
  nativeCatalogItem('meeting-load', 'calendar.meeting-load'),
] as const;

export function moveStudioWidget(
  widgets: readonly HomeWidgetPreference[],
  widgetKey: HomeWidgetKey,
  direction: -1 | 1
): HomeWidgetPreference[] {
  const index = widgets.findIndex((widget) => widget.widgetKey === widgetKey);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= widgets.length) return [...widgets];
  const next = [...widgets];
  const [widget] = next.splice(index, 1);
  if (!widget) return [...widgets];
  next.splice(target, 0, widget);
  return next;
}

export function homeStudioWidgetsEqual(
  left: readonly HomeWidgetPreference[],
  right: readonly HomeWidgetPreference[]
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

type HomeLayoutStudioWorkbenchProps = Readonly<{
  view: HomeView | null;
  overview?: HomeOverview;
  overviewLoading: boolean;
  overviewFetching: boolean;
  overviewFailed: boolean;
  widgetRuntimeDecisions: HomeWidgetRuntimeDecisions;
  busy: boolean;
  feedbackBusy: boolean;
  onRetryOverview: () => void;
  onRecommendationFeedback: (recommendation: HomeRecommendation) => void;
  onSave: (widgets: HomeWidgetPreference[]) => void;
  onOpenHistory: () => void;
}>;

export function HomeLayoutStudioWorkbench({
  view,
  overview,
  overviewLoading,
  overviewFetching,
  overviewFailed,
  widgetRuntimeDecisions,
  busy,
  feedbackBusy,
  onRetryOverview,
  onRecommendationFeedback,
  onSave,
  onOpenHistory,
}: HomeLayoutStudioWorkbenchProps) {
  const { t } = useTranslation('homeStudio');
  const baseline = useMemo(() => reconcileHomeWidgets(view?.layout.widgets), [view]);
  const [draft, setDraft] = useState<HomeWidgetPreference[]>(baseline);
  const [history, setHistory] = useState<HomeWidgetPreference[][]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(baseline[0]?.widgetKey ?? 'command-rail');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | StudioCatalogKind>('all');

  useEffect(() => {
    setDraft(baseline);
    setHistory([]);
    setSelectedKey((current) =>
      HOME_STUDIO_CATALOG.some(({ key }) => key === current)
        ? current
        : (baseline[0]?.widgetKey ?? 'command-rail')
    );
  }, [baseline]);

  const selected = HOME_STUDIO_CATALOG.find(({ key }) => key === selectedKey)!;
  const selectedIndex = draft.findIndex(({ widgetKey }) => widgetKey === selectedKey);
  const selectedPreference = selectedIndex >= 0 ? draft[selectedIndex] : undefined;
  const dirty = !homeStudioWidgetsEqual(draft, baseline);
  const filteredCatalog = HOME_STUDIO_CATALOG.filter((item) => {
    const matchesKind = filter === 'all' || item.kind === filter;
    const label = `${t(`layout.catalog.items.${item.key}`)} ${item.catalogId}`.toLocaleLowerCase();
    return matchesKind && label.includes(query.trim().toLocaleLowerCase());
  });

  const commitDraft = (next: HomeWidgetPreference[]) => {
    setHistory((current) => [...current.slice(-19), draft]);
    setDraft(next);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setDraft(previous);
    setHistory((current) => current.slice(0, -1));
  };
  const reset = () => {
    if (homeStudioWidgetsEqual(draft, baseline)) return;
    setHistory((current) => [...current.slice(-19), draft]);
    setDraft(baseline);
  };
  const save = () => {
    if (!view || !dirty || busy) return;
    onSave(draft);
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  };

  const controls = (placement: 'top' | 'bottom') => (
    <Stack
      data-home-studio-controls={placement}
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
      flexWrap="wrap"
      sx={{
        p: 1.25,
        borderBottom: placement === 'top' ? 1 : 0,
        borderTop: placement === 'bottom' ? 1 : 0,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <Chip
          size="small"
          color={dirty ? 'warning' : 'success'}
          label={dirty ? t('layout.status.dirty') : t('layout.status.saved')}
          data-home-studio-dirty={dirty ? 'true' : 'false'}
        />
        <Typography variant="caption" color="text.secondary">
          {t('layout.shortcuts')}
        </Typography>
      </Stack>
      <Stack direction="row" gap={0.5}>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<History size={16} />}
          onClick={onOpenHistory}
          sx={{ minHeight: 44 }}
        >
          {t('layout.actions.history')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<Undo2 size={16} />}
          disabled={history.length === 0 || busy}
          onClick={undo}
          sx={{ minHeight: 44 }}
        >
          {t('layout.actions.undo')}
        </ActionButton>
        <ActionButton
          intent="secondary"
          size="small"
          startIcon={<RotateCcw size={16} />}
          disabled={!dirty || busy}
          onClick={reset}
          sx={{ minHeight: 44 }}
        >
          {t('layout.actions.reset')}
        </ActionButton>
        <ActionButton
          intent="primary"
          size="small"
          startIcon={<Save size={16} />}
          disabled={!dirty || !view}
          loading={busy}
          onClick={save}
          sx={{ minHeight: 44 }}
        >
          {t('layout.actions.save')}
        </ActionButton>
      </Stack>
    </Stack>
  );

  const columns = [
    draft.filter((widget) => widget.visible && [0, 3, 6].includes(draft.indexOf(widget))),
    draft.filter((widget) => widget.visible && [1, 4].includes(draft.indexOf(widget))),
    draft.filter((widget) => widget.visible && [2, 5].includes(draft.indexOf(widget))),
  ] as const;

  return (
    <Box
      data-testid="home-layout-studio-workbench"
      data-home-studio-catalog-count={HOME_STUDIO_CATALOG.length}
      data-home-studio-native-count={HOME_WIDGET_REGISTRY.length}
      data-home-studio-projection-count={HOME_STUDIO_CATALOG.length - HOME_WIDGET_REGISTRY.length}
      data-home-editor-focus-contract="dialog-trap-independent-panels-keyboard-save-close-restore"
      onKeyDown={handleKeyDown}
      sx={{
        height: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {controls('top')}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '260px 248px minmax(0, 1fr)' },
          gridTemplateRows: { xs: 'auto auto minmax(420px, 1fr)', lg: 'minmax(0, 1fr)' },
        }}
      >
        <Box
          component="section"
          aria-labelledby="home-studio-catalog-title"
          data-home-editor-scroll-scope="catalog"
          tabIndex={0}
          sx={{
            minHeight: 0,
            overflowY: 'auto',
            p: 1.5,
            borderRight: { lg: 1 },
            borderBottom: { xs: 1, lg: 0 },
            borderColor: 'divider',
          }}
        >
          <Typography
            id="home-studio-catalog-title"
            component="h3"
            variant="subtitle1"
            fontWeight={foundationTokens.home.typography.weightEmphasis}
          >
            {t('layout.catalog.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('layout.catalog.count', { count: HOME_STUDIO_CATALOG.length })}
          </Typography>
          <FormField
            fullWidth
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('layout.catalog.search')}
            inputProps={{ 'aria-label': t('layout.catalog.search') }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ mt: 1.25 }}
          />
          <Stack direction="row" gap={0.5} sx={{ my: 1 }}>
            {(['all', 'native', 'projection'] as const).map((value) => (
              <ActionButton
                key={value}
                intent={filter === value ? 'primary' : 'quiet'}
                size="small"
                onClick={() => setFilter(value)}
                sx={{ minHeight: 44, px: 1 }}
              >
                {t(`layout.catalog.filters.${value}`)}
              </ActionButton>
            ))}
          </Stack>
          <Stack gap={0.75}>
            {filteredCatalog.map((item) => {
              const Icon = item.icon;
              const selectedItem = selectedKey === item.key;
              return (
                <ButtonBase
                  key={item.key}
                  data-home-studio-catalog-item={item.key}
                  data-home-studio-catalog-id={item.catalogId}
                  data-home-studio-renderer={item.kind}
                  aria-pressed={selectedItem}
                  onClick={() => setSelectedKey(item.key)}
                  sx={{
                    width: 1,
                    minHeight: 52,
                    p: 1,
                    gap: 1,
                    justifyContent: 'flex-start',
                    textAlign: 'start',
                    border: 1,
                    borderColor: selectedItem ? 'primary.main' : 'divider',
                    borderRadius: foundationTokens.home.radius.control,
                    bgcolor: selectedItem ? 'action.selected' : 'background.paper',
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  <Box minWidth={0} flex={1}>
                    <Typography
                      variant="body2"
                      fontWeight={foundationTokens.home.typography.weightSemibold}
                    >
                      {t(`layout.catalog.items.${item.key}`)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.catalogId}
                    </Typography>
                  </Box>
                  {item.kind === 'projection' && (
                    <Chip size="small" label={t('layout.catalog.preview')} />
                  )}
                </ButtonBase>
              );
            })}
          </Stack>
        </Box>

        <Box
          component="aside"
          aria-labelledby="home-studio-inspector-title"
          data-home-editor-scroll-scope="inspector"
          tabIndex={0}
          sx={{
            minHeight: 0,
            overflowY: 'auto',
            p: 1.5,
            borderRight: { lg: 1 },
            borderBottom: { xs: 1, lg: 0 },
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography
            id="home-studio-inspector-title"
            component="h3"
            variant="subtitle1"
            fontWeight={foundationTokens.home.typography.weightEmphasis}
          >
            {t('layout.inspector.title')}
          </Typography>
          <Typography
            variant="body2"
            fontWeight={foundationTokens.home.typography.weightBold}
            sx={{ mt: 1.5 }}
          >
            {t(`layout.catalog.items.${selected.key}`)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {selected.catalogId}
          </Typography>
          <Chip
            size="small"
            color={selected.kind === 'native' ? 'success' : 'default'}
            label={t(`layout.inspector.${selected.kind}`)}
            sx={{ mt: 0.75 }}
          />
          <Divider sx={{ my: 1.5 }} />
          {(
            [
              'owner',
              'source',
              'permission',
              'supportedWidths',
              'dataBudget',
              'targetRegion',
            ] as const
          ).map((field) => (
            <Box key={field} data-home-studio-inspector-field={field} sx={{ mb: 1.25 }}>
              <Typography variant="caption" color="text.secondary">
                {t(`layout.inspector.${field}`)}
              </Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {selected[field]}
              </Typography>
            </Box>
          ))}
          {selected.kind === 'projection' ? (
            <Box
              sx={{
                mt: 2,
                p: 1.25,
                bgcolor: 'warning.light',
                borderRadius: foundationTokens.home.radius.control,
              }}
            >
              <Typography
                variant="caption"
                color="warning.dark"
                fontWeight={foundationTokens.home.typography.weightBold}
              >
                {t('layout.inspector.wave4Title')}
              </Typography>
              <Typography variant="body2">{t('layout.inspector.wave4Description')}</Typography>
            </Box>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary">
                {t('layout.inspector.order')}
              </Typography>
              <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
                <ActionIconButton
                  label={t('layout.actions.moveEarlier')}
                  disabled={selectedIndex <= 0 || busy}
                  onClick={() =>
                    commitDraft(moveStudioWidget(draft, selected.key as HomeWidgetKey, -1))
                  }
                  sx={{ width: 44, height: 44 }}
                >
                  <ArrowUp size={17} />
                </ActionIconButton>
                <ActionIconButton
                  label={t('layout.actions.moveLater')}
                  disabled={selectedIndex < 0 || selectedIndex === draft.length - 1 || busy}
                  onClick={() =>
                    commitDraft(moveStudioWidget(draft, selected.key as HomeWidgetKey, 1))
                  }
                  sx={{ width: 44, height: 44 }}
                >
                  <ArrowDown size={17} />
                </ActionIconButton>
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                {t('layout.inspector.visibility')}
              </Typography>
              <ActionButton
                intent="secondary"
                size="small"
                disabled={!selectedPreference || busy}
                onClick={() =>
                  commitDraft(
                    draft.map((widget) =>
                      widget.widgetKey === selected.key
                        ? { ...widget, visible: !widget.visible }
                        : widget
                    )
                  )
                }
                sx={{ minHeight: 44, mt: 0.5 }}
              >
                {selectedPreference?.visible ? t('layout.actions.hide') : t('layout.actions.show')}
              </ActionButton>
            </>
          )}
        </Box>

        <Box
          component="section"
          aria-labelledby="home-studio-canvas-title"
          data-home-editor-scroll-scope="canvas"
          data-home-studio-canvas-ratio="38-34-28"
          data-home-studio-preview-density="compact"
          tabIndex={0}
          sx={{ minWidth: 0, minHeight: 0, overflowY: 'auto', p: 1.5 }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={2}
            mb={1.25}
          >
            <Box>
              <Typography
                id="home-studio-canvas-title"
                component="h3"
                variant="subtitle1"
                fontWeight={foundationTokens.home.typography.weightEmphasis}
              >
                {t('layout.canvas.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('layout.canvas.description')}
              </Typography>
            </Box>
            <Chip size="small" color="primary" variant="outlined" label="38 / 34 / 28" />
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 38fr) minmax(0, 34fr) minmax(0, 28fr)',
              gap: 1.25,
              alignItems: 'start',
            }}
          >
            {columns.map((column, columnIndex) => (
              <Stack
                key={columnIndex}
                data-home-studio-canvas-column={columnIndex + 1}
                gap={1.25}
                minWidth={0}
              >
                {column.map((widget) => (
                  <Box
                    key={widget.widgetKey}
                    data-home-studio-native-renderer={widget.widgetKey}
                    data-home-studio-preview-item-budget={
                      widget.widgetKey === 'command-rail' ? 1 : undefined
                    }
                    sx={{
                      minWidth: 0,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: selectedKey === widget.widgetKey ? 'primary.main' : 'divider',
                      borderRadius: foundationTokens.home.radius.compactCard,
                      overflow: 'hidden',
                      '& section': { px: '12px !important', py: '12px !important' },
                      '& h2, & h3': {
                        fontSize: foundationTokens.home.typography.cardSizeImportant,
                      },
                      '& .MuiTypography-root': {
                        minWidth: 0,
                        wordBreak: 'keep-all !important',
                        overflowWrap: 'normal !important',
                      },
                      '& [role="listitem"] .MuiTypography-root, & button .MuiTypography-root': {
                        display: '-webkit-box',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                      },
                      '& [data-testid="home-priority-rail"]': {
                        gridTemplateColumns: 'minmax(0, 1fr) !important',
                      },
                      '& [data-testid="home-priority-rail"] > :not(:first-child)': {
                        display: 'none',
                      },
                    }}
                  >
                    <HomeWidgetErrorBoundary
                      widgetKey={widget.widgetKey}
                      resetKey={overview?.generatedAt}
                    >
                      <HomeOverviewWidget
                        widgetKey={widget.widgetKey}
                        size={widget.size ?? 'compact'}
                        height={widget.height ?? 'short'}
                        runtimeDecision={widgetRuntimeDecisions[widget.widgetKey]}
                        label={t(`layout.catalog.items.${widget.widgetKey}`)}
                        overview={overview}
                        loading={overviewLoading}
                        fetching={overviewFetching}
                        requestFailed={overviewFailed}
                        onRetry={onRetryOverview}
                        feedbackBusy={feedbackBusy}
                        onRecommendationFeedback={onRecommendationFeedback}
                      />
                    </HomeWidgetErrorBoundary>
                  </Box>
                ))}
              </Stack>
            ))}
          </Box>
          <Box
            component="section"
            aria-label={t('layout.canvas.projectionPreview')}
            data-home-studio-projection-preview
            sx={{
              mt: 1.5,
              p: 1.25,
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.home.radius.compactCard,
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={foundationTokens.home.typography.weightEmphasis}
            >
              {t('layout.canvas.projectionPreview')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('layout.canvas.projectionPreviewDescription')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: 0.75,
                mt: 1,
              }}
            >
              {HOME_STUDIO_CATALOG.filter(({ kind }) => kind === 'projection').map((item) => (
                <Box
                  key={item.key}
                  data-home-studio-projection-placeholder={item.catalogId}
                  aria-disabled="true"
                  sx={{
                    p: 1,
                    minWidth: 0,
                    bgcolor: 'action.disabledBackground',
                    borderRadius: foundationTokens.home.radius.control,
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={foundationTokens.home.typography.weightBold}
                    display="block"
                  >
                    {item.catalogId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('layout.catalog.preview')}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
      {controls('bottom')}
    </Box>
  );
}
