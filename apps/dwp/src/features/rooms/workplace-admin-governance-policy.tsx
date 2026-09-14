import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, Pencil, Plus, Scale } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWorkplaceGovernancePolicyOverrides,
  previewWorkplaceGovernancePolicy,
  reviewWorkplacePolicyOverride,
  applyWorkplacePolicyOverrideChange,
  useAuth,
  usePermissionsStore,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  InlineFeedback,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

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

import {
  WorkplaceGovernanceChangeReview,
  useGovernanceChangeReview,
} from './workplace-governance-change-review';
import { useWorkplaceGovernanceTargetScope } from './workplace-governance-target-scope';
import { ScopePicker } from './workplace-governance-scope-picker';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';

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
  const { user } = useAuth();
  const governance = useWorkplaceGovernanceTargetScope();
  const hasSiteWidePolicy =
    globalAdministrator ||
    effectiveScopes.some((scope) => governance.allowsTarget('POLICY_MANAGE', scope.scopeId));
  const allowedTypes = useMemo(
    () =>
      globalAdministrator
        ? SCOPE_TYPES
        : hasSiteWidePolicy
          ? SCOPE_TYPES.slice(2)
          : SCOPE_TYPES.slice(3),
    [globalAdministrator, hasSiteWidePolicy]
  );
  const [nativeTarget, setNativeTarget] = useState<{
    target: { siteId: string; floorId: string | null } | null;
    ready: boolean;
    scopeType: WorkplaceGovernancePolicyScopeType | null;
    scopeId: string | null;
  }>({ target: null, ready: false, scopeType: null, scopeId: null });
  const permissions = usePermissionsStore((value) => value.permissions);
  const authorityKey = JSON.stringify([
    user,
    permissions,
    globalAdministrator,
    effectiveScopes,
    canManage,
    governance.authorityKey,
  ]);
  const [scopeType, setScopeType] = useState<WorkplaceGovernancePolicyScopeType>(
    globalAdministrator ? 'TENANT' : hasSiteWidePolicy ? 'SITE' : 'FLOOR'
  );
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [editor, setEditor] = useState<WorkplaceGovernancePolicyOverride | 'new' | null>(null);
  useEffect(() => {
    if (!allowedTypes.includes(scopeType)) {
      setScopeType(allowedTypes[0]);
      setScopeId(null);
    }
  }, [allowedTypes, scopeType]);
  const overridesQuery = useQuery({
    queryKey: [
      'workplace',
      'governance',
      'policy-overrides',
      authorityKey,
      globalAdministrator ? 'all' : scopeType,
      globalAdministrator ? null : scopeId,
    ],
    queryFn: () =>
      getWorkplaceGovernancePolicyOverrides(
        globalAdministrator ? undefined : scopeType,
        globalAdministrator ? undefined : scopeId
      ),
    enabled:
      governance.ready &&
      (globalAdministrator ||
        (nativeTarget.ready && (!workplaceGovernanceScopeNeedsId(scopeType) || Boolean(scopeId)))),
    staleTime: 15_000,
    retry: retryRecoverableWorkplaceRead,
    refetchInterval: 15_000,
  });
  const previewQuery = useQuery({
    queryKey: ['workplace', 'governance', 'policy-preview', scopeType, scopeId, authorityKey],
    queryFn: () => previewWorkplaceGovernancePolicy(scopeType, scopeId),
    enabled:
      governance.ready &&
      nativeTarget.ready &&
      (!workplaceGovernanceScopeNeedsId(scopeType) || Boolean(scopeId)),
    staleTime: 10_000,
    retry: retryRecoverableWorkplaceRead,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    setEditor(null);
  }, [authorityKey]);
  const currentEditor = overridesQuery.isError
    ? null
    : editor === 'new'
      ? editor
      : editor
        ? (overridesQuery.data?.find((item) => item.policyOverrideId === editor.policyOverrideId) ??
          null)
        : null;
  const sourceReady =
    governance.ready &&
    !overridesQuery.isError &&
    !overridesQuery.isFetching &&
    !overridesQuery.isStale;

  return (
    <Stack spacing={2}>
      <InlineFeedback severity="info">
        {t('workplace.admin.governance.policy.inheritanceNotice')}
      </InlineFeedback>
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
            canManage && governance.ready ? (
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
                      <Typography fontWeight="fontWeightBold">
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
                  {canManage &&
                  sourceReady &&
                  (override.scopeType === 'SITE'
                    ? Boolean(
                        override.scopeId &&
                        governance.allowsTarget('POLICY_MANAGE', override.scopeId)
                      )
                    : override.scopeType === 'TENANT' || override.scopeType === 'CAMPUS'
                      ? globalAdministrator
                      : globalAdministrator ||
                        (nativeTarget.ready &&
                          override.scopeType === scopeType &&
                          override.scopeId === scopeId)) ? (
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
              allowedScopeTypes={allowedTypes}
              targetPermission="POLICY_MANAGE"
              onTargetChange={(target, ready) =>
                setNativeTarget({ target, ready, scopeType, scopeId })
              }
              allowedSiteIds={
                globalAdministrator
                  ? undefined
                  : effectiveScopes
                      .filter((scope) => scope.scopeType === 'SITE')
                      .map((scope) => scope.scopeId)
              }
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
          {nativeTarget.ready &&
          previewQuery.data &&
          !previewQuery.isError &&
          previewQuery.data.targetScopeType === scopeType &&
          previewQuery.data.targetScopeId === (scopeType === 'TENANT' ? null : scopeId) ? (
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
                      <Typography variant="body2" fontWeight="fontWeightBold">
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

      {currentEditor ? (
        <PolicyOverrideDialog
          key={`${authorityKey}:${currentEditor === 'new' ? 'new' : currentEditor.policyOverrideId}`}
          target={currentEditor}
          sourceReady={sourceReady}
          authorityKey={authorityKey}
          recheck={async () => (await overridesQuery.refetch()).isSuccess}
          canManage={canManage}
          globalAdministrator={globalAdministrator}
          effectiveScopes={effectiveScopes}
          onClose={() => setEditor(null)}
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
  sourceReady,
  authorityKey,
  recheck,
  onClose,
}: {
  target: WorkplaceGovernancePolicyOverride | 'new';
  canManage: boolean;
  globalAdministrator: boolean;
  effectiveScopes: readonly WorkplaceGovernanceEffectiveDelegatedScope[];
  sourceReady: boolean;
  authorityKey: string;
  recheck: () => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const governance = useWorkplaceGovernanceTargetScope();
  const hasSiteWidePolicy =
    globalAdministrator ||
    effectiveScopes.some((scope) => governance.allowsTarget('POLICY_MANAGE', scope.scopeId));
  const allowedTypes = useMemo(
    () =>
      globalAdministrator
        ? SCOPE_TYPES
        : hasSiteWidePolicy
          ? SCOPE_TYPES.slice(2)
          : SCOPE_TYPES.slice(3),
    [globalAdministrator, hasSiteWidePolicy]
  );
  const [nativeTarget, setNativeTarget] = useState<{
    target: { siteId: string; floorId: string | null } | null;
    ready: boolean;
    scopeType: WorkplaceGovernancePolicyScopeType | null;
    scopeId: string | null;
  }>({ target: null, ready: false, scopeType: null, scopeId: null });
  const existing = target !== 'new' ? target : null;
  const initialExisting = useRef(existing).current;
  const initialGlobal = useRef(globalAdministrator).current;
  const [scopeType, setScopeType] = useState<WorkplaceGovernancePolicyScopeType>(
    globalAdministrator ? 'TENANT' : hasSiteWidePolicy ? 'SITE' : 'FLOOR'
  );
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [patch, setPatch] = useState<WorkplaceGovernancePolicyPatch>({});
  const [state, setState] = useState<WorkplaceGovernancePolicyOverrideInput['state']>('ACTIVE');
  useEffect(() => {
    setScopeType(
      initialExisting?.scopeType ??
        (initialGlobal ? 'TENANT' : hasSiteWidePolicy ? 'SITE' : 'FLOOR')
    );
    setScopeId(initialExisting?.scopeId ?? null);
    setPatch(initialExisting?.policyPatch ?? {});
    setState(initialExisting?.state ?? 'ACTIVE');
  }, [initialExisting, initialGlobal, hasSiteWidePolicy]);
  const valid =
    (!workplaceGovernanceScopeNeedsId(scopeType) || Boolean(scopeId)) &&
    validateWorkplaceGovernancePolicyPatch(patch);
  const proposed: WorkplaceGovernancePolicyOverrideInput = {
    scopeType,
    scopeId: scopeType === 'TENANT' ? null : scopeId,
    policyPatch: patch,
    state,
    version: existing?.version ?? null,
  };
  const targetManageable =
    canManage &&
    governance.ready &&
    nativeTarget.scopeType === scopeType &&
    nativeTarget.scopeId === proposed.scopeId &&
    (scopeType === 'TENANT' || scopeType === 'CAMPUS'
      ? globalAdministrator
      : Boolean(nativeTarget.target) &&
        governance.allowsTarget(
          'POLICY_MANAGE',
          nativeTarget.target!.siteId,
          nativeTarget.target!.floorId
        ));
  const reviewState = useGovernanceChangeReview({
    contextKey: JSON.stringify([
      authorityKey,
      existing?.policyOverrideId ?? 'new',
      scopeType,
      scopeId,
    ]),
    proposed,
    canManage: targetManageable,
    sourceReady: sourceReady && nativeTarget.ready,
    valid,
    review: (input) =>
      reviewWorkplacePolicyOverride(
        existing?.policyOverrideId ?? null,
        scopeType,
        proposed.scopeId,
        input
      ),
    apply: (input) => {
      if (
        !targetManageable ||
        (nativeTarget.target &&
          !governance.allowsTarget(
            'POLICY_MANAGE',
            nativeTarget.target.siteId,
            nativeTarget.target.floorId
          )) ||
        input.proposed.scopeType !== scopeType ||
        input.proposed.scopeId !== proposed.scopeId
      )
        return Promise.reject(new Error('The current policy target is not authorized.'));
      return applyWorkplacePolicyOverrideChange(
        existing?.policyOverrideId ?? null,
        scopeType,
        proposed.scopeId,
        input
      );
    },
    recheck,
    onSaved: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance'] });
    },
  });
  const rows = [
    {
      label: t('workplace.admin.governance.fields.scopeType'),
      current: existing ? t(`workplace.admin.governance.scopeTypes.${existing.scopeType}`) : '—',
      proposed: t(`workplace.admin.governance.scopeTypes.${scopeType}`),
    },
    {
      label: t('workplace.admin.governance.fields.scopeTarget'),
      current: existing?.scopeId ?? t('workplace.admin.governance.policy.tenantRoot'),
      proposed: proposed.scopeId ?? t('workplace.admin.governance.policy.tenantRoot'),
    },
    {
      label: t('workplace.admin.governance.fields.state'),
      current: existing ? t(`workplace.admin.governance.states.${existing.state}`) : '—',
      proposed: t(`workplace.admin.governance.states.${state}`),
    },
    ...Array.from(
      new Set([...Object.keys(existing?.policyPatch ?? {}), ...Object.keys(patch)])
    ).map((key) => ({
      label: t(`workplace.admin.governance.policy.fields.${key}`),
      current: String(existing?.policyPatch[key as keyof WorkplaceGovernancePolicyPatch] ?? '—'),
      proposed: String(
        patch[key as keyof WorkplaceGovernancePolicyPatch] ??
          t('workplace.admin.governance.policy.tenantDefault')
      ),
    })),
    {
      label: t('workplace.experience.version'),
      current: String(existing?.version ?? '—'),
      proposed: String(proposed.version ?? '—'),
    },
  ];
  const disabled =
    Boolean(reviewState.busy) || Boolean(reviewState.outcome) || reviewState.saved || !canManage;
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
      busy={Boolean(reviewState.busy)}
      showSubmit={false}
      showCancel={false}
      mobileFullScreen
      onClose={onClose}
      onSubmit={reviewState.save}
      maxWidth="lg"
    >
      <WorkplaceGovernanceChangeReview
        state={reviewState}
        rows={rows}
        onClose={onClose}
        readOnly={!targetManageable}
      >
        <Box
          component="fieldset"
          disabled={disabled}
          sx={{
            border: 0,
            p: 0,
            m: 0,
            minWidth: 0,
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
              allowedScopeTypes={allowedTypes}
              targetPermission="POLICY_MANAGE"
              onTargetChange={(target, ready) =>
                setNativeTarget({ target, ready, scopeType, scopeId })
              }
              allowedSiteIds={
                globalAdministrator
                  ? undefined
                  : effectiveScopes
                      .filter((scope) => scope.scopeType === 'SITE')
                      .map((scope) => scope.scopeId)
              }
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
            <InlineFeedback severity="info" icon={<GitBranch size={20} />}>
              {t('workplace.admin.governance.policy.partialPatchNotice')}
            </InlineFeedback>
          </Stack>
          <PolicyPatchEditor patch={patch} onChange={setPatch} />
        </Box>
      </WorkplaceGovernanceChangeReview>
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
        <Typography fontWeight="fontWeightBold">
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
        <InlineFeedback severity="warning" icon={<Scale size={20} />}>
          {t('workplace.admin.governance.policy.selectField')}
        </InlineFeedback>
      ) : null}
      {Object.keys(patch).length && !validateWorkplaceGovernancePolicyPatch(patch) ? (
        <InlineFeedback severity="error" icon={<Scale size={20} />}>
          {t('workplace.admin.governance.policy.validationError')}
        </InlineFeedback>
      ) : null}
    </Box>
  );
}
