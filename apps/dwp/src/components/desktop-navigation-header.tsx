import Box from '@mui/material/Box';

import { BrandLockup } from './brand-lockup';
import { DesktopNavigationToggle } from '../features/shell/desktop-navigation';
import { shellHeaderHeight } from '../features/shell/shell-registry';
import { ShellMobileNavigationCloseButton } from '../features/shell/shell-mobile-navigation';

type DesktopNavigationHeaderProps = {
  compact: boolean;
  collapsible: boolean;
  controlsId: string;
  description?: string;
  label?: string;
  onDismiss?: () => void;
  onToggle: () => void;
};

export function DesktopNavigationHeader({
  compact,
  collapsible,
  controlsId,
  description,
  label,
  onDismiss,
  onToggle,
}: DesktopNavigationHeaderProps) {
  const showDesktopToggle = collapsible && !onDismiss;

  return (
    <Box
      data-testid="desktop-navigation-header"
      sx={{
        minHeight: shellHeaderHeight,
        px: compact ? 0 : 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'center' : 'space-between',
        gap: compact ? 0 : 1,
      }}
    >
      {(!compact || !showDesktopToggle) && (
        <BrandLockup
          key="brand"
          variant={compact ? 'product-only' : 'product-full'}
          label={label}
          description={description}
          sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}
        />
      )}

      {showDesktopToggle && (
        <DesktopNavigationToggle
          key="toggle"
          compact={compact}
          controlsId={controlsId}
          onToggle={onToggle}
        />
      )}

      {onDismiss && !compact && <ShellMobileNavigationCloseButton onDismiss={onDismiss} />}
    </Box>
  );
}
