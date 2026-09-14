import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  reviewWorkplaceAccessRule,
  applyWorkplaceAccessRuleChange,
} from '@dwp-frontend/shared-utils';
import {
  DateTimePickerField,
  DwpDateTimeProvider,
  FormField,
  SelectField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import {
  isWorkplaceGovernancePeriodValid,
  isWorkplaceGovernanceUuid,
  parseWorkplaceGovernanceUserId,
} from './workplace-admin-governance-model';
import {
  WorkplaceGovernanceChangeReview,
  useGovernanceChangeReview,
} from './workplace-governance-change-review';
import type {
  WorkplaceGovernanceSiteAccessRule,
  WorkplaceGovernanceSiteAccessRuleInput,
  WorkplaceGovernanceAccessPermission,
} from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';
import {
  accessRuleFloorReviewMatches,
  verifiedAccessRuleFloors,
} from './workplace-governance-floor-scope';
import { formatWorkplaceExperienceInstant } from './workplace-experience-format';
import { useWorkplaceGovernanceTargetScope } from './workplace-governance-target-scope';

export function AccessRuleEditor({
  siteId,
  timeZone,
  target,
  canManage,
  locale,
  sourceReady,
  authorityKey,
  recheck,
  onClose,
  lead,
  secondary,
  floorOptions,
  floorSourceReady = false,
}: {
  siteId: string;
  timeZone: string;
  target: WorkplaceGovernanceSiteAccessRule | 'new';
  canManage: boolean;
  locale?: string;
  sourceReady: boolean;
  authorityKey: string;
  recheck: () => Promise<boolean>;
  onClose: () => void;
  lead?: ReactNode;
  secondary?: ReactNode;
  floorOptions?: unknown;
  floorSourceReady?: boolean;
}) {
  const { t } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const governance = useWorkplaceGovernanceTargetScope();
  const existing = target !== 'new' ? target : null;
  const initialExisting = useRef(existing).current;
  const [form, setForm] = useState<WorkplaceGovernanceSiteAccessRuleInput>({
    subjectType: 'USER',
    subjectUserId: null,
    subjectGroupRef: null,
    permission: 'VIEW',
    effect: 'ALLOW',
    validFrom: null,
    validUntil: null,
    state: 'ACTIVE',
    version: null,
    floorId: null,
  });
  const [subject, setSubject] = useState('');
  useEffect(() => {
    setForm(
      initialExisting
        ? {
            subjectType: initialExisting.subjectType,
            subjectUserId: initialExisting.subjectUserId,
            subjectGroupRef: initialExisting.subjectGroupRef,
            permission: initialExisting.permission,
            effect: initialExisting.effect,
            validFrom: initialExisting.validFrom,
            validUntil: initialExisting.validUntil,
            state: initialExisting.state,
            version: initialExisting.version,
            floorId: initialExisting.floorId ?? null,
          }
        : {
            subjectType: 'USER',
            subjectUserId: null,
            subjectGroupRef: null,
            permission: 'VIEW',
            effect: 'ALLOW',
            validFrom: null,
            validUntil: null,
            state: 'ACTIVE',
            version: null,
            floorId: null,
          }
    );
    setSubject(String(initialExisting?.subjectUserId ?? initialExisting?.subjectGroupRef ?? ''));
  }, [initialExisting]);
  useEffect(() => {
    setForm((current) => ({ ...current, version: existing?.version ?? null }));
  }, [existing?.version]);
  const subjectValid =
    form.subjectType === 'USER'
      ? parseWorkplaceGovernanceUserId(subject) !== null
      : isWorkplaceGovernanceUuid(subject);
  const periodValid = isWorkplaceGovernancePeriodValid(form.validFrom, form.validUntil);
  const proposed: WorkplaceGovernanceSiteAccessRuleInput = {
    ...form,
    subjectUserId: form.subjectType === 'USER' ? parseWorkplaceGovernanceUserId(subject) : null,
    subjectGroupRef: form.subjectType === 'GROUP_REF' ? subject.trim() : null,
  };
  const floors = verifiedAccessRuleFloors(siteId, floorOptions);
  const selectedFloor = floors?.find((floor) => floor.floorId === proposed.floorId);
  const manageableFloors = (floors ?? []).filter(
    (floor) => governance.ready && governance.allowsTarget('ACCESS_MANAGE', siteId, floor.floorId)
  );
  const siteManageable = governance.ready && governance.allowsTarget('ACCESS_MANAGE', siteId);
  const targetManageable =
    canManage &&
    governance.ready &&
    governance.allowsTarget('ACCESS_MANAGE', siteId, proposed.floorId ?? null);
  const firstManageableFloor = manageableFloors[0]?.floorId;
  useEffect(() => {
    if (!existing && !form.floorId && !siteManageable && floorSourceReady && firstManageableFloor)
      setForm((current) => ({ ...current, floorId: firstManageableFloor }));
  }, [existing, form.floorId, siteManageable, floorSourceReady, firstManageableFloor]);
  const floorScopeReady =
    !proposed.floorId ||
    (floorSourceReady &&
      Boolean(selectedFloor) &&
      (Boolean(existing) || selectedFloor?.state === 'ACTIVE'));
  const verifiedReview = useRef<string | null>(null);
  const proposedKey = JSON.stringify(proposed);
  useEffect(() => {
    verifiedReview.current = null;
  }, [authorityKey, siteId, proposedKey, floorSourceReady, floorOptions]);
  const reviewState = useGovernanceChangeReview({
    contextKey: JSON.stringify([
      authorityKey,
      governance.authorityKey,
      siteId,
      existing?.accessRuleId ?? 'new',
    ]),
    proposed,
    canManage: targetManageable,
    sourceReady: sourceReady && floorScopeReady,
    valid: subjectValid && periodValid,
    review: async (input) => {
      const result = await reviewWorkplaceAccessRule(siteId, existing?.accessRuleId ?? null, input);
      if (!accessRuleFloorReviewMatches(siteId, input.proposed, result)) {
        verifiedReview.current = null;
        throw new Error('The native producer did not verify the requested floor scope.');
      }
      verifiedReview.current = JSON.stringify(input.proposed);
      return result;
    },
    apply: (input) => {
      if (
        !governance.ready ||
        !governance.allowsTarget('ACCESS_MANAGE', siteId, input.proposed.floorId ?? null)
      )
        return Promise.reject(new Error('The current access-rule target is not authorized.'));
      if (
        input.proposed.floorId &&
        (!floorScopeReady || verifiedReview.current !== JSON.stringify(input.proposed))
      )
        return Promise.reject(
          new Error('Floor scope must be verified by the current native review.')
        );
      return applyWorkplaceAccessRuleChange(siteId, existing?.accessRuleId ?? null, input);
    },
    recheck,
    onSaved: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance'] });
    },
  });
  const baseline = existing;
  const displayValue = (
    key: 'permission' | 'effect' | 'state' | 'validFrom' | 'validUntil' | 'version',
    value: string | number | null | undefined
  ) => {
    if (value === null || value === undefined)
      return key === 'validFrom' || key === 'validUntil'
        ? t('workplace.admin.governance.common.unbounded')
        : '—';
    if (key === 'permission') return t(`workplace.admin.governance.permissions.${value}`);
    if (key === 'effect') return t(`workplace.admin.governance.effects.${value}`);
    if (key === 'state') return t(`workplace.admin.governance.states.${value}`);
    return key === 'validFrom' || key === 'validUntil'
      ? formatWorkplaceExperienceInstant(String(value), timeZone)
      : String(value);
  };
  const scopeLabel = (floorId: string | null | undefined) =>
    !floorId
      ? t('workplace.experience.siteAccessInherited')
      : (floors?.find((floor) => floor.floorId === floorId)?.name ?? floorId);
  const rows = [
    {
      label: t('workplace.experience.accessRuleScope'),
      current: baseline ? scopeLabel(baseline.floorId) : '—',
      proposed: scopeLabel(proposed.floorId),
    },
    {
      label: t('workplace.admin.governance.fields.subjectType'),
      current: baseline
        ? t(`workplace.admin.governance.subjectTypes.${baseline.subjectType}`)
        : '—',
      proposed: t(`workplace.admin.governance.subjectTypes.${proposed.subjectType}`),
    },
    {
      label: t(
        proposed.subjectType === 'USER'
          ? 'workplace.admin.governance.fields.userId'
          : 'workplace.admin.governance.fields.groupRef'
      ),
      current: String(baseline?.subjectUserId ?? baseline?.subjectGroupRef ?? '—'),
      proposed: String(proposed.subjectUserId ?? proposed.subjectGroupRef ?? '—'),
    },
    ...(['permission', 'effect', 'state', 'validFrom', 'validUntil', 'version'] as const)
      .filter(
        (key) =>
          key === 'permission' ||
          key === 'effect' ||
          key === 'version' ||
          !baseline ||
          baseline[key] !== proposed[key] ||
          (key === 'state' ? baseline.state !== 'ACTIVE' : baseline[key] !== null)
      )
      .map((key) => ({
        label:
          key === 'version'
            ? t('workplace.experience.version')
            : t(`workplace.admin.governance.fields.${key}`),
        current: baseline ? displayValue(key, baseline[key]) : '—',
        proposed: displayValue(key, proposed[key]),
      })),
  ];
  const disabled =
    Boolean(reviewState.busy) || Boolean(reviewState.outcome) || reviewState.saved || !canManage;
  return (
    <WorkplaceGovernanceChangeReview
      state={reviewState}
      rows={rows}
      onClose={onClose}
      readOnly={!targetManageable}
      lead={lead}
      secondary={secondary}
      comparisonInRail
    >
      {!sourceReady ? (
        <InlineFeedback severity="warning">
          {t('workplace.experience.sourceNotCurrent')}
        </InlineFeedback>
      ) : null}
      {floors === null && !proposed.floorId ? (
        <InlineFeedback severity="info">
          {t('workplace.experience.floorScopeProducerUnavailable')}
        </InlineFeedback>
      ) : null}
      {proposed.floorId ? (
        <InlineFeedback severity={floorScopeReady ? 'info' : 'warning'}>
          {t(
            floorScopeReady
              ? 'workplace.experience.floorAccessOverlayNotice'
              : 'workplace.experience.floorScopeProducerUnavailable'
          )}
        </InlineFeedback>
      ) : null}
      <Box component="fieldset" disabled={disabled} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Stack spacing={2}>
          <SelectField
            label={t('workplace.experience.accessRuleScope')}
            value={form.floorId ?? 'SITE'}
            disabled={Boolean(existing) || floors === null}
            options={[
              ...(siteManageable
                ? [{ value: 'SITE', label: t('workplace.experience.siteAccessInherited') }]
                : []),
              ...manageableFloors
                .filter((floor) => floor.state === 'ACTIVE' || floor.floorId === existing?.floorId)
                .map((floor) => ({ value: floor.floorId, label: floor.name })),
            ]}
            onValueChange={(floorId) =>
              setForm({ ...form, floorId: floorId === 'SITE' ? null : floorId })
            }
          />
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr' }, gap: 1.5 }}
          >
            <SelectField
              label={t('workplace.admin.governance.fields.subjectType')}
              value={form.subjectType}
              options={(['USER', 'GROUP_REF'] as const).map((value) => ({
                value,
                label: t(`workplace.admin.governance.subjectTypes.${value}`),
              }))}
              onValueChange={(value) => {
                setForm({
                  ...form,
                  subjectType: value as WorkplaceGovernanceSiteAccessRuleInput['subjectType'],
                });
                setSubject('');
              }}
            />
            <FormField
              required
              label={t(
                form.subjectType === 'USER'
                  ? 'workplace.admin.governance.fields.userId'
                  : 'workplace.admin.governance.fields.groupRef'
              )}
              value={subject}
              errorMessage={
                subject && !subjectValid
                  ? t('workplace.admin.governance.fields.invalidSubject')
                  : undefined
              }
              onChange={(event) => setSubject(event.target.value)}
            />
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
              gap: 1.5,
            }}
          >
            <SelectField
              label={t('workplace.admin.governance.fields.permission')}
              value={form.permission}
              options={(['VIEW', 'BOOK', 'MANAGE'] as const).map((value) => ({
                value,
                label: t(`workplace.admin.governance.permissions.${value}`),
              }))}
              onValueChange={(value) =>
                setForm({ ...form, permission: value as WorkplaceGovernanceAccessPermission })
              }
            />
            <SelectField
              label={t('workplace.admin.governance.fields.effect')}
              value={form.effect}
              options={(['ALLOW', 'DENY'] as const).map((value) => ({
                value,
                label: t(`workplace.admin.governance.effects.${value}`),
              }))}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  effect: value as WorkplaceGovernanceSiteAccessRuleInput['effect'],
                })
              }
            />
            <SelectField
              label={t('workplace.admin.governance.fields.state')}
              value={form.state}
              options={(['ACTIVE', 'INACTIVE'] as const).map((value) => ({
                value,
                label: t(`workplace.admin.governance.states.${value}`),
              }))}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  state: value as WorkplaceGovernanceSiteAccessRuleInput['state'],
                })
              }
            />
          </Box>
          <DwpDateTimeProvider locale={locale} timeZone={timeZone}>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
            >
              <DateTimePickerField
                label={t('workplace.admin.governance.fields.validFrom')}
                value={form.validFrom}
                onValueChange={(value) => setForm({ ...form, validFrom: value })}
                supportingText={timeZone}
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
        </Stack>
      </Box>
    </WorkplaceGovernanceChangeReview>
  );
}
