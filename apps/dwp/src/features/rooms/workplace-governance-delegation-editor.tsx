import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWorkplaceAdminSites,
  getWorkplaceAdminFloors,
  reviewWorkplaceDelegation,
  applyWorkplaceDelegationChange,
} from '@dwp-frontend/shared-utils';
import {
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
  SelectField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  isWorkplaceGovernancePeriodValid,
  isWorkplaceGovernanceUuid,
  parseWorkplaceGovernanceUserId,
} from './workplace-admin-governance-model';
import {
  WorkplaceGovernanceChangeReview,
  useGovernanceChangeReview,
} from './workplace-governance-change-review';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import {
  workplaceDelegationFloorSet,
  workplaceDelegationFloorReviewIsBound,
} from './workplace-delegation-floor-scope';
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

export function DelegationDialog({
  target,
  canManage,
  sourceReady,
  authorityKey,
  recheck,
  onClose,
}: {
  target: WorkplaceGovernanceDelegatedAdminScope | 'new';
  canManage: boolean;
  sourceReady: boolean;
  authorityKey: string;
  recheck: () => Promise<boolean>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const existing = target !== 'new' ? target : null;
  const initialExisting = useRef(existing).current;
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'sites', authorityKey],
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
    refetchInterval: 15_000,
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
    floorIds: null,
  });
  const [delegate, setDelegate] = useState('');
  const [scope, setScope] = useState('');
  const floorRestricted = form.floorIds != null;
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'governance', 'delegation-floor-options', authorityKey, scope],
    queryFn: () => getWorkplaceAdminFloors(scope),
    enabled: floorRestricted && isWorkplaceGovernanceUuid(scope),
    staleTime: 30_000,
    refetchInterval: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const floors = Array.isArray(floorsQuery.data) ? floorsQuery.data : [];
  const floorSet = workplaceDelegationFloorSet(form.floorIds);
  const floorOptionsValid =
    floorsQuery.data == null ||
    (Array.isArray(floorsQuery.data) &&
      floors.every(
        (floor) =>
          floor &&
          typeof floor.floorId === 'string' &&
          isWorkplaceGovernanceUuid(floor.floorId) &&
          floor.siteId === scope &&
          ['DRAFT', 'ACTIVE', 'CLOSED'].includes(floor.state)
      ) &&
      new Set(floors.map((floor) => floor.floorId.toLowerCase())).size === floors.length);
  const floorSourceReady =
    !floorRestricted ||
    (floorsQuery.isSuccess && !floorsQuery.isFetching && !floorsQuery.isStale && floorOptionsValid);
  const floorSelectionValid =
    !floorRestricted ||
    (floorOptionsValid &&
      Array.isArray(floorSet) &&
      floorSet.every((id) => floors.some((floor) => floor.floorId.toLowerCase() === id)));
  useEffect(() => {
    setForm(
      initialExisting
        ? {
            delegateType: initialExisting.delegateType,
            delegateUserId: initialExisting.delegateUserId,
            delegateGroupRef: initialExisting.delegateGroupRef,
            scopeType: initialExisting.scopeType,
            siteId: initialExisting.siteId,
            managedGroupRef: initialExisting.managedGroupRef,
            permissions: initialExisting.permissions,
            validFrom: initialExisting.validFrom,
            validUntil: initialExisting.validUntil,
            state: initialExisting.state,
            version: initialExisting.version,
            floorIds: initialExisting.floorIds ?? null,
          }
        : {
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
            floorIds: null,
          }
    );
    setDelegate(String(initialExisting?.delegateUserId ?? initialExisting?.delegateGroupRef ?? ''));
    setScope(String(initialExisting?.siteId ?? initialExisting?.managedGroupRef ?? ''));
  }, [initialExisting]);
  useEffect(() => {
    if (!scope && !existing && sites[0]) setScope(sites[0].siteId);
  }, [scope, existing, sites]);
  useEffect(() => {
    setForm((current) => ({ ...current, version: existing?.version ?? null }));
  }, [existing?.version]);
  const delegateValid =
    form.delegateType === 'USER'
      ? parseWorkplaceGovernanceUserId(delegate) !== null
      : isWorkplaceGovernanceUuid(delegate);
  const scopeValid = sites.some((site) => site.siteId === scope);
  const periodValid = isWorkplaceGovernancePeriodValid(form.validFrom, form.validUntil);
  const proposed: WorkplaceGovernanceDelegatedAdminScopeInput = {
    ...form,
    delegateUserId: form.delegateType === 'USER' ? parseWorkplaceGovernanceUserId(delegate) : null,
    delegateGroupRef: form.delegateType === 'GROUP_REF' ? delegate.trim() : null,
    scopeType: 'SITE',
    siteId: scope,
    managedGroupRef: null,
  };
  const reviewState = useGovernanceChangeReview({
    contextKey: JSON.stringify([
      authorityKey,
      existing?.delegationId ?? 'new',
      scope,
      floorRestricted ? floors.map((floor) => [floor.floorId, floor.siteId, floor.version]) : null,
    ]),
    proposed,
    canManage,
    sourceReady:
      sourceReady &&
      !sitesQuery.isError &&
      !sitesQuery.isFetching &&
      !sitesQuery.isStale &&
      floorSourceReady,
    valid:
      delegateValid &&
      scopeValid &&
      periodValid &&
      Boolean(form.permissions.length) &&
      floorSelectionValid,
    review: async (input) => {
      const result = await reviewWorkplaceDelegation(existing?.delegationId ?? null, input);
      if (!workplaceDelegationFloorReviewIsBound(result, input.proposed, existing))
        throw new Error('workplace-delegation-scope-unverified');
      return result;
    },
    apply: (input) => applyWorkplaceDelegationChange(existing?.delegationId ?? null, input),
    recheck: async () => {
      const results = await Promise.all([
        recheck(),
        sitesQuery.refetch(),
        floorRestricted ? floorsQuery.refetch() : Promise.resolve(null),
      ]);
      return (
        results[0] && results[1].isSuccess && (!floorRestricted || results[2]?.isSuccess === true)
      );
    },
    onSaved: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'governance', 'delegated-scopes'],
      });
    },
  });
  const rows = [
    {
      label: t('workplace.admin.governance.fields.subjectType'),
      current: existing
        ? t(`workplace.admin.governance.subjectTypes.${existing.delegateType}`)
        : '—',
      proposed: t(`workplace.admin.governance.subjectTypes.${proposed.delegateType}`),
    },
    {
      label: t(
        proposed.delegateType === 'USER'
          ? 'workplace.admin.governance.fields.userId'
          : 'workplace.admin.governance.fields.groupRef'
      ),
      current: String(existing?.delegateUserId ?? existing?.delegateGroupRef ?? '—'),
      proposed: String(proposed.delegateUserId ?? proposed.delegateGroupRef ?? '—'),
    },
    {
      label: t('workplace.admin.governance.fields.site'),
      current:
        sites.find((site) => site.siteId === existing?.siteId)?.name ??
        existing?.managedGroupRef ??
        existing?.siteId ??
        '—',
      proposed: sites.find((site) => site.siteId === scope)?.name ?? scope,
    },
    {
      label: t('workplace.admin.governance.delegation.floorRange'),
      current: existing
        ? existing.floorIds == null
          ? t('workplace.admin.governance.delegation.allFloors')
          : existing.floorIds
              .map((id) => floors.find((floor) => floor.floorId === id)?.name ?? id)
              .join(', ')
        : '—',
      proposed:
        proposed.floorIds == null
          ? t('workplace.admin.governance.delegation.allFloors')
          : proposed.floorIds
              .map((id) => floors.find((floor) => floor.floorId === id)?.name ?? id)
              .join(', '),
    },
    {
      label: t('workplace.admin.governance.fields.permissions'),
      current:
        existing?.permissions
          .map((permission) => t(`workplace.admin.governance.delegatedPermissions.${permission}`))
          .join(', ') ?? '—',
      proposed: proposed.permissions
        .map((permission) => t(`workplace.admin.governance.delegatedPermissions.${permission}`))
        .join(', '),
    },
    ...(['state', 'validFrom', 'validUntil', 'version'] as const).map((key) => ({
      label:
        key === 'version'
          ? t('workplace.experience.version')
          : t(`workplace.admin.governance.fields.${key}`),
      current:
        key === 'state' && existing
          ? t(`workplace.admin.governance.states.${existing.state}`)
          : String(existing?.[key] ?? '—'),
      proposed:
        key === 'state'
          ? t(`workplace.admin.governance.states.${proposed.state}`)
          : String(proposed[key] ?? '—'),
    })),
  ];
  const disabled =
    Boolean(reviewState.busy) || Boolean(reviewState.outcome) || reviewState.saved || !canManage;
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
      busy={Boolean(reviewState.busy)}
      showSubmit={false}
      showCancel={false}
      mobileFullScreen
      maxWidth="lg"
      onClose={onClose}
      onSubmit={reviewState.save}
    >
      <WorkplaceGovernanceChangeReview
        state={reviewState}
        rows={rows}
        onClose={onClose}
        readOnly={!canManage}
      >
        {!sourceReady ||
        sitesQuery.isError ||
        sitesQuery.isFetching ||
        sitesQuery.isStale ||
        !floorSourceReady ? (
          <InlineFeedback severity="warning">
            {t('workplace.experience.sourceNotCurrent')}
          </InlineFeedback>
        ) : null}
        <Box component="fieldset" disabled={disabled} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr' },
                gap: 1.5,
              }}
            >
              <SelectField
                label={t('workplace.admin.governance.fields.delegateType')}
                disabled={Boolean(existing?.floorIds)}
                value={form.delegateType}
                options={(['USER', 'GROUP_REF'] as const).map((value) => ({
                  value,
                  label: t(`workplace.admin.governance.subjectTypes.${value}`),
                }))}
                onValueChange={(value) => {
                  setForm({
                    ...form,
                    delegateType:
                      value as WorkplaceGovernanceDelegatedAdminScopeInput['delegateType'],
                  });
                  setDelegate('');
                }}
              />
              <FormField
                required
                disabled={Boolean(existing?.floorIds)}
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
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr' },
                gap: 1.5,
              }}
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
                disabled={Boolean(existing?.floorIds)}
                value={scope}
                options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
                onValueChange={(value) => {
                  setScope(value);
                  if (floorRestricted) setForm((current) => ({ ...current, floorIds: [] }));
                }}
              />
            </Box>
            <SelectField
              label={t('workplace.admin.governance.delegation.floorRange')}
              value={floorRestricted ? 'FLOORS' : 'SITE'}
              disabled={Boolean(existing)}
              options={[
                { value: 'SITE', label: t('workplace.admin.governance.delegation.allFloors') },
                {
                  value: 'FLOORS',
                  label: t('workplace.admin.governance.delegation.selectedFloors'),
                },
              ]}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, floorIds: value === 'FLOORS' ? [] : null }))
              }
            />
            {floorRestricted && (
              <Box sx={{ border: 1, borderColor: 'divider', p: 1.25 }}>
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {t('workplace.admin.governance.delegation.selectFloors')}
                </Typography>
                {floorSourceReady && floors.length ? (
                  floors.map((floor) => (
                    <FormControlLabel
                      key={floor.floorId}
                      label={`${floor.name} · ${t(`workplace.floorStates.${floor.state}`)}`}
                      control={
                        <Checkbox
                          disabled={Boolean(existing) || !floorSourceReady}
                          checked={form.floorIds?.includes(floor.floorId) ?? false}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              floorIds: event.target.checked
                                ? [...(current.floorIds ?? []), floor.floorId]
                                : (current.floorIds ?? []).filter((id) => id !== floor.floorId),
                            }))
                          }
                        />
                      }
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('workplace.admin.governance.delegation.floorOptionsUnavailable')}
                  </Typography>
                )}
              </Box>
            )}
            {existing && (
              <InlineFeedback severity="info">
                {t('workplace.admin.governance.delegation.immutableRange')}
              </InlineFeedback>
            )}
            <Box sx={{ border: 1, borderColor: 'divider', p: 1.25 }}>
              <Typography variant="body2" fontWeight="fontWeightBold" sx={{ mb: 0.75 }}>
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
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
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
            <InlineFeedback severity="info" icon={<KeyRound size={20} />}>
              {t('workplace.admin.governance.delegation.expiryNotice')}
            </InlineFeedback>
          </Stack>
        </Box>
      </WorkplaceGovernanceChangeReview>
    </FormDialog>
  );
}
