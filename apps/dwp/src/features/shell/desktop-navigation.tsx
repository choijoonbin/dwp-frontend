import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { ProductGlyph } from '@dwp-frontend/design-system/components/product-mark';
import { useAppearance } from '@dwp-frontend/design-system/appearance';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';

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
  const restingKind = compact ? 'product-mark' : 'sidebar';
  const activeKind = compact ? 'expand' : 'collapse';

  return (
    <ActionIconButton
      data-testid="desktop-navigation-toggle"
      data-navigation-toggle-state={compact ? 'compact' : 'expanded'}
      size="small"
      label={label}
      tooltipPlacement="right"
      aria-controls={controlsId}
      aria-expanded={!compact}
      onClick={onToggle}
      sx={{
        width: 40,
        height: 40,
        flex: '0 0 40px',
        position: 'relative',
        p: 0,
        display: { xs: 'none', lg: 'inline-flex' },
        color: 'text.secondary',
        '& .DwpDesktopNavigationToggle-visual': {
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          transition: (theme) =>
            theme.transitions.create(['opacity', 'transform'], {
              duration: theme.transitions.duration.shortest,
            }),
        },
        '& .DwpDesktopNavigationToggle-resting': {
          opacity: 1,
          transform: 'scale(1)',
        },
        '& .DwpDesktopNavigationToggle-active': {
          opacity: 0,
          transform: 'scale(0.86)',
        },
        '&:hover, &:focus-visible': {
          color: 'text.primary',
          bgcolor: 'action.hover',
        },
        '&:hover .DwpDesktopNavigationToggle-resting, &:focus-visible .DwpDesktopNavigationToggle-resting':
          {
            opacity: 0,
            transform: 'scale(0.86)',
          },
        '&:hover .DwpDesktopNavigationToggle-active, &:focus-visible .DwpDesktopNavigationToggle-active':
          {
            opacity: 1,
            transform: 'scale(1)',
          },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .DwpDesktopNavigationToggle-visual': { transition: 'none' },
        },
        '@media (forced-colors: active)': {
          '&:hover, &:focus-visible': {
            color: 'ButtonText',
            bgcolor: 'Canvas',
            outline: '2px solid Highlight',
          },
        },
      }}
    >
      <span
        className="DwpDesktopNavigationToggle-visual DwpDesktopNavigationToggle-resting"
        data-navigation-toggle-visual="resting"
        data-navigation-toggle-visual-kind={restingKind}
        aria-hidden="true"
      >
        {compact ? (
          <ProductGlyph component="span" />
        ) : (
          <PanelLeft size={18} strokeWidth={1.8} aria-hidden="true" />
        )}
      </span>
      <span
        className="DwpDesktopNavigationToggle-visual DwpDesktopNavigationToggle-active"
        data-navigation-toggle-visual="active"
        data-navigation-toggle-visual-kind={activeKind}
        aria-hidden="true"
      >
        {compact ? (
          <PanelLeftOpen size={18} strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={18} strokeWidth={1.8} aria-hidden="true" />
        )}
      </span>
    </ActionIconButton>
  );
}
