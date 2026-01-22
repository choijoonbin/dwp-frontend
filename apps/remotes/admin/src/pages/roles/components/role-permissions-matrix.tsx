// ----------------------------------------------------------------------

import { memo, useMemo, useState, useCallback } from 'react';
import {
  toSelectOptions,
  getCodesByGroupFromMap,
  useCodesByResourceQuery,
  useAdminResourcesTreeQuery,
  useAdminRolePermissionsQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { ResourceTreeView } from './resource-tree-view';

// ----------------------------------------------------------------------

type RolePermissionsMatrixProps = {
  roleId: string;
  onSuccess: () => void;
};

export const RolePermissionsMatrix = memo(({ roleId, onSuccess }: RolePermissionsMatrixProps) => {
  const { data: rolePermissions } = useAdminRolePermissionsQuery(roleId);
  const { data: resourcesTree } = useAdminResourcesTreeQuery();
  const { data: codeMap } = useCodesByResourceQuery('menu.admin.roles');

  // Get permission codes from Code API
  const permissionCodes = useMemo(() => {
    const codes = getCodesByGroupFromMap(codeMap, 'PERMISSION_CODE');
    return toSelectOptions(codes);
  }, [codeMap]);

  const permissionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (rolePermissions) {
      rolePermissions.permissions.forEach((perm) => {
        map.set(perm.resourceKey, new Set(perm.permissionCodes));
      });
    }
    return map;
  }, [rolePermissions]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  if (!resourcesTree || resourcesTree.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        리소스가 없습니다.
      </Typography>
    );
  }

  return (
    <Box>
      <ResourceTreeView
        nodes={resourcesTree}
        permissionMap={permissionMap}
        permissionCodes={permissionCodes}
        expandedNodes={expandedNodes}
        onToggle={handleToggle}
        roleId={roleId}
        onSuccess={onSuccess}
      />
    </Box>
  );
});

RolePermissionsMatrix.displayName = 'RolePermissionsMatrix';
