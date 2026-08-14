import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { useAppearance } from '@dwp-frontend/design-system/appearance';
import { useAuth } from '@dwp-frontend/shared-utils';

import type { ShellDefinition } from './shell-registry';

const STORAGE_PREFIX = 'dwp:shell:desktop-navigation';

function readCompactPreference(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === 'compact';
  } catch {
    return false;
  }
}

function writeCompactPreference(storageKey: string, compact: boolean): void {
  try {
    window.localStorage.setItem(storageKey, compact ? 'compact' : 'expanded');
  } catch {
    // Storage policy must not block navigation within the current session.
  }
}

type DesktopNavigationOptions = {
  allowTopNavigation?: boolean;
};

export function useDesktopNavigation(
  shell: ShellDefinition,
  { allowTopNavigation = false }: DesktopNavigationOptions = {}
) {
  const appearance = useAppearance();
  const auth = useAuth();
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${auth.user?.tenantId ?? 'tenant'}:${auth.user?.userId ?? 'user'}`,
    [auth.user?.tenantId, auth.user?.userId]
  );
  const [preferredCompact, setPreferredCompact] = useState(() => readCompactPreference(storageKey));

  useEffect(() => {
    setPreferredCompact(readCompactPreference(storageKey));
  }, [storageKey]);

  const topNavigation = allowTopNavigation && appearance.navigationPattern === 'top';
  const forcedCompact = appearance.navigationPattern === 'rail';
  const compact = !topNavigation && (forcedCompact || preferredCompact);
  const collapsible =
    !topNavigation &&
    !forcedCompact &&
    appearance.policy.navigation.allowCollapse &&
    Boolean(shell.compactNavigationWidth);
  const sidebarWidth = compact
    ? (shell.compactNavigationWidth ?? shell.desktopNavigationWidth)
    : shell.desktopNavigationWidth;
  const desktopOffset = topNavigation ? 0 : sidebarWidth;

  const toggle = () => {
    if (!collapsible) return;
    setPreferredCompact((current) => {
      const next = !current;
      writeCompactPreference(storageKey, next);
      return next;
    });
  };

  return {
    compact,
    collapsible,
    desktopOffset,
    sidebarWidth,
    toggle,
    topNavigation,
  };
}

export function DesktopNavigationToggle({
  compact,
  controlsId,
  onToggle,
}: {
  compact: boolean;
  controlsId: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation('shell');
  const label = compact ? t('navigation.expand') : t('navigation.collapse');

  return (
    <ActionIconButton
      size="small"
      label={label}
      tooltipPlacement="bottom"
      aria-controls={controlsId}
      aria-expanded={!compact}
      onClick={onToggle}
      sx={{
        mr: 0.5,
        width: 40,
        height: 40,
        display: { xs: 'none', lg: 'inline-flex' },
        color: 'text.secondary',
        '&:hover': { color: 'text.primary' },
      }}
    >
      {compact ? (
        <PanelLeftOpen size={18} strokeWidth={1.8} />
      ) : (
        <PanelLeftClose size={18} strokeWidth={1.8} />
      )}
    </ActionIconButton>
  );
}
