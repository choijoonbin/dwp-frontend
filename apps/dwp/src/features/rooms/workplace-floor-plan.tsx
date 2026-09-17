import { foundationTokens } from '@dwp-frontend/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  BriefcaseBusiness,
  CarFront,
  LockKeyhole,
  Monitor,
  Package,
  Phone,
  UsersRound,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { WorkplaceResourcePhoto } from './workplace-resource-photo';

import type {
  WorkplaceOccupancy,
  WorkplaceResource,
  WorkplaceResourceType,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';
import type { Theme } from '@mui/material/styles';

export type WorkplaceResourceAvailability =
  'AVAILABLE' | 'OCCUPIED' | 'MINE' | 'ASSIGNED' | 'DROP_IN' | 'UNAVAILABLE';

export type WorkplaceFloorPlanZone = {
  key: string;
  label: string;
  resourceCount: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/**
 * Builds visual zones only from the registered resource projection. It never infers rooms,
 * walls, sensor coverage, or live presence that the floor-plan contract did not return.
 */
export function workplaceFloorPlanZones(
  resources: readonly WorkplaceResource[]
): WorkplaceFloorPlanZone[] {
  const grouped = new Map<string, WorkplaceResource[]>();
  for (const resource of resources) {
    const label = resource.neighborhood?.trim();
    if (!label) continue;
    grouped.set(label, [...(grouped.get(label) ?? []), resource]);
  }
  return [...grouped.entries()]
    .map(([label, zoneResources]) => {
      const left = Math.min(...zoneResources.map((resource) => resource.positionX));
      const top = Math.min(...zoneResources.map((resource) => resource.positionY));
      const right = Math.max(
        ...zoneResources.map((resource) => resource.positionX + resource.widthPercent)
      );
      const bottom = Math.max(
        ...zoneResources.map((resource) => resource.positionY + resource.heightPercent)
      );
      const padding = 1.5;
      const zoneLeft = clampPercent(left - padding);
      const zoneTop = clampPercent(top - padding);
      return {
        key: label,
        label,
        resourceCount: zoneResources.length,
        left: zoneLeft,
        top: zoneTop,
        width: Math.min(100 - zoneLeft, Math.max(4, clampPercent(right + padding) - zoneLeft)),
        height: Math.min(100 - zoneTop, Math.max(4, clampPercent(bottom + padding) - zoneTop)),
      };
    })
    .sort((left, right) => left.top - right.top || left.left - right.left);
}

const RESOURCE_ICONS: Record<WorkplaceResourceType, LucideIcon> = {
  ROOM: UsersRound,
  DESK: Monitor,
  LOCKER: LockKeyhole,
  PARKING: CarFront,
  FOCUS_POD: BriefcaseBusiness,
  PHONE_BOOTH: Phone,
  EQUIPMENT: Package,
};

function availabilityColors(theme: Theme, status: WorkplaceResourceAvailability) {
  const palette = {
    AVAILABLE: theme.palette.success,
    OCCUPIED: { main: theme.palette.grey[500], dark: theme.palette.text.secondary },
    MINE: theme.palette.primary,
    ASSIGNED: theme.palette.secondary,
    DROP_IN: theme.palette.warning,
    UNAVAILABLE: theme.palette.error,
  }[status];
  return {
    border: palette.main,
    fill: alpha(palette.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
    text: palette.dark,
  };
}

export function workplaceResourceAvailability(
  resource: WorkplaceResource,
  occupancy: readonly WorkplaceOccupancy[],
  closures: readonly { resourceId: string }[] = []
): WorkplaceResourceAvailability {
  if (closures.some((closure) => closure.resourceId === resource.resourceId)) return 'UNAVAILABLE';
  if (resource.state !== 'AVAILABLE' || resource.mode === 'UNAVAILABLE') return 'UNAVAILABLE';
  const active = occupancy.find((slot) => slot.resourceId === resource.resourceId);
  if (active?.currentUser) return 'MINE';
  if (active) return 'OCCUPIED';
  if (resource.mode === 'ASSIGNED') return 'ASSIGNED';
  if (resource.mode === 'DROP_IN') return 'DROP_IN';
  return 'AVAILABLE';
}

export function WorkplaceMapLegend({
  labels,
  ariaLabel,
}: {
  labels: Record<WorkplaceResourceAvailability, string>;
  ariaLabel: string;
}) {
  const theme = useTheme();
  return (
    <Stack direction="row" gap={1.5} useFlexGap flexWrap="wrap" aria-label={ariaLabel}>
      {(['AVAILABLE', 'OCCUPIED', 'MINE', 'ASSIGNED', 'DROP_IN', 'UNAVAILABLE'] as const).map(
        (status) => {
          const colors = availabilityColors(theme, status);
          return (
            <Stack key={status} direction="row" gap={0.65} alignItems="center">
              <Box
                aria-hidden="true"
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '2px',
                  bgcolor: colors.fill,
                  border: 1,
                  borderColor: colors.border,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {labels[status]}
              </Typography>
            </Stack>
          );
        }
      )}
    </Stack>
  );
}

export function WorkplaceFloorPlan({
  resources,
  occupancy,
  closures = [],
  planWidth,
  planHeight,
  backgroundAssetPath,
  selectedResourceId,
  onSelect,
  statusLabels,
  bookingEligibility,
  bookingEligibilityLabels,
  ariaLabel,
  zoomInLabel,
  zoomOutLabel,
  fitLabel,
}: {
  resources: readonly WorkplaceResource[];
  occupancy: readonly WorkplaceOccupancy[];
  closures?: readonly { resourceId: string }[];
  planWidth: number;
  planHeight: number;
  backgroundAssetPath?: string | null;
  selectedResourceId?: string | null;
  onSelect: (resource: WorkplaceResource) => void;
  statusLabels: Record<WorkplaceResourceAvailability, string>;
  bookingEligibility: (resource: WorkplaceResource) => boolean;
  bookingEligibilityLabels: { eligible: string; blocked: string };
  ariaLabel: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  fitLabel: string;
}) {
  const theme = useTheme();
  const [zoom, setZoom] = useState(1);
  const [activeResourceId, setActiveResourceId] = useState(
    () => selectedResourceId ?? resources[0]?.resourceId ?? ''
  );
  const resourceRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (selectedResourceId && resources.some((item) => item.resourceId === selectedResourceId)) {
      setActiveResourceId(selectedResourceId);
      return;
    }
    if (!resources.some((item) => item.resourceId === activeResourceId)) {
      setActiveResourceId(resources[0]?.resourceId ?? '');
    }
  }, [activeResourceId, resources, selectedResourceId]);
  const occupancyByResource = useMemo(() => {
    const values = new Map<string, WorkplaceOccupancy[]>();
    for (const slot of occupancy) {
      const current = values.get(slot.resourceId) ?? [];
      current.push(slot);
      values.set(slot.resourceId, current);
    }
    return values;
  }, [occupancy]);
  const zones = useMemo(() => workplaceFloorPlanZones(resources), [resources]);
  const availabilityCounts = useMemo(() => {
    const counts = new Map<WorkplaceResourceAvailability, number>();
    for (const resource of resources) {
      const status = workplaceResourceAvailability(
        resource,
        occupancyByResource.get(resource.resourceId) ?? [],
        closures
      );
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return counts;
  }, [closures, occupancyByResource, resources]);

  const moveFocus = (currentId: string, direction: -1 | 1) => {
    const currentIndex = resources.findIndex((resource) => resource.resourceId === currentId);
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + direction + resources.length) % resources.length;
    const next = resources[nextIndex];
    if (!next) return;
    setActiveResourceId(next.resourceId);
    resourceRefs.current.get(next.resourceId)?.focus();
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1}
        sx={{ mb: 0.75 }}
      >
        <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap">
          {([...availabilityCounts.entries()] as [WorkplaceResourceAvailability, number][]).map(
            ([status, count]) => {
              const colors = availabilityColors(theme, status);
              return (
                <Chip
                  key={status}
                  size="small"
                  label={`${statusLabels[status]} ${count}`}
                  sx={{ bgcolor: colors.fill, color: colors.text, borderColor: colors.border }}
                  variant="outlined"
                />
              );
            }
          )}
        </Stack>
        <Stack direction="row" justifyContent="flex-end" gap={0.25}>
          <ActionIconButton
            label={zoomOutLabel}
            tooltip={zoomOutLabel}
            disabled={zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
          >
            <ZoomOut size={17} />
          </ActionIconButton>
          <ActionIconButton label={fitLabel} tooltip={fitLabel} onClick={() => setZoom(1)}>
            <Maximize2 size={17} />
          </ActionIconButton>
          <ActionIconButton
            label={zoomInLabel}
            tooltip={zoomInLabel}
            disabled={zoom >= 2}
            onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
          >
            <ZoomIn size={17} />
          </ActionIconButton>
        </Stack>
      </Stack>
      <Box sx={{ overflow: 'auto', maxHeight: 660, minHeight: { xs: 320, md: 420 }, pb: 0.5 }}>
        <Box
          data-testid="workplace-floor-plan"
          role="listbox"
          aria-label={ariaLabel}
          sx={{
            position: 'relative',
            width: `${zoom * 100}%`,
            minWidth: 640,
            aspectRatio: `${Math.max(planWidth, 1)} / ${Math.max(planHeight, 1)}`,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
            backgroundImage: backgroundAssetPath
              ? `linear-gradient(${alpha(theme.palette.background.paper, 0.04)}, ${alpha(theme.palette.background.paper, 0.04)}), url(${backgroundAssetPath})`
              : `linear-gradient(${alpha(theme.palette.divider, 0.35)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(theme.palette.divider, 0.35)} 1px, transparent 1px)`,
            backgroundSize: backgroundAssetPath ? 'contain' : '24px 24px',
            backgroundRepeat: backgroundAssetPath ? 'no-repeat' : 'repeat',
            backgroundPosition: 'center',
          }}
        >
          {zones.map((zone) => (
            <Box
              key={zone.key}
              aria-hidden="true"
              sx={{
                pointerEvents: 'none',
                position: 'absolute',
                zIndex: 0,
                left: `${zone.left}%`,
                top: `${zone.top}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
                border: 1,
                borderColor: alpha(theme.palette.primary.main, 0.22),
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.05 : 0.025
                ),
                borderRadius: foundationTokens.radius.surface + 'px',
              }}
            >
              <Typography
                component="span"
                variant="caption"
                sx={{
                  position: 'absolute',
                  top: 4,
                  left: 6,
                  maxWidth: 'calc(100% - 12px)',
                  color: 'text.secondary',
                  bgcolor: alpha(theme.palette.background.paper, 0.88),
                  px: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {zone.label} · {zone.resourceCount}
              </Typography>
            </Box>
          ))}
          {resources.map((resource) => {
            const status = workplaceResourceAvailability(
              resource,
              occupancyByResource.get(resource.resourceId) ?? [],
              closures
            );
            const colors = availabilityColors(theme, status);
            const Icon = RESOURCE_ICONS[resource.type] ?? Armchair;
            const selected = resource.resourceId === selectedResourceId;
            const disabled = status === 'OCCUPIED' || status === 'UNAVAILABLE';
            const bookingLabel = bookingEligibility(resource)
              ? bookingEligibilityLabels.eligible
              : bookingEligibilityLabels.blocked;
            const tooltip = `${resource.name} · ${statusLabels[status]} · ${bookingLabel}`;
            return (
              <Tooltip key={resource.resourceId} title={tooltip} arrow>
                <Box
                  component="button"
                  type="button"
                  role="option"
                  aria-label={tooltip}
                  aria-selected={selected}
                  tabIndex={
                    resource.resourceId === (activeResourceId || resources[0]?.resourceId) ? 0 : -1
                  }
                  ref={(node: HTMLButtonElement | null) => {
                    if (node) resourceRefs.current.set(resource.resourceId, node);
                    else resourceRefs.current.delete(resource.resourceId);
                  }}
                  onFocus={() => setActiveResourceId(resource.resourceId)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                      event.preventDefault();
                      moveFocus(resource.resourceId, 1);
                    }
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      moveFocus(resource.resourceId, -1);
                    }
                    if (event.key === 'Home' || event.key === 'End') {
                      event.preventDefault();
                      const target = event.key === 'Home' ? resources[0] : resources.at(-1);
                      if (target) {
                        setActiveResourceId(target.resourceId);
                        resourceRefs.current.get(target.resourceId)?.focus();
                      }
                    }
                  }}
                  onClick={() => {
                    setActiveResourceId(resource.resourceId);
                    onSelect(resource);
                  }}
                  sx={{
                    position: 'absolute',
                    zIndex: 1,
                    left: `${resource.positionX}%`,
                    top: `${resource.positionY}%`,
                    width: `${resource.widthPercent}%`,
                    height: `${resource.heightPercent}%`,
                    minWidth: 38,
                    minHeight: 38,
                    p: 0.5,
                    border: selected ? 2 : 1,
                    borderColor: selected ? 'primary.main' : colors.border,
                    bgcolor: colors.fill,
                    color: colors.text,
                    transform: `rotate(${resource.rotationDegrees}deg)`,
                    cursor: 'pointer',
                    opacity: disabled ? 0.78 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.25,
                    overflow: 'hidden',
                    font: 'inherit',
                    boxShadow: selected ? 3 : 0,
                    transition: 'box-shadow 140ms ease, transform 140ms ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    '&:hover': {
                      boxShadow: 3,
                      transform: `rotate(${resource.rotationDegrees}deg) translateY(-2px)`,
                    },
                    '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light' },
                  }}
                >
                  <Icon size={resource.type === 'DESK' ? 15 : 17} strokeWidth={1.9} />
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      color: 'inherit',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.1,
                      display: resource.widthPercent < 8 ? 'none' : 'block',
                    }}
                  >
                    {resource.code}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export function WorkplaceResourceList({
  resources,
  occupancy,
  closures = [],
  onSelect,
  statusLabels,
  bookingEligibility,
  bookingEligibilityLabels,
  typeLabels,
  selectedResourceId,
  compact = false,
}: {
  resources: readonly WorkplaceResource[];
  occupancy: readonly WorkplaceOccupancy[];
  closures?: readonly { resourceId: string }[];
  onSelect: (resource: WorkplaceResource) => void;
  statusLabels: Record<WorkplaceResourceAvailability, string>;
  bookingEligibility: (resource: WorkplaceResource) => boolean;
  bookingEligibilityLabels: { eligible: string; blocked: string };
  typeLabels: Record<WorkplaceResourceType, string>;
  selectedResourceId?: string | null;
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : { xs: '1fr', md: 'repeat(2, 1fr)' },
        gap: 1,
      }}
    >
      {resources.map((resource) => {
        const status = workplaceResourceAvailability(resource, occupancy, closures);
        const colors = availabilityColors(theme, status);
        const Icon = RESOURCE_ICONS[resource.type];
        const selected = resource.resourceId === selectedResourceId;
        const bookingEligible = bookingEligibility(resource);
        return (
          <Box
            component="article"
            key={resource.resourceId}
            sx={{
              minWidth: 0,
              border: 1,
              borderColor: selected ? 'primary.main' : 'divider',
              borderRadius: foundationTokens.radius.surface + 'px',
              bgcolor: 'background.paper',
              overflow: 'hidden',
              boxShadow: selected ? 1 : 0,
            }}
          >
            {!compact && (
              <Box sx={{ p: 1.5, pb: 0 }}>
                <WorkplaceResourcePhoto
                  resourceId={resource.resourceId}
                  alt={resource.name}
                  height={140}
                />
              </Box>
            )}
            <Box
              component="button"
              type="button"
              onClick={() => onSelect(resource)}
              sx={{
                width: '100%',
                minWidth: 0,
                minHeight: 92,
                p: 1.5,
                textAlign: 'left',
                border: 0,
                bgcolor: 'background.paper',
                color: 'text.primary',
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: '40px minmax(0, 1fr)',
                gridTemplateAreas: '"icon body" "icon status"',
                alignItems: 'center',
                gap: 1.25,
                font: 'inherit',
                '&:hover': { borderColor: colors.border, bgcolor: colors.fill },
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.light',
                  outlineOffset: -3,
                },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  display: 'grid',
                  placeItems: 'center',
                  border: 1,
                  borderColor: colors.border,
                  bgcolor: colors.fill,
                  color: colors.text,
                  gridArea: 'icon',
                }}
              >
                <Icon size={19} />
              </Box>
              <Box sx={{ minWidth: 0, gridArea: 'body' }}>
                <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                  {resource.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', overflowWrap: 'anywhere' }}
                >
                  {[
                    typeLabels[resource.type],
                    resource.neighborhood,
                    resource.features.slice(0, 2).join(' · '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
              <Stack
                direction="row"
                gap={0.65}
                useFlexGap
                flexWrap="wrap"
                sx={{
                  gridArea: 'status',
                  justifySelf: 'start',
                  mt: 0.25,
                }}
              >
                <Chip
                  size="small"
                  label={statusLabels[status]}
                  sx={{
                    borderRadius: foundationTokens.radius.control + 'px',
                    bgcolor: colors.fill,
                    color: colors.text,
                  }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={bookingEligible ? 'success' : 'default'}
                  label={
                    bookingEligible
                      ? bookingEligibilityLabels.eligible
                      : bookingEligibilityLabels.blocked
                  }
                  sx={{ borderRadius: foundationTokens.radius.control + 'px' }}
                />
              </Stack>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
