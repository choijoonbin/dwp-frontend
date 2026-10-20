import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';

import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { normalizeProductPath } from '../components/product-manifest';
import { shellHeaderHeight } from '../features/shell/shell-registry';
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
  controlsId,
  label,
  onBack,
  onDismiss,
}: Readonly<{
  areaKey: string;
  children: ReactNode;
  controlsId: string;
  label: string;
  onBack: () => void;
  onDismiss: () => void;
}>) {
  const { t } = useTranslation('common');
  return (
    <Box
      data-testid={`${areaKey}-mobile-task-navigator`}
      sx={{ height: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Box
        component="header"
        data-testid={`${areaKey}-mobile-task-navigator-header`}
        sx={{
          minHeight: 56,
          px: 1,
          display: 'grid',
          gridTemplateColumns: '44px minmax(0, 1fr) 44px',
          alignItems: 'center',
          gap: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'var(--dwp-product-sidebar, var(--mui-palette-background-paper))',
          boxShadow: (theme) => theme.shadows[2],
          zIndex: 2,
        }}
      >
        <ActionIconButton
          label={t('actions.back')}
          tooltipPlacement="bottom"
          onClick={onBack}
          sx={{ width: 44, height: 44, color: 'text.secondary' }}
        >
          <ArrowLeft size={19} strokeWidth={1.9} aria-hidden="true" />
        </ActionIconButton>
        <Typography
          component="h2"
          variant="subtitle2"
          title={label}
          noWrap
          sx={{ minWidth: 0, px: 0.5, textAlign: 'center', fontWeight: 700 }}
        >
          {label}
        </Typography>
        <ActionIconButton
          label={t('actions.close')}
          tooltipPlacement="bottom"
          onClick={onDismiss}
          sx={{ width: 44, height: 44, color: 'text.secondary' }}
        >
          <X size={19} strokeWidth={1.9} aria-hidden="true" />
        </ActionIconButton>
      </Box>
      <Box
        id={controlsId}
        role="region"
        aria-label={label}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          scrollbarGutter: 'stable',
        }}
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
        elevation={0}
        sx={{
          position: 'fixed',
          top: shellHeaderHeight + 10,
          left,
          zIndex: (theme) => theme.zIndex.drawer + 2,
          width: 'clamp(420px, 32vw, 480px)',
          maxWidth: `calc(100vw - ${left}px - 16px)`,
          maxHeight: `calc(100dvh - ${shellHeaderHeight + 22}px)`,
          minWidth: 0,
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          bgcolor: 'background.paper',
          border: 1,
          borderLeft: 0,
          borderColor: 'divider',
          borderRadius: (theme) =>
            `0 ${Number(theme.shape.borderRadius) * 2.5}px ${Number(theme.shape.borderRadius) * 2.5}px 0`,
          boxShadow: (theme) => theme.shadows[12],
          overflow: 'hidden',
          transformOrigin: 'top left',
          animation: 'dwp-task-navigator-enter 180ms cubic-bezier(0.2, 0, 0, 1)',
          '&:has([data-navigation-density="dense"])': {
            width: 'clamp(500px, 38vw, 560px)',
          },
          '@keyframes dwp-task-navigator-enter': {
            from: { opacity: 0, transform: 'translateX(-8px) scale(0.992)' },
            to: { opacity: 1, transform: 'translateX(0) scale(1)' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
          },
          '@media (forced-colors: active)': {
            border: '1px solid CanvasText',
            borderLeft: 0,
            boxShadow: 'none',
          },
        }}
      >
        <Box
          data-testid={`${areaKey}-desktop-task-navigator-toolbar`}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pointerEvents: 'none',
          }}
        >
          <ActionIconButton
            label={t('actions.close')}
            size="small"
            onClick={() => onDismiss(true)}
            sx={{
              width: 36,
              height: 36,
              pointerEvents: 'auto',
              color: 'text.secondary',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              boxShadow: (theme) => theme.shadows[3],
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              '@media (forced-colors: active)': { border: '1px solid ButtonText' },
            }}
          >
            <X size={18} aria-hidden="true" />
          </ActionIconButton>
        </Box>
        <Box
          data-testid={`${areaKey}-desktop-task-navigator-scroll`}
          sx={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
          }}
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
