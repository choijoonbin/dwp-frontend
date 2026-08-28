import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BriefcaseBusiness, ChevronDown, Layers3, Settings2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';
import {
  resolveProductSurfaceHeaderControlModel,
  type ProductSurfaceNavigationEntry,
} from './product-surface-header-control-model';

export type ProductSurfaceHeaderControlsProps = {
  variant: 'desktop' | 'compact';
  currentSurfaceId: string;
  entries: readonly ProductSurfaceNavigationEntry[];
  label: string;
  productLabel: string;
  resolveLabel?: (labelKey: string) => string;
  onNavigate?: () => void;
};

function ProductManagementModeBadge({ compact }: { compact: boolean }) {
  const { t } = useTranslation('common');
  const managementModeLabel = t('productSurface.labels.managementMode');

  return (
    <Box
      component="span"
      data-testid="product-surface-management-mode"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        flex: '0 0 auto',
        minHeight: 30,
        px: compact ? { xs: 0.75, md: 1 } : 1,
        bgcolor: 'action.selected',
        border: 1,
        borderColor: 'divider',
        borderRadius: 999,
        typography: 'caption',
        fontWeight: 750,
      }}
    >
      {compact ? (
        <>
          <Box
            component="span"
            data-testid="product-surface-management-mode-compact-label"
            sx={{ display: { xs: 'inline', md: 'none' } }}
          >
            {t('productSurface.labels.managementModeCompact')}
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
            {managementModeLabel}
          </Box>
        </>
      ) : (
        managementModeLabel
      )}
    </Box>
  );
}

function ProductSurfaceAreaDisclosure({
  currentSurfaceId,
  current,
  entries,
  resolveLabel,
  onNavigate,
  compact,
}: {
  currentSurfaceId: string;
  current: ProductSurfaceNavigationEntry;
  entries: readonly ProductSurfaceNavigationEntry[];
  resolveLabel?: (labelKey: string) => string;
  onNavigate?: () => void;
  compact: boolean;
}) {
  const { t } = useTranslation('common');
  const telemetry = useProductSurfaceTelemetry();
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const currentLabel = resolveLabel?.(current.labelKey) ?? current.labelKey;
  const areaLabel = t(
    current.plane === 'management'
      ? 'productSurface.labels.managementAreas'
      : 'productSurface.labels.workAreas'
  );

  return (
    <>
      <Tooltip title={currentLabel} placement="bottom">
        <ActionButton
          size="small"
          intent="quiet"
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? menuId : undefined}
          aria-label={t('productSurface.labels.currentSurface', { surface: currentLabel })}
          startIcon={<Layers3 size={16} strokeWidth={1.8} aria-hidden="true" />}
          endIcon={<ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{
            minWidth: compact ? { xs: 40, md: 'auto' } : 40,
            minHeight: compact ? 44 : 40,
            maxWidth: compact ? { md: 150 } : 164,
            px: compact ? { xs: 1, md: 1.25 } : 1.25,
            whiteSpace: 'nowrap',
            '& .MuiButton-startIcon': {
              ml: 0,
              mr: compact ? { xs: 0, md: 0.75 } : 0.75,
              color: 'primary.main',
            },
            '& .MuiButton-endIcon': {
              display: compact ? { xs: 'none', md: 'inherit' } : 'inherit',
              ml: 0.5,
            },
          }}
        >
          <Box
            component="span"
            sx={{
              display: compact ? { xs: 'none', md: 'block' } : 'block',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentLabel}
          </Box>
        </ActionButton>
      </Tooltip>
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: { sx: { maxWidth: 'calc(100vw - 24px)', mt: 0.5 } },
        }}
      >
        <MenuList
          id={menuId}
          autoFocusItem={Boolean(anchor)}
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
                    telemetry.beginSurfaceSwitch(
                      entry.productId,
                      currentSurfaceId,
                      entry.surfaceId
                    );
                  }
                  setAnchor(null);
                  onNavigate?.();
                }}
                sx={{ minHeight: 44, gap: 1, px: 1.5 }}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <Typography
                  component="span"
                  variant="body2"
                  fontWeight={selected ? 750 : 600}
                  noWrap
                >
                  {entryLabel}
                </Typography>
              </MenuItem>
            );
          })}
        </MenuList>
      </Popover>
    </>
  );
}

function ProductSurfaceTransitionLink({
  currentSurfaceId,
  entry,
  productLabel,
  compact,
  onNavigate,
}: {
  currentSurfaceId: string;
  entry: ProductSurfaceNavigationEntry;
  productLabel: string;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation('common');
  const telemetry = useProductSurfaceTelemetry();
  const managementEntry = entry.entryKind === 'management-entry';
  const visibleLabel = t(
    managementEntry ? 'productSurface.labels.appManagement' : 'productSurface.labels.returnToWork'
  );
  const accessibleLabel = t(
    managementEntry
      ? 'productSurface.labels.appManagementForProduct'
      : 'productSurface.labels.returnToWorkForProduct',
    { product: productLabel }
  );
  const compactLabel = t(
    managementEntry ? 'productSurface.labels.managementModeCompact' : 'productSurface.labels.work'
  );
  const Icon = managementEntry ? Settings2 : ArrowLeft;

  return (
    <Tooltip title={accessibleLabel} placement="bottom">
      <ActionButton
        data-testid={
          managementEntry ? 'product-surface-management-entry' : 'product-surface-work-return'
        }
        component={NavLink}
        to={entry.path}
        intent="quiet"
        size="small"
        startIcon={<Icon size={16} strokeWidth={1.9} aria-hidden="true" />}
        aria-label={accessibleLabel}
        onClick={() => {
          if (managementEntry) {
            telemetry.beginSurfaceSwitch(entry.productId, currentSurfaceId, entry.surfaceId);
          } else {
            telemetry.captureReturn(entry.productId, currentSurfaceId, entry.surfaceId);
          }
          onNavigate?.();
        }}
        sx={{
          minWidth: compact ? 'auto' : 'auto',
          minHeight: 40,
          px: compact ? { xs: 0.75, sm: 1, md: 1.25 } : 1.25,
          color: 'text.primary',
          whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': {
            ml: 0,
            mr: compact ? { xs: 0.5, md: 0.75 } : 0.75,
            color: 'primary.main',
          },
        }}
      >
        <Box component="span">{compact ? compactLabel : visibleLabel}</Box>
      </ActionButton>
    </Tooltip>
  );
}

export default function ProductSurfaceHeaderControls({
  variant,
  currentSurfaceId,
  entries,
  label,
  productLabel,
  resolveLabel,
  onNavigate,
}: ProductSurfaceHeaderControlsProps) {
  const model = resolveProductSurfaceHeaderControlModel(currentSurfaceId, entries);
  if (!model) return null;
  const compact = variant === 'compact';
  const showAreaNavigation = model.samePlaneEntries.length > 1;
  const hasNavigation = showAreaNavigation || Boolean(model.transitionEntry);
  if (!hasNavigation && model.currentPlane === 'work') return null;

  return (
    <Stack
      component={hasNavigation ? 'nav' : 'div'}
      aria-label={hasNavigation ? label : undefined}
      direction="row"
      alignItems="center"
      gap={compact ? 0.25 : 0.5}
      flexWrap="nowrap"
      sx={{ minWidth: 0 }}
    >
      {model.currentPlane === 'management' && <ProductManagementModeBadge compact={compact} />}
      {showAreaNavigation && (
        <ProductSurfaceAreaDisclosure
          currentSurfaceId={currentSurfaceId}
          current={model.current}
          entries={model.samePlaneEntries}
          resolveLabel={resolveLabel}
          onNavigate={onNavigate}
          compact={compact}
        />
      )}
      {model.transitionEntry && (
        <Box
          display="flex"
          alignItems="center"
          sx={
            compact
              ? showAreaNavigation
                ? { ml: 0.25, pl: 0.5, borderLeft: 1, borderColor: 'divider' }
                : undefined
              : { ml: 0.5, pl: 1, borderLeft: 1, borderColor: 'divider' }
          }
        >
          <ProductSurfaceTransitionLink
            currentSurfaceId={currentSurfaceId}
            entry={model.transitionEntry}
            productLabel={productLabel}
            compact={compact}
            onNavigate={onNavigate}
          />
        </Box>
      )}
    </Stack>
  );
}
