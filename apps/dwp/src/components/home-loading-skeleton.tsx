import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { shellHeaderHeight } from '../features/shell/shell-registry';
import {
  HOME_LAUNCHPAD_FIVE_COLUMN_DOCK_MIN_WIDTH,
  HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH,
  HOME_LAUNCHPAD_TILE_HEIGHT,
  HOME_LAUNCHPAD_TILE_WIDTH,
  HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH,
  HOME_LAUNCHPAD_VISIBLE_COLUMNS,
} from './workspace-composer/home-launchpad-layout-contract';
import {
  HOME_REFERENCE_GRID_PLACEMENTS,
  readHomeLaunchpadGroupItemCounts,
  readOptionalHomePresentationHint,
  resolveHomeLoadingLayout,
  type HomeLoadingLayout,
} from './home-loading-layout-policy';

type HomeLoadingSkeletonProps = {
  reserveHeader?: boolean;
};

type BrowserHomeLoadingLayout = HomeLoadingLayout &
  Readonly<{
    presentationResolved: boolean;
    dockGroupItemCounts: readonly number[] | null;
  }>;

const skeletonLine = {
  bgcolor: 'var(--home-loading-line)',
  borderRadius: 999,
} as const;

const canvasSkeleton = {
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: '16px',
} as const;

function browserHomeLoadingLayout(): BrowserHomeLoadingLayout {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      ...resolveHomeLoadingLayout({
        presentation: 'balanced',
        viewportWidth: 1440,
        rootFontSize: 16,
      }),
      presentationResolved: false,
      dockGroupItemCounts: null,
    };
  }
  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = undefined;
  }
  const rootFontSize = Number.parseFloat(
    window.getComputedStyle(document.documentElement).fontSize
  );
  const presentation = readOptionalHomePresentationHint(storage);
  return {
    ...resolveHomeLoadingLayout({
      presentation: presentation ?? 'balanced',
      viewportWidth: document.documentElement.clientWidth || window.innerWidth,
      rootFontSize,
    }),
    presentationResolved: presentation !== null,
    dockGroupItemCounts: readHomeLaunchpadGroupItemCounts(storage),
  };
}

function useHomeLoadingLayout(): BrowserHomeLoadingLayout {
  const [layout, setLayout] = useState(browserHomeLoadingLayout);
  useEffect(() => {
    const sync = () => setLayout(browserHomeLoadingLayout());
    const resizeObserver = new ResizeObserver(sync);
    const mutationObserver = new MutationObserver(sync);
    resizeObserver.observe(document.documentElement);
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    window.addEventListener('resize', sync);
    sync();
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);
  return layout;
}

function NeutralDockSkeleton() {
  return (
    <Box
      data-home-loading-dock
      data-home-loading-dock-state="neutral"
      sx={{
        width: 1,
        minHeight: { xs: 138, sm: 132 },
        p: { xs: 1.5, md: 2 },
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        bgcolor: 'background.paper',
        display: 'grid',
        alignContent: 'center',
        gap: 2,
      }}
    >
      <Box sx={{ ...skeletonLine, width: 42, height: 12 }} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {[46, 64, 38].map((width) => (
          <Box key={width} sx={{ display: 'grid', gap: 1 }}>
            <Box sx={{ ...skeletonLine, width: `${width}%`, height: 9 }} />
            <Box sx={{ ...skeletonLine, width: '100%', height: 32, opacity: 0.62 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function DockSkeleton({ layout }: { layout: BrowserHomeLoadingLayout }) {
  const largeText = layout.template === 'single-column' && layout.dockStacked;
  const groupItemCounts =
    layout.dockGroupItemCounts ??
    Array.from(
      { length: 4 },
      (_, groupIndex) =>
        Math.floor(layout.dockItemCount / 4) + (groupIndex < layout.dockItemCount % 4 ? 1 : 0)
    );
  const renderedItemCount = groupItemCounts.reduce((total, count) => total + count, 0);

  return (
    <Box
      data-home-loading-dock
      data-home-loading-dock-item-count={renderedItemCount}
      data-home-loading-dock-stacked={layout.dockStacked ? 'true' : 'false'}
      sx={{
        width: 1,
        maxWidth: 'none',
        mx: 'auto',
        minHeight: layout.dockStacked ? (largeText ? 540 : { xs: 272, sm: 480, lg: 272 }) : 138,
        p: { xs: 1.5, md: 2 },
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        bgcolor: 'background.paper',
        display: 'grid',
        containerName: 'flow-dock',
        containerType: 'inline-size',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        alignContent: 'stretch',
        gap: 1.5,
      }}
    >
      <Box sx={{ ...skeletonLine, width: 42, height: 16 }} />
      <Box
        data-home-loading-dock-groups
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 1,
          [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]: {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gridAutoRows: '1fr',
            gap: 1.5,
          },
          [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH}px)`]: {
            gridTemplateColumns: largeText
              ? 'repeat(2, minmax(0, 1fr))'
              : 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        {groupItemCounts.map((itemCount, groupIndex) => (
          <Box
            key={groupIndex}
            data-home-loading-dock-group
            sx={{
              display: 'contents',
              minWidth: 0,
              height: '100%',
              [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]: {
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                px: 1.25,
                py: 0.75,
                border: 1,
                borderColor: 'divider',
                borderRadius: '12px',
                bgcolor: 'background.paper',
              },
              [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH}px)`]:
                {
                  px: 1.5,
                  py: 0.75,
                },
              '@media (forced-colors: active)': {
                borderColor: 'CanvasText',
                bgcolor: 'Canvas',
                backgroundImage: 'none',
                boxShadow: 'none',
              },
            }}
          >
            <Box
              sx={{
                display: 'none',
                minHeight: 18,
                alignItems: 'center',
                [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]:
                  {
                    display: 'flex',
                  },
              }}
            >
              <Box sx={{ ...skeletonLine, width: '42%', height: 8 }} />
            </Box>
            <Box
              sx={{
                ...skeletonLine,
                display: 'none',
                width: '68%',
                minHeight: '1.25em',
                height: 8,
                [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]:
                  {
                    display: 'block',
                  },
              }}
            />
            <Box
              sx={{
                display: 'contents',
                gap: 0.75,
                pt: 0,
                [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]:
                  {
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, ${HOME_LAUNCHPAD_TILE_WIDTH}px)`,
                    justifyContent: 'start',
                  },
                [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH}px)`]:
                  {
                    gridTemplateColumns: `repeat(${HOME_LAUNCHPAD_VISIBLE_COLUMNS}, minmax(0, 1fr))`,
                  },
                [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FIVE_COLUMN_DOCK_MIN_WIDTH}px)`]:
                  {
                    gridTemplateColumns: `repeat(${HOME_LAUNCHPAD_VISIBLE_COLUMNS}, minmax(0, 1fr))`,
                  },
              }}
            >
              {Array.from({ length: itemCount }, (_, itemIndex) => (
                <Box
                  key={itemIndex}
                  data-home-loading-dock-item
                  sx={{
                    minWidth: 0,
                    minHeight: HOME_LAUNCHPAD_TILE_HEIGHT,
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: 'action.hover',
                      border: 1,
                      borderColor: 'divider',
                    }}
                  />
                  <Box sx={{ ...skeletonLine, width: 34, height: 7 }} />
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function HomeLoadingSkeleton({ reserveHeader = false }: HomeLoadingSkeletonProps) {
  const layout = useHomeLoadingLayout();
  const loadingWidgets = [
    { key: 'action-queue', height: 232 },
    { key: 'today', height: 232 },
    { key: 'response-hub', height: 196 },
    { key: 'request-tracker', height: 196 },
    { key: 'role-pulse', height: 196 },
    { key: 'focus-balance', height: 154 },
    { key: 'meeting-load', height: 154 },
  ] as const;
  const gridColumns = layout.template === 'single-column' ? 1 : 60;
  const widgetColumn = (widgetKey: (typeof loadingWidgets)[number]['key']) => {
    if (layout.template === 'single-column') return '1 / -1';
    if (layout.template === 'adaptive-wide') {
      return HOME_REFERENCE_GRID_PLACEMENTS[widgetKey].gridColumn;
    }
    if (widgetKey === 'action-queue') return 'span 40';
    if (widgetKey === 'focus-balance' || widgetKey === 'meeting-load') return 'span 30';
    return 'span 20';
  };

  return (
    <Box
      aria-hidden="true"
      data-testid="home-loading-skeleton"
      data-home-loading-contract="flow-geometry"
      data-home-loading-state={layout.presentationResolved ? 'resolved-hint' : 'neutral'}
      data-home-loading-presentation={
        layout.presentationResolved ? layout.presentation : 'unresolved'
      }
      data-home-loading-read-template={layout.presentationResolved ? layout.template : 'neutral'}
      sx={{
        width: 1,
        '--home-loading-line': (theme) => theme.palette.action.selected,
        maxWidth: layout.maxWidth,
        // Keep the page footer below the loading viewport while the saved layout is unknown.
        minHeight: `calc(100svh - ${reserveHeader ? 0 : shellHeaderHeight}px)`,
        mx: 'auto',
        px: {
          xs: 2,
          sm: 3,
          lg: layout.presentation === 'expressive' ? '20px' : 'clamp(20px, 2vw, 36px)',
        },
        '@media (min-width:1800px)': {
          ...(layout.presentation !== 'focused' ? { px: '20px' } : {}),
        },
        pt: reserveHeader ? `calc(${shellHeaderHeight}px + 16px)` : 2,
        pb: 2,
        display: 'grid',
        gap: 2,
        animation: 'homeLoadingReveal 140ms ease-out 180ms both',
        '@keyframes homeLoadingReveal': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        '@media (prefers-reduced-motion: reduce)': {
          animationDuration: '1ms',
          animationTimingFunction: 'step-end',
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          '--home-loading-line': 'rgba(226,232,240,0.22)',
          minHeight: { xs: 156, md: 104 },
          p: { xs: 2, md: 2.5 },
          overflow: 'hidden',
          borderRadius: '16px',
          bgcolor: '#061630',
          color: '#F8FAFC',
        }}
      >
        <Box sx={{ ...skeletonLine, width: 132, height: 10 }} />
        <Box sx={{ ...skeletonLine, mt: 1.25, width: { xs: '82%', sm: 410 }, height: 28 }} />
        <Box sx={{ ...skeletonLine, mt: 1, width: { xs: '92%', sm: 520 }, height: 12 }} />
        <Box
          sx={{
            mt: { xs: 1.5, md: 0 },
            position: { xs: 'relative', md: 'absolute' },
            right: { md: 24 },
            top: { md: 28 },
            width: { xs: 1, md: 390 },
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {[0, 1, 2].map((index) => (
            <Box
              key={index}
              sx={{
                height: 38,
                borderInlineStart: index ? '1px solid rgba(255,255,255,0.16)' : 0,
              }}
            />
          ))}
        </Box>
      </Box>
      {layout.presentationResolved ? <DockSkeleton layout={layout} /> : <NeutralDockSkeleton />}

      <Box sx={{ ...canvasSkeleton, height: 56, bgcolor: 'action.hover' }} />
      <Box
        data-home-loading-widgets
        data-home-loading-grid-contract={
          !layout.presentationResolved
            ? 'neutral'
            : layout.template === 'adaptive-wide'
              ? '8-4/4-4-4/8-4'
              : layout.template === 'single-column'
                ? 'single-column'
                : '8-4/4-4-4/6-6'
        }
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {layout.presentationResolved ? (
          <>
            <Box
              data-home-loading-widget="announcements"
              sx={{ ...canvasSkeleton, height: 224, gridColumn: '1 / -1' }}
            />
            {loadingWidgets.map((widget) => (
              <Box
                key={widget.key}
                data-home-loading-widget={widget.key}
                sx={{
                  ...canvasSkeleton,
                  height: widget.height,
                  gridColumn: widgetColumn(widget.key),
                  gridRow:
                    layout.template === 'adaptive-wide'
                      ? HOME_REFERENCE_GRID_PLACEMENTS[widget.key].row + 1
                      : undefined,
                }}
              />
            ))}
          </>
        ) : (
          <Box
            data-home-loading-neutral-canvas
            sx={(theme) => ({
              ...canvasSkeleton,
              gridColumn: '1 / -1',
              minHeight: { xs: 360, md: 420 },
              background: `linear-gradient(110deg, ${theme.palette.background.paper} 0%, ${theme.palette.action.hover} 46%, ${theme.palette.background.paper} 72%)`,
              backgroundSize: '220% 100%',
              animation: 'homeNeutralLoading 1.8s ease-in-out infinite',
              '@keyframes homeNeutralLoading': {
                from: { backgroundPosition: '100% 0' },
                to: { backgroundPosition: '-120% 0' },
              },
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
              },
            })}
          />
        )}
      </Box>
    </Box>
  );
}

export function HomeRouteFallback() {
  const { t } = useTranslation('common');

  return (
    <Box role="status" aria-live="polite">
      <HomeLoadingSkeleton />
      <Typography
        sx={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        {t('labels.loadingPage')}
      </Typography>
    </Box>
  );
}
