import type { Breakpoint } from '@mui/material/styles';

import { merge } from 'es-toolkit';
import { useTranslation } from '@dwp-frontend/shared-i18n';

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

          <Tooltip title={mode === 'light' ? t('theme.darkMode') : t('theme.lightMode')}>
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
