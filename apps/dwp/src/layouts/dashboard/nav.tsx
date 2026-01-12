import type { Theme, SxProps, Breakpoint } from '@mui/material/styles';

import { useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import ListItem from '@mui/material/ListItem';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemButton from '@mui/material/ListItemButton';
import Drawer, { drawerClasses } from '@mui/material/Drawer';

import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { Logo } from 'src/components/logo';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import type { NavItem } from '../nav-config-dashboard';

// ----------------------------------------------------------------------

export type NavContentProps = {
  data: NavItem[];
  slots?: {
    topArea?: React.ReactNode;
    bottomArea?: React.ReactNode;
  };
  workspaces: any; // Type remains as 'any' for now to avoid refactoring NavContentProps everywhere, but better would be to remove it if unused
  sx?: SxProps<Theme>;
  collapsed?: boolean;
};

export function NavDesktop({
  sx,
  data,
  slots,
  workspaces,
  layoutQuery,
  collapsed,
  onToggleCollapse,
}: NavContentProps & { layoutQuery: Breakpoint; onToggleCollapse: () => void }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        pt: 2.5,
        px: collapsed ? 1.5 : 2.5,
        top: 0,
        left: 0,
        height: 1,
        display: 'none',
        position: 'fixed',
        flexDirection: 'column',
        zIndex: 'var(--layout-nav-zIndex)',
        width: 'var(--layout-nav-current-width)',
        borderRight: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)}`,
        transition: theme.transitions.create(['width', 'padding'], {
          easing: 'var(--layout-transition-easing)',
          duration: 'var(--layout-transition-duration)',
        }),
        [theme.breakpoints.up(layoutQuery)]: {
          display: 'flex',
        },
        ...sx,
      }}
    >
      <NavContent data={data} slots={slots} workspaces={workspaces} collapsed={collapsed} />

      <IconButton
        onClick={onToggleCollapse}
        sx={{
          p: 0.5,
          top: 32,
          right: -12,
          zIndex: 1,
          position: 'absolute',
          border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)}`,
          bgcolor: 'background.paper',
          '&:hover': { bgcolor: 'background.neutral' },
          [theme.breakpoints.down(layoutQuery)]: { display: 'none' },
        }}
      >
        <Iconify
          width={16}
          icon={collapsed ? 'solar:alt-arrow-right-bold' : 'solar:alt-arrow-left-bold'}
        />
      </IconButton>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function NavMobile({
  sx,
  data,
  open,
  slots,
  onClose,
  workspaces,
}: NavContentProps & { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      sx={{
        [`& .${drawerClasses.paper}`]: {
          pt: 2.5,
          px: 2.5,
          overflow: 'unset',
          width: 'var(--layout-nav-mobile-width)',
          ...sx,
        },
      }}
    >
      <NavContent data={data} slots={slots} workspaces={workspaces} />
    </Drawer>
  );
}

// ----------------------------------------------------------------------

export function NavContent({ data, slots, workspaces, sx, collapsed }: NavContentProps) {
  const pathname = usePathname();

  return (
    <>
      <Logo sx={{ mb: 1, ml: collapsed ? 0.5 : 0 }} />

      {slots?.topArea}

      <Scrollbar fillContent>
        <Box
          component="nav"
          sx={[
            {
              display: 'flex',
              flex: '1 1 auto',
              flexDirection: 'column',
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        >
          <Box
            component="ul"
            sx={{
              gap: 0.5,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {data.reduce((acc: React.ReactNode[], item, index) => {
              const isActived = item.path === pathname;
              const prevItem = data[index - 1];
              const showGroup = item.group && (!prevItem || prevItem.group !== item.group);

              if (showGroup && !collapsed) {
                acc.push(
                  <ListSubheader
                    key={`group-${item.group}`}
                    sx={{
                      px: 2,
                      py: 1.5,
                      lineHeight: 1,
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'text.disabled',
                      bgcolor: 'transparent',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.group}
                  </ListSubheader>
                );
              }

              acc.push(
                <ListItem disableGutters disablePadding key={item.title}>
                  <ListItemButton
                    disableGutters
                    component={RouterLink}
                    href={item.path}
                    sx={[
                      (theme) => ({
                        pl: collapsed ? 1.5 : 2,
                        py: 1,
                        gap: collapsed ? 0 : 2,
                        pr: collapsed ? 1.5 : 1.5,
                        borderRadius: 0.75,
                        typography: 'body2',
                        fontWeight: 'fontWeightMedium',
                        color: theme.vars.palette.text.secondary,
                        minHeight: 44,
                        ...(isActived && {
                          fontWeight: 'fontWeightSemiBold',
                          color: theme.vars.palette.primary.main,
                          bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                          '&:hover': {
                            bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.16),
                          },
                        }),
                        ...(collapsed && {
                          justifyContent: 'center',
                        }),
                      }),
                    ]}
                  >
                    <Box component="span" sx={{ width: 24, height: 24, flexShrink: 0 }}>
                      {item.icon}
                    </Box>

                    {!collapsed && (
                      <Box component="span" sx={{ flexGrow: 1, whiteSpace: 'nowrap' }}>
                        {item.title}
                      </Box>
                    )}

                    {!collapsed && item.info && item.info}
                  </ListItemButton>
                </ListItem>
              );

              return acc;
            }, [])}
          </Box>
        </Box>
      </Scrollbar>

      {slots?.bottomArea}
    </>
  );
}
