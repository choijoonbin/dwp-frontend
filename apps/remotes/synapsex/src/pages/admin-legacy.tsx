import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Label, Iconify, PermissionGate } from '@dwp-frontend/design-system';
import {
  getResourceKeyForPath,
  setTenantIdOverride,
  useAdminTenantsQuery,
  useAdminUsersQuery,
  useGovernanceConfigQuery,
  usePatchGovernanceConfigMutation,
  type GovernanceConfigItem,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import { PiiEncryptionTab } from './admin/tabs/pii';
import { TenantScopeTab } from './admin/tenant-scope';

// 페이지 권한: pathname-to-page에서 menu.governance-config.admin VIEW로 가드됨.
// 탭/버튼 제어: PermissionGate(resourceKey, USE|EDIT|APPROVE|EXECUTE) 사용.
const ADMIN_RESOURCE_KEY = getResourceKeyForPath('admin') ?? 'menu.governance-config.admin';

// ----------------------------------------------------------------------

export const SynapseAdminPage = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [tenantId, setTenantId] = useState<string>('');
  const [userPage, setUserPage] = useState(0);
  const [userPageSize, setUserPageSize] = useState(20);

  const { data: tenantsData } = useAdminTenantsQuery();
  const tenants = useMemo(() => tenantsData ?? [], [tenantsData]);

  useEffect(() => {
    if (tenants.length > 0 && !tenantId) {
      const firstId = String(tenants[0].id);
      setTenantId(firstId);
      setTenantIdOverride(firstId);
    }
  }, [tenants, tenantId]);

  const handleTenantChange = (newTenantId: string) => {
    setTenantId(newTenantId);
    setTenantIdOverride(newTenantId);
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['synapse', 'admin'] });
  };

  const { data: usersData, isLoading: usersLoading, error: usersError } = useAdminUsersQuery({
    appCode: 'SYNAPSEX',
    page: userPage + 1,
    size: userPageSize,
    keyword: q.trim() || undefined,
  });

  const userRows = usersData?.items ?? [];
  const userTotal = usersData?.totalItems ?? usersData?.total ?? 0;

  const { data: governanceConfigList, isLoading: governanceLoading } = useGovernanceConfigQuery({
    enabled: tab === 0,
  });
  const patchGovernanceMutation = usePatchGovernanceConfigMutation();

  const miniStatValues = useMemo(() => {
    const fallback = { rbac: 'Role-based', sod: 'Enforced', savedViews: 'Org-scoped' };
    const configured = { rbac: false, sod: false, savedViews: false };
    if (!governanceConfigList?.length) return { ...fallback, configured };
    const getLabel = (item: { currentValue: string; options?: { code: string; name: string }[] }) =>
      item.options?.find((o) => o.code === item.currentValue)?.name ?? item.currentValue;
    const byKey = Object.fromEntries(governanceConfigList.map((c) => [c.configKey, c]));
    const savedViewsItem =
      byKey.UX_SAVED_VIEWS_SCOPE ??
      byKey.SECURITY_SAVED_VIEWS_SCOPE ??
      byKey.SAVED_VIEWS_SCOPE;
    const hasValue = (item: GovernanceConfigItem | undefined) =>
      !!(item?.currentValue?.trim?.());

    return {
      rbac: byKey.SECURITY_ACCESS_MODEL ? getLabel(byKey.SECURITY_ACCESS_MODEL) : fallback.rbac,
      sod: byKey.SECURITY_SOD_MODE ? getLabel(byKey.SECURITY_SOD_MODE) : fallback.sod,
      savedViews: savedViewsItem ? getLabel(savedViewsItem) : fallback.savedViews,
      configured: {
        rbac: hasValue(byKey.SECURITY_ACCESS_MODEL),
        sod: hasValue(byKey.SECURITY_SOD_MODE),
        savedViews: hasValue(savedViewsItem),
      },
    };
  }, [governanceConfigList]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Page Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          flexWrap="wrap"
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Admin
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Tenant setup, access control, and data protection policies.
            </Typography>
          </Box>

          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
            <FormControl sx={{ minWidth: 220 }}>
              <Select
                value={tenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Tenant 선택
                </MenuItem>
                {tenants.map((t) => (
                  <MenuItem key={t.id} value={String(t.id)}>
                    {t.name} {t.domain ? `(${t.domain})` : `(${t.id})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <PermissionGate resource={ADMIN_RESOURCE_KEY} permission="USE">
              <Button variant="contained" startIcon={<Iconify icon="solar:user-plus-bold" width={18} />}>
                Invite User
              </Button>
            </PermissionGate>
          </Stack>
        </Stack>

        {/* Main Card */}
        <Card variant="outlined">
          <CardHeader
            title={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Iconify icon="solar:settings-bold-duotone" width={20} sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Administration Console
                </Typography>
              </Stack>
            }
            subheader="RBAC + SoD, tenant/company/currency scope, and PII masking."
            action={
              <TextField
                size="small"
                placeholder="Search users..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ width: 280 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="solar:magnifer-bold" width={18} sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
            }
            sx={{ pb: 2 }}
          />
          <CardContent>
            <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab
                icon={<Iconify icon="solar:users-group-rounded-bold-duotone" width={18} />}
                iconPosition="start"
                label="Users"
                sx={{ minHeight: 64 }}
              />
              <Tab
                icon={<Iconify icon="solar:global-bold-duotone" width={18} />}
                iconPosition="start"
                label="Tenant Scope"
                sx={{ minHeight: 64 }}
              />
              <Tab
                icon={<Iconify icon="solar:lock-password-bold-duotone" width={18} />}
                iconPosition="start"
                label="PII & Encryption"
                sx={{ minHeight: 64 }}
              />
            </Tabs>

            {/* Users Tab — GET /api/admin/users?appCode=SYNAPSEX (Auth API) */}
            <TabPanel value={tab} index={0}>
              <Box sx={{ mt: 3 }}>
                {usersError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    사용자 목록을 불러오지 못했습니다. 권한(menu.admin.users VIEW) 및 API 연결을 확인하세요.
                  </Alert>
                )}
                {usersLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>MFA</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Last login</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {userRows.map((u) => (
                            <TableRow key={u.id ?? String(u.comUserId ?? '')}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {u.userName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {u.email ?? '-'} • U-{u.comUserId ?? u.id}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Iconify icon="solar:shield-check-bold-duotone" width={16} sx={{ color: 'text.secondary' }} />
                                  <Typography variant="body2">
                                    {u.roles?.length ? u.roles.map((r) => r.roleName).join(', ') : '-'}
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Label
                                  color={
                                    u.status === 'ACTIVE' ? 'success' : u.status === 'INVITED' ? 'info' : 'default'
                                  }
                                  variant="soft"
                                >
                                  {u.status}
                                </Label>
                              </TableCell>
                              <TableCell>
                                <Label
                                  color={u.mfaEnabled ? 'success' : 'warning'}
                                  variant="soft"
                                >
                                  {u.mfaEnabled ? 'Enabled' : 'Off'}
                                </Label>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {formatDateMaybe(u.lastLoginAt ?? '')}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                          {userRows.length === 0 && !usersLoading && (
                            <TableRow>
                              <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                <Typography variant="body2" color="text.secondary">
                                  사용자가 없습니다.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <TablePagination
                      component="div"
                      count={userTotal}
                      page={userPage}
                      onPageChange={(_, newPage) => setUserPage(newPage)}
                      rowsPerPage={userPageSize}
                      onRowsPerPageChange={(e) => {
                        setUserPageSize(parseInt(e.target.value, 10));
                        setUserPage(0);
                      }}
                      rowsPerPageOptions={[10, 20, 50]}
                      labelRowsPerPage="행 수:"
                    />
                  </>
                )}

                <Divider sx={{ my: 3 }} />

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                    gap: 2,
                  }}
                >
                  <MiniStat
                    icon="solar:shield-check-bold-duotone"
                    label="RBAC"
                    value={governanceLoading ? '…' : miniStatValues.rbac}
                    isConfigured={miniStatValues.configured?.rbac}
                  />
                  <MiniStat
                    icon="solar:key-bold-duotone"
                    label="SoD"
                    value={governanceLoading ? '…' : miniStatValues.sod}
                    isConfigured={miniStatValues.configured?.sod}
                  />
                  <MiniStat
                    icon="solar:filter-bold-duotone"
                    label="Saved Views"
                    value={governanceLoading ? '…' : miniStatValues.savedViews}
                    isConfigured={miniStatValues.configured?.savedViews}
                  />
                </Box>

                {/* API (ADMIN 전용): GET /api/synapse/admin/governance-config, PATCH .../governance-config/{configKey} */}
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  API (ADMIN 전용) — 거버넌스 설정
                </Typography>
                {governanceLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : governanceConfigList && governanceConfigList.length > 0 ? (
                  <Stack spacing={2}>
                    {governanceConfigList.map((item) => (
                      <GovernanceConfigRow
                        key={item.configKey}
                        item={item}
                        isUpdating={patchGovernanceMutation.isPending}
                        onValueChange={(value) => {
                          patchGovernanceMutation.mutate({
                            configKey: item.configKey,
                            payload: { value },
                          });
                        }}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    거버넌스 설정이 없습니다.
                  </Typography>
                )}
              </Box>
            </TabPanel>

            {/* Tenant Scope Tab — GET/PATCH /api/synapse/admin/tenant-scope */}
            <TabPanel value={tab} index={1}>
              <TenantScopeTab />
            </TabPanel>

            {/* PII & Encryption Tab — GET/PUT /api/synapse/admin/pii-*, data-protection */}
            <TabPanel value={tab} index={2}>
              <PiiEncryptionTab />
            </TabPanel>

            <Divider sx={{ my: 3 }} />

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                {tenantId
                  ? `${tenants.find((t) => String(t.id) === tenantId)?.name ?? tenantId} • `
                  : ''}
                Admin console
              </Typography>
              <Chip
                icon={<Iconify icon="solar:lock-password-bold" width={14} />}
                label="audit-ready"
                variant="outlined"
                size="small"
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

// ----------------------------------------------------------------------

function formatDateMaybe(v: string) {
  if (v === '-' || !v) return '-';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function MiniStat({
  icon,
  label,
  value,
  isConfigured,
}: {
  icon: string;
  label: string;
  value: string;
  isConfigured?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: 1,
        borderColor: isConfigured ? 'success.main' : 'divider',
        bgcolor: isConfigured ? 'success.main' + '08' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Iconify icon={icon} width={16} sx={{ color: 'text.secondary' }} />
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
      </Stack>
      {isConfigured && (
        <Label color="success" variant="soft" sx={{ fontSize: 10 }}>
          활성화됨
        </Label>
      )}
    </Box>
  );
}

/** 거버넌스 설정 한 행: 그룹명·현재값·옵션 셀렉트 → PATCH로 값 변경 */
function GovernanceConfigRow({
  item,
  isUpdating,
  onValueChange,
}: {
  item: GovernanceConfigItem;
  isUpdating: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {item.groupName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {item.configKey} · 현재: {item.currentValue}
        </Typography>
      </Box>
      <FormControl size="small" sx={{ minWidth: 160 }} disabled={isUpdating || !item.options?.length}>
        <Select
          value={item.currentValue}
          onChange={(e) => onValueChange(e.target.value)}
          displayEmpty
          renderValue={(v) => item.options?.find((o) => o.code === v)?.name ?? v ?? '-'}
        >
          {item.options?.map((opt) => (
            <MenuItem key={opt.code} value={opt.code}>
              {opt.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

// TabPanel helper component
function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ width: '100%' }}>
      {value === index && children}
    </Box>
  );
}
