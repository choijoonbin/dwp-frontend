import { Iconify } from '@dwp-frontend/design-system';
import { PermissionGate } from '@dwp-frontend/design-system';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { PermissionRouteGuard, useCodesByResourceQuery, getCodesByGroupFromMap, toSelectOptions } from '@dwp-frontend/shared-utils';
import {
  useAdminRolesQuery,
  useCreateAdminRoleMutation,
  useUpdateAdminRoleMutation,
  useDeleteAdminRoleMutation,
  useAdminRoleMembersQuery,
  useUpdateAdminRoleMembersMutation,
  useAdminRolePermissionsQuery,
  useUpdateAdminRolePermissionsMutation,
  useAdminUsersQuery,
  useAdminResourcesTreeQuery,
  useAdminRoleDetailQuery,
  type RoleSummary,
  type ResourceNode,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Checkbox from '@mui/material/Checkbox';
import ListItem from '@mui/material/ListItem';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

export const RolesPage = () => (
  <PermissionRouteGuard resource="menu.admin.roles" permission="VIEW" redirectTo="/403">
    <RolesPageContent />
  </PermissionRouteGuard>
);

const RolesPageContent = () => {
  const [keyword, setKeyword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleSummary | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const params = useMemo(
    () => ({
      size: 1000, // Get all roles for left sidebar
      keyword: keyword || undefined,
    }),
    [keyword]
  );

  const { data: rolesData, isLoading, error, refetch } = useAdminRolesQuery(params);
  const createMutation = useCreateAdminRoleMutation();
  const updateMutation = useUpdateAdminRoleMutation();
  const deleteMutation = useDeleteAdminRoleMutation();

  const handleCreate = () => {
    setSelectedRole(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (role: RoleSummary) => {
    setSelectedRole(role);
    setEditDialogOpen(true);
  };

  const handleDelete = (role: RoleSummary) => {
    setSelectedRole(role);
    setDeleteDialogOpen(true);
  };

  const handleRoleSelect = (roleId: string) => {
    setSelectedRoleId(roleId);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const filteredRoles = useMemo(() => {
    if (!rolesData?.items) return [];
    return rolesData.items;
  }, [rolesData]);

  return (
  <Box sx={{ p: 3 }}>
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">권한 그룹 관리</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          역할(Role) 및 권한 그룹을 관리합니다.
        </Typography>
      </Stack>

        {/* Filter Bar */}
        <Card sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="검색 (역할명/코드)"
              size="small"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              sx={{ flex: 1 }}
            />
            <PermissionGate resource="menu.admin.roles" permission="CREATE">
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleCreate}>
                역할 추가
              </Button>
            </PermissionGate>
          </Stack>
        </Card>

        {/* Main Content: Left List + Right Detail */}
        <Grid container spacing={2}>
          {/* Left: Roles List */}
          <Grid item xs={12} md={4}>
            <Card>
              {error && (
                <Alert severity="error" sx={{ m: 2 }}>
                  데이터를 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : 'Unknown error'}
                </Alert>
              )}

              {isLoading ? (
                <Box sx={{ p: 2 }}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Skeleton key={idx} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
                  ))}
                </Box>
              ) : filteredRoles.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    데이터가 없습니다.
                  </Typography>
                </Box>
              ) : (
                <List>
                  {filteredRoles.map((role) => (
                    <ListItem key={role.id} disablePadding>
                      <ListItemButton
                        selected={selectedRoleId === role.id}
                        onClick={() => handleRoleSelect(role.id)}
                        sx={{
                          borderLeft: selectedRoleId === role.id ? 3 : 0,
                          borderColor: 'primary.main',
                        }}
                      >
                        <ListItemText
                          primary={role.roleName}
                          secondary={
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {role.roleCode}
                              </Typography>
                              <Chip
                                label={role.status === 'ACTIVE' ? '활성' : '비활성'}
                                color={role.status === 'ACTIVE' ? 'success' : 'default'}
                                size="small"
                                sx={{ height: 18 }}
                              />
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Card>
          </Grid>

          {/* Right: Role Detail */}
          <Grid item xs={12} md={8}>
            {selectedRoleId ? (
              <RoleDetailView
                roleId={selectedRoleId}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSuccess={() => {
                  refetch();
                  showSnackbar('변경사항이 저장되었습니다.');
                }}
              />
            ) : (
              <Card sx={{ p: 3 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  좌측에서 역할을 선택하세요.
                </Typography>
              </Card>
            )}
          </Grid>
        </Grid>
      </Stack>

      {/* Create/Edit Dialog */}
      <RoleDialog
        open={createDialogOpen || editDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
        }}
        role={selectedRole}
        onSuccess={() => {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
          refetch();
          showSnackbar(selectedRole ? '역할이 수정되었습니다.' : '역할이 생성되었습니다.');
        }}
      />

      {/* Delete Dialog */}
      {selectedRole && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title="역할 삭제"
          content={`정말 "${selectedRole.roleName}" 역할을 삭제하시겠습니까?`}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(selectedRole.id);
              setDeleteDialogOpen(false);
              refetch();
              if (selectedRoleId === selectedRole.id) {
                setSelectedRoleId(null);
              }
              showSnackbar('역할이 삭제되었습니다.');
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
// Role Detail View
// ----------------------------------------------------------------------

type RoleDetailViewProps = {
  roleId: string;
  onEdit: (role: RoleSummary) => void;
  onDelete: (role: RoleSummary) => void;
  onSuccess: () => void;
};

const RoleDetailView = ({ roleId, onEdit, onDelete, onSuccess }: RoleDetailViewProps) => {
  const { data: roleDetail, isLoading } = useAdminRoleDetailQuery(roleId);
  const { data: roleMembers, isLoading: membersLoading } = useAdminRoleMembersQuery(roleId);
  const { data: rolePermissions, isLoading: permissionsLoading } = useAdminRolePermissionsQuery(roleId);

  if (isLoading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={200} />
      </Card>
    );
  }

  if (!roleDetail) {
    return (
      <Card sx={{ p: 3 }}>
        <Alert severity="error">역할 정보를 불러올 수 없습니다.</Alert>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Role Info */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">{roleDetail.roleName}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {roleDetail.roleCode}
              </Typography>
              <Chip
                label={roleDetail.status === 'ACTIVE' ? '활성' : '비활성'}
                color={roleDetail.status === 'ACTIVE' ? 'success' : 'default'}
                size="small"
              />
            </Stack>
            {roleDetail.description && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                {roleDetail.description}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <PermissionGate resource="menu.admin.roles" permission="UPDATE">
              <Button size="small" startIcon={<Iconify icon="solar:pen-bold" />} onClick={() => onEdit(roleDetail)}>
                편집
              </Button>
            </PermissionGate>
            <PermissionGate resource="menu.admin.roles" permission="DELETE">
              <Button
                size="small"
                color="error"
                startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                onClick={() => onDelete(roleDetail)}
              >
                삭제
              </Button>
            </PermissionGate>
          </Stack>
        </Stack>
      </Card>

      {/* Members */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1">멤버</Typography>
          <PermissionGate resource="menu.admin.roles" permission="MANAGE">
            <RoleMembersSection roleId={roleId} onSuccess={onSuccess} />
          </PermissionGate>
        </Stack>
        {membersLoading ? (
          <Skeleton variant="rectangular" height={100} />
        ) : roleMembers && roleMembers.length > 0 ? (
          <Stack spacing={1}>
            {roleMembers.map((member) => (
              <Typography key={member.id} variant="body2">
                {member.userName}
                {member.email && ` (${member.email})`}
              </Typography>
            ))}
          </Stack>
        ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            멤버가 없습니다.
        </Typography>
        )}
      </Card>

      {/* Permissions */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1">권한</Typography>
          <PermissionGate resource="menu.admin.roles" permission="MANAGE">
            <RolePermissionsSection roleId={roleId} onSuccess={onSuccess} />
          </PermissionGate>
        </Stack>
        {permissionsLoading ? (
          <Skeleton variant="rectangular" height={200} />
        ) : (
          <RolePermissionsMatrix roleId={roleId} onSuccess={onSuccess} />
        )}
      </Card>
    </Stack>
  );
};

// ----------------------------------------------------------------------
// Role Members Section
// ----------------------------------------------------------------------

type RoleMembersSectionProps = {
  roleId: string;
  onSuccess: () => void;
};

const RoleMembersSection = ({ roleId, onSuccess }: RoleMembersSectionProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: roleMembers } = useAdminRoleMembersQuery(roleId);
  const { data: allUsers } = useAdminUsersQuery({ size: 1000 });
  const updateMutation = useUpdateAdminRoleMembersMutation();

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (roleMembers) {
      setSelectedUserIds(new Set(roleMembers.map((u) => u.id)));
    }
  }, [roleMembers]);

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      await updateMutation.mutateAsync({
        roleId,
        payload: {
          userIds: Array.from(selectedUserIds),
        },
      });
      setDialogOpen(false);
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <>
      <Button size="small" startIcon={<Iconify icon="solar:users-group-rounded-bold" />} onClick={() => setDialogOpen(true)}>
        관리
      </Button>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>멤버 할당</DialogTitle>
        <DialogContent>
          <Box sx={{ maxHeight: 400, overflow: 'auto', mt: 2 }}>
            {allUsers?.items.map((user) => (
              <FormControlLabel
                key={user.id}
                control={<Checkbox checked={selectedUserIds.has(user.id)} onChange={() => handleToggleUser(user.id)} />}
                label={`${user.userName}${user.email ? ` (${user.email})` : ''}`}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={updateMutation.isPending}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ----------------------------------------------------------------------
// Role Permissions Section
// ----------------------------------------------------------------------

type RolePermissionsSectionProps = {
  roleId: string;
  onSuccess: () => void;
};

const RolePermissionsSection = ({ roleId, onSuccess }: RolePermissionsSectionProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button size="small" startIcon={<Iconify icon="solar:shield-check-bold" />} onClick={() => setDialogOpen(true)}>
        관리
      </Button>
      <RolePermissionsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} roleId={roleId} onSuccess={onSuccess} />
    </>
  );
};

// ----------------------------------------------------------------------
// Role Permissions Matrix
// ----------------------------------------------------------------------

type RolePermissionsMatrixProps = {
  roleId: string;
  onSuccess: () => void;
};

const RolePermissionsMatrix = ({ roleId, onSuccess }: RolePermissionsMatrixProps) => {
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
        roleId={roleId}
        onSuccess={onSuccess}
      />
    </Box>
  );
};

// ----------------------------------------------------------------------
// Resource Tree View (Optimized with lazy expand)
// ----------------------------------------------------------------------

type ResourceTreeViewProps = {
  nodes: ResourceNode[];
  permissionMap: Map<string, Set<string>>;
  permissionCodes: Array<{ value: string; label: string }>;
  roleId: string;
  onSuccess: () => void;
};

const ResourceTreeView = ({ nodes, permissionMap, permissionCodes, roleId, onSuccess }: ResourceTreeViewProps) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchKeyword, setSearchKeyword] = useState('');

  const toggleNode = useCallback((nodeId: string) => {
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

  // Filter tree based on search keyword
  const filteredNodes = useMemo(() => {
    if (!searchKeyword) return nodes;
    return filterResourceTree(nodes, searchKeyword);
  }, [nodes, searchKeyword]);

  return (
    <Stack spacing={1}>
      <TextField
        size="small"
        placeholder="리소스 검색..."
        value={searchKeyword}
        onChange={(e) => setSearchKeyword(e.target.value)}
        InputProps={{
          startAdornment: <Iconify icon="solar:magnifer-bold" width={20} sx={{ mr: 1, color: 'text.secondary' }} />,
        }}
      />
      {filteredNodes.map((node) => (
        <ResourceTreeNode
          key={node.id}
          node={node}
          permissionMap={permissionMap}
          permissionCodes={permissionCodes}
          expandedNodes={expandedNodes}
          onToggle={toggleNode}
          roleId={roleId}
          onSuccess={onSuccess}
        />
      ))}
    </Stack>
  );
};

// ----------------------------------------------------------------------
// Resource Tree Node (Lazy expand)
// ----------------------------------------------------------------------

type ResourceTreeNodeProps = {
  node: ResourceNode;
  permissionMap: Map<string, Set<string>>;
  permissionCodes: Array<{ value: string; label: string }>;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  roleId: string;
  onSuccess: () => void;
};

const ResourceTreeNode = ({
  node,
  permissionMap,
  permissionCodes,
  expandedNodes,
  onToggle,
  roleId,
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
                  onSuccess={onSuccess}
                />
              ))}
            </Box>
          </Collapse>
        )}
      </Stack>
    </Paper>
  );
};

// ----------------------------------------------------------------------
// Permission Checkbox Component
// ----------------------------------------------------------------------

type PermissionCheckboxProps = {
  resourceKey: string;
  permissionCode: string;
  roleId: string;
  checked: boolean;
  permissionMap: Map<string, Set<string>>;
  onSuccess: () => void;
  label: string;
};

const PermissionCheckbox = ({
  resourceKey,
  permissionCode,
  roleId,
  checked,
  permissionMap,
  onSuccess,
  label,
}: PermissionCheckboxProps) => {
  const updateMutation = useUpdateAdminRolePermissionsMutation();

  const handleToggle = async () => {
    const newMap = new Map(permissionMap);
    const codes = newMap.get(resourceKey) || new Set<string>();
    const newCodes = new Set(codes);

    if (newCodes.has(permissionCode)) {
      newCodes.delete(permissionCode);
    } else {
      newCodes.add(permissionCode);
    }

    if (newCodes.size === 0) {
      newMap.delete(resourceKey);
    } else {
      newMap.set(resourceKey, newCodes);
    }

    const permissions = Array.from(newMap.entries()).map(([key, permissionCodesSet]) => ({
      resourceKey: key,
      permissionCodes: Array.from(permissionCodesSet),
    }));

    try {
      await updateMutation.mutateAsync({
        roleId,
        payload: { permissions },
      });
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <FormControlLabel
      control={<Checkbox checked={checked} onChange={handleToggle} size="small" disabled={updateMutation.isPending} />}
      label={label}
    />
  );
};

// ----------------------------------------------------------------------
// Role Permissions Dialog (Full screen for editing)
// ----------------------------------------------------------------------

type RolePermissionsDialogProps = {
  open: boolean;
  onClose: () => void;
  roleId: string;
  onSuccess: () => void;
};

const RolePermissionsDialog = ({ open, onClose, roleId, onSuccess }: RolePermissionsDialogProps) => {
  const { data: rolePermissions } = useAdminRolePermissionsQuery(roleId);
  const { data: resourcesTree } = useAdminResourcesTreeQuery();
  const { data: codeMap } = useCodesByResourceQuery('menu.admin.roles');
  const updateMutation = useUpdateAdminRolePermissionsMutation();

  // Get permission codes from Code API
  const permissionCodes = useMemo(() => {
    const codes = getCodesByGroupFromMap(codeMap, 'PERMISSION_CODE');
    return toSelectOptions(codes);
  }, [codeMap]);

  const [permissionMap, setPermissionMap] = useState<Map<string, Set<string>>>(new Map());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => {
    if (rolePermissions) {
      const map = new Map<string, Set<string>>();
      rolePermissions.permissions.forEach((perm) => {
        map.set(perm.resourceKey, new Set(perm.permissionCodes));
      });
      setPermissionMap(map);
    }
  }, [rolePermissions]);

  const toggleNode = useCallback((nodeId: string) => {
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

  const handleTogglePermission = (resourceKey: string, permissionCode: string) => {
    setPermissionMap((prev) => {
      const next = new Map(prev);
      const codes = next.get(resourceKey) || new Set<string>();
      const newCodes = new Set(codes);
      if (newCodes.has(permissionCode)) {
        newCodes.delete(permissionCode);
      } else {
        newCodes.add(permissionCode);
      }
      if (newCodes.size === 0) {
        next.delete(resourceKey);
      } else {
        next.set(resourceKey, newCodes);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      const permissions = Array.from(permissionMap.entries()).map(([resourceKey, codes]) => ({
        resourceKey,
        permissionCodes: Array.from(codes),
      }));

      await updateMutation.mutateAsync({
        roleId,
        payload: {
          permissions,
        },
      });
      onSuccess();
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const filteredTree = useMemo(() => {
    if (!resourcesTree || !searchKeyword) return resourcesTree || [];
    return filterResourceTree(resourcesTree, searchKeyword);
  }, [resourcesTree, searchKeyword]);

  const renderResourceTree = (nodes: ResourceNode[], depth = 0) => {
    if (!nodes || nodes.length === 0) return null;

    return (
      <Stack spacing={1}>
        {nodes.map((node) => {
          const hasChildren = node.children && node.children.length > 0;
          const isExpanded = expandedNodes.has(node.id);
          const grantedCodes = permissionMap.get(node.resourceKey) || new Set<string>();

          return (
            <Box key={node.id}>
              <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {hasChildren && (
                      <IconButton size="small" onClick={() => toggleNode(node.id)}>
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
                        <FormControlLabel
                          key={perm.value}
                          control={
                            <Checkbox
                              checked={grantedCodes.has(perm.value)}
                              onChange={() => handleTogglePermission(node.resourceKey, perm.value)}
                              size="small"
                            />
                          }
                          label={perm.label}
                        />
                      ))
                    ) : (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        코드 매핑 필요
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Paper>
              {hasChildren && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 4, pt: 1 }}>
                    {renderResourceTree(node.children!, depth + 1)}
                  </Box>
                </Collapse>
              )}
            </Box>
          );
        })}
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>권한 할당</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            size="small"
            placeholder="리소스 검색..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            InputProps={{
              startAdornment: <Iconify icon="solar:magnifer-bold" width={20} sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
          <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
            {filteredTree && filteredTree.length > 0 ? (
              renderResourceTree(filteredTree)
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                리소스가 없습니다.
              </Typography>
            )}
  </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={updateMutation.isPending}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// Filter Resource Tree
// ----------------------------------------------------------------------

const filterResourceTree = (tree: ResourceNode[], keyword: string): ResourceNode[] => {
  if (!keyword) return tree;

  const filterNode = (node: ResourceNode): ResourceNode | null => {
    const matchesKeyword =
      node.resourceName.toLowerCase().includes(keyword.toLowerCase()) ||
      node.resourceKey.toLowerCase().includes(keyword.toLowerCase());

    const filteredChildren = node.children ? node.children.map(filterNode).filter((n): n is ResourceNode => n !== null) : [];

    if (matchesKeyword) {
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
// Role Dialog
// ----------------------------------------------------------------------

type RoleDialogProps = {
  open: boolean;
  onClose: () => void;
  role: RoleSummary | null;
  onSuccess: () => void;
};

const RoleDialog = ({ open, onClose, role, onSuccess }: RoleDialogProps) => {
  const [formData, setFormData] = useState({
    roleName: '',
    roleCode: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const createMutation = useCreateAdminRoleMutation();
  const updateMutation = useUpdateAdminRoleMutation();

  useEffect(() => {
    if (role) {
      setFormData({
        roleName: role.roleName,
        roleCode: role.roleCode,
        description: role.description || '',
        status: role.status,
      });
    } else {
      setFormData({
        roleName: '',
        roleCode: '',
        description: '',
        status: 'ACTIVE',
      });
    }
  }, [role]);

  const handleSubmit = async () => {
    try {
      if (role) {
        await updateMutation.mutateAsync({
          roleId: role.id,
          payload: {
            roleName: formData.roleName,
            roleCode: formData.roleCode,
            description: formData.description || undefined,
            status: formData.status,
          },
        });
      } else {
        await createMutation.mutateAsync({
          roleName: formData.roleName,
          roleCode: formData.roleCode,
          description: formData.description || undefined,
          status: formData.status,
        });
      }
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{role ? '역할 편집' : '역할 추가'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="역할명 *"
            fullWidth
            value={formData.roleName}
            onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
            required
          />
          <TextField
            label="역할 코드 *"
            fullWidth
            value={formData.roleCode}
            onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
            required
            disabled={!!role}
          />
          <TextField
            label="설명"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            select
            label="상태"
            fullWidth
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
          >
            <MenuItem value="ACTIVE">활성</MenuItem>
            <MenuItem value="INACTIVE">비활성</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.roleName || !formData.roleCode || (createMutation.isPending || updateMutation.isPending)}
        >
          {role ? '저장' : '생성'}
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
