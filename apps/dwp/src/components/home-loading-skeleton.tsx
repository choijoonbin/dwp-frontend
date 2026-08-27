import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { shellHeaderHeight } from '../features/shell/shell-registry';
import {
  readHomePresentationHint,
  resolveHomeLoadingLayout,
  type HomeLoadingLayout,
} from './home-loading-layout-policy';

type HomeLoadingSkeletonProps = {
  reserveHeader?: boolean;
};

const skeletonLine = {
  bgcolor: 'rgba(226,232,240,0.22)',
  borderRadius: 999,
} as const;

const canvasSkeleton = {
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: '16px',
} as const;

function browserHomeLoadingLayout(): HomeLoadingLayout {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return resolveHomeLoadingLayout({
      presentation: 'balanced',
      viewportWidth: 1440,
      rootFontSize: 16,
    });
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
  return resolveHomeLoadingLayout({
    presentation: readHomePresentationHint(storage),
    viewportWidth: document.documentElement.clientWidth || window.innerWidth,
    rootFontSize,
  });
}

function useHomeLoadingLayout(): HomeLoadingLayout {
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

function DockSkeleton({ layout }: { layout: HomeLoadingLayout }) {
  return (
    <Box
      data-home-loading-dock
      data-home-loading-dock-item-count={layout.dockItemCount}
      data-home-loading-dock-stacked={layout.dockStacked ? 'true' : 'false'}
      sx={{
        width: 1,
        minHeight: layout.dockStacked ? 169 : { xs: 138, sm: 132 },
        mt: { xs: 3, md: 2 },
        p: { xs: 1.5, md: 2 },
        border: '1px solid rgba(255,255,255,0.20)',
        borderRadius: '16px',
        bgcolor: 'rgba(4,18,43,0.72)',
        display: 'grid',
        alignContent: 'center',
        gap: 1.5,
        '@media (min-width: 900px)': {
          width: `min(100%, ${layout.dockPreferredWidth}px)`,
        },
      }}
    >
      <Box sx={{ ...skeletonLine, width: 42, height: 12 }} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns:
            layout.dockItemCount <= 4
              ? 'repeat(4, minmax(0, 1fr))'
              : `repeat(${layout.dockItemCount}, 56px)`,
          justifyContent: 'start',
          gap: { xs: 1, sm: 1.5 },
        }}
      >
        {Array.from({ length: layout.dockItemCount }, (_, index) => (
          <Box
            key={index}
            data-home-loading-dock-item
            sx={{
              minWidth: 0,
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
                bgcolor: 'rgba(226,232,240,0.14)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
            <Box sx={{ ...skeletonLine, width: 34, height: 7 }} />
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
  ] as const;
  const gridColumns = layout.template === 'single-column' ? 1 : 60;
  const widgetColumn = (index: number) => {
    if (layout.template === 'single-column') return '1 / -1';
    if (layout.template === 'adaptive-wide')
      return `span ${index === 0 ? 35 : index === 1 ? 25 : 20}`;
    return `span ${index === 0 ? 40 : 20}`;
  };

  return (
    <Box
      aria-hidden="true"
      data-testid="home-loading-skeleton"
      data-home-loading-contract="flow-geometry"
      data-home-loading-presentation={layout.presentation}
      data-home-loading-read-template={layout.template}
      sx={{
        width: 1,
        maxWidth: 2560,
        mx: 'auto',
        px: { xs: 2, sm: 3, lg: '20px' },
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
          minHeight: { xs: 328, sm: 343, lg: 308 },
          p: { xs: 2, sm: 3 },
          overflow: 'hidden',
          borderRadius: '16px',
          bgcolor: '#061630',
          backgroundImage:
            'radial-gradient(circle at 82% 36%, rgba(66,153,225,0.30), transparent 28%), linear-gradient(120deg, #061630 0%, #0A2B63 56%, #0D4E9B 100%)',
          color: '#F8FAFC',
          '@media (min-width: 1800px)': { minHeight: 339 },
        }}
      >
        <Box sx={{ ...skeletonLine, width: 132, height: 10 }} />
        <Box sx={{ ...skeletonLine, mt: 1.25, width: { xs: '82%', sm: 410 }, height: 28 }} />
        <Box sx={{ ...skeletonLine, mt: 1, width: { xs: '92%', sm: 520 }, height: 12 }} />
        <Box
          sx={{
            mt: 1.5,
            width: { xs: 1, sm: 620 },
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
        <DockSkeleton layout={layout} />
      </Box>

      <Box sx={{ ...canvasSkeleton, height: 56, bgcolor: 'action.hover' }} />
      <Box
        data-home-loading-widgets
        data-home-loading-grid-contract={
          layout.template === 'adaptive-wide'
            ? '7-5/4-4-4'
            : layout.template === 'single-column'
              ? 'single-column'
              : '8-4/4-4-4'
        }
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {loadingWidgets.map((widget, index) => (
          <Box
            key={widget.key}
            data-home-loading-widget={widget.key}
            sx={{ ...canvasSkeleton, height: widget.height, gridColumn: widgetColumn(index) }}
          />
        ))}
        <Box
          data-home-loading-widget="announcements"
          sx={{ ...canvasSkeleton, height: 224, gridColumn: { md: '1 / -1' } }}
        />
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
