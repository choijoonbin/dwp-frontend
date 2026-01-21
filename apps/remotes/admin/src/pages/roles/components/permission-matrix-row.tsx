// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import { Iconify } from '@dwp-frontend/design-system';
import React, { memo, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { PermissionMatrixCell } from './permission-matrix-cell';
import { flattenResourceTree } from '../adapters/role-permission-adapter';

// ----------------------------------------------------------------------

type PermissionValue = 'ALLOW' | 'DENY' | null;

type PermissionMatrixRowProps = {
  resource: ResourceNode;
  depth: number;
  permissionCodes: Array<{ value: string; label: string }>;
  permissionMap: Map<string, Map<string, PermissionValue>>;
  originalMap: Map<string, Map<string, PermissionValue>>;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onCellClick: (resourceKey: string, permissionCode: string) => void;
  onRowBulkAction: (resourceKey: string, value: PermissionValue) => void;
  allResources: ResourceNode[];
};

export const PermissionMatrixRow = memo(
  ({
    resource,
    depth,
    permissionCodes,
    permissionMap,
    originalMap,
    expandedNodes,
    onToggleExpand,
    onCellClick,
    onRowBulkAction,
    allResources,
  }: PermissionMatrixRowProps) => {
    const hasChildren = resource.children && resource.children.length > 0;
    const isExpanded = expandedNodes.has(resource.id);

    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(menuAnchorEl);

    const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setMenuAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
      setMenuAnchorEl(null);
    };

    const handleBulkAction = (value: PermissionValue) => {
      const getKeysRecursive = (node: ResourceNode): string[] => {
        const keys = [node.resourceKey];
        if (node.children) {
          node.children.forEach((child) => {
            keys.push(...getKeysRecursive(child));
          });
        }
        return keys;
      };

      const allRelatedKeys = getKeysRecursive(resource);
      allRelatedKeys.forEach((key) => onRowBulkAction(key, value));
      handleMenuClose();
    };

    // Check if row has any dirty cells
    const hasDirtyCells = useMemo(() => {
      const currentPerms = permissionMap.get(resource.resourceKey);
      const originalPerms = originalMap.get(resource.resourceKey);

      if (!currentPerms && !originalPerms) return false;
      if (!currentPerms || !originalPerms) return true;

      for (const [code, value] of currentPerms.entries()) {
        if (originalPerms.get(code) !== value) return true;
      }

      for (const [code, value] of originalPerms.entries()) {
        if (currentPerms.get(code) !== value) return true;
      }

      return false;
    }, [resource.resourceKey, permissionMap, originalMap]);

    const getPermissionValue = (permissionCode: string): PermissionValue => permissionMap.get(resource.resourceKey)?.get(permissionCode) ?? null;

    const isDirty = (permissionCode: string): boolean => {
      const current = permissionMap.get(resource.resourceKey)?.get(permissionCode);
      const original = originalMap.get(resource.resourceKey)?.get(permissionCode);
      return current !== original;
    };

    return (
      <>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            transition: 'background-color 0.2s',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          {/* Resource Name Cell (Sticky) */}
          <Box
            sx={{
              position: 'sticky',
              left: 0,
              zIndex: 10,
              minWidth: 280,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1.5,
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              pl: `${depth * 20 + 16}px`,
            }}
          >
            {hasChildren ? (
              <IconButton
                size="small"
                onClick={() => onToggleExpand(resource.id)}
                sx={{ width: 24, height: 24 }}
              >
                <Iconify
                  icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'}
                  width={16}
                />
              </IconButton>
            ) : (
              <Box sx={{ width: 24 }} />
            )}

            <Iconify
              icon={resource.resourceType === 'MENU' ? 'solar:folder-bold' : 'solar:settings-bold'}
              width={16}
              sx={{ color: resource.resourceType === 'MENU' ? 'text.secondary' : 'primary.main' }}
            />

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {resource.resourceName || resource.resourceKey}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                {resource.resourceKey}
              </Typography>
            </Box>

            <Chip label={resource.resourceType} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />

            {/* Row Bulk Action Menu */}
            <Box
              className="permission-matrix-row-menu"
              sx={{
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
            >
              <Tooltip title="행 일괄 작업">
                <IconButton size="small" onClick={handleMenuOpen} sx={{ width: 24, height: 24 }}>
                  <Iconify icon="solar:menu-dots-bold" width={16} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Permission Cells */}
          {permissionCodes.map((perm) => {
            const value = getPermissionValue(perm.value);
            const dirty = isDirty(perm.value);

            return (
              <PermissionMatrixCell
                key={perm.value}
                resourceKey={resource.resourceKey}
                resourceName={resource.resourceName || resource.resourceKey}
                permissionCode={perm.value}
                permissionLabel={perm.label}
                value={value}
                isDirty={dirty}
                onClick={() => onCellClick(resource.resourceKey, perm.value)}
              />
            );
          })}
        </Box>

        {/* Row Bulk Action Menu */}
        <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleMenuClose}>
          <MenuItem onClick={() => handleBulkAction('ALLOW')}>
            <Iconify icon="solar:check-circle-bold" width={18} sx={{ mr: 1, color: 'success.main' }} />
            전체 허용
          </MenuItem>
          <MenuItem onClick={() => handleBulkAction('DENY')}>
            <Iconify icon="solar:close-circle-bold" width={18} sx={{ mr: 1, color: 'error.main' }} />
            전체 거부
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleBulkAction(null)}>
            <Iconify icon="solar:restart-bold" width={18} sx={{ mr: 1 }} />
            초기화
          </MenuItem>
        </Menu>

        {/* Children Rows */}
        {hasChildren &&
          isExpanded &&
          resource.children!.map((child) => (
            <PermissionMatrixRow
              key={child.id}
              resource={child}
              depth={depth + 1}
              permissionCodes={permissionCodes}
              permissionMap={permissionMap}
              originalMap={originalMap}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onCellClick={onCellClick}
              onRowBulkAction={onRowBulkAction}
              allResources={allResources}
            />
          ))}
      </>
    );
  }
);

PermissionMatrixRow.displayName = 'PermissionMatrixRow';
