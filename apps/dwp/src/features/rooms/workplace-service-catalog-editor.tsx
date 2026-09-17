import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceServiceCatalogItem,
  createWorkplaceIdempotencyKey,
  getWorkplaceAdminSites,
  resolveIdempotentMutationIntent,
  updateWorkplaceServiceCatalogItem,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { WorkplaceServiceCapacityAdmin } from './workplace-service-capacity-admin';
import {
  workplaceServiceOptionRows,
  workplaceServiceOptionSchema,
  WorkplaceServiceOptionSchemaEditor,
} from './workplace-service-option-schema-editor';
import { requireWorkplaceServiceWrite, workplaceServicesCopy } from './workplace-services-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceServiceCatalogAdminItem,
  WorkplaceServiceCatalogWriteInput,
  WorkplaceServiceCategory,
} from '@dwp-frontend/shared-utils';

type FormState = Omit<WorkplaceServiceCatalogWriteInput, 'explicitConfirmation'> & {
  serviceCode: string;
};
const resourceTypes = ['ROOM', 'DESK', 'POD', 'PARKING', 'LOCKER', 'EQUIPMENT'] as const;
const categories: readonly WorkplaceServiceCategory[] = [
  'CATERING',
  'AV',
  'ROOM_LAYOUT',
  'IT_SUPPORT',
  'CLEANING',
];
const emptyForm: FormState = {
  serviceCode: '',
  category: 'CATERING',
  nameKo: '',
  nameEn: '',
  descriptionKo: null,
  descriptionEn: null,
  providerCode: 'DWP_NATIVE_FULFILLMENT',
  siteScope: [],
  optionSchema: [],
  supportedResourceTypes: ['ROOM'],
  unitPrice: 0,
  currency: 'KRW',
  minimumQuantity: 1,
  maximumQuantity: 100,
  orderCutoffMinutes: 60,
  cancellationCutoffMinutes: 60,
  slaResponseMinutes: 15,
  slaFulfillmentLeadMinutes: 60,
  cancellationPolicyKo: '',
  cancellationPolicyEn: '',
  capacityMode: 'UNBOUNDED',
  capacityFreshnessSeconds: 900,
  inspectionMode: 'NONE',
  inspectionChecklistSchema: [],
  requiresAttendeeCount: false,
  requiresCostCenter: false,
  reason: '',
};

function formFromItem(value: WorkplaceServiceCatalogAdminItem): FormState {
  return {
    serviceCode: value.item.serviceCode,
    category: value.item.category,
    nameKo: value.item.nameKo,
    nameEn: value.item.nameEn,
    descriptionKo: value.item.descriptionKo,
    descriptionEn: value.item.descriptionEn,
    providerCode: value.item.providerCode,
    siteScope: value.siteScope,
    optionSchema: value.item.optionSchema,
    supportedResourceTypes: value.item.supportedResourceTypes,
    unitPrice: value.item.unitPrice,
    currency: value.item.currency,
    minimumQuantity: value.item.minimumQuantity,
    maximumQuantity: value.item.maximumQuantity,
    orderCutoffMinutes: value.item.orderCutoffMinutes,
    cancellationCutoffMinutes: value.item.cancellationCutoffMinutes,
    slaResponseMinutes: value.item.slaResponseMinutes,
    slaFulfillmentLeadMinutes: value.item.slaFulfillmentLeadMinutes,
    cancellationPolicyKo: value.item.cancellationPolicyKo,
    cancellationPolicyEn: value.item.cancellationPolicyEn,
    capacityMode: value.item.capacityMode,
    capacityFreshnessSeconds: value.item.capacityFreshnessSeconds,
    inspectionMode: value.item.inspectionMode,
    inspectionChecklistSchema: value.item.inspectionChecklistSchema,
    requiresAttendeeCount: value.item.requiresAttendeeCount,
    requiresCostCenter: value.item.requiresCostCenter,
    reason: '',
  };
}

export function CatalogEditor({
  selected,
  onSaved,
}: {
  selected: WorkplaceServiceCatalogAdminItem | null;
  onSaved: (item: WorkplaceServiceCatalogAdminItem) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin-sites', 'service-catalog'],
    queryFn: getWorkplaceAdminSites,
    enabled: capabilities.canViewWorkplaceAdmin,
  });
  const [form, setForm] = useState<FormState>(selected ? formFromItem(selected) : emptyForm);
  const [optionRows, setOptionRows] = useState(() => workplaceServiceOptionRows(form.optionSchema));
  const [inspectionRows, setInspectionRows] = useState(() =>
    workplaceServiceOptionRows(form.inspectionChecklistSchema)
  );
  const [confirmed, setConfirmed] = useState(false);
  const saveIntent = useRef<IdempotentMutationIntent | null>(null);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const screenCopy = workplaceServicesCopy(locale);
  useEffect(() => {
    const next = selected ? formFromItem(selected) : emptyForm;
    setForm(next);
    setOptionRows(workplaceServiceOptionRows(next.optionSchema));
    setInspectionRows(workplaceServiceOptionRows(next.inspectionChecklistSchema));
    setConfirmed(false);
    saveIntent.current = null;
  }, [selected]);
  const parsedOptions = useMemo(() => workplaceServiceOptionSchema(optionRows), [optionRows]);
  const parsedInspection = useMemo(
    () => workplaceServiceOptionSchema(inspectionRows),
    [inspectionRows]
  );
  const mutation = useMutation({
    mutationFn: async () => {
      requireWorkplaceServiceWrite(
        capabilities.canManageWorkplaceAdmin &&
          elevated &&
          sitesQuery.isSuccess &&
          confirmed &&
          parsedOptions !== null &&
          parsedInspection !== null
      );
      const input = {
        ...form,
        optionSchema: parsedOptions!,
        inspectionChecklistSchema: form.inspectionMode === 'NONE' ? [] : parsedInspection!,
        explicitConfirmation: true as const,
      };
      if (selected) {
        const { serviceCode: _serviceCode, ...values } = input;
        const payload = { ...values, expectedVersion: selected.item.version };
        const intent = resolveIdempotentMutationIntent(saveIntent.current, payload, () =>
          createWorkplaceIdempotencyKey('service-catalog-update')
        );
        saveIntent.current = intent;
        return updateWorkplaceServiceCatalogItem(selected.item.catalogItemId, payload, {
          idempotencyKey: intent.key,
          activeAccessMode: 'ELEVATED',
        });
      }
      const intent = resolveIdempotentMutationIntent(saveIntent.current, input, () =>
        createWorkplaceIdempotencyKey('service-catalog-create')
      );
      saveIntent.current = intent;
      return createWorkplaceServiceCatalogItem(input, {
        idempotencyKey: intent.key,
        activeAccessMode: 'ELEVATED',
      });
    },
    retry: false,
    onSuccess: (result) => {
      saveIntent.current = null;
      onSaved(result.item);
    },
  });
  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const disabled =
    mutation.isPending ||
    !capabilities.canManageWorkplaceAdmin ||
    !elevated ||
    !sitesQuery.isSuccess;
  const valid =
    Boolean(form.serviceCode.trim() && form.nameKo.trim() && form.nameEn.trim()) &&
    Boolean(form.cancellationPolicyKo.trim() && form.cancellationPolicyEn.trim()) &&
    Boolean(form.reason.trim()) &&
    form.supportedResourceTypes.length > 0 &&
    form.maximumQuantity >= form.minimumQuantity &&
    form.slaResponseMinutes >= 1 &&
    form.slaFulfillmentLeadMinutes >= 0 &&
    form.capacityFreshnessSeconds >= 30 &&
    form.capacityFreshnessSeconds <= 86400 &&
    parsedOptions !== null &&
    parsedInspection !== null;

  return (
    <Stack spacing={1.5} data-testid="workplace-service-catalog-editor">
      {!elevated && capabilities.canManageWorkplaceAdmin && (
        <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
          {t('workplace.services.stepUpRequired')}
        </InlineFeedback>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
        <FormField
          label={t('workplace.services.catalog.serviceCode')}
          value={form.serviceCode}
          disabled={disabled || Boolean(selected)}
          onChange={(event) => patch('serviceCode', event.target.value.toUpperCase())}
        />
        <SelectField
          label={t('workplace.services.catalog.category')}
          value={form.category}
          options={categories.map((value) => ({
            value,
            label: t(`workplace.services.catalog.categories.${value}`),
          }))}
          onValueChange={(value) => value && patch('category', value)}
          disabled={disabled}
        />
        <FormField
          label={t('workplace.services.catalog.nameKo')}
          value={form.nameKo}
          disabled={disabled}
          onChange={(event) => patch('nameKo', event.target.value)}
        />
        <FormField
          label={t('workplace.services.catalog.nameEn')}
          value={form.nameEn}
          disabled={disabled}
          onChange={(event) => patch('nameEn', event.target.value)}
        />
        <FormField
          label={t('workplace.services.catalog.providerCode')}
          value={form.providerCode}
          disabled={disabled}
          onChange={(event) => patch('providerCode', event.target.value)}
        />
        <FormField
          label={screenCopy.currency}
          value={form.currency}
          disabled={disabled}
          onChange={(event) => patch('currency', event.target.value.toUpperCase())}
        />
        <FormField
          type="number"
          label={t('workplace.services.catalog.unitPrice')}
          value={form.unitPrice}
          disabled={disabled}
          onChange={(event) => patch('unitPrice', Number(event.target.value))}
        />
        <FormField
          type="number"
          label={t('workplace.services.catalog.orderCutoff')}
          value={form.orderCutoffMinutes}
          disabled={disabled}
          onChange={(event) => patch('orderCutoffMinutes', Number(event.target.value))}
        />
        <FormField
          type="number"
          label={t('workplace.services.catalog.cancelCutoff')}
          value={form.cancellationCutoffMinutes}
          disabled={disabled}
          onChange={(event) => patch('cancellationCutoffMinutes', Number(event.target.value))}
        />
        <FormField
          type="number"
          label={t('workplace.services.catalog.slaResponseMinutes')}
          value={form.slaResponseMinutes}
          inputProps={{ min: 1 }}
          disabled={disabled}
          onChange={(event) => patch('slaResponseMinutes', Number(event.target.value))}
        />
        <FormField
          type="number"
          label={t('workplace.services.catalog.slaFulfillmentLeadMinutes')}
          value={form.slaFulfillmentLeadMinutes}
          inputProps={{ min: 0 }}
          disabled={disabled}
          onChange={(event) => patch('slaFulfillmentLeadMinutes', Number(event.target.value))}
        />
        <FormField
          type="number"
          label={t('workplace.services.catalog.minimumQuantity')}
          value={form.minimumQuantity}
          disabled={disabled}
          onChange={(event) => patch('minimumQuantity', Number(event.target.value))}
        />
        <FormField
          type="number"
          label={t('workplace.services.catalog.maximumQuantity')}
          value={form.maximumQuantity}
          disabled={disabled}
          onChange={(event) => patch('maximumQuantity', Number(event.target.value))}
        />
      </Box>
      <FormField
        multiline
        minRows={2}
        label={t('workplace.services.catalog.descriptionKo')}
        value={form.descriptionKo ?? ''}
        disabled={disabled}
        onChange={(event) => patch('descriptionKo', event.target.value || null)}
      />
      <FormField
        multiline
        minRows={2}
        label={t('workplace.services.catalog.descriptionEn')}
        value={form.descriptionEn ?? ''}
        disabled={disabled}
        onChange={(event) => patch('descriptionEn', event.target.value || null)}
      />
      <Typography component="h3" variant="subtitle2">
        {t('workplace.services.catalog.resourceTypes')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {resourceTypes.map((value) => (
          <FormControlLabel
            key={value}
            control={
              <Checkbox
                checked={form.supportedResourceTypes.includes(value)}
                disabled={disabled}
                onChange={(event) =>
                  patch(
                    'supportedResourceTypes',
                    event.target.checked
                      ? [...form.supportedResourceTypes, value]
                      : form.supportedResourceTypes.filter((item) => item !== value)
                  )
                }
              />
            }
            label={value}
          />
        ))}
      </Stack>
      <Typography component="h3" variant="subtitle2">
        {t('workplace.services.catalog.siteScope')}
      </Typography>
      {sitesQuery.isLoading || sitesQuery.isPending ? (
        <InlineFeedback severity="info">{screenCopy.sitesLoading}</InlineFeedback>
      ) : null}
      {sitesQuery.isError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void sitesQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {screenCopy.sitesError}
        </InlineFeedback>
      ) : null}
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {(sitesQuery.data ?? []).map((site) => (
          <FormControlLabel
            key={site.siteId}
            control={
              <Checkbox
                checked={form.siteScope.includes(site.siteId)}
                disabled={disabled}
                onChange={(event) =>
                  patch(
                    'siteScope',
                    event.target.checked
                      ? [...form.siteScope, site.siteId]
                      : form.siteScope.filter((id) => id !== site.siteId)
                  )
                }
              />
            }
            label={korean ? site.nameKo : site.nameEn}
          />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t('workplace.services.catalog.emptySiteScope')}
      </Typography>
      <WorkplaceServiceOptionSchemaEditor
        rows={optionRows}
        onChange={setOptionRows}
        disabled={disabled}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
        <SelectField
          label={t('workplace.services.extensions.capacityMode')}
          value={form.capacityMode}
          options={(['UNBOUNDED', 'BUCKETED'] as const).map((value) => ({
            value,
            label: t(`workplace.services.extensions.capacityModes.${value}`),
          }))}
          onValueChange={(value) => value && patch('capacityMode', value)}
          disabled={disabled}
        />
        <FormField
          type="number"
          label={t('workplace.services.extensions.capacityFreshnessSeconds')}
          value={form.capacityFreshnessSeconds}
          inputProps={{ min: 30, max: 86400, step: 30 }}
          onChange={(event) => patch('capacityFreshnessSeconds', Number(event.target.value))}
          disabled={disabled}
        />
        <SelectField
          label={t('workplace.services.extensions.inspectionMode')}
          value={form.inspectionMode}
          options={(['NONE', 'OPERATOR', 'REQUESTER'] as const).map((value) => ({
            value,
            label: t(`workplace.services.extensions.inspectionModes.${value}`),
          }))}
          onValueChange={(value) => value && patch('inspectionMode', value)}
          disabled={disabled}
        />
      </Box>
      {form.inspectionMode !== 'NONE' ? (
        <WorkplaceServiceOptionSchemaEditor
          kind="inspection"
          rows={inspectionRows}
          onChange={setInspectionRows}
          disabled={disabled}
        />
      ) : null}
      {form.capacityMode === 'BUCKETED' ? (
        <WorkplaceServiceCapacityAdmin
          catalogItemId={selected?.item.catalogItemId ?? null}
          siteId={form.siteScope[0] ?? null}
          canManage={capabilities.canManageWorkplaceAdmin}
          elevated={elevated}
        />
      ) : null}
      <FormField
        label={t('workplace.services.catalog.cancellationPolicyKo')}
        value={form.cancellationPolicyKo}
        disabled={disabled}
        onChange={(event) => patch('cancellationPolicyKo', event.target.value)}
      />
      <FormField
        label={t('workplace.services.catalog.cancellationPolicyEn')}
        value={form.cancellationPolicyEn}
        disabled={disabled}
        onChange={(event) => patch('cancellationPolicyEn', event.target.value)}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <FormControlLabel
          control={
            <Checkbox
              checked={form.requiresAttendeeCount}
              disabled={disabled}
              onChange={(event) => patch('requiresAttendeeCount', event.target.checked)}
            />
          }
          label={t('workplace.services.catalog.requireAttendees')}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.requiresCostCenter}
              disabled={disabled}
              onChange={(event) => patch('requiresCostCenter', event.target.checked)}
            />
          }
          label={t('workplace.services.catalog.requireCostCenter')}
        />
      </Stack>
      <FormField
        label={t('workplace.services.changeReason')}
        value={form.reason}
        inputProps={{ maxLength: 500 }}
        disabled={disabled}
        onChange={(event) => patch('reason', event.target.value)}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={confirmed}
            disabled={disabled}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
        }
        label={t('workplace.services.catalog.confirmation')}
      />
      {mutation.isError && (
        <InlineFeedback severity="error">{t('workplace.services.commandError')}</InlineFeedback>
      )}
      <ActionButton
        intent="primary"
        loading={mutation.isPending}
        disabled={disabled || !valid || !confirmed}
        onClick={() => {
          if (!disabled && valid && confirmed) mutation.mutate();
        }}
      >
        {selected ? t('actions.save') : t('workplace.services.catalog.create')}
      </ActionButton>
    </Stack>
  );
}
