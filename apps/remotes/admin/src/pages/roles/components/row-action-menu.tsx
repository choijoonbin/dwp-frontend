// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import { memo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';

// ----------------------------------------------------------------------

type RowActionMenuProps = {
  resource: ResourceNode;
  permissionCodes: Array<{ value: string; label: string }>;
  resourcesTree?: ResourceNode[] | null;
  onRowApply: (resourceKey: string, effect: 'ALLOW' | 'DENY') => void;
  onSetPermission: (resourceKey: string, permissionCode: string, effect: 'ALLOW' | 'DENY' | 'NONE') => void;
  onApplyToChildren?: (resourceKey: string, permissionCodes: string[], effect: 'ALLOW' | 'DENY') => void;
};

export const RowActionMenu = memo(({
  resource,
  permissionCodes,
  resourcesTree,
  onRowApply,
  onSetPermission,
  onApplyToChildren,
}: RowActionMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const hasChildren = resource.children && resource.children.length > 0;

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Iconify icon="solar:menu-dots-bold" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            onRowApply(resource.resourceKey, 'ALLOW');
            setAnchorEl(null);
          }}
        >
          <Iconify icon="solar:check-circle-bold" width={16} sx={{ mr: 1 }} />
          행 전체 ALLOW
        </MenuItem>
        <MenuItem
          onClick={() => {
            onRowApply(resource.resourceKey, 'DENY');
            setAnchorEl(null);
          }}
        >
          <Iconify icon="solar:close-circle-bold" width={16} sx={{ mr: 1 }} />
          행 전체 DENY
        </MenuItem>
        {hasChildren && onApplyToChildren && (
          <>
            <MenuItem
              onClick={() => {
                onApplyToChildren(resource.resourceKey, permissionCodes.map((p) => p.value), 'ALLOW');
                setAnchorEl(null);
              }}
            >
              <Iconify icon="solar:check-circle-bold" width={16} sx={{ mr: 1 }} />
              하위 노드 포함 ALLOW
            </MenuItem>
            <MenuItem
              onClick={() => {
                onApplyToChildren(resource.resourceKey, permissionCodes.map((p) => p.value), 'DENY');
                setAnchorEl(null);
              }}
            >
              <Iconify icon="solar:close-circle-bold" width={16} sx={{ mr: 1 }} />
              하위 노드 포함 DENY
            </MenuItem>
          </>
        )}
        <MenuItem
          onClick={() => {
            permissionCodes.forEach((code) => {
              onSetPermission(resource.resourceKey, code.value, 'NONE');
            });
            setAnchorEl(null);
          }}
        >
          <Iconify icon="solar:minus-circle-bold" width={16} sx={{ mr: 1 }} />
          행 전체 초기화
        </MenuItem>
      </Menu>
    </>
  );
});

RowActionMenu.displayName = 'RowActionMenu';
