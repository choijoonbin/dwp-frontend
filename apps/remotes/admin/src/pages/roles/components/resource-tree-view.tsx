// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import { memo } from 'react';

import Stack from '@mui/material/Stack';

import { ResourceTreeNode } from './resource-tree-node';

// ----------------------------------------------------------------------

type ResourceTreeViewProps = {
  nodes: ResourceNode[];
  permissionMap: Map<string, Set<string>>;
  permissionCodes: Array<{ value: string; label: string }>;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  roleId: string;
  onPermissionToggle?: (resourceKey: string, permissionCode: string) => void;
  onSuccess: () => void;
};

export const ResourceTreeView = memo(({
  nodes,
  permissionMap,
  permissionCodes,
  expandedNodes,
  onToggle,
  roleId,
  onPermissionToggle,
  onSuccess,
}: ResourceTreeViewProps) => (
  <Stack spacing={1}>
    {nodes.map((node) => (
        <ResourceTreeNode
          key={node.id}
          node={node}
          permissionMap={permissionMap}
          permissionCodes={permissionCodes}
          expandedNodes={expandedNodes}
          onToggle={onToggle}
          roleId={roleId}
          onPermissionToggle={onPermissionToggle}
          onSuccess={onSuccess}
        />
    ))}
  </Stack>
));

ResourceTreeView.displayName = 'ResourceTreeView';
