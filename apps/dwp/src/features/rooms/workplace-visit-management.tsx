import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceIdempotencyKey,
  createWorkplaceKioskDevice,
  createWorkplaceVisitAccessZone,
  createWorkplaceVisitPolicy,
  createWorkplaceVisitProviderBinding,
  getWorkplaceKioskDevices,
  getWorkplaceVisitAccessZones,
  getWorkplaceVisitPolicies,
  getWorkplaceVisitProviderBindings,
  previewWorkplaceVisitPolicyImpact,
  resolveIdempotentMutationIntent,
  testWorkplaceVisitProviderBinding,
  updateWorkplaceKioskDevice,
  updateWorkplaceVisitAccessZone,
  updateWorkplaceVisitPolicy,
  updateWorkplaceVisitProviderBinding,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  FormField,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading } from './rooms-ui';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { workplaceVisitProviderTone } from './workplace-visits-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceKioskDevice,
  WorkplaceVisitAccessZone,
  WorkplaceVisitPolicy,
  WorkplaceVisitPolicyImpact,
  WorkplaceVisitProviderBinding,
} from '@dwp-frontend/shared-utils';

export type WorkplaceVisitManagementMode = 'policies' | 'zones' | 'providers' | 'kiosks';
type Resource =
  | WorkplaceVisitPolicy
  | WorkplaceVisitAccessZone
  | WorkplaceVisitProviderBinding
  | WorkplaceKioskDevice;

type Editor = {
  visitType: string;
  allowedFrom: string;
  allowedUntil: string;
  minimumFields: string;
  retentionDays: string;
  approvalRequired: boolean;
  ndaRequired: boolean;
  identityVerificationRequired: boolean;
  siteId: string;
  zoneCode: string;
  name: string;
  accessLevel: string;
  mappingReference: string;
  allowedVisitTypes: string;
  providerKind: 'VISITOR' | 'ACCESS';
  providerCode: string;
  configurationVersion: string;
  manualOwner: string;
  manualProcedure: string;
  evidenceReference: string;
  deviceIdentitySha256: string;
  policyId: string;
  privacyNoticeVersion: string;
  active: boolean;
  reason: string;
  confirmed: boolean;
};

const EMPTY_EDITOR: Editor = {
  visitType: 'BUSINESS',
  allowedFrom: '08:00:00',
  allowedUntil: '20:00:00',
  minimumFields: 'maskedLabel,purpose',
  retentionDays: '90',
  approvalRequired: true,
  ndaRequired: false,
  identityVerificationRequired: false,
  siteId: '',
  zoneCode: '',
  name: '',
  accessLevel: 'VISITOR',
  mappingReference: '',
  allowedVisitTypes: 'BUSINESS',
  providerKind: 'VISITOR',
  providerCode: '',
  configurationVersion: '1',
  manualOwner: '',
  manualProcedure: '',
  evidenceReference: '',
  deviceIdentitySha256: '',
  policyId: '',
  privacyNoticeVersion: 'v1',
  active: true,
  reason: 'Maintain verified visitor access configuration',
  confirmed: false,
};

function isPolicy(item: Resource): item is WorkplaceVisitPolicy {
  return 'policyId' in item && 'visitType' in item;
}

function isZone(item: Resource): item is WorkplaceVisitAccessZone {
  return 'zoneId' in item;
}

function isProvider(item: Resource): item is WorkplaceVisitProviderBinding {
  return 'bindingId' in item;
}

function resourceId(item: Resource) {
  if (isPolicy(item)) return item.policyId;
  if (isZone(item)) return item.zoneId;
  if (isProvider(item)) return item.bindingId;
  return item.deviceId;
}

function resourceTitle(item: Resource) {
  if (isPolicy(item)) return item.visitType;
  if (isZone(item)) return `${item.zoneCode} · ${item.name}`;
  if (isProvider(item)) return `${item.kind} · ${item.providerCode}`;
  return item.deviceId;
}

function editorFrom(item: Resource): Editor {
  const base = { ...EMPTY_EDITOR, active: item.active, confirmed: false };
  if (isPolicy(item)) {
    return {
      ...base,
      visitType: item.visitType,
      allowedFrom: item.allowedFrom,
      allowedUntil: item.allowedUntil,
      minimumFields: item.minimumCollectionFields.join(','),
      retentionDays: String(item.retentionDays),
      approvalRequired: item.approvalRequired,
      ndaRequired: item.ndaRequired,
      identityVerificationRequired: item.identityVerificationRequired,
    };
  }
  if (isZone(item)) {
    return {
      ...base,
      siteId: item.siteId,
      zoneCode: item.zoneCode,
      name: item.name,
      accessLevel: item.accessLevel,
      mappingReference: item.providerMappingReference,
      allowedVisitTypes: item.allowedVisitTypes.join(','),
    };
  }
  if (isProvider(item)) {
    return {
      ...base,
      providerKind: item.kind,
      providerCode: item.providerCode,
      configurationVersion: String(item.configurationVersion),
      manualOwner: item.manualOwner,
      manualProcedure: item.manualProcedure,
    };
  }
  return {
    ...base,
    siteId: item.siteId,
    policyId: item.policyId ?? '',
    privacyNoticeVersion: item.privacyNoticeVersion,
  };
}

function split(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function StateChip({ item }: { item: Resource }) {
  const { t } = useTranslation('rooms');
  if (isProvider(item)) {
    return (
      <Chip
        size="small"
        color={workplaceVisitProviderTone(item.state)}
        label={t(`workplace.visits.providerStates.${item.state}`)}
      />
    );
  }
  if ('state' in item) {
    return (
      <Chip
        size="small"
        color={item.state === 'READY' ? 'success' : 'warning'}
        label={t(`workplace.visits.kioskStates.${item.state}`)}
      />
    );
  }
  return (
    <Chip
      size="small"
      color={item.active ? 'success' : 'default'}
      label={item.active ? t('workplace.visits.active') : t('workplace.visits.inactive')}
    />
  );
}

export function WorkplaceVisitManagement({ mode }: { mode: WorkplaceVisitManagementMode }) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const canWrite = capabilities.canManageWorkplaceAdmin && elevated;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editor, setEditor] = useState<Editor>(EMPTY_EDITOR);
  const [impact, setImpact] = useState<WorkplaceVisitPolicyImpact | null>(null);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const testIntentRef = useRef<IdempotentMutationIntent | null>(null);

  const query = useQuery({
    queryKey: ['workplace', 'visits', 'management', mode],
    queryFn: async (): Promise<readonly Resource[]> => {
      if (mode === 'policies') return getWorkplaceVisitPolicies();
      if (mode === 'zones') return getWorkplaceVisitAccessZones();
      if (mode === 'providers') return getWorkplaceVisitProviderBindings();
      return getWorkplaceKioskDevices();
    },
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    retry: false,
  });
  const resources = useMemo(() => query.data ?? [], [query.data]);
  const selected = resources.find((item) => resourceId(item) === selectedId) ?? null;

  useEffect(() => {
    if (creating) return;
    if (selected) setEditor(editorFrom(selected));
    else if (resources.length > 0) setSelectedId(resourceId(resources[0]!));
  }, [creating, resources, selected]);

  const update = <K extends keyof Editor>(key: K, value: Editor[K]) =>
    setEditor((current) => ({ ...current, [key]: value }));
  const expectedVersion = selected?.version ?? 0;
  const numericVersion = Number(editor.configurationVersion);
  const numericRetention = Number(editor.retentionDays);
  const formValid =
    editor.reason.trim().length > 0 &&
    editor.confirmed &&
    (mode !== 'policies' ||
      (editor.visitType.trim().length > 0 && Number.isInteger(numericRetention))) &&
    (mode !== 'zones' ||
      Boolean(
        editor.siteId.trim() &&
        editor.zoneCode.trim() &&
        editor.name.trim() &&
        editor.mappingReference.trim()
      )) &&
    (mode !== 'providers' ||
      Boolean(
        editor.providerCode.trim() &&
        editor.manualOwner.trim() &&
        editor.manualProcedure.trim() &&
        Number.isInteger(numericVersion)
      )) &&
    (mode !== 'kiosks' ||
      Boolean(
        /^[0-9a-f]{64}$/u.test(editor.deviceIdentitySha256) &&
        editor.siteId.trim() &&
        editor.privacyNoticeVersion.trim()
      ));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!canWrite || !formValid) throw new Error('VISIT_MANAGEMENT_WRITE_BLOCKED');
      const optionsFor = (fingerprint: unknown) => {
        const intent = resolveIdempotentMutationIntent(intentRef.current, fingerprint, () =>
          createWorkplaceIdempotencyKey(`visit-${mode}-save`)
        );
        intentRef.current = intent;
        return { idempotencyKey: intent.key, activeAccessMode: 'ELEVATED' as const };
      };
      if (mode === 'policies') {
        const input = {
          visitType: editor.visitType.trim(),
          approvalRequired: editor.approvalRequired,
          ndaRequired: editor.ndaRequired,
          identityVerificationRequired: editor.identityVerificationRequired,
          allowedFrom: editor.allowedFrom,
          allowedUntil: editor.allowedUntil,
          minimumCollectionFields: split(editor.minimumFields),
          retentionDays: numericRetention,
          expectedVersion,
          active: editor.active,
          reason: editor.reason.trim(),
          explicitConfirmation: true as const,
        };
        return selected && isPolicy(selected)
          ? updateWorkplaceVisitPolicy(selected.policyId, input, optionsFor(input))
          : createWorkplaceVisitPolicy(input, optionsFor(input));
      }
      if (mode === 'zones') {
        const input = {
          siteId: editor.siteId.trim(),
          zoneCode: editor.zoneCode.trim(),
          name: editor.name.trim(),
          accessLevel: editor.accessLevel.trim(),
          providerMappingReference: editor.mappingReference.trim(),
          allowedVisitTypes: split(editor.allowedVisitTypes),
          expectedVersion,
          active: editor.active,
          reason: editor.reason.trim(),
          explicitConfirmation: true as const,
        };
        return selected && isZone(selected)
          ? updateWorkplaceVisitAccessZone(selected.zoneId, input, optionsFor(input))
          : createWorkplaceVisitAccessZone(input, optionsFor(input));
      }
      if (mode === 'providers') {
        const input = {
          kind: editor.providerKind,
          providerCode: editor.providerCode.trim(),
          configurationVersion: numericVersion,
          manualOwner: editor.manualOwner.trim(),
          manualProcedure: editor.manualProcedure.trim(),
          expectedVersion,
          active: editor.active,
          reason: editor.reason.trim(),
          explicitConfirmation: true as const,
        };
        return selected && isProvider(selected)
          ? updateWorkplaceVisitProviderBinding(selected.bindingId, input, optionsFor(input))
          : createWorkplaceVisitProviderBinding(input, optionsFor(input));
      }
      const input = {
        deviceIdentitySha256: editor.deviceIdentitySha256,
        siteId: editor.siteId.trim(),
        policyId: editor.policyId.trim() || null,
        privacyNoticeVersion: editor.privacyNoticeVersion.trim(),
        expectedVersion,
        active: editor.active,
        reason: editor.reason.trim(),
        explicitConfirmation: true as const,
      };
      return selected && !isPolicy(selected) && !isZone(selected) && !isProvider(selected)
        ? updateWorkplaceKioskDevice(selected.deviceId, input, optionsFor(input))
        : createWorkplaceKioskDevice(input, optionsFor(input));
    },
    retry: false,
    onSuccess: async (result) => {
      intentRef.current = null;
      setCreating(false);
      setSelectedId(resourceId(result.item));
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'visits', 'management', mode],
      });
    },
    onError: () =>
      void queryClient.invalidateQueries({
        queryKey: ['workplace', 'visits', 'management', mode],
      }),
  });

  const operationalMutation = useMutation({
    mutationFn: async (operation: 'impact' | 'test') => {
      if (!selected) throw new Error('VISIT_MANAGEMENT_SELECTION_REQUIRED');
      if (!canWrite || !editor.confirmed) {
        throw new Error('VISIT_MANAGEMENT_OPERATION_BLOCKED');
      }
      if (operation === 'impact' && isPolicy(selected)) {
        return previewWorkplaceVisitPolicyImpact(
          selected.policyId,
          {
            expectedVersion: selected.version,
            reason: editor.reason.trim(),
            explicitConfirmation: true,
          },
          'ELEVATED'
        );
      }
      const fingerprint = { operation, id: resourceId(selected), version: selected.version };
      const intent = resolveIdempotentMutationIntent(testIntentRef.current, fingerprint, () =>
        createWorkplaceIdempotencyKey(`visit-${operation}`)
      );
      testIntentRef.current = intent;
      const options = { idempotencyKey: intent.key, activeAccessMode: 'ELEVATED' as const };
      const now = new Date().toISOString();
      if (operation === 'test' && isProvider(selected)) {
        return testWorkplaceVisitProviderBinding(
          selected.bindingId,
          {
            expectedVersion: selected.version,
            observedConfigurationVersion: selected.configurationVersion,
            reportedState: 'READY',
            evidenceReference: editor.evidenceReference.trim(),
            sourceAt: now,
            receivedAt: now,
            lastSuccessAt: now,
            reason: editor.reason.trim(),
            explicitConfirmation: true,
          },
          options
        );
      }
      throw new Error('VISIT_MANAGEMENT_OPERATION_INVALID');
    },
    retry: false,
    onSuccess: async (result, operation) => {
      testIntentRef.current = null;
      if (operation === 'impact' && 'affectedFutureVisits' in result) setImpact(result);
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'visits', 'management', mode],
      });
    },
  });

  const beginCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setEditor({ ...EMPTY_EDITOR, reason: EMPTY_EDITOR.reason });
    setImpact(null);
  };
  const subtitle = useMemo(() => {
    if (!selected) return null;
    return formatDate(selected.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale);
  }, [locale, selected]);

  return (
    <PageCanvas topInset="compact" data-testid={`workplace-visit-management-${mode}`}>
      <RoomsPageHeading
        eyebrow={t(`workplace.visits.management.${mode}.eyebrow`)}
        title={t(`workplace.visits.management.${mode}.title`)}
        description={t(`workplace.visits.management.${mode}.description`)}
        actions={
          <Stack direction="row" gap={1} flexWrap="wrap">
            <ActionButton
              intent="secondary"
              startIcon={<RefreshCw size={16} />}
              onClick={() => void query.refetch()}
            >
              {t('actions.refresh')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Plus size={16} />}
              disabled={!canWrite}
              onClick={beginCreate}
            >
              {t('workplace.visits.management.create')}
            </ActionButton>
          </Stack>
        }
      />
      {!capabilities.canManageWorkplaceAdmin && (
        <InlineFeedback severity="info" sx={{ mb: 1.5 }}>
          {t('workplace.visits.management.readOnly')}
        </InlineFeedback>
      )}
      {capabilities.canManageWorkplaceAdmin && !elevated && (
        <InlineFeedback severity="warning" icon={<ShieldAlert size={18} />} sx={{ mb: 1.5 }}>
          {t('workplace.visits.admin.elevationRequired')}
        </InlineFeedback>
      )}
      {query.isLoading ? (
        <LoadingState
          embedded
          variant="skeleton"
          skeletonRows={4}
          label={t('workplace.visits.loading')}
        />
      ) : query.isError ? (
        <InlineFeedback severity="error">
          {t('workplace.visits.management.loadError')}
        </InlineFeedback>
      ) : resources.length === 0 && !creating ? (
        <EmptyState
          title={t('workplace.visits.management.emptyTitle')}
          description={t('workplace.visits.management.emptyDescription')}
          action={
            <ActionButton intent="primary" disabled={!canWrite} onClick={beginCreate}>
              {t('workplace.visits.management.create')}
            </ActionButton>
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, .8fr) minmax(0, 1.7fr)' },
            gap: 2,
          }}
        >
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {resources.map((item) => (
              <Box component="li" key={resourceId(item)}>
                <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: 1.25 })}>
                  <Stack direction="row" justifyContent="space-between" gap={1} alignItems="start">
                    <Typography
                      variant="body2"
                      fontWeight="fontWeightBold"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {resourceTitle(item)}
                    </Typography>
                    <StateChip item={item} />
                  </Stack>
                  <ActionButton
                    size="small"
                    intent={resourceId(item) === selectedId ? 'primary' : 'quiet'}
                    onClick={() => {
                      setCreating(false);
                      setSelectedId(resourceId(item));
                      setImpact(null);
                    }}
                    sx={{ mt: 0.75 }}
                  >
                    {t('workplace.visits.management.inspect')}
                  </ActionButton>
                </Box>
              </Box>
            ))}
          </Stack>
          {(selected || creating) && (
            <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography component="h2" variant="h6">
                    {creating
                      ? t('workplace.visits.management.newTitle')
                      : resourceTitle(selected!)}
                  </Typography>
                  {subtitle && (
                    <Typography variant="caption" color="text.secondary">
                      {t('workplace.visits.management.updatedAt', { value: subtitle })}
                    </Typography>
                  )}
                  {selected &&
                    !isPolicy(selected) &&
                    !isZone(selected) &&
                    !isProvider(selected) && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {t('workplace.visits.management.kioskHeartbeat', {
                          value: selected.lastHeartbeatAt
                            ? formatDate(
                                selected.lastHeartbeatAt,
                                { dateStyle: 'short', timeStyle: 'short' },
                                locale
                              )
                            : t('workplace.visits.management.never'),
                        })}
                      </Typography>
                    )}
                </Box>
                <ManagementFields mode={mode} editor={editor} update={update} />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editor.active}
                      onChange={(event) => update('active', event.target.checked)}
                    />
                  }
                  label={t('workplace.visits.management.active')}
                />
                <FormField
                  label={t('workplace.visits.fields.reason')}
                  value={editor.reason}
                  onChange={(event) => update('reason', event.target.value)}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editor.confirmed}
                      onChange={(event) => update('confirmed', event.target.checked)}
                    />
                  }
                  label={t('workplace.visits.management.confirmation')}
                />
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <ActionButton
                    intent="primary"
                    disabled={!canWrite || !formValid}
                    loading={mutation.isPending}
                    onClick={() => mutation.mutate()}
                  >
                    {t('actions.save')}
                  </ActionButton>
                  {mode === 'policies' && selected && (
                    <ActionButton
                      intent="secondary"
                      disabled={!canWrite || !editor.confirmed}
                      loading={operationalMutation.isPending}
                      onClick={() => operationalMutation.mutate('impact')}
                    >
                      {t('workplace.visits.management.previewImpact')}
                    </ActionButton>
                  )}
                  {mode === 'providers' && selected && (
                    <ActionButton
                      intent="secondary"
                      startIcon={<Activity size={16} />}
                      disabled={!canWrite || !editor.confirmed || !editor.evidenceReference.trim()}
                      loading={operationalMutation.isPending}
                      onClick={() => operationalMutation.mutate('test')}
                    >
                      {t('workplace.visits.management.testProvider')}
                    </ActionButton>
                  )}
                </Stack>
                {(mutation.isError || operationalMutation.isError) && (
                  <InlineFeedback severity="error">
                    {t('workplace.visits.management.commandError')}
                  </InlineFeedback>
                )}
                {impact && (
                  <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
                    <Typography variant="subtitle2" fontWeight="fontWeightBold">
                      {t('workplace.visits.management.impactCount', {
                        count: impact.affectedFutureVisits,
                      })}
                    </Typography>
                    {impact.warnings.map((warning) => (
                      <Typography key={warning} variant="body2" color="warning.main">
                        {warning}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Box>
      )}
    </PageCanvas>
  );
}

function ManagementFields({
  mode,
  editor,
  update,
}: {
  mode: WorkplaceVisitManagementMode;
  editor: Editor;
  update: <K extends keyof Editor>(key: K, value: Editor[K]) => void;
}) {
  const { t } = useTranslation('rooms');
  const field = (
    key: keyof Editor,
    label: string,
    extra?: { type?: string; supportingText?: string }
  ) => (
    <FormField
      key={key}
      label={label}
      type={extra?.type}
      supportingText={extra?.supportingText}
      value={String(editor[key])}
      onChange={(event) => update(key, event.target.value as never)}
    />
  );
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.25,
      }}
    >
      {mode === 'policies' && (
        <>
          {field('visitType', t('workplace.visits.fields.visitType'))}
          {field('retentionDays', t('workplace.visits.management.fields.retentionDays'), {
            type: 'number',
          })}
          {field('allowedFrom', t('workplace.visits.management.fields.allowedFrom'))}
          {field('allowedUntil', t('workplace.visits.management.fields.allowedUntil'))}
          {field('minimumFields', t('workplace.visits.management.fields.minimumFields'))}
          <Stack>
            {(['approvalRequired', 'ndaRequired', 'identityVerificationRequired'] as const).map(
              (key) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={editor[key]}
                      onChange={(event) => update(key, event.target.checked)}
                    />
                  }
                  label={t(`workplace.visits.management.fields.${key}`)}
                />
              )
            )}
          </Stack>
        </>
      )}
      {mode === 'zones' && (
        <>
          {field('siteId', t('workplace.visits.fields.siteId'))}
          {field('zoneCode', t('workplace.visits.management.fields.zoneCode'))}
          {field('name', t('workplace.visits.management.fields.name'))}
          {field('accessLevel', t('workplace.visits.management.fields.accessLevel'))}
          {field('mappingReference', t('workplace.visits.management.fields.mappingReference'))}
          {field('allowedVisitTypes', t('workplace.visits.management.fields.allowedVisitTypes'))}
        </>
      )}
      {mode === 'providers' && (
        <>
          <SelectField<'VISITOR' | 'ACCESS'>
            label={t('workplace.visits.management.fields.providerKind')}
            value={editor.providerKind}
            options={[
              { value: 'VISITOR', label: t('workplace.visits.providerKinds.VISITOR') },
              { value: 'ACCESS', label: t('workplace.visits.providerKinds.ACCESS') },
            ]}
            onValueChange={(value) => value && update('providerKind', value)}
          />
          {field('providerCode', t('workplace.visits.management.fields.providerCode'))}
          {field(
            'configurationVersion',
            t('workplace.visits.management.fields.configurationVersion'),
            { type: 'number' }
          )}
          {field('manualOwner', t('workplace.visits.management.fields.manualOwner'))}
          {field('manualProcedure', t('workplace.visits.management.fields.manualProcedure'))}
          {field('evidenceReference', t('workplace.visits.management.fields.evidenceReference'))}
        </>
      )}
      {mode === 'kiosks' && (
        <>
          {field('deviceIdentitySha256', t('workplace.visits.management.fields.deviceHash'), {
            supportingText: t('workplace.visits.management.fields.deviceHashHint'),
          })}
          {field('siteId', t('workplace.visits.fields.siteId'))}
          {field('policyId', t('workplace.visits.management.fields.policyId'))}
          {field(
            'privacyNoticeVersion',
            t('workplace.visits.management.fields.privacyNoticeVersion')
          )}
        </>
      )}
    </Box>
  );
}

export const WorkplaceVisitPolicyAdmin = () => <WorkplaceVisitManagement mode="policies" />;
export const WorkplaceVisitAccessZoneAdmin = () => <WorkplaceVisitManagement mode="zones" />;
export const WorkplaceVisitProviderAdmin = () => <WorkplaceVisitManagement mode="providers" />;
export const WorkplaceKioskDeviceAdmin = () => <WorkplaceVisitManagement mode="kiosks" />;
