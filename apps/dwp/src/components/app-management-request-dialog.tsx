import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAppAdminPresetSelfServiceRequest,
  getAppAdminPresetSelfServiceOptions,
} from '@dwp-frontend/shared-utils/api/app-governance-api';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';
import { FormDialog } from '@dwp-frontend/design-system/components/dialogs/form-dialog';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { SelectField } from '@dwp-frontend/design-system/components/forms/select-field';
import {
  GuidedEmptyState,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system/components/states/state-panels';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function newRequestKey() {
  return `app-admin:${crypto.randomUUID()}`;
}

const AppManagementRequestScheduleFields = lazy(() =>
  import('./app-management-request-schedule-fields').then((module) => ({
    default: module.AppManagementRequestScheduleFields,
  }))
);

export function AppManagementRequestDialog({
  appResourceKey,
  requestedSurfaceId,
  onClose,
}: {
  appResourceKey: string | null;
  requestedSurfaceId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('work');
  const { t: tDisplay } = useTranslation('display');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [presetCode, setPresetCode] = useState('');
  const [resourceSetId, setResourceSetId] = useState('');
  const [validTo, setValidTo] = useState('');
  const [reviewDueAt, setReviewDueAt] = useState('');
  const [justification, setJustification] = useState('');
  const requestKey = useRef(newRequestKey());
  const optionsQuery = useQuery({
    queryKey: ['app-governance', 'self-service-options', appResourceKey],
    queryFn: () => getAppAdminPresetSelfServiceOptions(appResourceKey!),
    enabled: Boolean(appResourceKey),
    retry: 1,
  });
  const options = optionsQuery.data ?? [];
  const confirmedAppResourceKey = options[0]?.preset.appResourceKey;
  const safeRequestedSurface =
    requestedSurfaceId &&
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u.test(requestedSurfaceId) &&
    options.some(({ preset }) => requestedSurfaceId.startsWith(`${preset.productKey}.`))
      ? requestedSurfaceId
      : null;
  const selectedOption = options.find((option) => option.preset.presetCode === presetCode);
  const selectedResourceSet = selectedOption?.resourceSets.find(
    (resourceSet) => resourceSet.resourceSetId === resourceSetId
  );
  const validToMs = Date.parse(validTo);
  const reviewDueMs = Date.parse(reviewDueAt);
  const invalidValidity =
    Boolean(validTo) && (!Number.isFinite(validToMs) || validToMs <= Date.now());
  const invalidReview =
    Boolean(reviewDueAt) &&
    (!Number.isFinite(reviewDueMs) ||
      reviewDueMs <= Date.now() ||
      (Number.isFinite(validToMs) && reviewDueMs > validToMs));
  const valid =
    Boolean(selectedOption && selectedResourceSet && validTo && reviewDueAt) &&
    !invalidValidity &&
    !invalidReview &&
    justification.trim().length >= 10;
  const presetOptions = options.map(({ preset }) => ({
    value: preset.presetCode,
    label: `${preset.displayName} · ${tDisplay(`riskTiers.${preset.riskTier}`)}`,
  }));

  useEffect(() => {
    setPresetCode('');
    setResourceSetId('');
    setValidTo('');
    setReviewDueAt('');
    setJustification('');
    requestKey.current = newRequestKey();
  }, [appResourceKey]);

  const requestMutation = useMutation({
    mutationFn: () =>
      createAppAdminPresetSelfServiceRequest(
        {
          presetCode: selectedOption!.preset.presetCode,
          resourceSetId: selectedResourceSet!.resourceSetId,
          validTo,
          reviewDueAt,
          justification: justification.trim(),
        },
        requestKey.current
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'app-governance'] });
      toast.success(t('appsPage.managementRequest.requested'));
      requestKey.current = newRequestKey();
      onClose();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('appsPage.managementRequest.requestError')
      );
    },
  });

  return (
    <FormDialog
      open={Boolean(appResourceKey)}
      title={t('appsPage.managementRequest.title')}
      description={t('appsPage.managementRequest.description')}
      cancelLabel={t('appsPage.managementRequest.cancel')}
      submitLabel={t('appsPage.managementRequest.submit')}
      submittingLabel={t('appsPage.managementRequest.submitting')}
      busy={requestMutation.isPending}
      submitDisabled={!valid || optionsQuery.isPending || optionsQuery.isError}
      onClose={onClose}
      onSubmit={async () => {
        if (valid) await requestMutation.mutateAsync();
      }}
      maxWidth="sm"
    >
      {optionsQuery.isPending ? (
        <LoadingState label={t('appsPage.managementRequest.loading')} size="standard" />
      ) : optionsQuery.isError ? (
        <LocalErrorState
          title={t('appsPage.managementRequest.loadErrorTitle')}
          description={
            optionsQuery.error instanceof Error
              ? optionsQuery.error.message
              : t('appsPage.managementRequest.loadErrorDescription')
          }
          retryLabel={t('appsPage.managementRequest.retry')}
          retrying={optionsQuery.isFetching}
          onRetry={() => void optionsQuery.refetch()}
          size="standard"
        />
      ) : options.length === 0 ? (
        <GuidedEmptyState
          kind="permission"
          title={t('appsPage.managementRequest.emptyTitle')}
          description={t('appsPage.managementRequest.emptyDescription')}
        />
      ) : (
        <Stack gap={2} sx={{ pt: 0.5 }}>
          <Alert severity="info">{t('appsPage.managementRequest.pendingNotice')}</Alert>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t('appsPage.managementRequest.requestContext')}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
              {confirmedAppResourceKey}
            </Typography>
            {safeRequestedSurface && (
              <Typography variant="caption" color="text.secondary">
                {t('appsPage.managementRequest.requestedSurface', {
                  surface: safeRequestedSurface,
                })}
              </Typography>
            )}
          </Box>
          <SelectField
            required
            label={t('appsPage.managementRequest.preset')}
            value={presetCode}
            onValueChange={(value) => {
              setPresetCode(value);
              setResourceSetId('');
            }}
            options={presetOptions}
          />
          {selectedOption && (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="subtitle2">{selectedOption.preset.description}</Typography>
              <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                {selectedOption.preset.duties.map((duty) => (
                  <Chip
                    key={duty.dutyCode}
                    size="small"
                    variant="outlined"
                    label={`${duty.dutyCode} · ${tDisplay(`riskTiers.${duty.riskTier}`)}`}
                  />
                ))}
              </Stack>
            </Box>
          )}
          <SelectField
            required
            label={t('appsPage.managementRequest.scope')}
            value={resourceSetId}
            onValueChange={setResourceSetId}
            options={(selectedOption?.resourceSets ?? []).map((resourceSet) => ({
              value: resourceSet.resourceSetId,
              label: resourceSet.resourceSetName,
            }))}
          />
          <Suspense
            fallback={
              <LoadingState label={t('appsPage.managementRequest.loading')} size="standard" />
            }
          >
            <AppManagementRequestScheduleFields
              validTo={validTo}
              reviewDueAt={reviewDueAt}
              invalidValidity={invalidValidity}
              invalidReview={invalidReview}
              onValidToChange={setValidTo}
              onReviewDueAtChange={setReviewDueAt}
            />
          </Suspense>
          <FormField
            required
            multiline
            minRows={3}
            label={t('appsPage.managementRequest.justification')}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            supportingText={t('appsPage.managementRequest.justificationHelp')}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      )}
    </FormDialog>
  );
}
