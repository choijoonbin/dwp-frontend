import { useEffect, useRef, useState } from 'react';

import {
  BriefcaseBusiness,
  CalendarDays,
  Grid2X2,
  Inbox,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TenantWorkscape } from '../../components/tenant-workscape';
import {
  HOME_LAUNCHPAD_GROUP_ITEM_LIMIT,
  HOME_LAUNCHPAD_VISIBLE_COLUMNS,
} from '../../components/workspace-composer/home-launchpad-layout-contract';

import type { HomeContentAlignment, HomeExperience } from '@dwp-frontend/shared-utils';

export type HomePreviewViewport = 'WIDE' | 'DESKTOP' | 'TABLET' | 'MOBILE';
export type HomePreviewTheme = 'LIGHT' | 'DARK';

export const HOME_PREVIEW_VIEWPORTS = {
  WIDE: { width: 1920, height: 312, stageWidth: 1320 },
  DESKTOP: { width: 1440, height: 326, stageWidth: 1120 },
  TABLET: { width: 1024, height: 396, stageWidth: 820 },
  MOBILE: { width: 390, height: 340, stageWidth: 390 },
} as const;

const APP_ICONS = [BriefcaseBusiness, Sparkles, Inbox, CalendarDays, MessageSquareText, Grid2X2];

type Props = {
  experience: HomeExperience;
  backgroundUrl: string;
  headline: string;
  subheadline: string;
  viewport: HomePreviewViewport;
  theme: HomePreviewTheme;
  focalX: number;
  focalY: number;
  mobileFocalX: number;
  mobileFocalY: number;
  contentAlignment: HomeContentAlignment;
  overlayOpacity: number;
  draft: boolean;
  canvasLabel: string;
  draftLabel: string;
  publishedLabel: string;
  appDockLabel: string;
  allAppsLabel: string;
  emptyAppsLabel: string;
  sampleDate: string;
  metrics: readonly string[];
};

/**
 * Admin-owned preview contract. It deliberately consumes only the public home-experience DTO,
 * keeping the Admin boundary independent from feature/home internals while matching the runtime
 * header geometry and responsive crop semantics.
 */
export function HomeExperiencePreview({
  experience,
  backgroundUrl,
  headline,
  subheadline,
  viewport,
  theme,
  focalX,
  focalY,
  mobileFocalX,
  mobileFocalY,
  contentAlignment,
  overlayOpacity,
  draft,
  canvasLabel,
  draftLabel,
  publishedLabel,
  appDockLabel,
  allAppsLabel,
  emptyAppsLabel,
  sampleDate,
  metrics,
}: Props) {
  const dimensions = HOME_PREVIEW_VIEWPORTS[viewport];
  const mobile = viewport === 'MOBILE';
  const shortCanvas = viewport === 'WIDE' || viewport === 'DESKTOP';
  const dark = theme === 'DARK';
  const textAlign =
    contentAlignment === 'CENTER' ? 'center' : contentAlignment === 'RIGHT' ? 'right' : 'left';
  const launchpad = experience.launchpadConfiguration;
  const configuredApps = launchpad?.placements?.length ?? 0;
  const previewGroupKeys = (launchpad?.groups ?? [])
    .filter((group) => group.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((group) => group.groupKey);
  const desktopGroupItemCounts = Array.from(
    { length: Math.max(1, previewGroupKeys.length) },
    (_, groupIndex) => {
      const groupKey = previewGroupKeys[groupIndex];
      if (!groupKey) return 0;
      return Math.min(
        HOME_LAUNCHPAD_GROUP_ITEM_LIMIT,
        launchpad?.placements.filter((placement) => placement.groupKey === groupKey).length ?? 0
      );
    }
  );
  const mobileVisibleApps = Math.min(4, configuredApps);
  const previewGroupItemCounts = mobile
    ? Array.from(
        { length: 4 },
        (_, groupIndex) =>
          Math.floor(mobileVisibleApps / 4) + (groupIndex < mobileVisibleApps % 4 ? 1 : 0)
      )
    : desktopGroupItemCounts;
  const visibleApps = previewGroupItemCounts.reduce((total, count) => total + count, 0);
  const previewItemColumns = viewport === 'WIDE' ? HOME_LAUNCHPAD_VISIBLE_COLUMNS : 4;
  const previewGroupColumns = mobile ? 4 : viewport === 'TABLET' ? 2 : 4;
  const previewGroupBands = mobile
    ? []
    : Array.from(
        { length: Math.ceil(previewGroupItemCounts.length / previewGroupColumns) },
        (_, bandIndex) =>
          previewGroupItemCounts.slice(
            bandIndex * previewGroupColumns,
            (bandIndex + 1) * previewGroupColumns
          )
      );
  const previewVirtualHeight = mobile
    ? dimensions.height
    : Math.max(
        dimensions.height,
        280 +
          previewGroupBands.reduce(
            (height, band) =>
              height +
              70 +
              Math.max(1, ...band.map((count) => Math.ceil(count / previewItemColumns))) * 52,
            0
          )
      );
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [previewFrameWidth, setPreviewFrameWidth] = useState(0);

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame) return;
    const updateWidth = (width: number) =>
      setPreviewFrameWidth((current) => (Math.abs(current - width) < 0.5 ? current : width));
    updateWidth(frame.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateWidth(entry.contentRect.width);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const previewScale =
    (previewFrameWidth || Math.min(dimensions.stageWidth, dimensions.width)) / dimensions.width;

  return (
    <Box
      data-testid="home-experience-preview"
      data-preview-viewport={viewport.toLowerCase()}
      sx={{
        width: 1,
        maxWidth: `${dimensions.stageWidth}px`,
        minWidth: 0,
        mx: 'auto',
        p: 1,
        overflow: 'hidden',
        borderRadius: 3,
        bgcolor: dark ? '#0B1322' : '#E8EDF5',
        border: 1,
        borderColor: dark ? 'rgba(148,163,184,0.24)' : 'rgba(62,79,108,0.18)',
        transition: 'max-width 220ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 160ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 0.5, pb: 0.75 }}
      >
        <Typography variant="caption" color={dark ? '#CBD5E1' : 'text.secondary'}>
          {canvasLabel}
        </Typography>
        <Chip
          size="small"
          color={draft ? 'warning' : 'success'}
          label={draft ? draftLabel : publishedLabel}
        />
      </Stack>
      <Box
        ref={previewFrameRef}
        data-testid="home-experience-preview-frame"
        data-preview-virtual-width={dimensions.width}
        data-preview-virtual-height={previewVirtualHeight}
        sx={{
          position: 'relative',
          width: 1,
          aspectRatio: `${dimensions.width} / ${previewVirtualHeight}`,
          minWidth: 0,
          overflow: 'hidden',
          borderRadius: 2.5,
        }}
      >
        <Box
          data-testid="home-experience-preview-canvas"
          data-preview-scale={previewScale}
          sx={{
            position: 'absolute',
            insetBlockStart: 0,
            insetInlineStart: 0,
            width: `${dimensions.width}px`,
            height: `${previewVirtualHeight}px`,
            transform: `scale(${previewScale})`,
            transformOrigin: 'top left',
          }}
        >
          <TenantWorkscape
            ariaLabel={headline}
            backgroundUrl={backgroundUrl}
            backgroundPosition={experience.backgroundPosition}
            focalX={focalX}
            focalY={focalY}
            mobileFocalX={mobileFocalX}
            mobileFocalY={mobileFocalY}
            contentAlignment={contentAlignment}
            overlayOpacity={overlayOpacity}
            compact={mobile}
            previewViewport={viewport.toLowerCase() as Lowercase<HomePreviewViewport>}
            darkPreview={dark}
          >
            <Box
              sx={{
                width: mobile ? 1 : 'min(100%, 760px)',
                textAlign,
                textShadow: '0 2px 12px rgba(0,0,0,0.42)',
              }}
            >
              <Typography
                variant="overline"
                sx={{
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: shortCanvas ? 16 : undefined,
                  lineHeight: shortCanvas ? 1.2 : undefined,
                }}
              >
                {sampleDate}
              </Typography>
              <Typography
                component="p"
                sx={{
                  fontSize: mobile
                    ? 24
                    : viewport === 'TABLET'
                      ? 30
                      : viewport === 'WIDE'
                        ? 36
                        : 32,
                  fontWeight: 750,
                  lineHeight: 1.1,
                  letterSpacing: '-0.025em',
                }}
              >
                {headline}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: shortCanvas ? 0.25 : 0.5,
                  color: 'rgba(255,255,255,0.82)',
                  fontSize: shortCanvas ? 16 : undefined,
                  lineHeight: shortCanvas ? 1.25 : undefined,
                }}
              >
                {subheadline}
              </Typography>
              <Stack
                direction="row"
                gap={shortCanvas ? 0.5 : 0.75}
                sx={{ mt: shortCanvas ? 0.75 : 1.25, display: mobile ? 'none' : 'flex' }}
              >
                {metrics.map((metric) => (
                  <Box
                    key={metric}
                    sx={{
                      minWidth: shortCanvas ? 0 : 158,
                      flex: shortCanvas ? '1 1 0' : undefined,
                      px: shortCanvas ? 1 : 1.25,
                      py: shortCanvas ? 0.5 : 0.75,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(5,16,35,0.54)',
                      border: '1px solid rgba(255,255,255,0.22)',
                      fontSize: shortCanvas ? 14 : 12,
                      lineHeight: shortCanvas ? 1.2 : undefined,
                    }}
                  >
                    {metric}
                  </Box>
                ))}
              </Stack>
            </Box>
            <Box
              data-testid="home-experience-preview-dock"
              sx={{
                width: 1,
                mt: 'auto',
                alignSelf: 'stretch',
                px: 1.5,
                py: shortCanvas ? 1 : 1.25,
                borderRadius: 2,
                bgcolor: dark ? 'rgba(5,16,35,0.90)' : 'rgba(8,24,52,0.82)',
                border: '1px solid rgba(255,255,255,0.22)',
                backdropFilter: 'blur(20px) saturate(125%)',
                '@media (prefers-reduced-transparency: reduce)': {
                  bgcolor: '#10284D',
                  backdropFilter: 'none',
                },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography
                  component="p"
                  variant="subtitle2"
                  fontWeight={750}
                  sx={{
                    fontSize: shortCanvas ? 14 : undefined,
                  }}
                >
                  {appDockLabel}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.72)',
                    fontSize: shortCanvas ? 12 : undefined,
                  }}
                >
                  {allAppsLabel}
                </Typography>
              </Stack>
              {visibleApps > 0 ? (
                <Box
                  sx={{
                    mt: shortCanvas ? 0.5 : 1,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${previewGroupColumns}, minmax(0, 1fr))`,
                    gridAutoRows: mobile ? undefined : '1fr',
                    gap: shortCanvas ? 0.5 : 0.75,
                  }}
                >
                  {previewGroupItemCounts.map((itemCount, groupIndex) => (
                    <Box
                      key={groupIndex}
                      data-home-experience-preview-group
                      sx={{
                        display: mobile ? 'contents' : 'grid',
                        gridTemplateRows: mobile ? undefined : 'auto 1fr',
                        gap: mobile ? 0 : shortCanvas ? 0.5 : 0.75,
                        minWidth: 0,
                        height: '100%',
                        p: mobile ? 0 : shortCanvas ? 0.75 : 1,
                        border: mobile ? 0 : '1px solid rgba(255,255,255,0.15)',
                        borderRadius: mobile ? 0 : '10px',
                        bgcolor: mobile ? 'transparent' : 'rgba(255,255,255,0.035)',
                        backgroundImage: mobile
                          ? 'none'
                          : 'linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.012) 62%, rgba(78,165,255,0.035))',
                        '@media (forced-colors: active)': {
                          borderColor: 'CanvasText',
                          bgcolor: mobile ? 'transparent' : 'Canvas',
                          backgroundImage: 'none',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: mobile ? 'none' : 'block',
                          width: `${38 + groupIndex * 6}%`,
                          height: shortCanvas ? 4 : 5,
                          borderRadius: 99,
                          bgcolor: 'rgba(248,250,252,0.32)',
                        }}
                      />
                      <Box
                        sx={{
                          display: mobile ? 'contents' : 'grid',
                          gridTemplateColumns: mobile
                            ? undefined
                            : `repeat(${previewItemColumns}, minmax(0, 1fr))`,
                          alignItems: 'start',
                          gap: shortCanvas ? 0.5 : 0.75,
                        }}
                      >
                        {Array.from({ length: itemCount }, (_, itemIndex) => {
                          const index = groupIndex + itemIndex * 4;
                          const Icon = APP_ICONS[index % APP_ICONS.length]!;
                          const iconSize = shortCanvas ? 36 : 38;
                          return (
                            <Stack
                              key={itemIndex}
                              alignItems="center"
                              gap={shortCanvas ? 0.25 : 0.5}
                            >
                              <Box
                                sx={{
                                  width: iconSize,
                                  height: iconSize,
                                  display: 'grid',
                                  placeItems: 'center',
                                  borderRadius: 1.5,
                                  bgcolor: ['#EAF0FF', '#F1ECFF', '#E8F6F5', '#ECF2F8'][index % 4],
                                  color: ['#315FD5', '#7A4FC4', '#087E8B', '#2F5E8A'][index % 4],
                                }}
                              >
                                <Icon size={18} aria-hidden="true" />
                              </Box>
                              <Box
                                sx={{
                                  width: shortCanvas ? 32 : 36,
                                  height: shortCanvas ? 4 : 5,
                                  borderRadius: 99,
                                  bgcolor: 'rgba(248,250,252,0.32)',
                                }}
                              />
                            </Stack>
                          );
                        })}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    mt: shortCanvas ? 0.5 : 1,
                    color: 'rgba(255,255,255,0.72)',
                    fontSize: shortCanvas ? 14 : undefined,
                    lineHeight: shortCanvas ? 1.2 : undefined,
                  }}
                >
                  {emptyAppsLabel}
                </Typography>
              )}
            </Box>
          </TenantWorkscape>
        </Box>
      </Box>
    </Box>
  );
}
