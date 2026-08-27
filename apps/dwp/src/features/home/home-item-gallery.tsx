import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { ActionButton, ContentDialog, EmptyState, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { AppGlyph } from './app-glyph';
import {
  filterHomeGalleryItems,
  homeGalleryActionableCount,
  homeGalleryRestorableCount,
  matchesHomeGallerySearch,
  resolveHomeAppGalleryItems,
  resolveHomeWidgetGalleryItems,
} from './home-item-gallery-model';
import { workspaceWidgetCatalogDefinition } from '../../components/workspace-composer/workspace-widget-catalog';

import type { HomeWidgetKey, HomeWidgetPreference } from '@dwp-frontend/shared-utils';
import type {
  HomeAppDefinition,
  LaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';
import type {
  HomeGalleryItem,
  HomeGalleryItemKind,
  HomeGalleryKindFilter,
  HomeGalleryPlacementState,
  HomeGalleryStatusFilter,
  HomeGalleryView,
} from './home-item-gallery-model';

type HomeItemGalleryProps = {
  open: boolean;
  availableApps: readonly HomeAppDefinition[];
  appLayout: LaunchpadLayout;
  availableWidgetKeys: readonly HomeWidgetKey[];
  widgetPreferences: readonly HomeWidgetPreference[];
  catalogEnabled?: boolean;
  flow?: boolean;
  busy?: boolean;
  onClose: () => void;
  onAddApp: (app: HomeAppDefinition) => void;
  onAddWidget: (widgetKey: HomeWidgetKey) => void;
  onOpenStudio?: () => void;
};

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
} as const;

const galleryToggleGroupSx = {
  maxWidth: '100%',
  flexWrap: 'wrap',
  '& .MuiToggleButton-root': {
    minWidth: { xs: 44, sm: 'auto' },
    minHeight: { xs: 44, sm: 'auto' },
  },
  '@media (forced-colors: active)': {
    '& .MuiToggleButton-root': {
      color: 'CanvasText',
      backgroundColor: 'Canvas',
      borderColor: 'ButtonText',
      forcedColorAdjust: 'none',
    },
    '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
      color: 'CanvasText',
      backgroundColor: 'Canvas',
      borderColor: 'Highlight',
      outline: '3px solid Highlight',
      outlineOffset: -3,
    },
  },
} as const;

const galleryTabsSx = {
  px: { xs: 2, sm: 3 },
  '@media (forced-colors: active)': {
    '& .MuiTab-root': {
      color: 'CanvasText',
      forcedColorAdjust: 'none',
    },
    '& .MuiTab-root.Mui-selected': {
      color: 'CanvasText',
      outline: '2px solid Highlight',
      outlineOffset: -3,
    },
    '& .MuiTabs-indicator': {
      height: 4,
      backgroundColor: 'Highlight',
      forcedColorAdjust: 'none',
    },
  },
} as const;

export function HomeItemGallery({
  open,
  availableApps,
  appLayout,
  availableWidgetKeys,
  widgetPreferences,
  catalogEnabled = false,
  flow = false,
  busy = false,
  onClose,
  onAddApp,
  onAddWidget,
  onOpenStudio,
}: HomeItemGalleryProps) {
  const { t } = useTranslation('home');
  const [view, setView] = useState<HomeGalleryView>('LIBRARY');
  const [kind, setKind] = useState<HomeGalleryKindFilter>('ALL');
  const [status, setStatus] = useState<HomeGalleryStatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const deferredQuery = useDeferredValue(query);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFocus = useRef<{ id: string; index: number } | null>(null);
  const emptyHeadingRef = useRef<HTMLElement | null>(null);
  const pendingResultAnnouncement = useRef(false);
  const panelIdPrefix = useId();

  useEffect(() => {
    if (!open) return;
    setView(catalogEnabled ? 'LIBRARY' : 'HIDDEN');
    setKind('ALL');
    setStatus('ALL');
    setQuery('');
    setAnnouncement('');
  }, [catalogEnabled, open]);

  const appItems = useMemo(
    () => resolveHomeAppGalleryItems(availableApps, appLayout),
    [appLayout, availableApps]
  );
  const widgetItems = useMemo(
    () =>
      resolveHomeWidgetGalleryItems(availableWidgetKeys, widgetPreferences, availableApps, flow),
    [availableApps, availableWidgetKeys, flow, widgetPreferences]
  );
  const allItems = useMemo(() => [...appItems, ...widgetItems], [appItems, widgetItems]);
  const hiddenCount = homeGalleryRestorableCount(allItems);
  const actionableCount = homeGalleryActionableCount(allItems);
  const filteredByState = useMemo(
    () => filterHomeGalleryItems(allItems, { view, kind, status }),
    [allItems, kind, status, view]
  );
  const filteredItems = useMemo(
    () =>
      filteredByState.filter((item) =>
        matchesHomeGallerySearch(deferredQuery, gallerySearchValues(item, t, availableApps, flow))
      ),
    [availableApps, deferredQuery, filteredByState, flow, t]
  );
  const appResults = filteredItems.filter((item) => item.kind === 'APP');
  const widgetResults = filteredItems.filter((item) => item.kind === 'WIDGET');
  const filtersActive = query.trim() !== '' || kind !== 'ALL' || status !== 'ALL';
  const resultTotal = view === 'HIDDEN' ? hiddenCount : allItems.length;
  const emptyTitle = t(
    filtersActive
      ? 'editor.noSearchResults'
      : view === 'HIDDEN'
        ? 'editor.nothingHidden'
        : 'editor.noAvailableWidgets'
  );
  const emptyDescription = t(
    filtersActive
      ? 'editor.noSearchResultsDescription'
      : view === 'HIDDEN'
        ? 'editor.nothingHiddenDescription'
        : 'editor.noAvailableWidgetsDescription'
  );

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const nextTarget = filteredItems[Math.min(pending.index, filteredItems.length - 1)];
    window.requestAnimationFrame(() => {
      const target = nextTarget ? rowRefs.current.get(nextTarget.id) : emptyHeadingRef.current;
      target?.focus();
      target?.scrollIntoView({ block: 'nearest' });
    });
    pendingFocus.current = null;
  }, [filteredItems]);

  useEffect(() => {
    if (!pendingResultAnnouncement.current) return;
    pendingResultAnnouncement.current = false;
    setAnnouncement(t('editor.resultCount', { shown: filteredItems.length, total: resultTotal }));
  }, [deferredQuery, filteredItems.length, kind, resultTotal, status, t, view]);

  const resetFilters = () => {
    pendingResultAnnouncement.current = true;
    setQuery('');
    setKind('ALL');
    setStatus('ALL');
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const actOnItem = (item: HomeGalleryItem, label: string) => {
    const index = filteredItems.findIndex((candidate) => candidate.id === item.id);
    pendingFocus.current = { id: item.id, index: Math.max(index, 0) };
    if (item.kind === 'APP') onAddApp(item.app);
    else onAddWidget(item.widget.key);
    const action = item.state === 'RESTORE' ? 'restored' : 'added';
    setAnnouncement(t(`editor.announcement.${action}`, { item: label }));
  };

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      title={t(catalogEnabled ? 'editor.galleryTitle' : 'editor.hiddenItemsTitle')}
      description={t(catalogEnabled ? 'editor.gallerySubtitle' : 'editor.hiddenItemsDescription')}
      closeLabel={t(catalogEnabled ? 'editor.closeGalleryLabel' : 'editor.closeHiddenItemsLabel')}
      busy={busy}
      maxWidth="md"
      closeButtonSx={{ minWidth: { xs: 44, sm: 'auto' }, minHeight: { xs: 44, sm: 'auto' } }}
      contentSx={{ p: 0, scrollPaddingBlock: 2 }}
      footerContent={
        <ActionButton
          intent="primary"
          fullWidth
          onClick={onClose}
          disabled={busy}
          sx={{ minHeight: 44 }}
        >
          {t('editor.returnToHomeEditing')}
        </ActionButton>
      }
      footerSx={{
        display: { xs: 'flex', sm: 'none' },
        flexShrink: 0,
        px: 2,
        pt: 1.5,
        pb: 'max(16px, env(safe-area-inset-bottom))',
        borderTop: 1,
        borderColor: 'divider',
      }}
      headerContent={
        <>
          <Tabs
            value={view}
            onChange={(_, value: HomeGalleryView) => {
              pendingResultAnnouncement.current = true;
              setView(value);
              setStatus('ALL');
            }}
            aria-label={t(catalogEnabled ? 'editor.galleryTabs' : 'editor.hiddenItemsViews')}
            sx={galleryTabsSx}
          >
            {catalogEnabled && (
              <Tab
                id={`${panelIdPrefix}-library-tab`}
                aria-controls={`${panelIdPrefix}-library-panel`}
                value="LIBRARY"
                label={t('editor.libraryTab', { count: allItems.length })}
              />
            )}
            <Tab
              id={`${panelIdPrefix}-hidden-tab`}
              aria-controls={`${panelIdPrefix}-hidden-panel`}
              value="HIDDEN"
              label={t('editor.hiddenTab', { count: hiddenCount })}
            />
          </Tabs>
          <Divider />
        </>
      }
      slotProps={{
        backdrop: { sx: { backdropFilter: 'blur(10px)', bgcolor: 'rgba(15,23,42,0.42)' } },
        transition: {
          onEntered: () => searchInputRef.current?.focus(),
        },
        paper: {
          sx: {
            m: { xs: 0, sm: 4 },
            width: { xs: '100%', sm: 'auto' },
            height: { xs: '100%', sm: 'auto' },
            maxHeight: { xs: '100%', sm: 'calc(100% - 64px)' },
            border: 1,
            borderColor: 'divider',
            borderRadius: { xs: 0, sm: 1 },
            overflow: 'hidden',
            boxShadow: '0 28px 80px rgba(15,23,42,0.28)',
          },
        },
      }}
    >
      <Box
        role="tabpanel"
        id={`${panelIdPrefix}-${view.toLowerCase()}-panel`}
        aria-labelledby={`${panelIdPrefix}-${view.toLowerCase()}-tab`}
      >
        <Box sx={visuallyHidden} role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </Box>

        <Stack gap={{ xs: 1.25, sm: 2 }} sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            gap={1.5}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {t(view === 'LIBRARY' ? 'editor.widgetLibraryTitle' : 'editor.hiddenItemsTitle')}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.25, display: { xs: 'block', sm: 'none' } }}
              >
                {t(
                  view === 'LIBRARY'
                    ? 'editor.widgetLibraryDescriptionCompact'
                    : 'editor.hiddenItemsDescription'
                )}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.25, display: { xs: 'none', sm: 'block' } }}
              >
                {t(
                  view === 'LIBRARY'
                    ? 'editor.widgetLibraryDescription'
                    : 'editor.hiddenItemsDescription'
                )}
              </Typography>
            </Box>
            {onOpenStudio && view === 'LIBRARY' && (
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<SlidersHorizontal size={16} />}
                onClick={onOpenStudio}
                sx={{ minHeight: { xs: 44, sm: 'auto' } }}
              >
                {t('editor.openWidgetStudio')}
              </ActionButton>
            )}
          </Stack>

          {!catalogEnabled && (
            <Alert severity="info">
              <Typography variant="subtitle2">{t('editor.libraryOffTitle')}</Typography>
              <Typography variant="body2">{t('editor.libraryOffDescription')}</Typography>
            </Alert>
          )}

          <FormField
            autoFocus
            inputRef={searchInputRef}
            size="small"
            value={query}
            onChange={(event) => {
              pendingResultAnnouncement.current = true;
              setQuery(event.target.value);
            }}
            label={t('editor.searchLabel')}
            placeholder={t('editor.searchPlaceholder')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            gap={1.25}
          >
            <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={kind}
                onChange={(_, value: HomeGalleryKindFilter | null) => {
                  if (!value) return;
                  pendingResultAnnouncement.current = true;
                  setKind(value);
                }}
                aria-label={t('editor.kindFilterLabel')}
                sx={galleryToggleGroupSx}
              >
                {(['ALL', 'APP', 'WIDGET'] as const).map((value) => (
                  <ToggleButton key={value} value={value}>
                    {t(`editor.kindFilter.${value}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {view === 'LIBRARY' && (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={status}
                  onChange={(_, value: HomeGalleryStatusFilter | null) => {
                    if (!value) return;
                    pendingResultAnnouncement.current = true;
                    setStatus(value);
                  }}
                  aria-label={t('editor.statusFilterLabel')}
                  sx={galleryToggleGroupSx}
                >
                  {(['ALL', 'ACTIONABLE', 'ADDED'] as const).map((value) => (
                    <ToggleButton key={value} value={value}>
                      {t(`editor.statusFilter.${value}`)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}
            </Stack>
            {filtersActive && (
              <ActionButton
                intent="quiet"
                size="small"
                onClick={resetFilters}
                sx={{ minHeight: { xs: 44, sm: 'auto' } }}
              >
                {t('editor.resetFilters')}
              </ActionButton>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {t('editor.resultCount', { shown: filteredItems.length, total: resultTotal })}
          </Typography>

          {view === 'LIBRARY' && allItems.length > 0 && actionableCount === 0 && (
            <Alert
              severity="success"
              icon={<CheckCircle2 size={19} />}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              <Typography variant="subtitle2">{t('editor.allItemsAddedTitle')}</Typography>
              <Typography variant="body2">
                {t(
                  onOpenStudio
                    ? 'editor.allItemsAddedDescriptionWithStudio'
                    : 'editor.allItemsAddedDescription'
                )}
              </Typography>
            </Alert>
          )}
        </Stack>

        {filteredItems.length === 0 ? (
          <Box
            ref={emptyHeadingRef}
            tabIndex={-1}
            role="group"
            aria-label={emptyTitle}
            data-home-gallery-empty
            sx={{ outline: 'none' }}
          >
            <EmptyState
              size="compact"
              title={emptyTitle}
              description={emptyDescription}
              action={
                filtersActive ? (
                  <ActionButton
                    intent="secondary"
                    onClick={resetFilters}
                    sx={{ minHeight: { xs: 44, sm: 'auto' } }}
                  >
                    {t('editor.resetFilters')}
                  </ActionButton>
                ) : undefined
              }
            />
          </Box>
        ) : (
          <Stack gap={0}>
            <GallerySection
              kind="APP"
              items={appResults}
              busy={busy}
              rowRefs={rowRefs}
              onAction={actOnItem}
            />
            <GallerySection
              kind="WIDGET"
              items={widgetResults}
              busy={busy}
              rowRefs={rowRefs}
              onAction={actOnItem}
              flow={flow}
              availableApps={availableApps}
            />
          </Stack>
        )}
      </Box>
    </ContentDialog>
  );
}

function GallerySection({
  kind,
  items,
  busy,
  rowRefs,
  onAction,
  flow = false,
  availableApps = [],
}: {
  kind: HomeGalleryItemKind;
  items: HomeGalleryItem[];
  busy: boolean;
  rowRefs: React.RefObject<Map<string, HTMLElement>>;
  onAction: (item: HomeGalleryItem, label: string) => void;
  flow?: boolean;
  availableApps?: readonly HomeAppDefinition[];
}) {
  const { t } = useTranslation('home');
  if (items.length === 0) return null;
  const headingId = `home-gallery-${kind.toLowerCase()}-heading`;

  return (
    <Box component="section" aria-labelledby={headingId}>
      <Typography
        id={headingId}
        component="h3"
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', px: { xs: 2, sm: 3 }, py: 1, bgcolor: 'action.hover' }}
      >
        {t(`editor.section.${kind}`, { count: items.length })}
      </Typography>
      <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {items.map((item) => {
          const copy = galleryItemCopy(item, t, availableApps, flow);
          return (
            <Box
              component="li"
              key={item.id}
              ref={(node: HTMLElement | null) => {
                if (node) rowRefs.current.set(item.id, node);
                else rowRefs.current.delete(item.id);
              }}
              tabIndex={-1}
              data-home-gallery-item={item.id}
              data-home-gallery-state={item.state}
              sx={{
                minHeight: 84,
                px: { xs: 2, sm: 3 },
                display: 'grid',
                gridTemplateColumns: {
                  xs: '44px minmax(0, 1fr)',
                  sm: '52px minmax(0, 1fr) auto',
                },
                alignItems: 'center',
                gap: 1.5,
                py: { xs: 1.5, sm: 1 },
                borderBottom: 1,
                borderColor: 'divider',
                outlineOffset: -3,
                '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
              }}
            >
              {item.kind === 'APP' ? (
                <AppGlyph app={item.app} size={44} />
              ) : (
                <Box sx={{ color: 'text.secondary', display: 'grid', placeItems: 'center' }}>
                  <item.widget.icon size={22} aria-hidden="true" />
                </Box>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">{copy.label}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {copy.description}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {copy.metadata}
                </Typography>
              </Box>
              <GalleryItemAction
                state={item.state}
                itemLabel={copy.label}
                itemKind={item.kind}
                busy={busy}
                onClick={() => onAction(item, copy.label)}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function GalleryItemAction({
  state,
  itemLabel,
  itemKind,
  busy,
  onClick,
}: {
  state: HomeGalleryPlacementState;
  itemLabel: string;
  itemKind: HomeGalleryItemKind;
  busy: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation('home');
  const itemType = t(`editor.itemType.${itemKind}`);
  const actionSx = {
    gridColumn: { xs: 2, sm: 'auto' },
    justifySelf: 'start',
    minHeight: { xs: 44, sm: 36 },
  } as const;

  if (state === 'ADD' || state === 'RESTORE') {
    const restore = state === 'RESTORE';
    return (
      <ActionButton
        intent={restore ? 'secondary' : 'quiet'}
        size="small"
        startIcon={restore ? <RotateCcw size={16} /> : <Plus size={16} />}
        onClick={onClick}
        disabled={busy}
        aria-label={t(restore ? 'editor.restoreItemLabel' : 'editor.addItemLabel', {
          item: itemLabel,
          type: itemType,
        })}
        sx={actionSx}
      >
        {t(restore ? 'editor.restore' : 'editor.add')}
      </ActionButton>
    );
  }

  const locked = state === 'LOCKED' || state === 'FORBIDDEN';
  return (
    <Chip
      size="small"
      color={locked ? 'default' : 'success'}
      variant="outlined"
      icon={locked ? <LockKeyhole size={14} /> : <CheckCircle2 size={14} />}
      label={t(
        state === 'LOCKED'
          ? 'editor.locked'
          : state === 'FORBIDDEN'
            ? 'editor.forbidden'
            : 'editor.alreadyAdded'
      )}
      sx={actionSx}
    />
  );
}

function galleryItemCopy(
  item: HomeGalleryItem,
  t: ReturnType<typeof useTranslation<'home'>>['t'],
  availableApps: readonly HomeAppDefinition[],
  flow: boolean
) {
  if (item.kind === 'APP') {
    return {
      label: item.app.name,
      description: item.app.description,
      metadata: t('editor.appMetadata'),
    };
  }

  const flowCopy = {
    schedule: {
      label: 'flow.purpose.timeline.title',
      description: 'flow.purpose.timeline.description',
    },
    'daily-brief': {
      label: 'flow.purpose.response.title',
      description: 'flow.purpose.response.description',
    },
    focus: { label: 'flow.purpose.request.title', description: 'flow.purpose.request.description' },
    activity: { label: 'flow.purpose.pulse.title', description: 'flow.purpose.pulse.description' },
  } as const;
  const purposeCopy = flow ? flowCopy[item.widget.key as keyof typeof flowCopy] : undefined;
  const definition = workspaceWidgetCatalogDefinition(item.widget.key);
  const ownerApp = availableApps.find(
    (app) => app.resourceKey === definition?.sourceAppResourceKey
  )?.name;
  return {
    label: t(purposeCopy?.label ?? `widgets.registry.${item.widget.key}.label`),
    description: t(purposeCopy?.description ?? `widgets.registry.${item.widget.key}.description`),
    metadata: t(
      definition?.configuration ? 'editor.configurableWidgetMetadata' : 'editor.widgetTypeMetadata',
      {
        app: ownerApp ?? t('editor.platformOwner'),
      }
    ),
  };
}

function gallerySearchValues(
  item: HomeGalleryItem,
  t: ReturnType<typeof useTranslation<'home'>>['t'],
  availableApps: readonly HomeAppDefinition[],
  flow: boolean
): string[] {
  const copy = galleryItemCopy(item, t, availableApps, flow);
  return [copy.label, copy.description, copy.metadata];
}
