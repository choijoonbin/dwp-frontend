import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, Pencil, Plus, Scale } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWorkplaceAdminFloors,
  getWorkplaceAdminResources,
  getWorkplaceAdminSites,
  getWorkplaceGovernanceCampuses,
  getWorkplaceGovernancePolicyOverrides,
  getWorkplaceGovernanceZones,
  previewWorkplaceGovernancePolicy,
  saveWorkplaceGovernancePolicyOverride,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
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
  validateWorkplaceGovernancePolicyPatch,
  workplaceGovernanceScopeNeedsId,
  WORKPLACE_GOVERNANCE_POLICY_FIELDS,
} from './workplace-admin-governance-model';
import {
  GovernanceEmpty,
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';

import type {
  WorkplaceGovernancePolicyOverride,
  WorkplaceGovernancePolicyOverrideInput,
  WorkplaceGovernancePolicyPatch,
  WorkplaceGovernancePolicyScopeType,
  WorkplaceGovernanceEffectiveDelegatedScope,
} from '@dwp-frontend/shared-utils';

const SCOPE_TYPES = ['TENANT', 'CAMPUS', 'SITE', 'FLOOR', 'ZONE', 'RESOURCE'] as const;

export function WorkplaceAdminGovernancePolicy({
  canManage,
  globalAdministrator,
  effectiveScopes,
}: {
  canManage: boolean;
  globalAdministrator: boolean;
  effectiveScopes: readonly WorkplaceGovernanceEffectiveDelegatedScope[];
}) {
  const { t } = useTranslation('rooms');
  const [scopeType, setScopeType] = useState<WorkplaceGovernancePolicyScopeType>(
    globalAdministrator ? 'TENANT' : 'SITE'
  );
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [editor, setEditor] = useState<WorkplaceGovernancePolicyOverride | 'new' | null>(null);
  const overridesQuery = useQuery({
    queryKey: [
      'workplace',
      'governance',
      'policy-overrides',
      globalAdministrator ? 'all' : scopeType,
      globalAdministrator ? null : scopeId,
    ],
    queryFn: () =>
      getWorkplaceGovernancePolicyOverrides(
        globalAdministrator ? undefined : scopeType,
        globalAdministrator ? undefined : scopeId
      ),
    enabled: globalAdministrator || !workplaceGovernanceScopeNeedsId(scopeType) || Boolean(scopeId),
    staleTime: 15_000,
    retry: 1,
  });
  const previewQuery = useQuery({
    queryKey: ['workplace', 'governance', 'policy-preview', scopeType, scopeId],
    queryFn: () => previewWorkplaceGovernancePolicy(scopeType, scopeId),
    enabled: !workplaceGovernanceScopeNeedsId(scopeType) || Boolean(scopeId),
    staleTime: 10_000,
    retry: 1,
  });

  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('workplace.admin.governance.policy.inheritanceNotice')}</Alert>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(340px, 0.8fr) minmax(0, 1.5fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <GovernancePanel
          title={t('workplace.admin.governance.policy.overrides')}
          description={t('workplace.admin.governance.policy.overridesDescription')}
          actions={
            canManage ? (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={16} />}
                onClick={() => setEditor('new')}
              >
                {t('workplace.admin.governance.policy.addOverride')}
              </ActionButton>
            ) : null
          }
        >
          {overridesQuery.isLoading ? (
            <GovernanceLoading rows={5} />
          ) : overridesQuery.isError ? (
            <GovernanceQueryError retry={() => void overridesQuery.refetch()} />
          ) : overridesQuery.data?.length ? (
            <Stack divider={<Divider flexItem />}>
              {overridesQuery.data.map((override) => (
                <Stack
                  key={override.policyOverrideId}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                  sx={{ px: 1.5, py: 1.25 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" gap={0.6} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={750}>
                        {t(`workplace.admin.governance.scopeTypes.${override.scopeType}`)}
                      </Typography>
                      <Chip size="small" variant="outlined" label={override.state} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {override.scopeId ?? t('workplace.admin.governance.policy.tenantRoot')} ·{' '}
                      {t('workplace.admin.governance.policy.fieldCount', {
                        count: Object.keys(override.policyPatch).length,
                      })}
                    </Typography>
                  </Box>
                  {canManage ? (
                    <ActionIconButton
                      size="small"
                      label={t('actions.edit')}
                      onClick={() => setEditor(override)}
                    >
                      <Pencil size={15} />
                    </ActionIconButton>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          ) : (
            <GovernanceEmpty
              title={t('workplace.admin.governance.policy.emptyOverrides')}
              description={t('workplace.admin.governance.policy.emptyOverridesDescription')}
            />
          )}
        </GovernancePanel>

        <GovernancePanel
          title={t('workplace.admin.governance.policy.preview')}
          description={t('workplace.admin.governance.policy.previewDescription')}
        >
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <ScopePicker
              scopeType={scopeType}
              scopeId={scopeId}
              allowedScopeTypes={globalAdministrator ? SCOPE_TYPES : SCOPE_TYPES.slice(2)}
              allowedSiteIds={effectiveScopes
                .filter((scope) => scope.scopeType === 'SITE')
                .map((scope) => scope.scopeId)}
              onChange={(nextType, nextId) => {
                setScopeType(nextType);
                setScopeId(nextId);
              }}
            />
          </Box>
          {previewQuery.isLoading ? <GovernanceLoading rows={7} /> : null}
          {previewQuery.isError ? (
            <GovernanceQueryError retry={() => void previewQuery.refetch()} />
          ) : null}
          {previewQuery.data ? (
            <Stack divider={<Divider flexItem />}>
              {Object.entries(previewQuery.data.effectivePolicy).map(([key, value]) => {
                const source = previewQuery.data.fieldSources[key];
                return (
                  <Stack
                    key={key}
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                    gap={0.75}
                    sx={{ px: 1.5, py: 1.1 }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        {t(`workplace.admin.governance.policy.fields.${key}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {source
                          ? t('workplace.admin.governance.policy.source', {
                              scope: t(`workplace.admin.governance.scopeTypes.${source.scopeType}`),
                            })
                          : t('workplace.admin.governance.policy.tenantDefault')}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color="info"
                      variant="outlined"
                      label={typeof value === 'boolean' ? String(value) : value}
                    />
                  </Stack>
                );
              })}
            </Stack>
          ) : null}
        </GovernancePanel>
      </Box>

      <PolicyOverrideDialog
        target={editor}
        canManage={canManage}
        globalAdministrator={globalAdministrator}
        effectiveScopes={effectiveScopes}
        onClose={() => setEditor(null)}
      />
    </Stack>
  );
}

function ScopePicker({
  scopeType,
  scopeId,
  disabled = false,
  allowedScopeTypes = SCOPE_TYPES,
  allowedSiteIds,
  onChange,
}: {
  scopeType: WorkplaceGovernancePolicyScopeType;
  scopeId: string | null;
  disabled?: boolean;
  allowedScopeTypes?: readonly WorkplaceGovernancePolicyScopeType[];
  allowedSiteIds?: readonly string[];
  onChange: (scopeType: WorkplaceGovernancePolicyScopeType, scopeId: string | null) => void;
}) {
  const { t } = useTranslation('rooms');
  const [siteId, setSiteId] = useState('');
  const [floorId, setFloorId] = useState('');
  const campusesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'campuses'],
    queryFn: getWorkplaceGovernanceCampuses,
    enabled: allowedScopeTypes.includes('CAMPUS'),
    staleTime: 30_000,
  });
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'sites'],
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
  });
  const sites = useMemo(
    () =>
      allowedSiteIds !== undefined
        ? (sitesQuery.data ?? []).filter((site) => allowedSiteIds.includes(site.siteId))
        : (sitesQuery.data ?? []),
    [allowedSiteIds, sitesQuery.data]
  );
  useEffect(() => {
    if (!siteId && sites.length) setSiteId(sites[0].siteId);
  }, [siteId, sites]);
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'admin', 'floors', siteId],
    queryFn: () => getWorkplaceAdminFloors(siteId),
    enabled: Boolean(siteId),
    staleTime: 30_000,
  });
  const floors = useMemo(() => floorsQuery.data ?? [], [floorsQuery.data]);
  useEffect(() => {
    if (floors.length && !floors.some((floor) => floor.floorId === floorId)) {
      setFloorId(floors[0].floorId);
    }
  }, [floorId, floors]);
  const zonesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'zones', floorId],
    queryFn: () => getWorkplaceGovernanceZones(floorId),
    enabled: Boolean(floorId),
    staleTime: 20_000,
  });
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'resources', floorId],
    queryFn: () => getWorkplaceAdminResources(floorId),
    enabled: Boolean(floorId),
    staleTime: 20_000,
  });
  const targetOptions = (() => {
    if (scopeType === 'CAMPUS') {
      return (campusesQuery.data ?? []).map((campus) => ({
        value: campus.campusId,
        label: `${campus.nameKo} (${campus.code})`,
      }));
    }
    if (scopeType === 'SITE') {
      return sites.map((site) => ({ value: site.siteId, label: site.name }));
    }
    if (scopeType === 'FLOOR') {
      return floors.map((floor) => ({ value: floor.floorId, label: floor.name }));
    }
    if (scopeType === 'ZONE') {
      return (zonesQuery.data ?? []).map((zone) => ({ value: zone.zoneId, label: zone.nameKo }));
    }
    if (scopeType === 'RESOURCE') {
      return (resourcesQuery.data ?? []).map((resource) => ({
        value: resource.resourceId,
        label: resource.name,
      }));
    }
    return [];
  })();
  useEffect(() => {
    if (disabled) return;
    if (scopeType === 'TENANT') {
      if (scopeId !== null) onChange(scopeType, null);
      return;
    }
    if (targetOptions.length && !targetOptions.some((option) => option.value === scopeId)) {
      onChange(scopeType, targetOptions[0].value);
    }
  }, [disabled, onChange, scopeId, scopeType, targetOptions]);

  return (
    <Stack spacing={1.5}>
      <SelectField
        disabled={disabled}
        label={t('workplace.admin.governance.fields.scopeType')}
        value={scopeType}
        options={allowedScopeTypes.map((value) => ({
          value,
          label: t(`workplace.admin.governance.scopeTypes.${value}`),
        }))}
        onValueChange={(value) =>
          onChange(value as WorkplaceGovernancePolicyScopeType, value === 'TENANT' ? null : '')
        }
      />
      {['FLOOR', 'ZONE', 'RESOURCE'].includes(scopeType) ? (
        <SelectField
          disabled={disabled}
          label={t('workplace.admin.governance.fields.site')}
          value={siteId}
          options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
          onValueChange={(value) => {
            setSiteId(value);
            setFloorId('');
            onChange(scopeType, '');
          }}
        />
      ) : null}
      {['ZONE', 'RESOURCE'].includes(scopeType) ? (
        <SelectField
          disabled={disabled}
          label={t('workplace.admin.governance.fields.floor')}
          value={floorId}
          options={floors.map((floor) => ({ value: floor.floorId, label: floor.name }))}
          onValueChange={(value) => {
            setFloorId(value);
            onChange(scopeType, '');
          }}
        />
      ) : null}
      {scopeType !== 'TENANT' ? (
        <SelectField
          disabled={disabled}
          label={t('workplace.admin.governance.fields.scopeTarget')}
          value={scopeId ?? ''}
          options={targetOptions}
          onValueChange={(value) => onChange(scopeType, value)}
        />
      ) : null}
    </Stack>
  );
}

function PolicyOverrideDialog({
  target,
  canManage,
  globalAdministrator,
  effectiveScopes,
  onClose,
}: {
  target: WorkplaceGovernancePolicyOverride | 'new' | null;
  canManage: boolean;
  globalAdministrator: boolean;
  effectiveScopes: readonly WorkplaceGovernanceEffectiveDelegatedScope[];
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const existing = target && target !== 'new' ? target : null;
  const [scopeType, setScopeType] = useState<WorkplaceGovernancePolicyScopeType>(
    globalAdministrator ? 'TENANT' : 'SITE'
  );
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [patch, setPatch] = useState<WorkplaceGovernancePolicyPatch>({});
  const [state, setState] = useState<WorkplaceGovernancePolicyOverrideInput['state']>('ACTIVE');
  useEffect(() => {
    if (!target) return;
    setScopeType(existing?.scopeType ?? (globalAdministrator ? 'TENANT' : 'SITE'));
    setScopeId(existing?.scopeId ?? null);
    setPatch(existing?.policyPatch ?? {});
    setState(existing?.state ?? 'ACTIVE');
  }, [existing, globalAdministrator, target]);
  const mutation = useMutation({
    mutationFn: () => {
      if (!canManage || !validateWorkplaceGovernancePolicyPatch(patch)) {
        throw new Error('Invalid policy override');
      }
      return saveWorkplaceGovernancePolicyOverride(existing?.policyOverrideId ?? null, {
        scopeType,
        scopeId: scopeType === 'TENANT' ? null : scopeId,
        policyPatch: patch,
        state,
        version: existing?.version ?? null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance'] });
      toast.success(t('workplace.admin.governance.common.saved'));
      onClose();
    },
    onError: () => toast.error(t('workplace.admin.governance.common.saveError')),
  });
  const validTarget = !workplaceGovernanceScopeNeedsId(scopeType) || Boolean(scopeId);
  const valid = validTarget && validateWorkplaceGovernancePolicyPatch(patch);
  return (
    <FormDialog
      open={Boolean(target)}
      title={t(
        existing
          ? 'workplace.admin.governance.policy.editOverride'
          : 'workplace.admin.governance.policy.addOverride'
      )}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!canManage || !valid}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="lg"
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)' },
          gap: 2,
        }}
      >
        <Stack spacing={1.5}>
          <ScopePicker
            scopeType={scopeType}
            scopeId={scopeId}
            disabled={Boolean(existing)}
            allowedScopeTypes={globalAdministrator ? SCOPE_TYPES : SCOPE_TYPES.slice(2)}
            allowedSiteIds={effectiveScopes
              .filter((scope) => scope.scopeType === 'SITE')
              .map((scope) => scope.scopeId)}
            onChange={(nextType, nextId) => {
              setScopeType(nextType);
              setScopeId(nextId);
            }}
          />
          <SelectField
            label={t('workplace.admin.governance.fields.state')}
            value={state}
            options={(['ACTIVE', 'INACTIVE'] as const).map((value) => ({
              value,
              label: t(`workplace.admin.governance.states.${value}`),
            }))}
            onValueChange={(value) =>
              setState(value as WorkplaceGovernancePolicyOverrideInput['state'])
            }
          />
          <Alert severity="info" icon={<GitBranch size={20} />}>
            {t('workplace.admin.governance.policy.partialPatchNotice')}
          </Alert>
        </Stack>
        <PolicyPatchEditor patch={patch} onChange={setPatch} />
      </Box>
    </FormDialog>
  );
}

function PolicyPatchEditor({
  patch,
  onChange,
}: {
  patch: WorkplaceGovernancePolicyPatch;
  onChange: (patch: WorkplaceGovernancePolicyPatch) => void;
}) {
  const { t } = useTranslation('rooms');
  const defaults: WorkplaceGovernancePolicyPatch = {
    bookingWindowDays: 30,
    maximumActiveBookings: 10,
    minimumBookingMinutes: 30,
    maximumBookingMinutes: 480,
    maximumConsecutiveDays: 5,
    workingDayStart: '08:00',
    workingDayEnd: '20:00',
    allowRecurring: true,
    requireCheckIn: true,
    checkInLeadMinutes: 15,
    autoReleaseMinutes: 15,
    allowAssignedDeskLending: false,
    showColleagueNames: true,
    bookingRetentionDays: 365,
  };
  return (
    <Box sx={{ border: 1, borderColor: 'divider', minWidth: 0 }}>
      <Stack sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={800}>
          {t('workplace.admin.governance.policy.fieldsTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.admin.governance.policy.fieldsDescription')}
        </Typography>
      </Stack>
      <Stack divider={<Divider flexItem />}>
        {WORKPLACE_GOVERNANCE_POLICY_FIELDS.map((definition) => {
          const enabled = Object.hasOwn(patch, definition.key);
          const value = enabled ? patch[definition.key] : defaults[definition.key];
          return (
            <Box
              key={definition.key}
              sx={{
                px: 1.5,
                py: 1,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(220px, 1fr) minmax(160px, 0.8fr)' },
                gap: 1.25,
                alignItems: 'center',
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={enabled}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onChange({ ...patch, [definition.key]: defaults[definition.key] });
                      } else {
                        const next = { ...patch };
                        delete next[definition.key];
                        onChange(next);
                      }
                    }}
                  />
                }
                label={t(`workplace.admin.governance.policy.fields.${definition.key}`)}
              />
              {definition.kind === 'boolean' ? (
                <SelectField
                  disabled={!enabled}
                  label={t('workplace.admin.governance.fields.value')}
                  value={String(value)}
                  options={[
                    { value: 'true', label: t('workplace.admin.governance.common.enabled') },
                    { value: 'false', label: t('workplace.admin.governance.common.disabled') },
                  ]}
                  onValueChange={(next) =>
                    onChange({ ...patch, [definition.key]: next === 'true' })
                  }
                />
              ) : (
                <FormField
                  disabled={!enabled}
                  type={definition.kind === 'time' ? 'time' : 'number'}
                  label={t('workplace.admin.governance.fields.value')}
                  value={value as string | number}
                  inputProps={{
                    min: 'minimum' in definition ? definition.minimum : undefined,
                    max: 'maximum' in definition ? definition.maximum : undefined,
                  }}
                  onChange={(event) =>
                    onChange({
                      ...patch,
                      [definition.key]:
                        definition.kind === 'integer'
                          ? Number(event.target.value)
                          : event.target.value,
                    })
                  }
                />
              )}
            </Box>
          );
        })}
      </Stack>
      {!Object.keys(patch).length ? (
        <Alert severity="warning" icon={<Scale size={20} />}>
          {t('workplace.admin.governance.policy.selectField')}
        </Alert>
      ) : null}
      {Object.keys(patch).length && !validateWorkplaceGovernancePolicyPatch(patch) ? (
        <Alert severity="error" icon={<Scale size={20} />}>
          {t('workplace.admin.governance.policy.validationError')}
        </Alert>
      ) : null}
    </Box>
  );
}
