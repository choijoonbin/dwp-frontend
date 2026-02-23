import type { Breakpoint } from '@mui/material/styles';

import { useCallback, useEffect } from 'react';
import { merge } from 'es-toolkit';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useAuraStore } from '@dwp-frontend/shared-utils/aura/use-aura-store';
import { useNotificationWebSocket, useWorkbenchReactiveStore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';

import { usePathname } from 'src/routes/hooks';

import { _langs, _notifications } from 'src/_mock';
import { useThemeMode } from 'src/theme/theme-mode';
import { isFixedLayoutPath } from 'src/config/layout-mode';
import { useLayoutStore, useLayoutActions } from 'src/store/use-layout-store';

import { Iconify } from 'src/components/iconify';

import { NavMobile, NavDesktop } from './nav';
import { layoutClasses } from '../core/classes';
import { _account } from '../nav-config-account';
import { dashboardLayoutVars } from './css-vars';
import { MainSection } from '../core/main-section';
import { Searchbar } from '../components/searchbar';
import { useNavData } from '../nav-config-dashboard';
import { _workspaces } from '../nav-config-workspace';
import { MenuButton } from '../components/menu-button';
import { HeaderSection } from '../core/header-section';
import { LayoutSection } from '../core/layout-section';
import { AccountPopover } from '../components/account-popover';
import { LanguagePopover } from '../components/language-popover';
import { WorkspacesPopover } from '../components/workspaces-popover';
import { AuraMiniOverlay } from '../../components/aura/aura-mini-overlay';
import { NotificationsPopover } from '../components/notifications-popover';
import { AuraFloatingButton } from '../../components/aura/aura-floating-button';

import type { MainSectionProps } from '../core/main-section';
import type { HeaderSectionProps } from '../core/header-section';
import type { LayoutSectionProps } from '../core/layout-section';

// ----------------------------------------------------------------------

type LayoutBaseProps = Pick<LayoutSectionProps, 'sx' | 'children' | 'cssVars'>;

export type DashboardLayoutProps = LayoutBaseProps & {
  layoutQuery?: Breakpoint;
  slotProps?: {
    header?: HeaderSectionProps;
    main?: MainSectionProps;
  };
};

export function DashboardLayout({
  sx,
  cssVars,
  children,
  slotProps,
  layoutQuery = 'lg',
}: DashboardLayoutProps) {
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();

  const pathname = usePathname();
  const { t } = useTranslation('common');
  const sidebarOpen = useLayoutStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useLayoutStore((state) => state.sidebarCollapsed);
  const { setSidebarOpen, toggleCollapse } = useLayoutActions();
  const navData = useNavData(); // 권한 기반 필터링된 메뉴 데이터
  const queryClient = useQueryClient();

  // 로컬·프로덕션 모두 기본 활성화. 비활성화 시에만 VITE_NOTIFICATION_WS_ENABLED=false
  const notificationWsEnabled =
    (import.meta.env as { VITE_NOTIFICATION_WS_ENABLED?: string }).VITE_NOTIFICATION_WS_ENABLED !== 'false';

  useEffect(() => {
    console.log('[Workbench SSE] WebSocket 알림 연결 여부', {
      enabled: notificationWsEnabled,
      isProd: !!import.meta.env.PROD,
      hint: !notificationWsEnabled
        ? '비활성화됨. 활성화하려면 VITE_NOTIFICATION_WS_ENABLED를 제거하거나 true로 설정하세요.'
        : undefined,
    });
  }, [notificationWsEnabled]);

  const onNotificationReceive = useCallback(
    (payload: Parameters<NonNullable<NonNullable<Parameters<typeof useNotificationWebSocket>[0]>['onReceive']>>[0]) => {
      const cat = (payload.category ?? '').toString().toUpperCase();
      const typ = (payload.type ?? '').toString().toUpperCase();
      const pl = payload.payload as {
        case_id?: string | number;
        caseId?: string | number;
        run_id?: string;
        runId?: string;
        stream_url?: string;
        streamUrl?: string;
        content?: string;
        delta?: string;
        event?: string;
      } | undefined;
      const raw = payload as unknown as { case_id?: string | number; caseId?: string | number };
      const caseId =
        (pl?.case_id != null ? String(pl.case_id) : null) ??
        (pl?.caseId != null ? String(pl.caseId) : null) ??
        (raw?.case_id != null ? String(raw.case_id) : null) ??
        (raw?.caseId != null ? String(raw.caseId) : null) ??
        undefined;
      const runId =
        pl?.run_id != null ? String(pl.run_id) : pl?.runId != null ? String(pl.runId) : undefined;

      if (import.meta.env?.DEV) {
        console.log('[Workbench onReceive]', { category: cat, type: typ, caseId, runId, hasPayload: !!pl });
      }

      if (cat === 'THOUGHT_STREAM' || typ === 'THOUGHT_STREAM') {
        const wb = useWorkbenchReactiveStore.getState();
        if (import.meta.env?.DEV) {
          console.log('[Workbench onReceive] THOUGHT_STREAM', {
            caseId,
            currentThoughtStreamCaseId: wb.currentThoughtStreamCaseId,
            match: caseId != null && wb.currentThoughtStreamCaseId === caseId,
          });
        }
        if (caseId && wb.currentThoughtStreamCaseId === caseId) {
          const delta = (pl?.content ?? pl?.delta ?? '').toString();
          if (!delta) return;
          const aura = useAuraStore.getState();
          const { addThoughtChain, updateThoughtChain } = aura.actions;
          const existingId = runId ? wb.getStreamingThoughtId(runId) : undefined;
          if (existingId) {
            const current = aura.thoughtChains.find((chain) => chain.id === existingId);
            if (current) {
              updateThoughtChain(existingId, { content: current.content + delta });
            } else {
              const id = addThoughtChain({ type: 'analysis', content: delta });
              if (runId) wb.setStreamingThoughtId(runId, id);
            }
          } else {
            const id = addThoughtChain({ type: 'analysis', content: delta });
            if (runId) wb.setStreamingThoughtId(runId, id);
          }
        }
        return;
      }

      if (cat === 'CASE_ACTION' || typ === 'CASE_ACTION' || pl?.event === 'case_created') {
        queryClient.invalidateQueries({ queryKey: ['synapse', 'dashboard', 'agent-stream'] });
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
        if (caseId) {
          useWorkbenchReactiveStore.getState().setSuggestedSelectCaseId(caseId);
          if (import.meta.env?.DEV) console.log('[Workbench onReceive] CASE_ACTION/case_created → setSuggestedSelectCaseId', caseId);
        } else if (import.meta.env?.DEV) {
          console.log('[Workbench onReceive] CASE_ACTION/case_created but no caseId in payload', { pl, raw: !!raw });
        }
      }
      if (typ === 'ANALYSIS_STARTED' || cat === 'ANALYSIS_STARTED') {
        console.log('[Workbench SSE] ANALYSIS_STARTED 수신', {
          caseId,
          runId,
          payloadKeys: pl ? Object.keys(pl) : [],
          hasStreamUrl: !!(pl?.stream_url ?? pl?.streamUrl),
        });
        if (caseId) {
          useWorkbenchReactiveStore.getState().addAnalyzing(caseId);
          useWorkbenchReactiveStore.getState().setSuggestedSelectCaseId(caseId);
          const streamUrlFromPayload =
            (pl?.stream_url != null && String(pl.stream_url).trim() !== ''
              ? String(pl.stream_url)
              : (pl?.streamUrl != null && String(pl.streamUrl).trim() !== '' ? String(pl.streamUrl) : undefined)) as
            | string
            | undefined;
          const streamUrl =
            streamUrlFromPayload ??
            (runId ? `/api/synapse/analysis-runs/${runId}/stream` : undefined);
          if (streamUrl) {
            useWorkbenchReactiveStore.getState().setPendingAutoStream({
              caseId,
              streamUrl,
              runId,
            });
            console.log('[Workbench SSE] pendingAutoStream 설정됨', {
              caseId,
              runId,
              fromPayload: Boolean(streamUrlFromPayload),
              streamUrl: streamUrl.slice(0, 80),
            });
          } else {
            console.log('[Workbench SSE] ANALYSIS_STARTED: stream_url·run_id 없음 → 자동 구독 불가', { pl });
          }
        } else {
          console.log('[Workbench SSE] ANALYSIS_STARTED: case_id 없음', { pl });
        }
        queryClient.invalidateQueries({ queryKey: ['synapse', 'dashboard', 'agent-stream'] });
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      }
    },
    [queryClient],
  );

  useNotificationWebSocket({
    enabled: notificationWsEnabled,
    showToastOnReceive: true,
    onReceive: onNotificationReceive,
  });

  const renderHeader = () => {
    const headerSlotProps: HeaderSectionProps['slotProps'] = {
      container: {
        maxWidth: false,
      },
    };

    const headerSlots: HeaderSectionProps['slots'] = {
      leftArea: (
        <>
          {/** @slot Nav mobile */}
          <MenuButton
            onClick={() => setSidebarOpen(true)}
            sx={{ mr: 1, ml: -1, [theme.breakpoints.up(layoutQuery)]: { display: 'none' } }}
          />
          <NavMobile
            data={navData}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            workspaces={_workspaces}
          />

          {/** @slot Workspaces popover */}
          <WorkspacesPopover
            data={_workspaces}
            sx={{
              width: 200,
              transition: theme.transitions.create(['margin-left', 'width']),
            }}
          />
        </>
      ),
      rightArea: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.75 } }}>
          {/** @slot Searchbar */}
          <Searchbar />

          {/** @slot Language popover */}
          <LanguagePopover data={_langs} />

          {/** @slot Notifications popover */}
          <NotificationsPopover data={_notifications} />

          <Tooltip
            title={`${t('theme.currentMode', { mode: t(mode === 'light' ? 'theme.lightMode' : 'theme.darkMode') })} · ${t('theme.switchTo', { mode: t(mode === 'light' ? 'theme.darkMode' : 'theme.lightMode') })}`}
          >
            <IconButton color="inherit" onClick={toggleMode}>
              <Iconify
                width={22}
                icon={mode === 'light' ? 'solar:eye-closed-bold' : 'solar:eye-bold'}
              />
            </IconButton>
          </Tooltip>

          {/** @slot Account drawer */}
          <AccountPopover data={_account} />
        </Box>
      ),
    };

    return (
      <HeaderSection
        disableElevation
        layoutQuery={layoutQuery}
        {...slotProps?.header}
        slots={{ ...headerSlots, ...slotProps?.header?.slots }}
        slotProps={merge(headerSlotProps, slotProps?.header?.slotProps ?? {})}
        sx={slotProps?.header?.sx}
      />
    );
  };

  const renderFooter = () => null;

  const renderMain = (layoutMode: 'fixed' | 'scrollable') => (
    <MainSection layoutMode={layoutMode} {...slotProps?.main}>
      {children}
    </MainSection>
  );

  // 레이아웃 모드: FIXED_LAYOUT_PATHS에 등록된 경로만 fixed, 나머지는 scrollable
  // @see src/config/layout-mode.ts
  const layoutMode = isFixedLayoutPath(pathname) ? 'fixed' : 'scrollable';

  return (
    <LayoutSection
      /** **************************************
       * @Header
       *************************************** */
      headerSection={renderHeader()}
      /** **************************************
       * @Sidebar
       *************************************** */
      sidebarSection={
        <NavDesktop
          data={navData}
          layoutQuery={layoutQuery}
          workspaces={_workspaces}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      }
      /** **************************************
       * @Footer
       *************************************** */
      footerSection={renderFooter()}
      /** **************************************
       * @Styles
       *************************************** */
      layoutMode={layoutMode}
      cssVars={{
        ...dashboardLayoutVars(theme, layoutMode),
        '--layout-nav-current-width': sidebarCollapsed
          ? 'var(--layout-nav-vertical-collapsed-width)'
          : 'var(--layout-nav-vertical-width)',
        ...cssVars,
      }}
      sx={[
        {
          [`& .${layoutClasses.sidebarContainer}`]: {
            [theme.breakpoints.up(layoutQuery)]: {
              pl: 'var(--layout-nav-current-width)',
              transition: theme.transitions.create(['padding-left'], {
                easing: 'var(--layout-transition-easing)',
                duration: 'var(--layout-transition-duration)',
              }),
            },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {renderMain(layoutMode)}
      <AuraFloatingButton />
      <AuraMiniOverlay />
    </LayoutSection>
  );
}
