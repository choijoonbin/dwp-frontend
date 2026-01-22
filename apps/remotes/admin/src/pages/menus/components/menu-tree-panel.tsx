// ----------------------------------------------------------------------

import type { MouseEvent } from 'react';
import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { memo, useMemo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { MenuTreeList } from './menu-tree-list';

// ----------------------------------------------------------------------

type MenuTreePanelProps = {
  tree: AdminMenuNode[];
  expandedNodes: Set<string>;
  isLoading: boolean;
  error: Error | null;
  anchorEl: HTMLElement | null;
  actionMeta: { isFirst: boolean; isLast: boolean } | null;
  selectedMenu: AdminMenuNode | null;
  showDisabled: boolean;
  searchQuery: string;
  onToggleNode: (nodeId: string) => void;
  onMenuOpen: (event: MouseEvent<HTMLElement>, menu: AdminMenuNode) => void;
  onMenuClose: () => void;
  onMenuSelect: (menu: AdminMenuNode) => void;
  onCreateChild: (menu: AdminMenuNode) => void;
  onToggleEnabled: (menu: AdminMenuNode) => void;
  onCopyKey: (menuKey: string) => void;
  onDelete: (menu: AdminMenuNode) => void;
  onReorder: (menuId: string, direction: 'UP' | 'DOWN') => void;
  onShowDisabledChange: (show: boolean) => void;
  onSearchChange: (query: string) => void;
};

export const MenuTreePanel = memo(({
  tree,
  expandedNodes,
  isLoading,
  error,
  anchorEl,
  actionMeta,
  selectedMenu,
  showDisabled,
  searchQuery,
  onToggleNode,
  onMenuOpen,
  onMenuClose,
  onMenuSelect,
  onCreateChild,
  onToggleEnabled,
  onCopyKey,
  onDelete,
  onReorder,
  onShowDisabledChange,
  onSearchChange,
}: MenuTreePanelProps) => {
  const { totalCount, enabledCount } = useMemo(() => {
    const flatten = (nodes: AdminMenuNode[]): AdminMenuNode[] =>
      nodes.flatMap((node) => [node, ...(node.children ? flatten(node.children) : [])]);
    const allMenus = flatten(tree);
    return {
      totalCount: allMenus.length,
      enabledCount: allMenus.filter((item) => item.enabled !== false).length,
    };
  }, [tree]);

  const filteredTree = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filterMenus = (nodes: AdminMenuNode[]): AdminMenuNode[] =>
      nodes
        .map((node) => ({
          ...node,
          children: node.children ? filterMenus(node.children) : [],
        }))
        .filter((node) => {
          const matchesSearch = !normalizedQuery
            || node.menuName.toLowerCase().includes(normalizedQuery)
            || node.menuKey.toLowerCase().includes(normalizedQuery)
            || (node.path ? node.path.toLowerCase().includes(normalizedQuery) : false);
          const matchesEnabled = showDisabled || node.enabled !== false;
          const hasChildMatches = node.children && node.children.length > 0;
          if (hasChildMatches) {
            return matchesEnabled;
          }
          return matchesSearch && matchesEnabled;
        });

    return filterMenus(tree);
  }, [tree, searchQuery, showDisabled]);

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <ApiErrorAlert error={error} />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} variant="rounded" height={48} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="메뉴 검색 (이름, 키, 경로)"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="solar:magnifer-bold" width={18} sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            비활성 메뉴 표시
          </Typography>
          <Switch checked={showDisabled} onChange={(event) => onShowDisabledChange(event.target.checked)} />
        </Stack>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 1 }}>
        {filteredTree.length === 0 ? (
          <Box sx={{ py: 8, px: 3, textAlign: 'center' }}>
            <Iconify icon="solar:folder-bold" width={40} sx={{ color: 'text.disabled', mb: 2 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {searchQuery ? '검색 결과가 없습니다.' : '메뉴가 없습니다.'}
            </Typography>
          </Box>
        ) : (
          <MenuTreeList
            tree={filteredTree}
            expandedNodes={expandedNodes}
            selectedMenu={selectedMenu}
            onToggleNode={onToggleNode}
            onMenuOpen={onMenuOpen}
            onMenuSelect={onMenuSelect}
          />
        )}
      </Box>
      <Divider />
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            전체 메뉴: {totalCount}개
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            활성: {enabledCount}개
          </Typography>
        </Stack>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onMenuClose}>
        <PermissionGate resource="menu.admin.menus" permission="CREATE">
          <MenuItem onClick={() => selectedMenu && onCreateChild(selectedMenu)}>
            <Iconify icon="solar:add-circle-bold" width={16} sx={{ mr: 1 }} />
            하위 메뉴 추가
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.menus" permission="UPDATE">
          <MenuItem
            disabled={actionMeta?.isFirst}
            onClick={() => selectedMenu && onReorder(selectedMenu.id, 'UP')}
          >
            <Iconify icon="solar:alt-arrow-up-bold" width={16} sx={{ mr: 1 }} />
            위로 이동
          </MenuItem>
          <MenuItem
            disabled={actionMeta?.isLast}
            onClick={() => selectedMenu && onReorder(selectedMenu.id, 'DOWN')}
          >
            <Iconify icon="solar:alt-arrow-down-bold" width={16} sx={{ mr: 1 }} />
            아래로 이동
          </MenuItem>
        </PermissionGate>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => selectedMenu && onCopyKey(selectedMenu.menuKey)}>
          <Iconify icon="solar:copy-bold" width={16} sx={{ mr: 1 }} />
          키 복사
        </MenuItem>
        <PermissionGate resource="menu.admin.menus" permission="UPDATE">
          <MenuItem onClick={() => selectedMenu && onToggleEnabled(selectedMenu)}>
            <Iconify
              icon={selectedMenu?.enabled === false ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
              width={16}
              sx={{ mr: 1 }}
            />
            {selectedMenu?.enabled === false ? '활성화' : '비활성화'}
          </MenuItem>
        </PermissionGate>
        <Divider sx={{ my: 0.5 }} />
        <PermissionGate resource="menu.admin.menus" permission="DELETE">
          <MenuItem onClick={() => selectedMenu && onDelete(selectedMenu)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>
    </Box>
  );
});

MenuTreePanel.displayName = 'MenuTreePanel';
