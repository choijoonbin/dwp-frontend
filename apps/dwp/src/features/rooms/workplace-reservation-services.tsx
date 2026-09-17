import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, BriefcaseBusiness, ChevronDown, RefreshCw, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceIdempotencyKey,
  getWorkplaceServiceCatalog,
  getWorkplaceServiceOrder,
  previewWorkplaceServiceOrder,
  resolveIdempotentMutationIntent,
  submitWorkplaceServiceOrder,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import {
  ServiceCatalogChoice,
  ServiceConfigurationCard,
  disclosureSx,
  serviceOrderStages,
} from './workplace-reservation-service-cards';
import { WorkplaceServiceCapacityTimeline } from './workplace-service-capacity-timeline';
import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  requireWorkplaceServiceWrite,
  serviceSelectionIsValid,
  workplaceServiceLimitationMessage,
  workplaceServiceReference,
} from './workplace-services-ui-model';

import type { ServiceOrderStage } from './workplace-reservation-service-cards';
import type {
  IdempotentMutationIntent,
  WorkplaceServiceOrderPreview,
  WorkplaceServiceReservationAuthority,
} from '@dwp-frontend/shared-utils';

type Props = {
  reservationId: string;
  reservationAuthority: WorkplaceServiceReservationAuthority;
  reservationVersion: number;
  attendeeCount: number | null;
  sourceReady: boolean;
};

export function WorkplaceReservationServices({
  reservationId,
  reservationAuthority,
  reservationVersion,
  attendeeCount,
  sourceReady,
}: Props) {
  const { t, i18n } = useTranslation('rooms');
  const { t: tCommon } = useTranslation('common');
  const capabilities = useRoomsCapabilities();
  const queryClient = useQueryClient();
  const scope = `${reservationAuthority}:${reservationId}:${reservationVersion}`;
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [optionsByItem, setOptionsByItem] = useState<Record<string, Record<string, unknown>>>({});
  const [people, setPeople] = useState(Math.max(1, attendeeCount ?? 1));
  const [costCenter, setCostCenter] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [preview, setPreview] = useState<WorkplaceServiceOrderPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<ServiceOrderStage>('catalog');
  const [requestDetailsOpen, setRequestDetailsOpen] = useState(true);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const submitIntent = useRef<IdempotentMutationIntent | null>(null);

  useEffect(() => {
    setSelectedIds([]);
    setQuantities({});
    setOptionsByItem({});
    setPeople(Math.max(1, attendeeCount ?? 1));
    setCostCenter('');
    setSpecialRequest('');
    setPreview(null);
    setConfirmed(false);
    setStage('catalog');
    setRequestDetailsOpen(true);
    setSubmittedOrderId(null);
    submitIntent.current = null;
  }, [scope, attendeeCount]);

  const catalogQuery = useQuery({
    queryKey: ['workplace', 'services', 'catalog', reservationAuthority, reservationId],
    queryFn: () => getWorkplaceServiceCatalog(reservationAuthority, reservationId),
    enabled: sourceReady && capabilities.isLoaded && capabilities.canViewWorkplace,
    retry: 1,
  });
  const recoveryQuery = useQuery({
    queryKey: ['workplace', 'services', 'order', submittedOrderId],
    queryFn: () => getWorkplaceServiceOrder(submittedOrderId!),
    enabled: Boolean(submittedOrderId),
  });
  const selectedItems = useMemo(
    () => catalogQuery.data?.items.filter((item) => selectedIds.includes(item.catalogItemId)) ?? [],
    [catalogQuery.data, selectedIds]
  );
  const selectionValid = useMemo(
    () => serviceSelectionIsValid(selectedItems, quantities, optionsByItem),
    [optionsByItem, quantities, selectedItems]
  );
  const canWrite =
    sourceReady &&
    capabilities.isLoaded &&
    capabilities.canUpdateWorkplaceBooking &&
    selectedItems.length > 0 &&
    selectionValid &&
    people >= 1 &&
    people <= 10_000 &&
    specialRequest.length <= 2000 &&
    selectedItems.every((item) => item.providerState === 'READY');

  const previewMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(canWrite);
      return previewWorkplaceServiceOrder(reservationId, {
        reservationAuthority,
        expectedReservationVersion: reservationVersion,
        attendeeCount: people,
        costCenter: costCenter.trim() || null,
        specialRequest: specialRequest.trim() || null,
        lines: selectedItems.map((item) => ({
          catalogItemId: item.catalogItemId,
          quantity: quantities[item.catalogItemId] ?? item.minimumQuantity,
          options: optionsByItem[item.catalogItemId] ?? {},
        })),
      });
    },
    onSuccess: (result) => {
      setPreview(result);
      setConfirmed(false);
      setStage('review');
    },
  });
  const submitMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(canWrite && Boolean(preview?.eligible) && confirmed);
      const input = {
        previewId: preview!.previewId,
        expectedReservationVersion: preview!.reservationVersion,
        explicitConfirmation: true as const,
        reason: specialRequest.trim() || t('workplace.services.defaultReason'),
      };
      const intent = resolveIdempotentMutationIntent(submitIntent.current, input, () =>
        createWorkplaceIdempotencyKey('service-order-submit')
      );
      submitIntent.current = intent;
      return submitWorkplaceServiceOrder(reservationId, input, { idempotencyKey: intent.key });
    },
    retry: false,
    onSuccess: (result) => {
      submitIntent.current = null;
      setSubmittedOrderId(result.order.serviceOrderId);
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services', 'orders'] });
    },
  });
  const disabled = previewMutation.isPending || submitMutation.isPending;
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const stageIndex = serviceOrderStages.indexOf(stage);
  const catalog = catalogQuery.data;
  const canConfigure =
    capabilities.canUpdateWorkplaceBooking &&
    selectedItems.length > 0 &&
    selectedItems.every((item) => item.providerState === 'READY');

  if (!sourceReady) {
    return (
      <InlineFeedback severity="warning">
        {t('workplace.services.reservationSourceUnavailable')}
      </InlineFeedback>
    );
  }
  if (!capabilities.isLoaded || catalogQuery.isLoading) {
    return <Typography color="text.secondary">{t('workplace.services.loading')}</Typography>;
  }
  if (!capabilities.canViewWorkplace) {
    return <InlineFeedback severity="warning">{t('workplace.services.denied')}</InlineFeedback>;
  }
  if (catalogQuery.isError) {
    return (
      <InlineFeedback
        severity="error"
        action={
          <ActionButton intent="quiet" onClick={() => void catalogQuery.refetch()}>
            {t('actions.retry')}
          </ActionButton>
        }
      >
        {t('workplace.services.catalogError')}
      </InlineFeedback>
    );
  }
  if (submittedOrderId) {
    const order = recoveryQuery.data;
    return (
      <Stack spacing={1.5} data-testid="workplace-reservation-services-result">
        <InlineFeedback
          severity={order?.state === 'RESULT_UNKNOWN' ? 'warning' : 'success'}
          icon={
            order?.state === 'RESULT_UNKNOWN' ? <ShieldAlert size={18} /> : <BadgeCheck size={18} />
          }
        >
          {order?.state === 'RESULT_UNKNOWN'
            ? t('workplace.services.resultUnknown')
            : t('workplace.services.submitted')}
        </InlineFeedback>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {t('workplace.services.orderReference', {
            id: workplaceServiceReference('order', submittedOrderId),
          })}
        </Typography>
        <ActionButton
          intent="secondary"
          startIcon={<RefreshCw size={16} />}
          loading={recoveryQuery.isFetching}
          onClick={() => void recoveryQuery.refetch()}
        >
          {t('workplace.services.refreshReceipt')}
        </ActionButton>
      </Stack>
    );
  }

  return (
    <Stack
      spacing={1.5}
      data-testid="workplace-reservation-services"
      sx={{ width: 1, minWidth: 0, overflowWrap: 'anywhere' }}
    >
      <Stack direction="row" gap={1} alignItems="flex-start">
        <BriefcaseBusiness size={18} aria-hidden="true" style={{ flex: '0 0 auto' }} />
        <Box minWidth={0}>
          <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
            {t('workplace.services.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workplace.services.description')}
          </Typography>
        </Box>
      </Stack>
      <Box component="details" sx={disclosureSx}>
        <Stack
          component="summary"
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Box minWidth={0}>
            <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
              {t('workplace.services.mobile.reservationSummary')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {catalog?.resourceReference ?? t('workplace.services.reservation')}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.5} alignItems="center">
            <Chip
              size="small"
              label={t('workplace.services.mobile.selected', { count: selectedItems.length })}
            />
            <ChevronDown className="WorkplaceServiceDisclosure-icon" size={18} aria-hidden="true" />
          </Stack>
        </Stack>
        <Stack spacing={0.5} px={1.25} pb={1.25}>
          {catalog ? (
            <Typography variant="body2" color="text.secondary">
              {t('workplace.services.reservationWindow', {
                start: formatDate(
                  catalog.reservationStartsAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  locale
                ),
                end: formatDate(
                  catalog.reservationEndsAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  locale
                ),
              })}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {t('workplace.services.attendeeCount')}: {people}
          </Typography>
        </Stack>
      </Box>

      <Stack
        component="ol"
        direction="row"
        spacing={0.5}
        aria-label={t('workplace.services.mobile.workflowLabel')}
        sx={{ p: 0, m: 0, minWidth: 0 }}
      >
        {serviceOrderStages.map((value, index) => (
          <Box component="li" key={value} sx={{ minWidth: 0, listStyle: 'none', flex: 1 }}>
            <Chip
              size="small"
              color={index < stageIndex ? 'success' : 'default'}
              variant="outlined"
              aria-current={index === stageIndex ? 'step' : undefined}
              label={`${index + 1}. ${t(`workplace.services.mobile.stages.${value}`)}`}
              sx={{
                width: 1,
                minHeight: 32,
                ...(index === stageIndex
                  ? {
                      bgcolor: 'action.selected',
                      borderColor: 'primary.main',
                      color: 'text.primary',
                      fontWeight: 'fontWeightBold',
                    }
                  : {}),
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" role="status">
        {t('workplace.services.mobile.stageStatus', {
          current: stageIndex + 1,
          total: serviceOrderStages.length,
        })}
      </Typography>

      {stage === 'catalog' ? (
        <Stack spacing={1.25} aria-labelledby="workplace-services-catalog-title">
          <Box>
            <Typography
              id="workplace-services-catalog-title"
              component="h4"
              variant="subtitle1"
              fontWeight="fontWeightBold"
            >
              {t('workplace.services.mobile.catalogTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.services.mobile.catalogDescription')}
            </Typography>
          </Box>
          {catalog?.items.length ? (
            catalog.items.map((item) => (
              <ServiceCatalogChoice
                key={item.catalogItemId}
                item={item}
                selected={selectedIds.includes(item.catalogItemId)}
                disabled={disabled || !capabilities.canUpdateWorkplaceBooking}
                onSelected={(selected) => {
                  setSelectedIds((current) =>
                    selected
                      ? [...current, item.catalogItemId]
                      : current.filter((id) => id !== item.catalogItemId)
                  );
                  setPreview(null);
                  setConfirmed(false);
                }}
              />
            ))
          ) : (
            <InlineFeedback severity="info">
              {t('workplace.services.mobile.noServices')}
            </InlineFeedback>
          )}
        </Stack>
      ) : stage === 'configure' ? (
        <Stack spacing={1.25} aria-labelledby="workplace-services-configuration-title">
          <Box>
            <Typography
              id="workplace-services-configuration-title"
              component="h4"
              variant="subtitle1"
              fontWeight="fontWeightBold"
            >
              {t('workplace.services.mobile.configurationTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.services.mobile.configurationDescription')}
            </Typography>
          </Box>
          {selectedItems.map((item, index) => (
            <Stack key={item.catalogItemId} spacing={1}>
              <ServiceConfigurationCard
                item={item}
                quantity={quantities[item.catalogItemId] ?? item.minimumQuantity}
                optionValues={optionsByItem[item.catalogItemId] ?? {}}
                disabled={disabled}
                defaultOpen={index === 0}
                onQuantity={(quantity) => {
                  setQuantities((current) => ({ ...current, [item.catalogItemId]: quantity }));
                  setPreview(null);
                }}
                onOption={(key, value) => {
                  setOptionsByItem((current) => ({
                    ...current,
                    [item.catalogItemId]: {
                      ...current[item.catalogItemId],
                      [key]: value,
                    },
                  }));
                  setPreview(null);
                }}
              />
              <WorkplaceServiceCapacityTimeline
                catalogItemId={item.catalogItemId}
                siteId={catalog?.siteReference ?? null}
                startsAt={catalog?.reservationStartsAt ?? ''}
                endsAt={catalog?.reservationEndsAt ?? ''}
              />
            </Stack>
          ))}
          <Box
            component="details"
            open={requestDetailsOpen}
            onToggle={(event) => setRequestDetailsOpen(event.currentTarget.open)}
            sx={disclosureSx}
          >
            <Stack
              component="summary"
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
            >
              <Typography component="h5" variant="subtitle2" fontWeight="fontWeightBold">
                {t('workplace.services.mobile.requestDetails')}
              </Typography>
              <ChevronDown
                className="WorkplaceServiceDisclosure-icon"
                size={18}
                aria-hidden="true"
              />
            </Stack>
            <Stack spacing={1.25} px={1.25} pb={1.25}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, .7fr) minmax(0, 1fr)' },
                  gap: 1.25,
                  minWidth: 0,
                }}
              >
                <FormField
                  type="number"
                  label={t('workplace.services.attendeeCount')}
                  value={people}
                  disabled={disabled}
                  slotProps={{ htmlInput: { min: 1, max: 10_000 } }}
                  onChange={(event) => {
                    setPeople(Number(event.target.value));
                    setPreview(null);
                  }}
                  sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
                />
                <FormField
                  label={t('workplace.services.costCenter')}
                  value={costCenter}
                  disabled={disabled}
                  onChange={(event) => {
                    setCostCenter(event.target.value);
                    setPreview(null);
                  }}
                  sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
                />
              </Box>
              <FormField
                multiline
                minRows={2}
                label={t('workplace.services.specialRequest')}
                value={specialRequest}
                disabled={disabled}
                inputProps={{ maxLength: 2000 }}
                onChange={(event) => {
                  setSpecialRequest(event.target.value);
                  setPreview(null);
                }}
              />
            </Stack>
          </Box>
        </Stack>
      ) : preview ? (
        <Stack
          spacing={1.25}
          aria-labelledby="workplace-services-review-title"
          data-testid="workplace-reservation-services-preview"
        >
          <Box>
            <Typography
              id="workplace-services-review-title"
              component="h4"
              variant="subtitle1"
              fontWeight="fontWeightBold"
            >
              {t('workplace.services.mobile.reviewTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.services.mobile.reviewDescription')}
            </Typography>
          </Box>
          <Box
            sx={(theme) => ({
              ...workplaceMemberSoftSurface(theme),
              p: 1.5,
              border: `1px solid ${theme.palette.divider}`,
              minWidth: 0,
            })}
          >
            <Stack direction="row" justifyContent="space-between" gap={1} alignItems="baseline">
              <Typography component="h5" variant="subtitle2" fontWeight="fontWeightBold">
                {t('workplace.services.previewTitle')}
              </Typography>
              <Typography variant="subtitle2" fontWeight="fontWeightBold" textAlign="right">
                {formatNumber(preview.estimatedCost, undefined, locale)} {preview.currency}
              </Typography>
            </Stack>
            <Stack component="ul" spacing={0.75} sx={{ p: 0, m: 0, mt: 1.25 }}>
              {preview.lines.map((line) => (
                <Stack
                  component="li"
                  direction="row"
                  justifyContent="space-between"
                  gap={1}
                  key={line.catalogItemId}
                  sx={{ listStyle: 'none', minWidth: 0 }}
                >
                  <Typography variant="body2" minWidth={0}>
                    {t('workplace.services.mobile.lineSummary', {
                      quantity: line.quantity,
                      name: korean ? line.nameKo : line.nameEn,
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="right">
                    {formatNumber(line.estimatedCost, undefined, locale)} {preview.currency}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            {preview.limitations.length > 0 && (
              <InlineFeedback severity="warning" sx={{ mt: 1.25 }}>
                {Array.from(
                  new Set(
                    preview.limitations.map((limitation) =>
                      workplaceServiceLimitationMessage(limitation, locale)
                    )
                  )
                ).join(' ')}
              </InlineFeedback>
            )}
            <FormControlLabel
              sx={{ mt: 1, mx: 0, minHeight: 44, alignItems: 'flex-start' }}
              control={
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  sx={{ width: 44, height: 44, flex: '0 0 44px' }}
                />
              }
              label={t('workplace.services.explicitConfirmation')}
            />
          </Box>
        </Stack>
      ) : null}

      {previewMutation.isError || submitMutation.isError ? (
        <InlineFeedback severity="error">{t('workplace.services.commandError')}</InlineFeedback>
      ) : null}
      <Box
        aria-hidden="true"
        sx={{
          display: { xs: 'block', sm: 'none' },
          minHeight: 'calc(96px + env(safe-area-inset-bottom))',
        }}
      />
      <Stack
        direction={{ xs: 'column-reverse', sm: 'row' }}
        gap={1}
        sx={(theme) => ({
          position: { xs: 'sticky', sm: 'static' },
          bottom: 0,
          zIndex: 2,
          p: 1,
          pb: { xs: 'max(8px, env(safe-area-inset-bottom))', sm: 1 },
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: theme.palette.background.paper,
        })}
      >
        {stage === 'catalog' ? (
          <ActionButton
            intent="primary"
            disabled={!canConfigure}
            onClick={() => setStage('configure')}
            sx={{ minHeight: 44, flex: 1 }}
          >
            {t('workplace.services.mobile.continue')}
          </ActionButton>
        ) : stage === 'configure' ? (
          <>
            <ActionButton
              intent="quiet"
              onClick={() => setStage('catalog')}
              disabled={disabled}
              sx={{ minHeight: 44, flex: 1 }}
            >
              {t('workplace.services.mobile.changeSelection')}
            </ActionButton>
            <ActionButton
              intent="primary"
              loading={previewMutation.isPending}
              disabled={!canWrite}
              onClick={() => previewMutation.mutate()}
              sx={{ minHeight: 44, flex: 1 }}
            >
              {t('workplace.services.preview')}
            </ActionButton>
          </>
        ) : (
          <>
            <ActionButton
              intent="quiet"
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
                setStage('configure');
              }}
              disabled={disabled}
              sx={{ minHeight: 44, flex: 1 }}
            >
              {tCommon('actions.back')}
            </ActionButton>
            <ActionButton
              intent="primary"
              loading={submitMutation.isPending}
              disabled={!preview?.eligible || !confirmed || !canWrite}
              onClick={() => submitMutation.mutate()}
              sx={{ minHeight: 44, flex: 1 }}
            >
              {t('workplace.services.submit')}
            </ActionButton>
          </>
        )}
      </Stack>
    </Stack>
  );
}
