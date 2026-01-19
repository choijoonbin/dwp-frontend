import { useState, useMemo, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { PermissionGate } from '@dwp-frontend/design-system';
import { PermissionRouteGuard } from '@dwp-frontend/shared-utils';
import {
  useAdminResourcesTreeQuery,
  useCreateAdminResourceMutation,
  useUpdateAdminResourceMutation,
  useDeleteAdminResourceMutation,
  useCodesByResourceQuery,
  getSelectOptionsByGroup,
  type ResourceNode,
  type Code,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Menu from '@mui/material/Menu';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

export const ResourcesPage = () => (
  <PermissionRouteGuard resource="menu.admin.resources" permission="VIEW" redirectTo="/403">
    <ResourcesPageContent />
  </PermissionRouteGuard>
);

const ResourcesPageContent = () => {
  const [keyword, setKeyword] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data: resourcesTree, isLoading, error, refetch } = useAdminResourcesTreeQuery();
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.resources');
  const createMutation = useCreateAdminResourceMutation();
  const updateMutation = useUpdateAdminResourceMutation();
  const deleteMutation = useDeleteAdminResourceMutation();

  // Get resource types from codes
  const resourceTypes = useMemo(() => getSelectOptionsByGroup(codeMap, 'RESOURCE_TYPE'), [codeMap]);

  // Filter tree
  const filteredTree = useMemo(() => {
    if (!resourcesTree) return [];
    return filterResourceTree(resourcesTree, keyword, resourceTypeFilter);
  }, [resourcesTree, keyword, resourceTypeFilter]);

  const handleCreate = () => {
    setSelectedResource(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (resource: ResourceNode) => {
    setSelectedResource(resource);
    setEditDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDelete = (resource: ResourceNode) => {
    setSelectedResource(resource);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, resource: ResourceNode) => {
    setAnchorEl(event.currentTarget);
    setSelectedResource(resource);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  return (
  <Box sx={{ p: 3 }}>
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">리소스 관리</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          메뉴 및 리소스 권한을 관리합니다.
        </Typography>
      </Stack>

        {/* Filter Bar */}
        <Card sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="검색"
              size="small"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="타입"
              size="small"
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">전체</MenuItem>
              {resourceTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
            <PermissionGate resource="menu.admin.resources" permission="CREATE">
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleCreate}>
                리소스 추가
              </Button>
            </PermissionGate>
          </Stack>
        </Card>

        {/* Tree */}
        <Card>
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              데이터를 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : 'Unknown error'}
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ p: 3 }}>
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
              ))}
            </Box>
          ) : !filteredTree || filteredTree.length === 0 ? (
            <Box sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                데이터가 없습니다.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              {renderResourceTree(filteredTree, expandedNodes, toggleNode, handleMenuOpen)}
            </Box>
          )}
        </Card>
      </Stack>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <PermissionGate resource="menu.admin.resources" permission="UPDATE">
          <MenuItem onClick={() => selectedResource && handleEdit(selectedResource)}>
            <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
            편집
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.resources" permission="DELETE">
          <MenuItem onClick={() => selectedResource && handleDelete(selectedResource)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>

      {/* Create/Edit Dialog */}
      <ResourceDialog
        open={createDialogOpen || editDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
        }}
        resource={selectedResource}
        resourcesTree={resourcesTree || []}
        codeMap={codeMap}
        onSuccess={() => {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
          refetch();
          showSnackbar(selectedResource ? '리소스가 수정되었습니다.' : '리소스가 생성되었습니다.');
        }}
      />

      {/* Delete Dialog */}
      {selectedResource && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title="리소스 삭제"
          content={`정말 "${selectedResource.resourceName}" 리소스를 삭제하시겠습니까?`}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(selectedResource.id);
              setDeleteDialogOpen(false);
              refetch();
              showSnackbar('리소스가 삭제되었습니다.');
            } catch (deleteError) {
              showSnackbar(deleteError instanceof Error ? deleteError.message : '삭제에 실패했습니다.', 'error');
            }
          }}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// ----------------------------------------------------------------------
// Filter Resource Tree
// ----------------------------------------------------------------------

const filterResourceTree = (
  tree: ResourceNode[],
  keyword: string,
  resourceType: string
): ResourceNode[] => {
  if (!keyword && !resourceType) return tree;

  const filterNode = (node: ResourceNode): ResourceNode | null => {
    const matchesKeyword = !keyword || node.resourceName.toLowerCase().includes(keyword.toLowerCase()) || node.resourceKey.toLowerCase().includes(keyword.toLowerCase());
    const matchesType = !resourceType || node.resourceType === resourceType;

    const filteredChildren = node.children ? node.children.map(filterNode).filter((n): n is ResourceNode => n !== null) : [];

    if (matchesKeyword && matchesType) {
      return { ...node, children: filteredChildren.length > 0 ? filteredChildren : undefined };
    }

    if (filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }

    return null;
  };

  return tree.map(filterNode).filter((n): n is ResourceNode => n !== null);
};

// ----------------------------------------------------------------------
// Render Resource Tree
// ----------------------------------------------------------------------

const renderResourceTree = (
  tree: ResourceNode[],
  expandedNodes: Set<string>,
  toggleNode: (nodeId: string) => void,
  handleMenuOpen: (event: React.MouseEvent<HTMLElement>, resource: ResourceNode) => void,
  depth = 0
) => (
    <Stack spacing={1}>
      {tree.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(node.id);

        return (
          <Box key={node.id}>
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

// ----------------------------------------------------------------------
// Resource Dialog
// ----------------------------------------------------------------------

type ResourceDialogProps = {
  open: boolean;
  onClose: () => void;
  resource: ResourceNode | null;
  resourcesTree: ResourceNode[];
  codeMap: Record<string, Code[]> | undefined;
  onSuccess: () => void;
};

const ResourceDialog = ({ open, onClose, resource, resourcesTree, codeMap, onSuccess }: ResourceDialogProps) => {
  const resourceTypes = useMemo(() => getSelectOptionsByGroup(codeMap, 'RESOURCE_TYPE'), [codeMap]);
  const [formData, setFormData] = useState({
    resourceName: '',
    resourceKey: '',
    resourceType: 'MENU' as 'MENU' | 'BUTTON' | 'API' | 'RESOURCE',
    path: '',
    parentId: '',
    sortOrder: '',
    enabled: true,
  });

  const createMutation = useCreateAdminResourceMutation();
  const updateMutation = useUpdateAdminResourceMutation();

  // Flatten tree for parent selection
  const flatResources = useMemo(() => {
    const flatten = (nodes: ResourceNode[], result: ResourceNode[] = []): ResourceNode[] => {
      nodes.forEach((node) => {
        if (resource && node.id !== resource.id) {
          result.push(node);
        }
        if (node.children) {
          flatten(node.children, result);
        }
      });
      return result;
    };
    return flatten(resourcesTree);
  }, [resourcesTree, resource]);

  useEffect(() => {
    if (resource) {
      setFormData({
        resourceName: resource.resourceName,
        resourceKey: resource.resourceKey,
        resourceType: resource.resourceType,
        path: resource.path || '',
        parentId: resource.parentId || '',
        sortOrder: resource.sortOrder?.toString() || '',
        enabled: resource.enabled,
      });
    } else {
      setFormData({
        resourceName: '',
        resourceKey: '',
        resourceType: 'MENU',
        path: '',
        parentId: '',
        sortOrder: '',
        enabled: true,
      });
    }
  }, [resource]);

  const handleSubmit = async () => {
    try {
      if (resource) {
        await updateMutation.mutateAsync({
          resourceId: resource.id,
          payload: {
            resourceName: formData.resourceName,
            resourceKey: formData.resourceKey,
            resourceType: formData.resourceType,
            path: formData.path || undefined,
            parentId: formData.parentId || undefined,
            sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
            enabled: formData.enabled,
          },
        });
      } else {
        await createMutation.mutateAsync({
          resourceName: formData.resourceName,
          resourceKey: formData.resourceKey,
          resourceType: formData.resourceType,
          path: formData.path || undefined,
          parentId: formData.parentId || undefined,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
          enabled: formData.enabled,
        });
      }
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{resource ? '리소스 편집' : '리소스 추가'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="리소스명 *"
            fullWidth
            value={formData.resourceName}
            onChange={(e) => setFormData({ ...formData, resourceName: e.target.value })}
            required
          />
          <TextField
            label="리소스 키 *"
            fullWidth
            value={formData.resourceKey}
            onChange={(e) => setFormData({ ...formData, resourceKey: e.target.value })}
            required
            disabled={!!resource}
          />
          <TextField
            select
            label="타입 *"
            fullWidth
            value={formData.resourceType}
            onChange={(e) => setFormData({ ...formData, resourceType: e.target.value as 'MENU' | 'BUTTON' | 'API' | 'RESOURCE' })}
            required
            disabled={resourceTypes.length === 0}
            helperText={resourceTypes.length === 0 ? '코드 매핑 필요' : undefined}
          >
            {resourceTypes.length > 0 ? (
              resourceTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled value="">
                코드 매핑 필요
              </MenuItem>
            )}
          </TextField>
          <TextField
            label="Path"
            fullWidth
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          />
          <TextField
            select
            label="부모 리소스"
            fullWidth
            value={formData.parentId}
            onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
          >
            <MenuItem value="">없음</MenuItem>
            {flatResources.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.resourceName} ({r.resourceKey})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="정렬 순서"
            type="number"
            fullWidth
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
          />
          <FormControlLabel
            control={
              <Switch checked={formData.enabled} onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })} />
            }
            label="활성화"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.resourceName || !formData.resourceKey || (createMutation.isPending || updateMutation.isPending)}
        >
          {resource ? '저장' : '생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// Delete Confirm Dialog
// ----------------------------------------------------------------------

type DeleteConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onConfirm: () => void;
};

const DeleteConfirmDialog = ({ open, onClose, title, content, onConfirm }: DeleteConfirmDialogProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <Typography variant="body2">{content}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>취소</Button>
      <Button variant="contained" color="error" onClick={onConfirm}>
        삭제
      </Button>
    </DialogActions>
  </Dialog>
);
