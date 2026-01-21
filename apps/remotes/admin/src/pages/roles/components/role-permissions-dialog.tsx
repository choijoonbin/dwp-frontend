// ----------------------------------------------------------------------

import { useMemo, useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import {
  isMatrixDirty,
  toSelectOptions,
  resetMatrixState,
  getChangePreview,
  createMatrixState,
  type ResourceNode,
  generateDiffPayload,
  getChangedResources,
  setPermissionEffect,
  applyRowPermissions,
  applyAllPermissions,
  applyColumnPermissions,
  getCodesByGroupFromMap,
  togglePermissionEffect,
  useCodesByResourceQuery,
  applyToResourceAndChildren,
  type PermissionMatrixState,
  useAdminResourcesTreeQuery,
  useAdminRolePermissionsQuery,
  useUpdateAdminRolePermissionsMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import TableRow from '@mui/material/TableRow';
import Collapse from '@mui/material/Collapse';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import { RowActionMenu } from './row-action-menu';

// ----------------------------------------------------------------------

type RolePermissionsDialogProps = {
  open: boolean;
  onClose: () => void;
  roleId: string;
  onSuccess: () => void;
};

export const RolePermissionsDialog = ({ open, onClose, roleId, onSuccess }: RolePermissionsDialogProps) => {
  const { data: rolePermissions, isLoading, error: permissionsError } = useAdminRolePermissionsQuery(roleId);
  const { data: resourcesTree } = useAdminResourcesTreeQuery();
  const { data: codeMap } = useCodesByResourceQuery('menu.admin.roles');
  const updateMutation = useUpdateAdminRolePermissionsMutation();

  // Get permission codes from Code API
  const permissionCodes = useMemo(() => {
    const codes = getCodesByGroupFromMap(codeMap, 'PERMISSION_CODE');
    return toSelectOptions(codes);
  }, [codeMap]);

  // Matrix state with dirty tracking
  const [matrixState, setMatrixState] = useState<PermissionMatrixState>({
    original: new Map(),
    current: new Map(),
  });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [selectedResourceKey, setSelectedResourceKey] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Initialize matrix state from rolePermissions
  useEffect(() => {
    if (rolePermissions) {
      const state = createMatrixState(rolePermissions.permissions);
      setMatrixState(state);
      // Reset filters when role changes
      setSearchKeyword('');
      setResourceTypeFilter('');
      setOnlyChanged(false);
      setSelectedResourceKey(null);
      setExpandedNodes(new Set());
    }
  }, [rolePermissions]);

  const isDirty = useMemo(() => isMatrixDirty(matrixState), [matrixState]);
  const changedResources = useMemo(() => getChangedResources(matrixState), [matrixState]);

  // Unsaved changes guard: prevent browser navigation
  useEffect(() => {
    if (!open || !isDirty) return undefined;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [open, isDirty]);

  // Flatten resources tree for filtering and display
  const flattenedResources = useMemo(() => {
    if (!resourcesTree) return [];
    const flatten = (nodes: typeof resourcesTree, result: typeof resourcesTree = []): typeof resourcesTree => {
      nodes.forEach((node) => {
        result.push(node);
        if (node.children) {
          flatten(node.children, result);
        }
      });
      return result;
    };
    return flatten(resourcesTree);
  }, [resourcesTree]);

  // Filter resources (for matrix table)
  const filteredResources = useMemo(() => {
    let filtered = flattenedResources;
    
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.resourceName?.toLowerCase().includes(keyword) ||
          r.resourceKey.toLowerCase().includes(keyword)
      );
    }
    
    if (resourceTypeFilter) {
      filtered = filtered.filter((r) => r.resourceType === resourceTypeFilter);
    }
    
    if (onlyChanged) {
      filtered = filtered.filter((r) => changedResources.has(r.resourceKey));
    }
    
    return filtered;
  }, [flattenedResources, searchKeyword, resourceTypeFilter, onlyChanged, changedResources]);

  // Filter tree nodes (for tree view) - recursive filtering that preserves tree structure
  const filteredTree = useMemo(() => {
    if (!resourcesTree) return [];
    
    const filterNode = (node: ResourceNode): ResourceNode | null => {
      // Check if node matches filters
      const matchesSearch = !searchKeyword || 
        node.resourceName?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        node.resourceKey.toLowerCase().includes(searchKeyword.toLowerCase());
      const matchesType = !resourceTypeFilter || node.resourceType === resourceTypeFilter;
      const matchesChanged = !onlyChanged || changedResources.has(node.resourceKey);
      
      const nodeMatches = matchesSearch && matchesType && matchesChanged;
      
      // Filter children recursively
      const filteredChildren = node.children
        ? node.children.map(filterNode).filter((child): child is ResourceNode => child !== null)
        : [];
      
      // Include node if it matches or has matching children
      if (nodeMatches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        };
      }
      
      return null;
    };
    
    return resourcesTree.map(filterNode).filter((node): node is ResourceNode => node !== null);
  }, [resourcesTree, searchKeyword, resourceTypeFilter, onlyChanged, changedResources]);


  const handleTogglePermission = (resourceKey: string, permissionCode: string) => {
    setMatrixState((prev) => togglePermissionEffect(prev, resourceKey, permissionCode));
  };

  const handleSetPermission = (resourceKey: string, permissionCode: string, effect: 'ALLOW' | 'DENY' | 'NONE') => {
    setMatrixState((prev) => setPermissionEffect(prev, resourceKey, permissionCode, effect));
  };

  // Bulk Apply: Row (all permissions for a resource)
  const handleRowApply = (resourceKey: string, effect: 'ALLOW' | 'DENY') => {
    setMatrixState((prev) => applyRowPermissions(prev, resourceKey, permissionCodes.map((p) => p.value), effect));
  };

  // Bulk Apply: Column (all resources for a permission code)
  const handleColumnApply = (permissionCode: string, effect: 'ALLOW' | 'DENY') => {
    setMatrixState((prev) =>
      applyColumnPermissions(prev, permissionCode, filteredResources.map((r) => r.resourceKey), effect)
    );
  };

  // Bulk Apply: Select All
  const handleSelectAll = (effect: 'ALLOW' | 'DENY') => {
    setMatrixState((prev) =>
      applyAllPermissions(prev, filteredResources.map((r) => r.resourceKey), permissionCodes.map((p) => p.value), effect)
    );
  };

  // Reset changes
  const handleReset = () => {
    setMatrixState((prev) => resetMatrixState(prev));
    setSnackbar({ open: true, message: '변경사항이 취소되었습니다.', severity: 'success' });
  };

  // Handle close with unsaved changes guard
  const handleClose = () => {
    if (isDirty) {
      setPendingClose(true);
    } else {
      onClose();
    }
  };

  // Save changes (only changed items)
  const handleSubmit = async () => {
    // Show preview first
    const changes = getChangePreview(matrixState, permissionCodes.map((p) => p.value));
    if (changes.length === 0) {
      setSnackbar({ open: true, message: '변경된 항목이 없습니다.', severity: 'error' });
      return;
    }
    setPreviewOpen(true);
  };

  // Confirm save after preview
  const handleConfirmSave = async () => {
    try {
      setPreviewOpen(false);
      const diffPayload = generateDiffPayload(matrixState, permissionCodes.map((p) => p.value));
      
      await updateMutation.mutateAsync({
        roleId,
        payload: diffPayload,
      });
      
      // Update original state to current after successful save
      setMatrixState((prev) => ({
        original: new Map(prev.current),
        current: new Map(prev.current),
      }));
      
      setSnackbar({ open: true, message: '권한이 저장되었습니다.', severity: 'success' });
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (submitError) {
      setSnackbar({
        open: true,
        message: submitError instanceof Error ? submitError.message : '저장에 실패했습니다.',
        severity: 'error',
      });
    }
  };

  // Handle tree node toggle
  const handleToggleNode = (nodeId: string) => {
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

  // Handle expand/collapse all
  const handleExpandAll = () => {
    if (!resourcesTree) return;
    const allIds = new Set<string>();
    const collectIds = (nodes: typeof resourcesTree) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(resourcesTree);
    setExpandedNodes(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Bulk Apply: Apply to resource and children
  const handleApplyToChildren = (resourceKey: string, codes: string[], effect: 'ALLOW' | 'DENY') => {
    if (!resourcesTree) return;
    setMatrixState((prev) => applyToResourceAndChildren(prev, resourceKey, codes, effect, resourcesTree));
  };

  // Get resource type options from codes
  const resourceTypeOptions = useMemo(() => {
    const codes = getCodesByGroupFromMap(codeMap, 'RESOURCE_TYPE');
    return toSelectOptions(codes);
  }, [codeMap]);

  // Get change preview data (must be before early returns)
  const changePreview = useMemo(() => getChangePreview(matrixState, permissionCodes.map((p) => p.value)), [matrixState, permissionCodes]);

  // Check if 403 error
  const isForbidden = permissionsError && 'status' in permissionsError && (permissionsError as { status?: number }).status === 403;

  if (isLoading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle>권한 할당</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 3 }}>
            <Skeleton variant="rectangular" height={400} />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (isForbidden) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>권한 할당</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mt: 2 }}>
            권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>닫기</Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (permissionsError) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>권한 할당</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mt: 2 }}>
            권한 정보를 불러오는 중 오류가 발생했습니다: {permissionsError instanceof Error ? permissionsError.message : 'Unknown error'}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>닫기</Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Render resource tree node recursively
  const renderTreeNode = (node: ResourceNode, depth = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedResourceKey === node.resourceKey;
    const isChanged = changedResources.has(node.resourceKey);

    return (
      <Box key={node.id}>
        <Paper
          sx={{
            p: 1,
            mb: 0.5,
            border: '1px solid',
            borderColor: isSelected ? 'primary.main' : 'divider',
            bgcolor: isSelected ? 'action.selected' : undefined,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          onClick={() => setSelectedResourceKey(node.resourceKey)}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {hasChildren ? (
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleToggleNode(node.id); }}>
                <Iconify icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'} width={16} />
              </IconButton>
            ) : (
              <Box sx={{ width: 32 }} />
            )}
            <Stack sx={{ flex: 1 }} spacing={0.5}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="body2" fontWeight={isChanged ? 'bold' : 'normal'}>
                  {node.resourceName}
                </Typography>
                {isChanged && <Chip label="변경" size="small" color="warning" />}
                <Chip label={node.resourceType} size="small" variant="outlined" />
                {!node.enabled && <Chip label="비활성" size="small" color="default" />}
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {node.resourceKey}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 2 }}>
              {node.children!.map((child) => renderTreeNode(child, depth + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">권한 할당</Typography>
            {isDirty && (
              <Chip label="변경사항 있음" color="warning" size="small" sx={{ ml: 2 }} />
            )}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Left Panel: Resource Tree */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      placeholder="리소스 검색..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      sx={{ flex: 1 }}
                      InputProps={{
                        startAdornment: <Iconify icon="solar:magnifer-bold" width={20} sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                    <Tooltip title="전체 확장">
                      <IconButton size="small" onClick={handleExpandAll}>
                        <Iconify icon="solar:double-alt-arrow-down-bold" width={20} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="전체 축소">
                      <IconButton size="small" onClick={handleCollapseAll}>
                        <Iconify icon="solar:double-alt-arrow-up-bold" width={20} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <TextField
                    select
                    label="리소스 타입"
                    size="small"
                    value={resourceTypeFilter}
                    onChange={(e) => setResourceTypeFilter(e.target.value)}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="">전체</option>
                    {resourceTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </TextField>
                  <FormControlLabel
                    control={<Switch checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} size="small" />}
                    label="변경된 것만"
                  />
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {filteredTree && filteredTree.length > 0 ? (
                      <Stack spacing={0.5}>
                        {filteredTree.map((node) => renderTreeNode(node))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
                        {onlyChanged ? '변경된 리소스가 없습니다.' : '리소스가 없습니다.'}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            {/* Right Panel: Permission Matrix */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={2}>
                {/* Toolbar */}
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Iconify icon="solar:check-circle-bold" />}
                      onClick={() => handleSelectAll('ALLOW')}
                    >
                      전체 ALLOW
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Iconify icon="solar:close-circle-bold" />}
                      onClick={() => handleSelectAll('DENY')}
                    >
                      전체 DENY
                    </Button>
                  </Stack>
                </Paper>

                {/* Matrix Table */}
                <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                  {filteredResources.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
                      {onlyChanged ? '변경된 리소스가 없습니다.' : '리소스가 없습니다.'}
                    </Typography>
                  ) : (
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ minWidth: 200, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }}>
                            리소스
                          </TableCell>
                          {permissionCodes.map((perm) => (
                            <TableCell key={perm.value} align="center" sx={{ minWidth: 120 }}>
                              <Stack spacing={0.5} alignItems="center">
                                <Typography variant="caption" fontWeight="bold">
                                  {perm.label}
                                </Typography>
                                <Stack direction="row" spacing={0.5}>
                                  <Tooltip title="전체 ALLOW">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleColumnApply(perm.value, 'ALLOW')}
                                      sx={{ p: 0.5 }}
                                    >
                                      <Iconify icon="solar:check-circle-bold" width={16} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="전체 DENY">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleColumnApply(perm.value, 'DENY')}
                                      sx={{ p: 0.5 }}
                                    >
                                      <Iconify icon="solar:close-circle-bold" width={16} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </Stack>
                            </TableCell>
                          ))}
                          <TableCell sx={{ minWidth: 100, position: 'sticky', right: 0, bgcolor: 'background.paper', zIndex: 2 }}>
                            행 작업
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredResources.map((resource) => {
                          const resourcePerms = matrixState.current.get(resource.resourceKey) || new Map();
                          const isChanged = changedResources.has(resource.resourceKey);

                          return (
                            <TableRow
                              key={resource.id}
                              sx={{
                                bgcolor: isChanged ? 'action.selected' : undefined,
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            >
                              <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                                <Stack spacing={0.5}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2" fontWeight={isChanged ? 'bold' : 'normal'}>
                                      {resource.resourceName}
                                    </Typography>
                                    {isChanged && <Chip label="변경" size="small" color="warning" />}
                                    {!resource.enabled && <Chip label="비활성" size="small" color="default" />}
                                  </Stack>
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {resource.resourceKey}
                                  </Typography>
                                  <Stack direction="row" spacing={0.5}>
                                    <Chip label={resource.resourceType} size="small" variant="outlined" />
                                  </Stack>
                                </Stack>
                              </TableCell>
                              {permissionCodes.map((perm) => {
                                const effect = resourcePerms.get(perm.value) || 'NONE';

                                return (
                                  <TableCell key={perm.value} align="center">
                                    <Tooltip title={effect === 'NONE' ? 'NONE (클릭하여 변경)' : effect === 'ALLOW' ? 'ALLOW' : 'DENY'}>
                                      <IconButton
                                        size="small"
                                        onClick={() => handleTogglePermission(resource.resourceKey, perm.value)}
                                        color={effect === 'ALLOW' ? 'success' : effect === 'DENY' ? 'error' : 'default'}
                                        sx={{
                                          border: '1px solid',
                                          borderColor: effect === 'NONE' ? 'divider' : effect === 'ALLOW' ? 'success.main' : 'error.main',
                                          bgcolor: effect === 'NONE' ? 'transparent' : effect === 'ALLOW' ? 'success.lighter' : 'error.lighter',
                                          '&:hover': {
                                            bgcolor: effect === 'NONE' ? 'action.hover' : effect === 'ALLOW' ? 'success.light' : 'error.light',
                                          },
                                        }}
                                      >
                                        {effect === 'ALLOW' ? (
                                          <Iconify icon="solar:check-circle-bold" width={20} />
                                        ) : effect === 'DENY' ? (
                                          <Iconify icon="solar:close-circle-bold" width={20} />
                                        ) : (
                                          <Iconify icon="solar:minus-circle-bold" width={20} />
                                        )}
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                );
                              })}
                              <TableCell sx={{ position: 'sticky', right: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                                <RowActionMenu
                                  resource={resource}
                                  permissionCodes={permissionCodes}
                                  resourcesTree={resourcesTree}
                                  onRowApply={handleRowApply}
                                  onSetPermission={handleSetPermission}
                                  onApplyToChildren={handleApplyToChildren}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>취소</Button>
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={!isDirty || updateMutation.isPending}
          >
            초기화
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!isDirty || updateMutation.isPending}
            startIcon={<Iconify icon="solar:diskette-bold" />}
          >
            저장 {isDirty && `(${changedResources.size}개 변경)`}
          </Button>
        </DialogActions>
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
      </Dialog>

      {/* Change Preview Modal */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>변경사항 확인</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              <Stack spacing={1}>
                <Typography variant="body2">
                  총 <strong>{changePreview.length}개</strong>의 변경사항이 있습니다.
                </Typography>
                <Typography variant="body2">
                  변경된 리소스: <strong>{changedResources.size}개</strong>
                </Typography>
                <Typography variant="body2">
                  저장하시겠습니까?
                </Typography>
              </Stack>
            </Alert>
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 200 }}>리소스</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>권한 코드</TableCell>
                    <TableCell align="center" sx={{ minWidth: 100 }}>변경 전</TableCell>
                    <TableCell align="center" sx={{ minWidth: 100 }}>변경 후</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {changePreview.slice(0, 20).map((change, idx) => (
                    <TableRow key={`${change.resourceKey}-${change.permissionCode}-${idx}`}>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" fontWeight="medium">
                            {flattenedResources.find((r) => r.resourceKey === change.resourceKey)?.resourceName || change.resourceKey}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {change.resourceKey}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{change.permissionCode}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={change.from}
                          size="small"
                          color={change.from === 'ALLOW' ? 'success' : change.from === 'DENY' ? 'error' : 'default'}
                          variant={change.from === 'NONE' ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={change.to}
                          size="small"
                          color={change.to === 'ALLOW' ? 'success' : change.to === 'DENY' ? 'error' : 'default'}
                          variant={change.to === 'NONE' ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {changePreview.length > 20 && (
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, textAlign: 'center', display: 'block' }}>
                  ... 외 {changePreview.length - 20}개 더
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleConfirmSave} disabled={updateMutation.isPending}>
            저장 확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unsaved Changes Guard Dialog */}
      <Dialog open={pendingClose} onClose={() => setPendingClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle>저장하지 않고 이동하시겠습니까?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1 }}>
            변경사항이 저장되지 않았습니다. 정말로 이동하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingClose(false)}>취소</Button>
          <Button
            variant="outlined"
            onClick={() => {
              setPendingClose(false);
              handleReset();
              onClose();
            }}
          >
            저장하지 않고 이동
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              setPendingClose(false);
              await handleConfirmSave();
              onClose();
            }}
            disabled={updateMutation.isPending}
          >
            저장 후 이동
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
