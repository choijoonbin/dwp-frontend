// ----------------------------------------------------------------------

import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import {
  trackEvent,
  HttpError,
  toSelectOptions,
  getCodesByGroupFromMap,
  useCodesByResourceQuery,
  useAdminResourcesTreeQuery,
  useAdminRolePermissionsQuery,
  useUpdateAdminRolePermissionsMutation,
} from '@dwp-frontend/shared-utils';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useRolePermissionsState } from '../hooks/use-role-permissions-state';
import {
  toPermissionMap,
  flattenResourceTree,
  filterResourceTreeByKeyword,
  toPermissionAssignmentPayload,
} from '../adapters/role-permission-adapter';
import { PermissionMatrixRow } from './permission-matrix-row';
import { PermissionMatrixHeader } from './permission-matrix-header';
import { PermissionMatrixLegend } from './permission-matrix-legend';

// ----------------------------------------------------------------------

type PermissionValue = 'ALLOW' | 'DENY' | null;

type RolePermissionMatrixTabProps = {
  roleId: string;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveRequest?: (handler: () => Promise<void>) => void;
};

export const RolePermissionMatrixTab = memo(({ roleId, onSuccess, onDirtyChange, onSaveRequest }: RolePermissionMatrixTabProps) => {
  const { data: rolePermissions } = useAdminRolePermissionsQuery(roleId);
  const { data: resourcesTree } = useAdminResourcesTreeQuery();
  const { data: codeMap } = useCodesByResourceQuery('menu.admin.roles');
  const updateMutation = useUpdateAdminRolePermissionsMutation();

  const [errorSnackbar, setErrorSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  const {
    searchKeyword,
    resourceTypeFilter,
    expandedNodes,
    handleSearchChange,
    handleResourceTypeFilterChange,
    handleToggleNode,
  } = useRolePermissionsState();

  // Get permission codes from Code API
  const permissionCodes = useMemo(() => {
    const codes = getCodesByGroupFromMap(codeMap, 'PERMISSION_CODE');
    return toSelectOptions(codes).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [codeMap]);

  // State for current modifications
  const [permissionMap, setPermissionMap] = useState<Map<string, Map<string, PermissionValue>>>(new Map());
  // State for original values from server
  const [originalMap, setOriginalMap] = useState<Map<string, Map<string, PermissionValue>>>(new Map());

  // Initialize maps when data loads
  useEffect(() => {
    if (rolePermissions?.permissions) {
      const map = toPermissionMap(rolePermissions.permissions);
      // Deep copy for the working state
      const workingMap = new Map();
      map.forEach((val, key) => workingMap.set(key, new Map(val)));
      
      setPermissionMap(workingMap);
      setOriginalMap(map);
      onDirtyChange?.(false);
    }
  }, [rolePermissions, onDirtyChange]);

  // Calculate changed items count
  const dirtyCount = useMemo(() => {
    let count = 0;
    const allResourceKeys = new Set([...Array.from(permissionMap.keys()), ...Array.from(originalMap.keys())]);
    
    allResourceKeys.forEach((resKey) => {
      const currentResMap = permissionMap.get(resKey) || new Map();
      const originalResMap = originalMap.get(resKey) || new Map();
      const allCodes = new Set([...Array.from(currentResMap.keys()), ...Array.from(originalResMap.keys())]);
      
      allCodes.forEach((code) => {
        if (currentResMap.get(code) !== originalResMap.get(code)) {
          count++;
        }
      });
    });
    return count;
  }, [permissionMap, originalMap]);

  const isDirty = dirtyCount > 0;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Cell Click: Cycle ALLOW -> DENY -> null
  const handleCellClick = useCallback((resourceKey: string, permissionCode: string) => {
    setPermissionMap((prev) => {
      const next = new Map(prev);
      const resMap = new Map(next.get(resourceKey) || []);
      const current = resMap.get(permissionCode) ?? null;
      
      let nextValue: PermissionValue = null;
      if (current === null) nextValue = 'ALLOW';
      else if (current === 'ALLOW') nextValue = 'DENY';
      else nextValue = null;

      if (nextValue === null) {
        resMap.delete(permissionCode);
      } else {
        resMap.set(permissionCode, nextValue);
      }

      if (resMap.size === 0) {
        next.delete(resourceKey);
      } else {
        next.set(resourceKey, resMap);
      }
      return next;
    });
  }, []);

  // Row Bulk Action
  const handleRowBulkAction = useCallback((resourceKey: string, value: PermissionValue) => {
    setPermissionMap((prev) => {
      const next = new Map(prev);
      if (value === null) {
        next.delete(resourceKey);
      } else {
        const resMap = new Map();
        permissionCodes.forEach((pc) => resMap.set(pc.value, value));
        next.set(resourceKey, resMap);
      }
      return next;
    });
  }, [permissionCodes]);

  // Column Bulk Action
  const handleColumnBulkAction = useCallback((permissionCode: string, value: PermissionValue) => {
    setPermissionMap((prev) => {
      const next = new Map(prev);
      const flatResources = flattenResourceTree(resourcesTree || []);
      
      flatResources.forEach((res) => {
        const resMap = new Map(next.get(res.resourceKey) || []);
        if (value === null) {
          resMap.delete(permissionCode);
        } else {
          resMap.set(permissionCode, value);
        }
        
        if (resMap.size === 0) {
          next.delete(res.resourceKey);
        } else {
          next.set(res.resourceKey, resMap);
        }
      });
      return next;
    });
  }, [resourcesTree]);

  const handleResetAll = useCallback(() => {
    const resetMap = new Map();
    originalMap.forEach((val, key) => resetMap.set(key, new Map(val)));
    setPermissionMap(resetMap);
  }, [originalMap]);

  const handleSave = useCallback(async () => {
    try {
      trackEvent({
        resourceKey: 'menu.admin.roles',
        action: 'CLICK',
        label: '권한 매트릭스 저장',
      });

      const items = toPermissionAssignmentPayload(permissionMap);
      await updateMutation.mutateAsync({ roleId, payload: { items } });
      onSuccess();
    } catch (err) {
      setErrorSnackbar({ open: true, message: err instanceof Error ? err.message : '저장 실패' });
    }
  }, [roleId, permissionMap, updateMutation, onSuccess]);

  useEffect(() => {
    onSaveRequest?.(handleSave);
  }, [handleSave, onSaveRequest]);

  const filteredTree = useMemo(() => {
    if (!resourcesTree) return [];
    let tree = filterResourceTreeByKeyword(resourcesTree, searchKeyword);
    if (resourceTypeFilter && resourceTypeFilter !== 'ALL') {
      const filterByType = (nodes: any[]): any[] => nodes.filter((n) => {
        const matches = n.resourceType === resourceTypeFilter;
        if (n.children) {
          n.children = filterByType(n.children);
        }
        return matches || (n.children && n.children.length > 0);
      });
      tree = filterByType(JSON.parse(JSON.stringify(tree)));
    }
    return tree;
  }, [resourcesTree, searchKeyword, resourceTypeFilter]);

  if (!resourcesTree) return null;

  return (
    <Stack 
      spacing={0} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        border: 1, 
        borderColor: 'divider', 
        borderRadius: 1, 
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}
    >
      {/* Toolbar */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} flex={1}>
            <TextField
              size="small"
              placeholder="리소스 검색..."
              value={searchKeyword}
              onChange={(e) => handleSearchChange(e.target.value)}
              InputProps={{
                startAdornment: <Iconify icon="solar:magnifer-bold" width={18} sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ maxWidth: 300, bgcolor: 'background.paper' }}
            />
            <Stack direction="row" spacing={0.5}>
              {[
                { value: 'ALL', label: '전체' },
                { value: 'MENU', label: '메뉴' },
                { value: 'UI_COMPONENT', label: '컴포넌트' },
              ].map((type) => (
                <Button
                  key={type.value}
                  size="small"
                  variant={resourceTypeFilter === type.value || (type.value === 'ALL' && !resourceTypeFilter) ? 'contained' : 'outlined'}
                  onClick={() => handleResourceTypeFilterChange(type.value)}
                  sx={{ minWidth: 60 }}
                >
                  {type.label}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            {dirtyCount > 0 && (
              <Badge badgeContent={dirtyCount} color="warning" sx={{ '& .MuiBadge-badge': { right: -3, top: 3 } }}>
                <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: 'warning.lighter', color: 'warning.darker', typography: 'caption', fontWeight: 700 }}>
                  {dirtyCount}개 변경됨
                </Box>
              </Badge>
            )}
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={handleResetAll}
              disabled={dirtyCount === 0}
            >
              전체 초기화
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Matrix Body */}
      <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Box sx={{ minWidth: 'max-content' }}>
          <PermissionMatrixHeader 
            permissionCodes={permissionCodes} 
            onColumnBulkAction={handleColumnBulkAction} 
          />
          {filteredTree.length === 0 ? (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">검색 결과가 없습니다.</Typography>
            </Box>
          ) : (
            filteredTree.map((res, index) => (
              <PermissionMatrixRow
                key={`${res.id}-${index}`}
                resource={res}
                depth={0}
                permissionCodes={permissionCodes}
                permissionMap={permissionMap}
                originalMap={originalMap}
                expandedNodes={expandedNodes}
                onToggleExpand={handleToggleNode}
                onCellClick={handleCellClick}
                onRowBulkAction={handleRowBulkAction}
                allResources={resourcesTree}
              />
            ))
          )}
        </Box>
      </Box>

      <PermissionMatrixLegend />

      <Snackbar
        open={errorSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setErrorSnackbar({ open: false, message: '' })}
      >
        <Alert severity="error" onClose={() => setErrorSnackbar({ open: false, message: '' })}>
          {errorSnackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
});

RolePermissionMatrixTab.displayName = 'RolePermissionMatrixTab';
