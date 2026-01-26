import type { Theme, SxProps, Breakpoint } from '@mui/material/styles';

import { varAlpha } from '@dwp-frontend/design-system';
import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import MenuList from '@mui/material/MenuList';
import ListItem from '@mui/material/ListItem';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemButton from '@mui/material/ListItemButton';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import MenuItem, { menuItemClasses } from '@mui/material/MenuItem';

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
        top: 0,
        left: 0,
        height: 1,
        display: 'none',
        position: 'fixed',
        flexDirection: 'column',
        zIndex: 'var(--layout-nav-zIndex)',
        width: 'var(--layout-nav-current-width)',
        borderRight: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)}`,
        transition: theme.transitions.create(['width']),
        overflow: 'visible',
        ...(collapsed && {
          alignItems: 'center',
        }),
        [theme.breakpoints.up(layoutQuery)]: {
          display: 'flex',
        },
        ...sx,
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          width: 1,
          minWidth: 0,
        }}
      >
        <NavContent data={data} slots={slots} workspaces={workspaces} collapsed={collapsed} />
      </Box>

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

  const handleClose = (event: React.SyntheticEvent | {}, reason?: string) => {
    // Drawer가 닫히기 전에 포커스를 제거하여 접근성 경고 방지
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
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

/**
 * Check if pathname matches any child path
 */
const hasActiveChild = (item: NavItem, pathname: string): boolean => {
  if (item.path === pathname) {
    return true;
  }
  if (item.children) {
    return item.children.some((child) => hasActiveChild(child, pathname));
  }
  return false;
};

/**
 * Render a single nav item with children support
 */
const NavItemComponent = ({
  item,
  pathname,
  collapsed,
  openStates,
  onToggleOpen,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  openStates: Map<string, boolean>;
  onToggleOpen: (key: string) => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const popoverPaperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null); // Ref for collapsed button
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.path === pathname;
  const hasActive = hasActiveChild(item, pathname);
  const isOpen = openStates.get(item.title) ?? hasActive; // Auto-open if has active child
  const popoverOpen = Boolean(anchorEl);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (hasChildren) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Use buttonRef if collapsed, otherwise use event.currentTarget
      const target = collapsed && buttonRef.current ? buttonRef.current : event.currentTarget;
      setAnchorEl(target);
    }
  };

  const handlePopoverClose = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
      timeoutRef.current = null;
    }, 100);
  };

  const handlePopoverEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleClose = () => {
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl) {
      if (popoverPaperRef.current?.contains(activeEl)) {
        activeEl.blur();
      } else if (anchorEl?.contains(activeEl)) {
        activeEl.blur();
      }
    }
    setAnchorEl(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // If collapsed, show popover for items with children
  if (collapsed) {
    return (
      <>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            width: 79,
            mx: 'auto',
          }}
        >
          <ListItemButton
            disableGutters
            component={hasChildren ? 'div' : RouterLink}
            href={hasChildren ? undefined : item.path}
            onClick={hasChildren ? handlePopoverOpen : undefined}
            onMouseEnter={hasChildren ? handlePopoverOpen : undefined}
            onMouseLeave={hasChildren ? handlePopoverClose : undefined}
            sx={[
              (theme) => ({
                py: 0,
                px: 0,
                gap: 0.25,
                width: 79,
                height: 58,
                minHeight: 58,
                flexDirection: 'column',
                justifyContent: 'center',
                borderRadius: 0.75,
                typography: 'body2',
                fontWeight: 'fontWeightMedium',
                color: theme.vars.palette.text.secondary,
                ...(isActive && {
                  fontWeight: 'fontWeightSemiBold',
                  color: theme.vars.palette.primary.main,
                  bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                }),
              }),
            ]}
          >
            <Box component="span" sx={{ width: 24, height: 24, flexShrink: 0 }}>
              {item.icon}
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: 10,
                fontWeight: 'fontWeightSemiBold',
                lineHeight: '16px',
                textAlign: 'center',
                width: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.title}
            </Box>
          </ListItemButton>
        </Box>

        {hasChildren && (
          <Popover
            open={popoverOpen}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
              paper: {
                ref: popoverPaperRef,
                onMouseEnter: handlePopoverEnter,
                onMouseLeave: handlePopoverClose,
                sx: {
                  mt: 0.5,
                  ml: 1,
                  minWidth: 200,
                  boxShadow: (theme) => theme.shadows[8],
                  pointerEvents: 'auto',
                },
              },
            }}
            sx={{
              pointerEvents: 'none',
            }}
            hideBackdrop
            disableScrollLock
            disableAutoFocus
            disableEnforceFocus
            disableRestoreFocus
          >
            <MenuList
              disablePadding
              sx={{
                p: 0.5,
                gap: 0.5,
                display: 'flex',
                flexDirection: 'column',
                [`& .${menuItemClasses.root}`]: {
                  px: 1.5,
                  py: 1,
                  gap: 1.5,
                  borderRadius: 0.75,
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                  [`&.${menuItemClasses.selected}`]: {
                    color: 'text.primary',
                    bgcolor: 'action.selected',
                    fontWeight: 'fontWeightSemiBold',
                  },
                },
              }}
            >
              {item.children!.map((child) => {
                const childIsActive = child.path === pathname;
                return (
                  <MenuItem
                    key={child.title}
                    component={RouterLink}
                    href={child.path}
                    selected={childIsActive}
                    onClick={handlePopoverClose}
                  >
                    {child.icon && (
                      <Box component="span" sx={{ width: 20, height: 20, flexShrink: 0 }}>
                        {child.icon}
                      </Box>
                    )}
                    <Box component="span" sx={{ flexGrow: 1 }}>
                      {child.title}
                    </Box>
                  </MenuItem>
                );
              })}
            </MenuList>
          </Popover>
        )}
      </>
    );
  }

  return (
    <>
      <ListItem disableGutters disablePadding>
        <ListItemButton
          disableGutters
          component={hasChildren ? 'div' : RouterLink}
          href={hasChildren ? undefined : item.path}
          onClick={hasChildren ? () => onToggleOpen(item.title) : undefined}
          sx={[
            (theme) => ({
              pl: 2,
              py: 1,
              gap: 2,
              pr: 1.5,
              borderRadius: 0.75,
              typography: 'body2',
              fontWeight: 'fontWeightMedium',
              color: theme.vars.palette.text.secondary,
              minHeight: 44,
              ...(isActive && {
                fontWeight: 'fontWeightSemiBold',
                color: theme.vars.palette.primary.main,
                bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                '&:hover': {
                  bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.16),
                },
              }),
              ...(hasActive && !isActive && {
                color: theme.vars.palette.primary.main,
              }),
            }),
          ]}
        >
          <Box component="span" sx={{ width: 24, height: 24, flexShrink: 0 }}>
            {item.icon}
          </Box>

          <Box
            component="span"
            sx={{
              flexGrow: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {item.title}
          </Box>

          {hasChildren && (
            <Iconify
              width={16}
              icon={isOpen ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
              sx={{ flexShrink: 0 }}
            />
          )}

          {!hasChildren && item.info && item.info}
        </ListItemButton>
      </ListItem>

      {hasChildren && (
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <Box
                component="ul"
                sx={{
                  gap: 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  margin: 0,
                  listStyle: 'none',
                  pl: collapsed ? 0 : 4, // Indent children only when expanded
                }}
              >
            {item.children!.map((child) => (
              <NavItemComponent
                key={child.title}
                item={child}
                pathname={pathname}
                collapsed={collapsed}
                openStates={openStates}
                onToggleOpen={onToggleOpen}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </>
  );
};

export function NavContent({ data, slots, workspaces, sx, collapsed }: NavContentProps) {
  const pathname = usePathname();
  const [openStates, setOpenStates] = useState<Map<string, boolean>>(new Map());

  // Initialize open states based on active path
  const initialOpenStates = useMemo(() => {
    const states = new Map<string, boolean>();
    const checkItem = (item: NavItem) => {
      if (item.children && item.children.length > 0) {
        const hasActive = hasActiveChild(item, pathname);
        states.set(item.title, hasActive);
        item.children.forEach(checkItem);
      }
    };
    data.forEach(checkItem);
    return states;
  }, [data, pathname]);

  useEffect(() => {
    setOpenStates(initialOpenStates);
  }, [initialOpenStates]);

  const handleToggleOpen = (key: string) => {
    setOpenStates((prev) => {
      const next = new Map(prev);
      next.set(key, !prev.get(key));
      return next;
    });
  };

  // Group data by group name
  const groupedData = data.reduce(
    (acc, item) => {
      const groupName = item.group || '';
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(item);
      return acc;
    },
    {} as Record<string, typeof data>
  );

  // Define group display order (MANAGEMENT first, then APPS)
  const groupOrder = ['MANAGEMENT', 'APPS'];
  const sortedGroupEntries = Object.entries(groupedData).sort(([groupA], [groupB]) => {
    const indexA = groupOrder.indexOf(groupA);
    const indexB = groupOrder.indexOf(groupB);
    // If both groups are in the order list, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // If only one is in the list, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    // If neither is in the list, sort alphabetically
    return groupA.localeCompare(groupB);
  });

  return (
    <>
      <Box
        className="nav-logo-wrapper"
        sx={{
          pt: 2.5,
          pb: 1,
          px: collapsed ? 0 : 2.5,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: (theme) => theme.transitions.create(['padding', 'justify-content']),
        }}
      >
        <Logo sx={{ ml: 0 }} />
      </Box>

      {slots?.topArea}

      <Scrollbar
        fillContent
        slotProps={{
          contentWrapperSx: { width: 1, minWidth: 0 },
          contentSx: { width: 1, minWidth: 0 },
        }}
      >
        <Box
          component="nav"
          className="nav-menu-wrapper"
          sx={[
            {
              display: 'flex',
              flex: '1 1 auto',
              flexDirection: 'column',
              width: 1,
              minWidth: 0,
              px: collapsed ? 0.5 : 2.5,
              transition: (theme) => theme.transitions.create(['padding']),
              overflow: 'hidden',
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        >
          {sortedGroupEntries.map(([groupName, items]) => (
            <Box
              key={groupName}
              className="nav-group-wrapper"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                mb: collapsed ? 1.5 : 2,
                borderRadius: 1.5, // 박스 형태를 명확히 함
                transition: (theme) => theme.transitions.create(['background-color']),
                '&:hover': {
                  // 개발자 도구뿐만 아니라 실제 마우스 오버 시 영역 확인 가능 (선택 사항)
                  // bgcolor: (theme) => varAlpha(theme.vars.palette.action.hoverChannel, 0.04),
                },
                '&:last-child': { mb: 0 },
              }}
            >
              {groupName && !collapsed && (
                <ListSubheader
                  sx={{
                    px: 2,
                    py: 1.5,
                    lineHeight: 1,
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'text.disabled',
                    bgcolor: 'transparent',
                    textTransform: 'uppercase',
                    cursor: 'default',
                  }}
                >
                  {groupName}
                </ListSubheader>
              )}

              <Box
                component="ul"
                sx={{
                  gap: 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  margin: 0,
                  listStyle: 'none',
                }}
              >
                {items.map((item) => (
                  <NavItemComponent
                    key={item.title}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    openStates={openStates}
                    onToggleOpen={handleToggleOpen}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Scrollbar>

      {slots?.bottomArea}
    </>
  );
}
