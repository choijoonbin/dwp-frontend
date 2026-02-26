import type { Breakpoint } from '@mui/material/styles';

import { merge } from 'es-toolkit';

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

import { usePathname } from 'src/routes/hooks';

import { _langs } from 'src/_mock';
import { isFixedLayoutPath } from 'src/config/layout-mode';
import { useLayoutStore, useLayoutActions } from 'src/store/use-layout-store';

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
import { useDashboardNotificationSync } from './use-dashboard-notification-sync';

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

  const pathname = usePathname();
  const sidebarOpen = useLayoutStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useLayoutStore((state) => state.sidebarCollapsed);
  const { setSidebarOpen, toggleCollapse } = useLayoutActions();
  const navData = useNavData(); // 권한 기반 필터링된 메뉴 데이터

  // 로컬·프로덕션 모두 기본 활성화. 비활성화 시에만 VITE_NOTIFICATION_WS_ENABLED=false
  const notificationWsEnabled =
    (import.meta.env as { VITE_NOTIFICATION_WS_ENABLED?: string }).VITE_NOTIFICATION_WS_ENABLED !== 'false';

  useDashboardNotificationSync(notificationWsEnabled);

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
              width: 230,
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

          {/** @slot Notifications popover — 실시간 알림만 표시, 없으면 빈 상태 */}
          <NotificationsPopover />

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
