import { Route } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { foundationTokens } from '@dwp-frontend/design-system';

import { workplaceNavigationDirection } from './workplace-navigation-model';

import type {
  WorkplaceNavigationRoute,
  WorkplaceNavigationStep,
} from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';
import type { WorkplaceNavigationLocale } from './workplace-navigation-model';

export type WorkplaceNavigationMapSegment = Readonly<{
  key: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  travelMode: WorkplaceNavigationStep['travelMode'];
  stepNumber: number;
}>;

export type WorkplaceNavigationRouteMapModel = Readonly<{
  floorId: string | null;
  floorName: string | null;
  backgroundAssetPath: string | null;
  segments: readonly WorkplaceNavigationMapSegment[];
}>;

function safeFloorMapPath(path: string | null | undefined) {
  if (!path) return null;
  return /^\/(assets|api\/platform\/v1\/(media|workplace))\//u.test(path) ? path : null;
}

function hasCoordinates(step: WorkplaceNavigationStep): step is WorkplaceNavigationStep &
  Readonly<{
    fromPositionX: number;
    fromPositionY: number;
    toPositionX: number;
    toPositionY: number;
  }> {
  return (
    step.fromPositionX !== null &&
    step.fromPositionY !== null &&
    step.toPositionX !== null &&
    step.toPositionY !== null
  );
}

/**
 * Builds a destination-floor projection from authoritative graph coordinates.
 * Cross-floor travel remains in the accessible turn list; the final floor is
 * the only floor for which the route contract supplies a background plan.
 */
export function workplaceNavigationRouteMapModel(
  route: Pick<WorkplaceNavigationRoute, 'destination' | 'fallback' | 'steps'>
): WorkplaceNavigationRouteMapModel {
  const floorId = route.destination?.floorId ?? route.fallback?.floorId ?? null;
  return {
    floorId,
    floorName: route.fallback?.floorName ?? null,
    backgroundAssetPath: safeFloorMapPath(route.fallback?.floorMapPath),
    segments: route.steps.flatMap((step, index) => {
      const toFloorId = step.toFloorId ?? step.floorId;
      if (
        !floorId ||
        !hasCoordinates(step) ||
        step.fromFloorId !== floorId ||
        toFloorId !== floorId
      )
        return [];
      return [
        {
          key: `${step.fromNodeId}-${step.toNodeId}-${index}`,
          fromX: step.fromPositionX,
          fromY: step.fromPositionY,
          toX: step.toPositionX,
          toY: step.toPositionY,
          travelMode: step.travelMode,
          stepNumber: index + 1,
        },
      ];
    }),
  };
}

function routeStroke(mode: WorkplaceNavigationStep['travelMode']) {
  return mode === 'WALK' ? undefined : '2.2 1.4';
}

export function WorkplaceNavigationRouteMap({
  route,
  locale,
  originName,
  destinationName,
}: {
  route: WorkplaceNavigationRoute;
  locale: WorkplaceNavigationLocale;
  originName: string;
  destinationName: string;
}) {
  const theme = useTheme();
  const model = workplaceNavigationRouteMapModel(route);
  const firstSegment = model.segments[0];
  const lastSegment = model.segments.at(-1);
  const firstVisibleStep = firstSegment ? route.steps[firstSegment.stepNumber - 1] : null;
  const routeLabel =
    locale === 'ko'
      ? `${originName}에서 ${destinationName}까지의 ${model.floorName ?? '목적지 층'} 경로도`
      : `${model.floorName ?? 'Destination floor'} route from ${originName} to ${destinationName}`;
  const unavailable =
    locale === 'ko'
      ? '이 경로의 좌표 도면을 표시할 수 없어 순차 텍스트 안내를 제공합니다.'
      : 'Coordinates are unavailable for this route. Use the turn-by-turn directions.';

  return (
    <Box
      component="figure"
      data-testid="workplace-wayfinding-map"
      role="img"
      aria-label={routeLabel}
      sx={{ m: 0, mb: 2 }}
    >
      <Box
        sx={{
          minHeight: { xs: 240, sm: 340 },
          position: 'relative',
          overflow: 'hidden',
          borderRadius: foundationTokens.workplace.radius.card + 'px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.045),
          backgroundImage: `linear-gradient(${alpha(theme.palette.primary.main, 0.08)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.08)} 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          aspectRatio: '1200 / 760',
        }}
      >
        {model.backgroundAssetPath ? (
          <Box
            component="img"
            src={model.backgroundAssetPath}
            alt=""
            aria-hidden="true"
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'fill',
            }}
          />
        ) : null}

        {model.segments.length > 0 ? (
          <Box
            component="svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <g
              fill="none"
              stroke={theme.palette.common.white}
              strokeWidth="1.55"
              strokeLinecap="round"
            >
              {model.segments.map((segment) => (
                <line
                  key={`halo-${segment.key}`}
                  x1={segment.fromX}
                  y1={segment.fromY}
                  x2={segment.toX}
                  y2={segment.toY}
                />
              ))}
            </g>
            <g
              fill="none"
              stroke={theme.palette.primary.main}
              strokeWidth="0.82"
              strokeLinecap="round"
            >
              {model.segments.map((segment) => (
                <line
                  key={segment.key}
                  x1={segment.fromX}
                  y1={segment.fromY}
                  x2={segment.toX}
                  y2={segment.toY}
                  strokeDasharray={routeStroke(segment.travelMode)}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
            {model.segments.map((segment) => (
              <g key={`point-${segment.key}`}>
                <circle
                  cx={segment.toX}
                  cy={segment.toY}
                  r="1.8"
                  fill={theme.palette.common.white}
                />
                <circle
                  cx={segment.toX}
                  cy={segment.toY}
                  r="1.18"
                  fill={theme.palette.primary.main}
                />
              </g>
            ))}
            {firstSegment ? (
              <g>
                <circle
                  cx={firstSegment.fromX}
                  cy={firstSegment.fromY}
                  r="2.25"
                  fill={theme.palette.common.white}
                />
                <circle
                  cx={firstSegment.fromX}
                  cy={firstSegment.fromY}
                  r="1.52"
                  fill={theme.palette.success.main}
                />
              </g>
            ) : null}
            {lastSegment ? (
              <g>
                <circle
                  cx={lastSegment.toX}
                  cy={lastSegment.toY}
                  r="2.25"
                  fill={theme.palette.common.white}
                />
                <circle
                  cx={lastSegment.toX}
                  cy={lastSegment.toY}
                  r="1.52"
                  fill={theme.palette.error.main}
                />
              </g>
            ) : null}
          </Box>
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 3 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
              sx={{
                maxWidth: 440,
                bgcolor: 'background.paper',
                p: 1.5,
                borderRadius: foundationTokens.workplace.radius.card + 'px',
              }}
            >
              {unavailable}
            </Typography>
          </Box>
        )}

        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            p: 1,
            borderRadius: foundationTokens.workplace.radius.card + 'px',
            bgcolor: alpha(theme.palette.grey[900], 0.92),
            color: theme.palette.common.white,
          }}
        >
          <Route size={18} aria-hidden="true" />
          <Typography
            variant="body2"
            fontWeight={foundationTokens.home.typography.weightEmphasis}
            noWrap
          >
            {model.floorName ? `${model.floorName} · ` : ''}
            {firstVisibleStep ? workplaceNavigationDirection(firstVisibleStep, locale) : routeLabel}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="figcaption"
        direction="row"
        justifyContent="space-between"
        gap={1}
        sx={{ mt: 0.75 }}
      >
        <Typography variant="caption" color="text.secondary">
          {locale === 'ko'
            ? '초록색: 구간 시작 · 빨간색: 목적지'
            : 'Green: segment start · Red: destination'}
        </Typography>
        {model.floorName ? (
          <Typography variant="caption" color="text.secondary">
            {model.floorName}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
