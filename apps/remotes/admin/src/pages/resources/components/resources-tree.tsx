// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

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

type ResourcesTreeProps = {
  tree: ResourceNode[];
  expandedNodes: Set<string>;
  isLoading: boolean;
  error: Error | null;
  anchorEl: HTMLElement | null;
  selectedResource: ResourceNode | null;
  onToggleNode: (nodeId: string) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, resource: ResourceNode) => void;
  onMenuClose: () => void;
  onEdit: (resource: ResourceNode) => void;
  onDelete: (resource: ResourceNode) => void;
};

export const ResourcesTree = memo(({
  tree,
  expandedNodes,
  isLoading,
  error,
  anchorEl,
  selectedResource,
  onToggleNode,
  onMenuOpen,
  onMenuClose,
  onEdit,
  onDelete,
}: ResourcesTreeProps) => {
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
        {renderResourceTree(tree, expandedNodes, onToggleNode, onMenuOpen)}
      </Box>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onMenuClose}>
        <PermissionGate resource="menu.admin.resources" permission="UPDATE">
          <MenuItem onClick={() => selectedResource && onEdit(selectedResource)}>
            <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
            편집
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.resources" permission="DELETE">
          <MenuItem onClick={() => selectedResource && onDelete(selectedResource)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>
    </>
  );
});

ResourcesTree.displayName = 'ResourcesTree';

// ----------------------------------------------------------------------
// Render Resource Tree (recursive)
// ----------------------------------------------------------------------

const renderResourceTree = (
  tree: ResourceNode[],
  expandedNodes: Set<string>,
  toggleNode: (nodeId: string) => void,
  handleMenuOpen: (event: React.MouseEvent<HTMLElement>, resource: ResourceNode) => void,
  depth = 0
) => (
  <Stack spacing={1}>
    {tree.map((node, idx) => {
      const nodeKey = node.id || node.resourceKey || `resource-${depth}-${idx}`;
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);

      return (
        <Box key={nodeKey}>
          <Card
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: depth % 2 === 0 ? 'background.paper' : 'background.neutral',
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              {hasChildren && (
                <IconButton size="small" onClick={() => toggleNode(node.id)}>
                  <Iconify icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'} />
                </IconButton>
              )}
              {!hasChildren && <Box sx={{ width: 40 }} />}
              <Stack sx={{ flex: 1 }} spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">{node.resourceName}</Typography>
                  <Chip label={node.resourceType} size="small" />
                  {!node.enabled && <Chip label="비활성" size="small" color="default" />}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {node.resourceKey}
                </Typography>
                {node.path && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Path: {node.path}
                  </Typography>
                )}
              </Stack>
              <IconButton size="small" onClick={(e) => handleMenuOpen(e, node)}>
                <Iconify icon="solar:menu-dots-bold" />
              </IconButton>
            </Stack>
          </Card>
          {hasChildren && (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ pl: 4, pt: 1 }}>
                {renderResourceTree(node.children!, expandedNodes, toggleNode, handleMenuOpen, depth + 1)}
              </Box>
            </Collapse>
          )}
        </Box>
      );
    })}
  </Stack>
);
