import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';

import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';

import { DesktopNavigationHeader } from '../components/desktop-navigation-header';
import { normalizeProductPath } from '../components/product-manifest';
import { resolveProductCompatibilityNavigationLocation } from '../features/shell/product-surface-compatibility-navigation';

import type {
  ProductAreaLayoutProps,
  ProductAreaNavigationLocation,
} from './product-area-layout-contract';

export function useProductAreaNavigationLocationResolver(
  surface: ProductAreaLayoutProps['surface']
) {
  return useCallback(
    (targetLocation: ProductAreaNavigationLocation) => {
      const target = surface?.compatibilityNavigationTargets?.get(
        normalizeProductPath(targetLocation.pathname)
      );
      return target
        ? resolveProductCompatibilityNavigationLocation(
            targetLocation.pathname,
            target,
            targetLocation
          )
        : targetLocation;
    },
    [surface?.compatibilityNavigationTargets]
  );
}

export function useProductAreaTaskNavigator() {
  const [path, setPath] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dismiss = useCallback((restoreFocus = true) => {
    setPath(null);
    if (restoreFocus) {
      const triggerTestId = triggerRef.current?.getAttribute('data-testid');
      const triggerControls = triggerRef.current?.getAttribute('aria-controls');
      window.requestAnimationFrame(() => {
        const referencedTrigger = triggerRef.current;
        const candidateTriggers = [
          ...document.querySelectorAll<HTMLButtonElement>('[data-navigation-panel-trigger]'),
        ].filter((candidate) => candidate.getAttribute('data-testid') === triggerTestId);
        const trigger = isVisibleNavigationTrigger(referencedTrigger)
          ? referencedTrigger
          : (candidateTriggers.find(
              (candidate) =>
                candidate.getAttribute('aria-controls') === triggerControls &&
                isVisibleNavigationTrigger(candidate)
            ) ?? candidateTriggers.find(isVisibleNavigationTrigger));
        trigger?.focus();
      });
    }
  }, []);
  const toggle = useCallback((nextPath: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setPath((current) => (current === nextPath ? null : nextPath));
  }, []);

  useEffect(() => {
    if (!path) return undefined;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismiss();
    };
    document.addEventListener('keydown', dismissOnEscape);
    return () => document.removeEventListener('keydown', dismissOnEscape);
  }, [dismiss, path]);

  return { path, dismiss, toggle } as const;
}

export function taskNavigatorContextKey(
  location: Readonly<{ pathname: string; search: string; hash: string }>,
  user?: Readonly<{
    identityPlane?: string | null;
    tenantId?: string | number | null;
    userId?: string | number | null;
  }> | null,
  supportSession?: Readonly<{ supportSessionId: string; tenantId: string }>,
  surface?: Readonly<{
    decision: Readonly<{
      context: Readonly<{ contextKey: string }>;
      scope: Readonly<{ key: string }>;
    }>;
  }>
) {
  return [
    location.pathname,
    location.search,
    location.hash,
    user?.identityPlane ?? 'anonymous',
    user?.tenantId ?? '',
    user?.userId ?? '',
    supportSession?.supportSessionId ?? '',
    supportSession?.tenantId ?? '',
    surface?.decision.context.contextKey ?? '',
    surface?.decision.scope.key ?? '',
  ].join('\u0000');
}

export function useProductAreaTaskNavigatorLifecycle({
  areaKey,
  compactShell,
  contextKey,
  dismiss,
  path,
}: Readonly<{
  areaKey: string;
  compactShell: boolean;
  contextKey: string;
  dismiss: (restoreFocus?: boolean) => void;
  path: string | null;
}>) {
  useEffect(() => dismiss(false), [contextKey, dismiss]);

  const previousCompactShellRef = useRef(compactShell);
  useLayoutEffect(() => {
    const enteredCompactShell = compactShell && !previousCompactShellRef.current;
    previousCompactShellRef.current = compactShell;
    if (!enteredCompactShell || !path) return;

    dismiss(false);
    const mobileTrigger = [
      ...document.querySelectorAll<HTMLButtonElement>(
        `[data-testid="${areaKey}-mobile-navigation-trigger"]`
      ),
    ].find(isVisibleNavigationTrigger);
    mobileTrigger?.focus({ preventScroll: true });
  }, [areaKey, compactShell, dismiss, path]);
}

export function isVisibleNavigationTrigger(
  trigger: HTMLButtonElement | null | undefined
): trigger is HTMLButtonElement {
  if (!trigger?.isConnected || trigger.hidden || trigger.closest('[hidden],[aria-hidden="true"]')) {
    return false;
  }
  for (let element: HTMLElement | null = trigger; element; element = element.parentElement) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

export function ProductAreaMobileTaskNavigator({
  areaKey,
  children,
  collapsible,
  controlsId,
  label,
  onBack,
  onDismiss,
  onToggle,
}: Readonly<{
  areaKey: string;
  children: ReactNode;
  collapsible: boolean;
  controlsId: string;
  label: string;
  onBack: () => void;
  onDismiss: () => void;
  onToggle: () => void;
}>) {
  const { t } = useTranslation('common');
  return (
    <Box
      data-testid={`${areaKey}-mobile-task-navigator`}
      sx={{ height: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <DesktopNavigationHeader
        compact={false}
        collapsible={collapsible}
        controlsId={controlsId}
        onDismiss={onDismiss}
        onToggle={onToggle}
      />
      <Divider />
      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<ArrowLeft size={17} aria-hidden="true" />}
          onClick={onBack}
          sx={{ minHeight: 44 }}
        >
          {t('actions.back')}
        </ActionButton>
      </Box>
      <Box
        id={controlsId}
        role="region"
        aria-label={label}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function ProductAreaDesktopTaskNavigator({
  areaKey,
  children,
  controlsId,
  label,
  left,
  onDismiss,
}: Readonly<{
  areaKey: string;
  children: ReactNode;
  controlsId: string;
  label: string;
  left: number;
  onDismiss: (restoreFocus?: boolean) => void;
}>) {
  const { t } = useTranslation('common');
  return (
    <ClickAwayListener
      mouseEvent="onMouseDown"
      onClickAway={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('[data-navigation-panel-trigger="true"]')) {
          return;
        }
        onDismiss(false);
      }}
    >
      <Paper
        id={controlsId}
        data-testid={`${areaKey}-desktop-task-navigator`}
        role="region"
        aria-label={label}
        elevation={10}
        square
        sx={{
          position: 'fixed',
          inset: `0 auto 0 ${left}px`,
          zIndex: (theme) => theme.zIndex.drawer + 2,
          width: 'clamp(380px, 34vw, 560px)',
          minWidth: 0,
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          overflow: 'hidden',
          '@media (forced-colors: active)': {
            border: '1px solid CanvasText',
            boxShadow: 'none',
          },
        }}
      >
        <Box
          data-testid={`${areaKey}-desktop-task-navigator-toolbar`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flex: '0 0 auto',
            minHeight: 52,
            px: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <ActionIconButton label={t('actions.close')} size="small" onClick={() => onDismiss(true)}>
            <X size={18} aria-hidden="true" />
          </ActionIconButton>
        </Box>
        <Box
          data-testid={`${areaKey}-desktop-task-navigator-scroll`}
          sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
        >
          {children}
        </Box>
      </Paper>
    </ClickAwayListener>
  );
}

export function ProductAreaNavigationReturnAction({
  compact,
  label,
  onActivate,
  startIcon,
  testId,
  to,
}: Readonly<{
  compact: boolean;
  label: string;
  onActivate: () => void;
  startIcon: ReactNode;
  testId: string;
  to: string;
}>) {
  return (
    <Box sx={{ p: compact ? 1 : 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Tooltip title={compact ? label : ''} placement="right">
        <ActionButton
          data-testid={testId}
          component={NavLink}
          to={to}
          fullWidth
          intent="quiet"
          aria-label={compact ? label : undefined}
          startIcon={startIcon}
          onClick={onActivate}
          sx={{
            justifyContent: compact ? 'center' : 'flex-start',
            minWidth: 0,
            px: compact ? 1 : undefined,
            '& .MuiButton-startIcon': { m: compact ? 0 : undefined },
          }}
        >
          {!compact && label}
        </ActionButton>
      </Tooltip>
    </Box>
  );
}
