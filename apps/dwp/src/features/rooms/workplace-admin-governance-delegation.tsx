import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Pencil, Plus, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWorkplaceAdminSites,
  getWorkplaceGovernanceDelegatedScopes,
  getWorkplaceGovernanceEffectiveDelegatedScopes,
  saveWorkplaceGovernanceDelegatedScope,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  isWorkplaceGovernancePeriodValid,
  isWorkplaceGovernanceUuid,
  parseWorkplaceGovernanceUserId,
} from './workplace-admin-governance-model';
import {
  GovernanceEmpty,
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';

import type {
  WorkplaceGovernanceDelegatedAdminScope,
  WorkplaceGovernanceDelegatedAdminScopeInput,
  WorkplaceGovernanceDelegatedPermission,
} from '@dwp-frontend/shared-utils';

const DELEGATED_PERMISSIONS = [
  'CATALOG_VIEW',
  'CATALOG_MANAGE',
  'ACCESS_MANAGE',
  'POLICY_MANAGE',
  'FLOOR_PLAN_MANAGE',
  'DELEGATION_VIEW',
] as const satisfies readonly WorkplaceGovernanceDelegatedPermission[];

export function WorkplaceAdminGovernanceDelegation({
  canManage,
  canViewAssignments,
}: {
  canManage: boolean;
  canViewAssignments: boolean;
}) {
  const { t } = useTranslation('rooms');
  const [editor, setEditor] = useState<WorkplaceGovernanceDelegatedAdminScope | 'new' | null>(null);
  const scopesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'delegated-scopes'],
    queryFn: getWorkplaceGovernanceDelegatedScopes,
    enabled: canViewAssignments,
    staleTime: 15_000,
    retry: 1,
  });
  const effectiveQuery = useQuery({
    queryKey: ['workplace', 'governance', 'delegated-scopes', 'effective'],
    queryFn: getWorkplaceGovernanceEffectiveDelegatedScopes,
    staleTime: 10_000,
    retry: 1,
  });

  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('workplace.admin.governance.delegation.leastPrivilege')}</Alert>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            xl: canViewAssignments ? 'minmax(0, 1.5fr) minmax(320px, 0.7fr)' : '1fr',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {canViewAssignments ? (
          <GovernancePanel
            title={t('workplace.admin.governance.delegation.assignments')}
            description={t('workplace.admin.governance.delegation.assignmentsDescription')}
            actions={
              canManage ? (
                <ActionButton
                  intent="primary"
                  startIcon={<Plus size={16} />}
                  onClick={() => setEditor('new')}
                >
                  {t('workplace.admin.governance.delegation.add')}
                </ActionButton>
              ) : null
            }
          >
            {scopesQuery.isLoading ? (
              <GovernanceLoading rows={5} />
            ) : scopesQuery.isError ? (
              <GovernanceQueryError retry={() => void scopesQuery.refetch()} />
            ) : scopesQuery.data?.length ? (
              <Stack divider={<Divider flexItem />}>
                {scopesQuery.data.map((scope) => (
                  <Stack
                    key={scope.delegationId}
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    gap={1.25}
                    sx={{ px: 1.5, py: 1.25 }}
                  >
                    <Stack direction="row" gap={1.25} sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          flex: '0 0 auto',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'var(--dwp-product-soft)',
                          color: 'var(--dwp-product-accent)',
                        }}
                      >
                        <UserRoundCog size={18} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" gap={0.6} alignItems="center" flexWrap="wrap">
                          <Typography fontWeight={750}>
                            {scope.delegateType === 'USER'
                              ? t('workplace.admin.governance.delegation.userDelegate', {
                                  id: scope.delegateUserId,
                                })
                              : t('workplace.admin.governance.delegation.groupDelegate', {
                                  id: scope.delegateGroupRef,
                                })}
                          </Typography>
                          <Chip size="small" variant="outlined" label={scope.state} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {t(`workplace.admin.governance.delegatedScopeTypes.${scope.scopeType}`)} ·{' '}
                          {scope.siteId ?? scope.managedGroupRef}
                        </Typography>
                        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.6 }}>
                          {scope.permissions.map((permission) => (
                            <Chip
                              key={permission}
                              size="small"
                              label={t(
                                `workplace.admin.governance.delegatedPermissions.${permission}`
                              )}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                    {canManage && scope.scopeType === 'SITE' ? (
                      <ActionIconButton
                        size="small"
                        label={t('actions.edit')}
                        onClick={() => setEditor(scope)}
                      >
                        <Pencil size={15} />
                      </ActionIconButton>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <GovernanceEmpty
                title={t('workplace.admin.governance.delegation.empty')}
                description={t('workplace.admin.governance.delegation.emptyDescription')}
              />
            )}
          </GovernancePanel>
        ) : null}

        <GovernancePanel
          title={t('workplace.admin.governance.delegation.effective')}
          description={t('workplace.admin.governance.delegation.effectiveDescription')}
        >
          {effectiveQuery.isLoading ? <GovernanceLoading rows={3} /> : null}
          {effectiveQuery.isError ? (
            <GovernanceQueryError retry={() => void effectiveQuery.refetch()} />
          ) : null}
          {effectiveQuery.data?.length ? (
            <Stack divider={<Divider flexItem />}>
              {effectiveQuery.data.map((scope) => (
                <Box key={scope.delegationId} sx={{ px: 1.5, py: 1.25 }}>
                  <Stack direction="row" gap={0.8} alignItems="center">
                    <ShieldCheck size={16} color="var(--dwp-product-accent)" />
                    <Typography variant="body2" fontWeight={750}>
                      {t(`workplace.admin.governance.delegatedScopeTypes.${scope.scopeType}`)}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {scope.scopeId}
                  </Typography>
                  <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
                    {scope.permissions.map((permission) => (
                      <Chip key={permission} size="small" variant="outlined" label={permission} />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : !effectiveQuery.isLoading && !effectiveQuery.isError ? (
            <GovernanceEmpty
              title={t('workplace.admin.governance.delegation.noEffective')}
              description={t('workplace.admin.governance.delegation.noEffectiveDescription')}
            />
          ) : null}
        </GovernancePanel>
      </Box>

      <DelegationDialog target={editor} canManage={canManage} onClose={() => setEditor(null)} />
    </Stack>
  );
}

function DelegationDialog({
  target,
  canManage,
  onClose,
}: {
  target: WorkplaceGovernanceDelegatedAdminScope | 'new' | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const existing = target && target !== 'new' ? target : null;
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'sites'],
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
  });
  const sites = useMemo(() => sitesQuery.data ?? [], [sitesQuery.data]);
  const [form, setForm] = useState<WorkplaceGovernanceDelegatedAdminScopeInput>({
    delegateType: 'USER',
    delegateUserId: null,
    delegateGroupRef: null,
    scopeType: 'SITE',
    siteId: null,
    managedGroupRef: null,
    permissions: ['CATALOG_VIEW'],
    validFrom: null,
    validUntil: null,
    state: 'ACTIVE',
    version: null,
  });
  const [delegate, setDelegate] = useState('');
  const [scope, setScope] = useState('');
  useEffect(() => {
    if (!target) return;
    setForm(
      existing
        ? {
            delegateType: existing.delegateType,
            delegateUserId: existing.delegateUserId,
            delegateGroupRef: existing.delegateGroupRef,
            scopeType: existing.scopeType,
            siteId: existing.siteId,
            managedGroupRef: existing.managedGroupRef,
            permissions: existing.permissions,
            validFrom: existing.validFrom,
            validUntil: existing.validUntil,
            state: existing.state,
            version: existing.version,
          }
        : {
            delegateType: 'USER',
            delegateUserId: null,
            delegateGroupRef: null,
            scopeType: 'SITE',
            siteId: sites[0]?.siteId ?? null,
            managedGroupRef: null,
            permissions: ['CATALOG_VIEW'],
            validFrom: null,
            validUntil: null,
            state: 'ACTIVE',
            version: null,
          }
    );
    setDelegate(String(existing?.delegateUserId ?? existing?.delegateGroupRef ?? ''));
    setScope(String(existing?.siteId ?? existing?.managedGroupRef ?? sites[0]?.siteId ?? ''));
  }, [existing, sites, target]);
  const delegateValid =
    form.delegateType === 'USER'
      ? parseWorkplaceGovernanceUserId(delegate) !== null
      : isWorkplaceGovernanceUuid(delegate);
  const scopeValid = Boolean(scope);
  const periodValid = isWorkplaceGovernancePeriodValid(form.validFrom, form.validUntil);
  const mutation = useMutation({
    mutationFn: () => {
      if (!canManage || !delegateValid || !scopeValid || !periodValid || !form.permissions.length) {
        throw new Error('Invalid delegation');
      }
      return saveWorkplaceGovernanceDelegatedScope(existing?.delegationId ?? null, {
        ...form,
        delegateUserId:
          form.delegateType === 'USER' ? parseWorkplaceGovernanceUserId(delegate) : null,
        delegateGroupRef: form.delegateType === 'GROUP_REF' ? delegate.trim() : null,
        scopeType: 'SITE',
        siteId: scope,
        managedGroupRef: null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'governance', 'delegated-scopes'],
      });
      toast.success(t('workplace.admin.governance.common.saved'));
      onClose();
    },
    onError: () => toast.error(t('workplace.admin.governance.common.saveError')),
  });
  const selectedSite = sites.find((site) => site.siteId === scope);
  return (
    <FormDialog
      open={Boolean(target)}
      title={t(
        existing
          ? 'workplace.admin.governance.delegation.edit'
          : 'workplace.admin.governance.delegation.add'
      )}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={
        !canManage || !delegateValid || !scopeValid || !periodValid || !form.permissions.length
      }
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="md"
    >
      <Stack spacing={2}>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr' }, gap: 1.5 }}
        >
          <SelectField
            label={t('workplace.admin.governance.fields.delegateType')}
            value={form.delegateType}
            options={(['USER', 'GROUP_REF'] as const).map((value) => ({
              value,
              label: t(`workplace.admin.governance.subjectTypes.${value}`),
            }))}
            onValueChange={(value) => {
              setForm({
                ...form,
                delegateType: value as WorkplaceGovernanceDelegatedAdminScopeInput['delegateType'],
              });
              setDelegate('');
            }}
          />
          <FormField
            required
            label={t(
              form.delegateType === 'USER'
                ? 'workplace.admin.governance.fields.userId'
                : 'workplace.admin.governance.fields.groupRef'
            )}
            value={delegate}
            errorMessage={
              delegate && !delegateValid
                ? t('workplace.admin.governance.fields.invalidSubject')
                : undefined
            }
            onChange={(event) => setDelegate(event.target.value)}
          />
        </Box>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr' }, gap: 1.5 }}
        >
          <SelectField
            label={t('workplace.admin.governance.fields.scopeType')}
            value="SITE"
            disabled
            options={[
              {
                value: 'SITE',
                label: t('workplace.admin.governance.delegatedScopeTypes.SITE'),
              },
            ]}
            onValueChange={() => undefined}
          />
          <SelectField
            label={t('workplace.admin.governance.fields.site')}
            value={scope}
            options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
            onValueChange={setScope}
          />
        </Box>
        <Box sx={{ border: 1, borderColor: 'divider', p: 1.25 }}>
          <Typography variant="body2" fontWeight={750} sx={{ mb: 0.75 }}>
            {t('workplace.admin.governance.fields.permissions')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {DELEGATED_PERMISSIONS.map((permission) => (
              <FormControlLabel
                key={permission}
                control={
                  <Checkbox
                    checked={form.permissions.includes(permission)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        permissions: event.target.checked
                          ? [...form.permissions, permission]
                          : form.permissions.filter((value) => value !== permission),
                      })
                    }
                  />
                }
                label={t(`workplace.admin.governance.delegatedPermissions.${permission}`)}
              />
            ))}
          </Box>
        </Box>
        <DwpDateTimeProvider
          locale={i18n.resolvedLanguage}
          timeZone={selectedSite?.timeZone ?? 'UTC'}
        >
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
          >
            <DateTimePickerField
              label={t('workplace.admin.governance.fields.validFrom')}
              value={form.validFrom}
              onValueChange={(value) => setForm({ ...form, validFrom: value })}
            />
            <DateTimePickerField
              label={t('workplace.admin.governance.fields.validUntil')}
              value={form.validUntil}
              onValueChange={(value) => setForm({ ...form, validUntil: value })}
              errorMessage={
                !periodValid ? t('workplace.admin.governance.fields.invalidPeriod') : undefined
              }
            />
          </Box>
        </DwpDateTimeProvider>
        <SelectField
          label={t('workplace.admin.governance.fields.state')}
          value={form.state}
          options={(['ACTIVE', 'REVOKED'] as const).map((value) => ({
            value,
            label: t(`workplace.admin.governance.states.${value}`),
          }))}
          onValueChange={(value) =>
            setForm({
              ...form,
              state: value as WorkplaceGovernanceDelegatedAdminScopeInput['state'],
            })
          }
        />
        <Alert severity="info" icon={<KeyRound size={20} />}>
          {t('workplace.admin.governance.delegation.expiryNotice')}
        </Alert>
      </Stack>
    </FormDialog>
  );
}
