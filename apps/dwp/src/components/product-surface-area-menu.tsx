import { BriefcaseBusiness, Settings2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';

import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';

import type { ProductSurfaceNavigationEntry } from './product-surface-header-control-model';

export function ProductSurfaceAreaMenu({
  anchor,
  menuId,
  areaLabel,
  currentSurfaceId,
  entries,
  resolveLabel,
  compact,
  onClose,
  onNavigate,
}: {
  anchor: HTMLElement;
  menuId: string;
  areaLabel: string;
  currentSurfaceId: string;
  entries: readonly ProductSurfaceNavigationEntry[];
  resolveLabel?: (labelKey: string) => string;
  compact: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}) {
  const telemetry = useProductSurfaceTelemetry();

  return (
    <Popover
      anchorEl={anchor}
      open
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { maxWidth: 'calc(100vw - 24px)', mt: 0.5 } } }}
    >
      <MenuList
        id={menuId}
        autoFocusItem
        aria-label={areaLabel}
        data-testid={
          compact ? 'product-surface-mobile-disclosure' : 'product-surface-desktop-disclosure'
        }
        sx={{ minWidth: compact ? 220 : 240 }}
      >
        {entries.map((entry) => {
          const Icon = entry.plane === 'management' ? Settings2 : BriefcaseBusiness;
          const selected = entry.surfaceId === currentSurfaceId;
          const entryLabel = resolveLabel?.(entry.labelKey) ?? entry.labelKey;
          return (
            <MenuItem
              key={entry.surfaceId}
              component={NavLink}
              to={entry.path}
              selected={selected}
              aria-current={selected ? 'page' : undefined}
              onClick={() => {
                if (!selected) {
                  telemetry.beginSurfaceSwitch(entry.productId, currentSurfaceId, entry.surfaceId);
                }
                onClose();
                onNavigate?.();
              }}
              sx={{ minHeight: 44, gap: 1, px: 1.5 }}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              <Typography
                component="span"
                variant="body2"
                fontWeight={selected ? 'fontWeightBold' : 'fontWeightMedium'}
                noWrap
              >
                {entryLabel}
              </Typography>
            </MenuItem>
          );
        })}
      </MenuList>
    </Popover>
  );
}
