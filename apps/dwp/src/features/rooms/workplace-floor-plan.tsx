import { useMemo } from 'react';
import {
  Armchair,
  BriefcaseBusiness,
  CarFront,
  DoorOpen,
  LockKeyhole,
  Monitor,
  Package,
  Phone,
  UsersRound,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  WorkplaceOccupancy,
  WorkplaceResource,
  WorkplaceResourceType,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

export type WorkplaceResourceAvailability =
  'AVAILABLE' | 'OCCUPIED' | 'MINE' | 'ASSIGNED' | 'DROP_IN' | 'UNAVAILABLE';

const RESOURCE_ICONS: Record<WorkplaceResourceType, LucideIcon> = {
  ROOM: UsersRound,
  DESK: Monitor,
  LOCKER: LockKeyhole,
  PARKING: CarFront,
  FOCUS_POD: BriefcaseBusiness,
  PHONE_BOOTH: Phone,
  EQUIPMENT: Package,
};

const AVAILABILITY_COLORS: Record<
  WorkplaceResourceAvailability,
  { border: string; fill: string; text: string }
> = {
  AVAILABLE: { border: '#16835B', fill: '#ECF8F2', text: '#0B6140' },
  OCCUPIED: { border: '#B8C0CC', fill: '#F1F3F6', text: '#5A6472' },
  MINE: { border: '#2563EB', fill: '#EAF1FF', text: '#1748B0' },
  ASSIGNED: { border: '#7C3AED', fill: '#F3EEFF', text: '#5B21B6' },
  DROP_IN: { border: '#C66A00', fill: '#FFF5E6', text: '#8B4A00' },
  UNAVAILABLE: { border: '#C33C46', fill: '#FFF0F1', text: '#8E2730' },
};

export function workplaceResourceAvailability(
  resource: WorkplaceResource,
  occupancy: readonly WorkplaceOccupancy[]
): WorkplaceResourceAvailability {
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
  return (
    <Stack direction="row" gap={1.5} useFlexGap flexWrap="wrap" aria-label={ariaLabel}>
      {(Object.keys(AVAILABILITY_COLORS) as WorkplaceResourceAvailability[]).map((status) => (
        <Stack key={status} direction="row" gap={0.65} alignItems="center">
          <Box
            aria-hidden="true"
            sx={{
              width: 9,
              height: 9,
              borderRadius: '2px',
              bgcolor: AVAILABILITY_COLORS[status].fill,
              border: 1,
              borderColor: AVAILABILITY_COLORS[status].border,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {labels[status]}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export function WorkplaceFloorPlan({
  resources,
  occupancy,
  planWidth,
  planHeight,
  backgroundAssetPath,
  selectedResourceId,
  onSelect,
  statusLabels,
  entryLabel,
}: {
  resources: readonly WorkplaceResource[];
  occupancy: readonly WorkplaceOccupancy[];
  planWidth: number;
  planHeight: number;
  backgroundAssetPath?: string | null;
  selectedResourceId?: string | null;
  onSelect: (resource: WorkplaceResource) => void;
  statusLabels: Record<WorkplaceResourceAvailability, string>;
  entryLabel: string;
}) {
  const occupancyByResource = useMemo(() => {
    const values = new Map<string, WorkplaceOccupancy[]>();
    for (const slot of occupancy) {
      const current = values.get(slot.resourceId) ?? [];
      current.push(slot);
      values.set(slot.resourceId, current);
    }
    return values;
  }, [occupancy]);

  return (
    <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
      <Box
        data-testid="workplace-floor-plan"
        sx={(theme) => ({
          position: 'relative',
          width: '100%',
          minWidth: 760,
          aspectRatio: `${planWidth} / ${planHeight}`,
          maxHeight: 660,
          minHeight: 420,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          bgcolor: theme.palette.mode === 'dark' ? '#171B21' : '#F8FAFC',
          backgroundImage: backgroundAssetPath
            ? `linear-gradient(${alpha(theme.palette.background.paper, 0.06)}, ${alpha(theme.palette.background.paper, 0.06)}), url(${backgroundAssetPath})`
            : `linear-gradient(${alpha(theme.palette.divider, 0.35)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(theme.palette.divider, 0.35)} 1px, transparent 1px)`,
          backgroundSize: backgroundAssetPath ? 'contain' : '40px 40px',
          backgroundRepeat: backgroundAssetPath ? 'no-repeat' : 'repeat',
          backgroundPosition: 'center',
        })}
      >
        {!backgroundAssetPath && (
          <>
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                inset: '5% 3%',
                border: 2,
                borderColor: 'text.disabled',
                pointerEvents: 'none',
              }}
            />
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                left: '46%',
                top: '5%',
                bottom: '5%',
                width: '8%',
                borderInline: 1,
                borderColor: 'divider',
                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
              }}
            />
            <Stack
              aria-hidden="true"
              direction="row"
              gap={0.75}
              alignItems="center"
              sx={{ position: 'absolute', left: '48.4%', bottom: '6.5%', color: 'text.disabled' }}
            >
              <DoorOpen size={16} />
              <Typography variant="caption">{entryLabel}</Typography>
            </Stack>
          </>
        )}

        {resources.map((resource) => {
          const status = workplaceResourceAvailability(
            resource,
            occupancyByResource.get(resource.resourceId) ?? []
          );
          const colors = AVAILABILITY_COLORS[status];
          const Icon = RESOURCE_ICONS[resource.type] ?? Armchair;
          const selected = resource.resourceId === selectedResourceId;
          const disabled = status === 'OCCUPIED' || status === 'UNAVAILABLE';
          const tooltip = `${resource.name} · ${statusLabels[status]}`;
          return (
            <Tooltip key={resource.resourceId} title={tooltip} arrow>
              <Box
                component="button"
                type="button"
                aria-label={tooltip}
                aria-pressed={selected}
                onClick={() => onSelect(resource)}
                sx={{
                  position: 'absolute',
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
  );
}

export function WorkplaceResourceList({
  resources,
  occupancy,
  onSelect,
  statusLabels,
  typeLabels,
}: {
  resources: readonly WorkplaceResource[];
  occupancy: readonly WorkplaceOccupancy[];
  onSelect: (resource: WorkplaceResource) => void;
  statusLabels: Record<WorkplaceResourceAvailability, string>;
  typeLabels: Record<WorkplaceResourceType, string>;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1 }}>
      {resources.map((resource) => {
        const status = workplaceResourceAvailability(resource, occupancy);
        const colors = AVAILABILITY_COLORS[status];
        const Icon = RESOURCE_ICONS[resource.type];
        return (
          <Box
            component="button"
            type="button"
            key={resource.resourceId}
            onClick={() => onSelect(resource)}
            sx={{
              minHeight: 92,
              p: 1.5,
              textAlign: 'left',
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.primary',
              cursor: 'pointer',
              display: 'grid',
              gridTemplateColumns: '40px minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 1.25,
              font: 'inherit',
              '&:hover': { borderColor: colors.border, bgcolor: colors.fill },
              '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light' },
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
              }}
            >
              <Icon size={19} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {resource.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {[
                  typeLabels[resource.type],
                  resource.neighborhood,
                  resource.features.slice(0, 2).join(' · '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={statusLabels[status]}
              sx={{ borderRadius: 1, bgcolor: colors.fill, color: colors.text }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
