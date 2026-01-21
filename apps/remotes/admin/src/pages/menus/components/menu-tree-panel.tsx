// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

// ----------------------------------------------------------------------

type MenuTreePanelProps = {
  tree: AdminMenuNode[];
  expandedNodes: Set<string>;
  isLoading: boolean;
  error: Error | null;
  anchorEl: HTMLElement | null;
  selectedMenu: AdminMenuNode | null;
  onToggleNode: (nodeId: string) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, menu: AdminMenuNode) => void;
  onMenuClose: () => void;
  onMenuSelect: (menu: AdminMenuNode) => void;
  onEdit: (menu: AdminMenuNode) => void;
  onDelete: (menu: AdminMenuNode) => void;
  onReorder: (menuId: string, direction: 'UP' | 'DOWN') => void;
};

export const MenuTreePanel = memo(({
  tree,
  expandedNodes,
  isLoading,
  error,
  anchorEl,
  selectedMenu,
  onToggleNode,
  onMenuOpen,
  onMenuClose,
  onMenuSelect,
  onEdit,
  onDelete,
  onReorder,
}: MenuTreePanelProps) => {
  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton key={idx} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
        ))}
      </Box>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          데이터가 없습니다.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ p: 2 }}>
        {renderMenuTree(tree, expandedNodes, selectedMenu, onToggleNode, onMenuOpen, onMenuSelect, onReorder, 0)}
      </Box>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onMenuClose}>
        <PermissionGate resource="menu.admin.menus" permission="UPDATE">
          <MenuItem onClick={() => selectedMenu && onEdit(selectedMenu)}>
            <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
            편집
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.menus" permission="DELETE">
          <MenuItem onClick={() => selectedMenu && onDelete(selectedMenu)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>
    </>
  );
});

MenuTreePanel.displayName = 'MenuTreePanel';

// ----------------------------------------------------------------------
// Render Menu Tree (recursive)
// ----------------------------------------------------------------------

const renderMenuTree = (
  tree: AdminMenuNode[],
  expandedNodes: Set<string>,
  selectedMenu: AdminMenuNode | null,
  toggleNode: (nodeId: string) => void,
  handleMenuOpen: (event: React.MouseEvent<HTMLElement>, menu: AdminMenuNode) => void,
  onMenuSelect: (menu: AdminMenuNode) => void,
  onReorder: (menuId: string, direction: 'UP' | 'DOWN') => void,
  depth = 0
) => (
  <Stack spacing={1}>
    {tree.map((node, index) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedMenu?.id === node.id;
      const isFirst = index === 0;
      const isLast = index === tree.length - 1;

      return (
        <Box key={node.id}>
          <Card
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'divider',
              bgcolor: isSelected ? 'action.selected' : depth % 2 === 0 ? 'background.paper' : 'background.neutral',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
            onClick={() => onMenuSelect(node)}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              {hasChildren && (
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.id);
                }}>
                  <Iconify icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'} />
                </IconButton>
              )}
              {!hasChildren && <Box sx={{ width: 40 }} />}
              <Stack sx={{ flex: 1 }} spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {node.icon && <Iconify icon={node.icon} width={20} />}
                  <Typography variant="subtitle2">{node.menuName}</Typography>
                  {node.group && <Chip label={node.group} size="small" />}
                  {node.enabled === false && <Chip label="비활성" size="small" color="default" />}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {node.menuKey}
                </Typography>
                {node.path && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Path: {node.path}
                  </Typography>
                )}
              </Stack>
              <Stack direction="row" spacing={0.5}>
                {/* Reorder buttons */}
                <PermissionGate resource="menu.admin.menus" permission="UPDATE">
                  <IconButton
                    size="small"
                    disabled={isFirst}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorder(node.id, 'UP');
                    }}
                    title="위로"
                  >
                    <Iconify icon="solar:alt-arrow-up-bold" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={isLast}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorder(node.id, 'DOWN');
                    }}
                    title="아래로"
                  >
                    <Iconify icon="solar:alt-arrow-down-bold" />
                  </IconButton>
                </PermissionGate>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuOpen(e, node);
                  }}
                >
                  <Iconify icon="solar:menu-dots-bold" />
                </IconButton>
              </Stack>
            </Stack>
          </Card>
          {hasChildren && (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ pl: 4, pt: 1 }}>
                {renderMenuTree(
                  node.children!,
                  expandedNodes,
                  selectedMenu,
                  toggleNode,
                  handleMenuOpen,
                  onMenuSelect,
                  onReorder,
                  depth + 1
                )}
              </Box>
            </Collapse>
          )}
        </Box>
      );
    })}
  </Stack>
);
