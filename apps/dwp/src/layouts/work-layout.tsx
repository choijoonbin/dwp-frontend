import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CircleAlert, Home, Inbox, Menu, Plus } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { useAppearance } from '@dwp-frontend/design-system/appearance';
import { resolveProductExperienceTones } from '@dwp-frontend/design-system/foundation/product-experience-tokens';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { isAppPermissionEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DesktopNavigationHeader } from '../components/desktop-navigation-header';
import { ShellHeader } from '../components/shell-header';
import { useDesktopNavigation } from '../features/shell/desktop-navigation';
import { getProductExperienceProfile } from '../features/shell/product-experience-registry';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';
import {
  ShellMobileNavigationDrawer,
  useShellMobileNavigation,
} from '../features/shell/shell-mobile-navigation';
import { WORK_NAVIGATION } from '../features/work/work-navigation';
import { WorkMobileNavigation } from './work-mobile-navigation';
import { shouldScheduleWorkMobileFocusScroll } from './work-mobile-focus-scroll';
import { useOwnerScopedState } from './use-owner-scoped-state';
import {
  workHubViewFromPath,
  workHubViewLocation,
  type WorkHubView,
} from '../features/work-hub/work-hub-view-navigation';
import { useWorkHubOperationOwner } from '../features/work-hub/use-work-hub-operation-owner';
import { canUpdatePersonalWork } from '../features/work-hub/work-hub-command-authority';
import {
  createWorkScheduleCoordinator,
  type WorkScheduleCoordinator,
} from '../features/work-hub/work-hub-schedule-coordinator';
import {
  createWorkTaskSaveCoordinator,
  type WorkTaskSaveCoordinator,
} from '../features/work-hub/work-hub-task-save-coordinator';

export type WorkNavigationState = {
  counts: Partial<Record<WorkHubView, number>>;
  incomplete: boolean;
  readySources: number;
  requestedSources: number;
};
export type WorkLayoutContext = {
  setWorkNavigationState: Dispatch<SetStateAction<WorkNavigationState | null>>;
  /** CSS layout width, including page zoom that does not change media queries. */
  availableWidth: number;
  scheduleCoordinator: WorkScheduleCoordinator;
  taskSaveCoordinator: WorkTaskSaveCoordinator;
};

/** Six execution views share source receipts and the established DWP session controls. */
export function WorkLayout() {
  const { t } = useTranslation(['work', 'shell']);
  const { preference } = useAppearance();
  const { permissions } = usePermissions();
  const operationOwner = useWorkHubOperationOwner();
  const location = useLocation();
  const navigate = useNavigate();
  const [navigationState, setWorkNavigationState] = useOwnerScopedState<WorkNavigationState | null>(
    operationOwner,
    null
  );
  const shellElement = useRef<HTMLDivElement>(null);
  const focusFrame = useRef<number | null>(null);
  const pointerActive = useRef(false);
  const [availableWidth, setAvailableWidth] = useState(() => window.innerWidth);
  useLayoutEffect(() => {
    const element = shellElement.current;
    if (!element) return;
    setAvailableWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const endPointerActivation = () => {
      pointerActive.current = false;
    };
    window.addEventListener('pointerup', endPointerActivation, true);
    window.addEventListener('pointercancel', endPointerActivation, true);
    return () => {
      window.removeEventListener('pointerup', endPointerActivation, true);
      window.removeEventListener('pointercancel', endPointerActivation, true);
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, []);
  const taskSaveAllowed = canUpdatePersonalWork(permissions);
  const scheduleAllowed =
    taskSaveAllowed && isAppPermissionEntitled('APP.CALENDAR', 'CREATE', permissions);
  const scheduleCoordinator = useMemo(
    () => createWorkScheduleCoordinator(scheduleAllowed ? operationOwner : null),
    [operationOwner, scheduleAllowed]
  );
  const taskSaveCoordinator = useMemo(
    () => createWorkTaskSaveCoordinator(taskSaveAllowed ? operationOwner : null),
    [operationOwner, taskSaveAllowed]
  );
  const mountedCoordinators = useRef<{
    schedule: WorkScheduleCoordinator;
    taskSave: WorkTaskSaveCoordinator;
  } | null>(null);
  useLayoutEffect(() => {
    const mounted = { schedule: scheduleCoordinator, taskSave: taskSaveCoordinator };
    mountedCoordinators.current = mounted;
    return () => {
      if (mountedCoordinators.current === mounted) mountedCoordinators.current = null;
      globalThis.queueMicrotask(() => {
        const replacement = mountedCoordinators.current;
        if (replacement?.schedule !== scheduleCoordinator) scheduleCoordinator.dispose();
        if (replacement?.taskSave !== taskSaveCoordinator) taskSaveCoordinator.dispose();
      });
    };
  }, [scheduleCoordinator, taskSaveCoordinator]);
  const context = useMemo(
    () => ({ setWorkNavigationState, availableWidth, scheduleCoordinator, taskSaveCoordinator }),
    [availableWidth, scheduleCoordinator, setWorkNavigationState, taskSaveCoordinator]
  );
  const desktop = availableWidth >= 1200;
  const profile = getProductExperienceProfile('work');
  const navigation = useDesktopNavigation({ ...shellRegistry.work, desktopNavigationWidth: 240 });
  const mobile = useShellMobileNavigation({ headerTestId: 'work-header' });
  const activeView = workHubViewFromPath(location.pathname);
  const sourceNeedsAttention = Boolean(
    navigationState && navigationState.readySources < navigationState.requestedSources
  );
  const openPanel = (key: 'compose' | 'panel', value: string, onNavigate?: () => void) => {
    const params = new URLSearchParams(location.search);
    params.set(key, value);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` });
    onNavigate?.();
  };
  const sidebar = (compact: boolean, onDismiss?: () => void) => (
    <Stack sx={{ height: 1, minHeight: 0 }}>
      <DesktopNavigationHeader
        compact={compact}
        collapsible={navigation.collapsible}
        controlsId="work-desktop-navigation"
        onDismiss={onDismiss}
        onToggle={navigation.toggle}
      />
      <Divider />
      <Box sx={{ p: compact ? 1 : 1.5 }}>
        {taskSaveAllowed && (
          <Tooltip title={compact ? t('work:workHub.navigation.createTask') : ''} placement="right">
            <ActionButton
              intent="primary"
              fullWidth
              aria-label={t('work:workHub.navigation.createTask')}
              startIcon={compact ? undefined : <Plus size={17} aria-hidden="true" />}
              onClick={() => openPanel('compose', 'task', onDismiss)}
              sx={{ minWidth: 0, minHeight: onDismiss ? 44 : 40, px: compact ? 0 : 1 }}
            >
              {compact ? (
                <Plus size={18} aria-hidden="true" />
              ) : (
                t('work:workHub.navigation.createTask')
              )}
            </ActionButton>
          </Tooltip>
        )}
      </Box>
      <Box
        component="nav"
        aria-label={t('work:shell.work.navigationLabel')}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: compact ? 1 : 1.5 }}
      >
        <Stack component="ul" gap={0.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {WORK_NAVIGATION[0].items.map(({ view, icon: Icon }) => {
            const selected = activeView === view;
            const label = t(`work:navigation.items.work.${view}.label`);
            const count = navigationState?.counts[view];
            const destination = workHubViewLocation(view, new URLSearchParams(location.search));
            return (
              <Box component="li" key={view}>
                <Tooltip title={compact ? label : ''} placement="right">
                  <ActionButton
                    intent="quiet"
                    component={NavLink}
                    to={`${destination.pathname}${destination.search}`}
                    fullWidth
                    data-testid={`work-navigation-item-${view}`}
                    aria-label={compact ? label : undefined}
                    aria-current={selected ? 'page' : undefined}
                    onClick={onDismiss}
                    sx={{
                      minWidth: 0,
                      minHeight: 44,
                      gap: 1.25,
                      px: compact ? 0 : 1.25,
                      justifyContent: compact ? 'center' : 'flex-start',
                      color: selected ? 'var(--dwp-product-accent)' : 'text.secondary',
                      bgcolor: selected ? 'var(--dwp-product-selection)' : 'transparent',
                      '&:hover': { bgcolor: 'var(--dwp-product-selection)' },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                      },
                      '@media (forced-colors: active)': {
                        '&[aria-current="page"]': {
                          outline: '2px solid Highlight',
                          outlineOffset: -2,
                        },
                      },
                    }}
                  >
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    {!compact && (
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{ flex: 1, textAlign: 'start' }}
                        >
                          {label}
                        </Typography>
                        {count !== undefined && count > 0 && (
                          <Chip
                            size="small"
                            color={selected ? 'primary' : 'default'}
                            label={
                              navigationState?.incomplete && view !== 'day-plan'
                                ? t('work:workHub.navigation.partialCount', { count })
                                : count
                            }
                            sx={{ height: 22, pointerEvents: 'none' }}
                          />
                        )}
                      </>
                    )}
                  </ActionButton>
                </Tooltip>
              </Box>
            );
          })}
        </Stack>
      </Box>
      <Stack gap={1} sx={{ p: compact ? 1 : 1.5 }}>
        <Tooltip title={compact ? t('work:workHub.navigation.sourceStatus') : ''} placement="right">
          <ActionButton
            intent="quiet"
            onClick={() => openPanel('panel', 'sources', onDismiss)}
            aria-label={t('work:workHub.navigation.sourceStatus')}
            sx={{
              minWidth: 0,
              p: compact ? 1 : 1.25,
              bgcolor: 'var(--dwp-product-soft)',
              justifyContent: 'flex-start',
            }}
          >
            {compact ? (
              sourceNeedsAttention ? (
                <CircleAlert size={19} aria-hidden="true" />
              ) : (
                <Activity size={19} aria-hidden="true" />
              )
            ) : (
              <Stack gap={0.5} sx={{ textAlign: 'start', width: 1 }}>
                <Typography component="span" variant="caption" color="text.secondary">
                  {t('work:workHub.navigation.sourceStatus')}
                </Typography>
                <Typography component="span" variant="body2">
                  {navigationState
                    ? t('work:workHub.navigation.sourcesReady', {
                        count: navigationState.readySources,
                      })
                    : t('work:workHub.navigation.sourcesLoading')}
                </Typography>
                {sourceNeedsAttention && (
                  <Typography component="span" variant="caption" color="warning.main">
                    {t('work:workHub.navigation.sourcesAttention', {
                      count: navigationState!.requestedSources - navigationState!.readySources,
                    })}
                  </Typography>
                )}
              </Stack>
            )}
          </ActionButton>
        </Tooltip>
        <ActionButton
          intent="quiet"
          component={NavLink}
          to="/"
          data-testid="work-surface-return"
          aria-label={t('work:shell.backToHome')}
          onClick={onDismiss}
          startIcon={compact ? undefined : <Home size={16} aria-hidden="true" />}
          sx={{
            minWidth: 0,
            minHeight: onDismiss ? 44 : undefined,
            justifyContent: compact ? 'center' : 'flex-start',
          }}
        >
          {compact ? <Home size={18} aria-hidden="true" /> : t('work:shell.backToHome')}
        </ActionButton>
      </Stack>
    </Stack>
  );
  return (
    <Box
      ref={shellElement}
      data-testid="work-shell"
      data-dwp-navigation-state={navigation.compact ? 'compact' : 'expanded'}
      sx={(theme) => {
        const dark = theme.palette.mode === 'dark' || preference.highContrast;
        const canvas = dark ? theme.palette.background.default : profile.canvas;
        const sidebarColor = dark ? theme.palette.background.paper : profile.sidebar;
        const tones = resolveProductExperienceTones(profile, {
          mode: theme.palette.mode,
          highContrast: preference.highContrast,
          canvas,
          sidebar: sidebarColor,
        });
        return {
          minHeight: '100dvh',
          bgcolor: canvas,
          '--dwp-product-accent': tones.accent,
          '--dwp-product-canvas': canvas,
          '--dwp-product-sidebar': sidebarColor,
          '--dwp-product-selection': dark ? theme.palette.action.selected : profile.selection,
          '--dwp-product-soft': dark ? theme.palette.action.hover : profile.softSurface,
        };
      }}
    >
      <Box
        component="aside"
        id="work-desktop-navigation"
        data-testid="work-sidebar"
        sx={{
          position: 'fixed',
          inset: '0 auto 0 0',
          width: navigation.sidebarWidth,
          display: desktop ? 'block' : 'none',
          bgcolor: 'var(--dwp-product-sidebar)',
          borderRight: 1,
          borderColor: 'divider',
          zIndex: (theme) => theme.zIndex.drawer,
        }}
      >
        {sidebar(navigation.compact)}
      </Box>
      <ShellMobileNavigationDrawer
        controlsId="work-mobile-navigation"
        label={t('work:shell.work.navigationLabel')}
        onDismiss={mobile.dismiss}
        open={mobile.open}
        testId="work-mobile-sidebar"
        width={280}
      >
        <Box sx={{ height: 1, bgcolor: 'var(--dwp-product-sidebar)' }}>
          {sidebar(false, mobile.dismiss)}
        </Box>
      </ShellMobileNavigationDrawer>
      <ShellHeader
        shellKey="work"
        scope="tenant"
        testId="work-header"
        context={{ icon: Inbox, label: t('work:shell.work.name') }}
        desktopOffset={desktop ? navigation.desktopOffset : 0}
        leading={
          !desktop ? (
            <ActionIconButton
              data-testid="work-mobile-navigation-trigger"
              aria-controls="work-mobile-navigation"
              aria-expanded={mobile.open}
              label={t('shell:navigation.open')}
              onClick={(event) => mobile.openFrom(event.currentTarget)}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Menu size={21} aria-hidden="true" />
            </ActionIconButton>
          ) : undefined
        }
        showWorkspace
      />
      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        onPointerDownCapture={() => {
          pointerActive.current = true;
          if (focusFrame.current !== null) {
            cancelAnimationFrame(focusFrame.current);
            focusFrame.current = null;
          }
        }}
        onFocusCapture={(event) => {
          const target = event.target;
          if (
            !shouldScheduleWorkMobileFocusScroll({
              availableWidth,
              pointerActive: pointerActive.current,
              target,
              container: event.currentTarget,
            })
          )
            return;
          if (!(target instanceof HTMLElement)) return;
          if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
          // Browser focus scrolling does not account for the fixed mobile navigation.
          focusFrame.current = requestAnimationFrame(() => {
            focusFrame.current = null;
            if (pointerActive.current || document.activeElement !== target || !target.isConnected)
              return;
            const shell = shellElement.current;
            const header = shell?.querySelector('[data-testid="work-header"]');
            const nav = shell?.querySelector('[data-testid="work-mobile-bottom-navigation"]');
            const navigationBounds = nav?.getBoundingClientRect();
            const visibleBottom = navigationBounds?.height
              ? navigationBounds.top
              : (window.visualViewport?.height ?? window.innerHeight);
            const visibleTop = header?.getBoundingClientRect().bottom ?? 0;
            const bounds = target.getBoundingClientRect();
            if (bounds.top < visibleTop || bounds.bottom > visibleBottom) {
              target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
            }
          });
        }}
        sx={{
          pt: `${shellHeaderHeight}px`,
          pb: availableWidth < 900 ? 'calc(68px + env(safe-area-inset-bottom, 0px))' : 0,
          width: desktop ? `calc(100% - ${navigation.desktopOffset}px)` : 1,
          ml: desktop ? `${navigation.desktopOffset}px` : 0,
          minWidth: 0,
          minHeight: '100dvh',
          overflowX: 'clip',
          outline: 'none',
          bgcolor: 'var(--dwp-product-canvas)',
        }}
      >
        <Outlet context={context satisfies WorkLayoutContext} />
      </Box>
      <WorkMobileNavigation availableWidth={availableWidth} />
    </Box>
  );
}
