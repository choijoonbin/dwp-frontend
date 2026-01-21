// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { PermissionCheckbox } from './permission-checkbox';

// ----------------------------------------------------------------------

type ResourceTreeNodeProps = {
  node: ResourceNode;
  permissionMap: Map<string, Set<string>>;
  permissionCodes: Array<{ value: string; label: string }>;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  roleId: string;
  onPermissionToggle?: (resourceKey: string, permissionCode: string) => void;
  onSuccess: () => void;
};

export const ResourceTreeNode = memo(({
  node,
  permissionMap,
  permissionCodes,
  expandedNodes,
  onToggle,
  roleId,
  onPermissionToggle,
  onSuccess,
}: ResourceTreeNodeProps) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const grantedCodes = permissionMap.get(node.resourceKey) || new Set<string>();

  return (
    <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          {hasChildren && (
            <IconButton size="small" onClick={() => onToggle(node.id)}>
              <Iconify icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'} />
            </IconButton>
          )}
          {!hasChildren && <Box sx={{ width: 32 }} />}
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {node.resourceName}
          </Typography>
          <Chip label={node.resourceType} size="small" />
          {!node.enabled && <Chip label="비활성" size="small" color="default" />}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', pl: 4 }}>
          {node.resourceKey}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ pl: 4 }}>
          {permissionCodes.length > 0 ? (
            permissionCodes.map((perm) => (
              <PermissionCheckbox
                key={perm.value}
                resourceKey={node.resourceKey}
                permissionCode={perm.value}
                roleId={roleId}
                checked={grantedCodes.has(perm.value)}
                permissionMap={permissionMap}
                onPermissionToggle={onPermissionToggle}
                onSuccess={onSuccess}
                label={perm.label}
              />
            ))
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              코드 매핑 필요
            </Typography>
          )}
        </Stack>
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 4 }}>
              {node.children!.map((child) => (
                <ResourceTreeNode
                  key={child.id}
                  node={child}
                  permissionMap={permissionMap}
                  permissionCodes={permissionCodes}
                  expandedNodes={expandedNodes}
                  onToggle={onToggle}
                  roleId={roleId}
                  onPermissionToggle={onPermissionToggle}
                  onSuccess={onSuccess}
                />
              ))}
            </Box>
          </Collapse>
        )}
      </Stack>
    </Paper>
  );
});

ResourceTreeNode.displayName = 'ResourceTreeNode';
