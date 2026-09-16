import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, History, RotateCcw, Save, Search, Undo2 } from 'lucide-react';
import { ActionButton, ActionIconButton, FormField } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HomeOverviewWidget } from '../features/home/home-overview-widget';
import { HomeWidgetErrorBoundary } from '../features/home/runtime/home-content-state';
import {
  HOME_STUDIO_INSTANCE_CAP,
  homeStudioRegistryReasonKey,
  homeStudioRegistryStateKey,
  isNativeWidgetKey,
  moveStudioWidget,
  resolveHomeStudioCatalog,
  type StudioCatalogItem,
  type StudioCatalogKind,
} from './home-layout-studio-model';
import { useHomeLayoutStudioDraft } from './use-home-layout-studio-draft';

export {
  HOME_STUDIO_CATALOG,
  HOME_STUDIO_INSTANCE_CAP,
  homeStudioRegistryReasonKey,
  homeStudioRegistryStateKey,
  homeStudioWidgetsEqual,
  moveStudioWidget,
  reconcileStudioWidgets,
  resolveHomeStudioCatalog,
} from './home-layout-studio-model';

import type {
  EffectiveWidgetCatalog,
  HomeOverview,
  PersonalHomeWidgetPreference,
  HomeRecommendation,
  HomeView,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { HomeWidgetRuntimeDecisions } from './home-widget-runtime-contract';

const CATALOG_ROW_HEIGHT = 64;
const CATALOG_VIEWPORT_ROWS = 8;
const CATALOG_OVERSCAN = 3;
type StudioWidgetPreference = PersonalHomeWidgetPreference<string>;

type HomeLayoutStudioWorkbenchProps = Readonly<{
  view: HomeView | null;
  overview?: HomeOverview;
  overviewLoading: boolean;
  overviewFetching: boolean;
  overviewFailed: boolean;
  widgetRuntimeDecisions: HomeWidgetRuntimeDecisions;
  effectiveWidgetCatalog?: EffectiveWidgetCatalog;
  busy: boolean;
  feedbackBusy: boolean;
  onRetryOverview: () => void;
  onRecommendationFeedback?: (recommendation: HomeRecommendation) => void;
  onSave: (widgets: StudioWidgetPreference[], baseVersion: number) => void;
  onOpenHistory: () => void;
  forceResetToken?: number;
}>;

export function HomeLayoutStudioWorkbench({
  view,
  overview,
  overviewLoading,
  overviewFetching,
  overviewFailed,
  widgetRuntimeDecisions,
  effectiveWidgetCatalog,
  busy,
  feedbackBusy,
  onRetryOverview,
  onRecommendationFeedback,
  onSave,
  onOpenHistory,
  forceResetToken = 0,
}: HomeLayoutStudioWorkbenchProps) {
  const { t } = useTranslation('homeStudio');
  const { baseline, baseVersion, draft, canUndo, dirty, commitDraft, undo, reset } =
    useHomeLayoutStudioDraft(view, forceResetToken);
  const [selectedKey, setSelectedKey] = useState<string>(baseline[0]?.widgetKey ?? 'command-rail');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | StudioCatalogKind>('all');
  const [catalogScrollTop, setCatalogScrollTop] = useState(0);
  const catalog = useMemo(
    () => resolveHomeStudioCatalog(effectiveWidgetCatalog, view?.modeKey),
    [effectiveWidgetCatalog, view?.modeKey]
  );

  useEffect(() => {
    setSelectedKey((current) =>
      catalog.some(({ key }) => key === current) ? current : (catalog[0]?.key ?? '')
    );
  }, [catalog]);

  const selected = catalog.find(({ key }) => key === selectedKey) ?? catalog[0];
  const selectedIndex = draft.findIndex(({ widgetKey }) => widgetKey === selected?.key);
  const selectedPreference = selectedIndex >= 0 ? draft[selectedIndex] : undefined;
  const selectedRuntimeDecision = isNativeWidgetKey(selected?.key)
    ? widgetRuntimeDecisions[selected.key]
    : undefined;
  const selectedUnavailable =
    selected?.effectiveState === 'DENY' || selected?.effectiveState === 'DEPRECATED';
  const selectedCanAdd =
    Boolean(selected?.canAdd) && !selectedUnavailable && draft.length < HOME_STUDIO_INSTANCE_CAP;
  const catalogLabel = (item: StudioCatalogItem) =>
    item.translatedLabel === false ? item.catalogId : t(`layout.catalog.items.${item.key}`);
  const catalogFieldValue = (
    item: StudioCatalogItem,
    field: 'owner' | 'source' | 'permission' | 'supportedWidths' | 'dataBudget' | 'targetRegion'
  ) => {
    const registryItem = item.registryItem;
    if (!registryItem) return item[field];
    if (field === 'owner') {
      return t('layout.inspector.registry.owner', {
        owner: registryItem.definitionKey.split('.').slice(0, 2).join('.'),
      });
    }
    if (field === 'source') {
      return registryItem.resolvedVersionId
        ? t('layout.inspector.registry.version', {
            version: registryItem.semanticVersion ?? registryItem.resolvedVersionId,
          })
        : t('layout.inspector.registry.unresolved');
    }
    if (field === 'permission') {
      return t('layout.inspector.registry.permission', {
        reasons: registryItem.reasonCodes
          .map((reason) =>
            t(`layout.inspector.registry.reasons.${homeStudioRegistryReasonKey(reason)}`)
          )
          .join(', '),
      });
    }
    if (field === 'supportedWidths') {
      return t(
        registryItem.placementCapabilities.canResize
          ? 'layout.inspector.registry.resizable'
          : 'layout.inspector.registry.fixed'
      );
    }
    if (field === 'dataBudget') return t('layout.inspector.registry.dataBudget');
    return t('layout.inspector.registry.target', {
      state: t(
        `layout.inspector.registry.states.${homeStudioRegistryStateKey(registryItem.effectiveState)}`
      ),
    });
  };
  const filteredCatalog = catalog.filter((item) => {
    const matchesKind = filter === 'all' || item.kind === filter;
    const label = `${catalogLabel(item)} ${item.catalogId}`.toLocaleLowerCase();
    return matchesKind && label.includes(query.trim().toLocaleLowerCase());
  });
  const virtualized = filteredCatalog.length > 30;
  const firstRenderedCatalogIndex = virtualized
    ? Math.max(0, Math.floor(catalogScrollTop / CATALOG_ROW_HEIGHT) - CATALOG_OVERSCAN)
    : 0;
  const renderedCatalog = virtualized
    ? filteredCatalog.slice(
        firstRenderedCatalogIndex,
        firstRenderedCatalogIndex + CATALOG_VIEWPORT_ROWS + CATALOG_OVERSCAN * 2
      )
    : filteredCatalog;

  useEffect(() => {
    setCatalogScrollTop(0);
  }, [filter, query]);

  const save = () => {
    if (!view || baseVersion === null || !dirty || busy) return;
    onSave(draft, baseVersion);
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
          disabled={!canUndo || busy}
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

  const nativeDraft = draft.filter((widget): widget is HomeWidgetPreference =>
    isNativeWidgetKey(widget.widgetKey)
  );
  const unsupportedDraft = draft.filter((widget) => !isNativeWidgetKey(widget.widgetKey));
  const projectionCatalog = catalog.filter(({ kind }) => kind === 'projection');
  const columns = [
    nativeDraft.filter(
      (widget) => widget.visible && [0, 3, 6].includes(nativeDraft.indexOf(widget))
    ),
    nativeDraft.filter((widget) => widget.visible && [1, 4].includes(nativeDraft.indexOf(widget))),
    nativeDraft.filter((widget) => widget.visible && [2, 5].includes(nativeDraft.indexOf(widget))),
  ] as const;

  return (
    <Box
      data-testid="home-layout-studio-workbench"
      data-home-studio-catalog-count={catalog.length}
      data-home-studio-native-count={catalog.filter(({ kind }) => kind === 'native').length}
      data-home-studio-projection-count={projectionCatalog.length}
      data-home-studio-catalog-rendered-count={renderedCatalog.length}
      data-home-studio-catalog-virtualized={virtualized ? 'true' : 'false'}
      data-home-studio-catalog-mode={effectiveWidgetCatalog?.mode.toLowerCase() ?? 'static'}
      data-home-studio-instance-cap={HOME_STUDIO_INSTANCE_CAP}
      data-home-studio-instance-count={draft.length}
      data-home-studio-native-instance-count={nativeDraft.length}
      data-home-studio-unsupported-instance-count={unsupportedDraft.length}
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
            {t('layout.catalog.count', { count: catalog.length })}
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
          <Box
            key={`${filter}:${query}`}
            data-home-studio-catalog-viewport
            tabIndex={virtualized ? 0 : undefined}
            aria-label={virtualized ? t('layout.catalog.keyboardViewport') : undefined}
            onScroll={(event) => setCatalogScrollTop(event.currentTarget.scrollTop)}
            onKeyDown={(event) => {
              if (!virtualized || event.target !== event.currentTarget) return;
              const scrollTarget = event.currentTarget;
              let nextScrollTop = scrollTarget.scrollTop;
              if (event.key === 'Home') nextScrollTop = 0;
              else if (event.key === 'End')
                nextScrollTop = Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
              else if (event.key === 'PageDown') nextScrollTop += scrollTarget.clientHeight;
              else if (event.key === 'PageUp') nextScrollTop -= scrollTarget.clientHeight;
              else return;
              scrollTarget.scrollTop = nextScrollTop;
              setCatalogScrollTop(nextScrollTop);
              event.preventDefault();
            }}
            sx={{
              height: virtualized ? CATALOG_ROW_HEIGHT * CATALOG_VIEWPORT_ROWS : 'auto',
              overflowY: virtualized ? 'auto' : 'visible',
            }}
          >
            <Box
              sx={
                virtualized
                  ? { height: filteredCatalog.length * CATALOG_ROW_HEIGHT, position: 'relative' }
                  : { display: 'flex', flexDirection: 'column', gap: 0.75 }
              }
            >
              {renderedCatalog.map((item, renderedIndex) => {
                const Icon = item.icon;
                const selectedItem = selectedKey === item.key;
                const catalogIndex = firstRenderedCatalogIndex + renderedIndex;
                return (
                  <ButtonBase
                    key={item.key}
                    data-home-studio-catalog-item={item.key}
                    data-home-studio-catalog-id={item.catalogId}
                    data-home-studio-renderer={item.kind}
                    data-home-studio-effective-state={item.effectiveState}
                    data-home-studio-reason-codes={item.reasonCodes?.join(',')}
                    aria-pressed={selectedItem}
                    onClick={() => setSelectedKey(item.key)}
                    sx={{
                      width: 1,
                      height: 56,
                      p: 1,
                      gap: 1,
                      justifyContent: 'flex-start',
                      textAlign: 'start',
                      border: 1,
                      borderColor: selectedItem ? 'primary.main' : 'divider',
                      borderRadius: foundationTokens.home.radius.control,
                      bgcolor: selectedItem ? 'action.selected' : 'background.paper',
                      ...(virtualized
                        ? {
                            position: 'absolute',
                            top: catalogIndex * CATALOG_ROW_HEIGHT,
                            insetInline: 0,
                          }
                        : {}),
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <Box minWidth={0} flex={1}>
                      <Typography
                        variant="body2"
                        fontWeight={foundationTokens.home.typography.weightSemibold}
                      >
                        {catalogLabel(item)}
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
            </Box>
          </Box>
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
          {selected ? (
            <>
              <Typography
                variant="body2"
                fontWeight={foundationTokens.home.typography.weightBold}
                sx={{ mt: 1.5 }}
              >
                {catalogLabel(selected)}
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
                    {catalogFieldValue(selected, field)}
                  </Typography>
                </Box>
              ))}
              {(selected.kind === 'projection' || selectedUnavailable) && (
                <Box
                  data-home-studio-safe-placeholder={selected.catalogId}
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
              )}
              {selectedPreference ? (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {t('layout.inspector.order')}
                  </Typography>
                  <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
                    <ActionIconButton
                      label={t('layout.actions.moveEarlier')}
                      disabled={
                        selectedUnavailable ||
                        selected.canMove === false ||
                        selectedIndex <= 0 ||
                        busy
                      }
                      onClick={() => commitDraft(moveStudioWidget(draft, selected.key, -1))}
                      sx={{ width: 44, height: 44 }}
                    >
                      <ArrowUp size={17} />
                    </ActionIconButton>
                    <ActionIconButton
                      label={t('layout.actions.moveLater')}
                      disabled={
                        selectedUnavailable ||
                        selected.canMove === false ||
                        selectedIndex < 0 ||
                        selectedIndex === draft.length - 1 ||
                        busy
                      }
                      onClick={() => commitDraft(moveStudioWidget(draft, selected.key, 1))}
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
                    disabled={
                      selectedUnavailable ||
                      selected.canHide === false ||
                      (!selectedPreference.visible &&
                        selectedRuntimeDecision?.canRestore === false) ||
                      busy
                    }
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
                    {selectedPreference.visible
                      ? t('layout.actions.hide')
                      : t('layout.actions.show')}
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  intent="primary"
                  size="small"
                  disabled={!selectedCanAdd || busy}
                  onClick={() =>
                    commitDraft([
                      ...draft,
                      {
                        widgetKey: selected.key,
                        visible: true,
                        size: 'compact',
                        height: 'standard',
                      },
                    ])
                  }
                  sx={{ minHeight: 44, mt: 1.5 }}
                >
                  {t('layout.actions.add')}
                </ActionButton>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('layout.catalog.empty')}
            </Typography>
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
                      '& [data-testid="home-priority-rail"] > * + *': {
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
          {unsupportedDraft.length > 0 && (
            <Box
              component="section"
              aria-label={t('layout.canvas.unsupportedInstances')}
              data-home-studio-unsupported-instances={unsupportedDraft.length}
              sx={{
                mt: 1.5,
                p: 1.25,
                border: 1,
                borderColor: 'warning.main',
                borderRadius: foundationTokens.home.radius.compactCard,
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={foundationTokens.home.typography.weightEmphasis}
              >
                {t('layout.canvas.unsupportedInstances')}
              </Typography>
              <Stack gap={0.75} sx={{ mt: 1 }}>
                {unsupportedDraft.map((widget) => (
                  <Box
                    key={widget.widgetKey}
                    data-home-studio-unsupported-instance={widget.widgetKey}
                    data-home-studio-unsupported-visible={widget.visible ? 'true' : 'false'}
                    sx={{
                      p: 1,
                      bgcolor: 'action.disabledBackground',
                      borderRadius: foundationTokens.home.radius.control,
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={foundationTokens.home.typography.weightBold}
                    >
                      {widget.widgetKey}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('layout.canvas.unsupportedPreserved')}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
          <Box
            component="section"
            aria-label={t('layout.canvas.projectionPreview')}
            data-home-studio-projection-preview
            data-home-studio-projection-total={projectionCatalog.length}
            data-home-studio-projection-rendered={Math.min(5, projectionCatalog.length)}
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
              {projectionCatalog.slice(0, 5).map((item) => (
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
