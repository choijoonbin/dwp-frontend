import { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify, PermissionGate } from '@dwp-frontend/design-system';
import {
  useAdminUsersQuery,
  setTenantIdOverride,
  useAdminTenantsQuery,
  getResourceKeyForPath,
  useGovernanceConfigQuery,
  type GovernanceConfigItem,
  usePatchGovernanceConfigMutation,
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
  const { t } = useTranslation('common');
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
              {t('adminPage.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('adminPage.description')}
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
                  {t('adminPage.selectTenant')}
                </MenuItem>
                {tenants.map((tenant) => (
                  <MenuItem key={tenant.id} value={String(tenant.id)}>
                    {tenant.name} {tenant.domain ? `(${tenant.domain})` : `(${tenant.id})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <PermissionGate resource={ADMIN_RESOURCE_KEY} permission="USE">
              <Button variant="contained" startIcon={<Iconify icon="solar:user-plus-bold" width={18} />}>
                {t('adminPage.inviteUser')}
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
                  {t('adminPage.adminConsole')}
                </Typography>
              </Stack>
            }
            subheader={t('adminPage.adminConsoleDesc')}
            action={
              <TextField
                size="small"
                placeholder={t('adminPage.searchUsers')}
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
                label={t('adminPage.tabs.users')}
                sx={{ minHeight: 64 }}
              />
              <Tab
                icon={<Iconify icon="solar:global-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('adminPage.tabs.tenantScope')}
                sx={{ minHeight: 64 }}
              />
              <Tab
                icon={<Iconify icon="solar:lock-password-bold-duotone" width={18} />}
                iconPosition="start"
                label={t('adminPage.tabs.piiEncryption')}
                sx={{ minHeight: 64 }}
              />
            </Tabs>

            {/* Users Tab — GET /api/admin/users?appCode=SYNAPSEX (Auth API) */}
            <TabPanel value={tab} index={0}>
              <Box sx={{ mt: 3 }}>
                {usersError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {t('adminPage.loadError')}
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
                            <TableCell sx={{ fontWeight: 600 }}>{t('adminPage.table.user')}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{t('adminPage.table.role')}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{t('adminPage.table.status')}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{t('adminPage.table.mfa')}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{t('adminPage.table.lastLogin')}</TableCell>
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
                                  {u.mfaEnabled ? t('adminPage.mfa.enabled') : t('adminPage.mfa.off')}
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
                                  {t('adminPage.noUsers')}
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
                    label={t('adminPage.miniStats.rbac')}
                    value={governanceLoading ? '…' : miniStatValues.rbac}
                    isConfigured={miniStatValues.configured?.rbac}
                    activeLabel={t('adminPage.miniStats.active')}
                  />
                  <MiniStat
                    icon="solar:key-bold-duotone"
                    label={t('adminPage.miniStats.sod')}
                    value={governanceLoading ? '…' : miniStatValues.sod}
                    isConfigured={miniStatValues.configured?.sod}
                    activeLabel={t('adminPage.miniStats.active')}
                  />
                  <MiniStat
                    icon="solar:filter-bold-duotone"
                    label={t('adminPage.miniStats.savedViews')}
                    value={governanceLoading ? '…' : miniStatValues.savedViews}
                    isConfigured={miniStatValues.configured?.savedViews}
                    activeLabel={t('adminPage.miniStats.active')}
                  />
                </Box>

                {/* API (ADMIN 전용): GET /api/synapse/admin/governance-config, PATCH .../governance-config/{configKey} */}
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('adminPage.governance.title')}
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
                        currentLabel={t('adminPage.governance.current')}
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
                    {t('adminPage.governance.noConfig')}
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
                  ? `${tenants.find((tn) => String(tn.id) === tenantId)?.name ?? tenantId} • `
                  : ''}
                {t('adminPage.footer.adminConsole')}
              </Typography>
              <Chip
                icon={<Iconify icon="solar:lock-password-bold" width={14} />}
                label={t('adminPage.footer.auditReady')}
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
  activeLabel,
}: {
  icon: string;
  label: string;
  value: string;
  isConfigured?: boolean;
  activeLabel?: string;
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
          {activeLabel}
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
  currentLabel,
}: {
  item: GovernanceConfigItem;
  isUpdating: boolean;
  onValueChange: (value: string) => void;
  currentLabel: string;
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
          {item.configKey} · {currentLabel}: {item.currentValue}
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
