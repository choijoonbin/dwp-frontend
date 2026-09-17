import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, RadioTower } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  activateWorkplaceSafetyIncident,
  createWorkplaceIdempotencyKey,
  getAdminWorkplaceSafetyCommand,
  getWorkplaceSafetyActivationPreview,
  previewWorkplaceSafetyActivation,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard } from './workplace-member-surfaces';
import {
  WorkplaceSafetyAudienceEvidence,
  WorkplaceSafetyConnectorEvidence,
  WorkplaceSafetyReceiptEvidence,
} from './workplace-safety-evidence';
import { workplaceSafetyActivationBlocked } from './workplace-safety-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceSafetyActivationPreview,
  WorkplaceSafetyCommandReceipt,
  WorkplaceSafetyDeliveryChannel,
  WorkplaceSafetyIncidentCommandResult,
  WorkplaceSafetySeverity,
} from '@dwp-frontend/shared-utils';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const CHANNELS: readonly WorkplaceSafetyDeliveryChannel[] = [
  'APP_PUSH',
  'SMS',
  'EMAIL',
  'EBS',
  'BLE_MESH',
];

function split(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function WorkplaceSafetyActivation({
  canMutate,
  onActivated,
}: {
  canMutate: boolean;
  onActivated: (result: WorkplaceSafetyIncidentCommandResult) => void | Promise<void>;
}) {
  const { t } = useTranslation('rooms');
  const [incidentType, setIncidentType] = useState('EVACUATION');
  const [severity, setSeverity] = useState<WorkplaceSafetySeverity>('URGENT');
  const [siteId, setSiteId] = useState('');
  const [floorIds, setFloorIds] = useState('');
  const [zoneIds, setZoneIds] = useState('');
  const [message, setMessage] = useState('');
  const [safetyAction, setSafetyAction] = useState('');
  const [assemblyPoint, setAssemblyPoint] = useState('');
  const [excludedKeys, setExcludedKeys] = useState('');
  const [channels, setChannels] = useState<readonly WorkplaceSafetyDeliveryChannel[]>(['APP_PUSH']);
  const [reason, setReason] = useState('Activate the verified workplace safety response');
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<WorkplaceSafetyActivationPreview | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<WorkplaceSafetyCommandReceipt | null>(null);
  const [result, setResult] = useState<WorkplaceSafetyIncidentCommandResult | null>(null);
  const previewIntentRef = useRef<IdempotentMutationIntent | null>(null);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);

  const parsedFloorIds = useMemo(() => split(floorIds), [floorIds]);
  const parsedZoneIds = useMemo(() => split(zoneIds), [zoneIds]);
  const parsedExcludedKeys = useMemo(() => split(excludedKeys), [excludedKeys]);
  const inputValid =
    UUID.test(siteId.trim()) &&
    parsedFloorIds.length > 0 &&
    parsedFloorIds.every((id) => UUID.test(id)) &&
    parsedZoneIds.every((id) => UUID.test(id)) &&
    parsedExcludedKeys.every((key) => SHA256.test(key)) &&
    Boolean(incidentType.trim() && message.trim() && safetyAction.trim() && channels.length);

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!canMutate || !inputValid || !confirmed || !reason.trim()) {
        throw new Error('SAFETY_PREVIEW_BLOCKED');
      }
      const input = {
        incidentType: incidentType.trim(),
        severity,
        siteId: siteId.trim(),
        floorIds: parsedFloorIds,
        zoneIds: parsedZoneIds,
        message: message.trim(),
        safetyAction: safetyAction.trim(),
        assemblyPoint: assemblyPoint.trim() || null,
        channels,
        excludedSubjectKeys: parsedExcludedKeys,
        reason: reason.trim(),
        explicitConfirmation: true as const,
      };
      const intent = resolveIdempotentMutationIntent(previewIntentRef.current, input, () =>
        createWorkplaceIdempotencyKey('safety-activation-preview')
      );
      previewIntentRef.current = intent;
      return previewWorkplaceSafetyActivation(input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
        activeAccessMode: 'ELEVATED',
      });
    },
    retry: false,
    onSuccess: (next) => {
      previewIntentRef.current = null;
      setPreview(next.preview);
      setPreviewReceipt(next.receipt);
      setResult(null);
      setConfirmed(false);
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => {
      if (
        !preview ||
        previewReceipt?.state === 'RESULT_UNKNOWN' ||
        result?.receipt.state === 'RESULT_UNKNOWN' ||
        workplaceSafetyActivationBlocked(preview) ||
        !canMutate ||
        !confirmed ||
        !reason.trim()
      ) {
        throw new Error('SAFETY_ACTIVATION_BLOCKED');
      }
      const input = {
        activationPreviewId: preview.activationPreviewId,
        reason: reason.trim(),
        explicitConfirmation: true as const,
      };
      const intent = resolveIdempotentMutationIntent(intentRef.current, input, () =>
        createWorkplaceIdempotencyKey('safety-activate')
      );
      intentRef.current = intent;
      return activateWorkplaceSafetyIncident(input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
        activeAccessMode: 'ELEVATED',
      });
    },
    retry: false,
    onSuccess: async (next) => {
      intentRef.current = null;
      setResult(next);
      setConfirmed(false);
      if (next.receipt.state !== 'RESULT_UNKNOWN') await onActivated(next);
    },
  });

  const toggleChannel = (channel: WorkplaceSafetyDeliveryChannel, checked: boolean) => {
    setChannels((current) =>
      checked ? [...new Set([...current, channel])] : current.filter((item) => item !== channel)
    );
    setPreview(null);
  };

  return (
    <Box
      sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}
      data-testid="safety-activation"
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
            {t('workplace.safety.activation.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workplace.safety.activation.description')}
          </Typography>
        </Box>
        {!canMutate && (
          <InlineFeedback severity="warning">
            {t('workplace.safety.admin.elevationRequired')}
          </InlineFeedback>
        )}
        {!preview ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.25,
              }}
            >
              <FormField
                label={t('workplace.safety.fields.incidentType')}
                value={incidentType}
                onChange={(event) => setIncidentType(event.target.value)}
              />
              <SelectField
                label={t('workplace.safety.fields.severity')}
                value={severity}
                options={(['ADVISORY', 'URGENT', 'CRITICAL'] as const).map((value) => ({
                  value,
                  label: t(`workplace.safety.severities.${value}`),
                }))}
                onValueChange={(value) => value && setSeverity(value)}
              />
              <FormField
                label={t('workplace.safety.fields.siteId')}
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
              />
              <FormField
                label={t('workplace.safety.fields.floorIds')}
                supportingText={t('workplace.safety.fields.commaSeparated')}
                value={floorIds}
                onChange={(event) => setFloorIds(event.target.value)}
              />
              <FormField
                label={t('workplace.safety.fields.zoneIds')}
                supportingText={t('workplace.safety.fields.commaSeparated')}
                value={zoneIds}
                onChange={(event) => setZoneIds(event.target.value)}
              />
              <FormField
                label={t('workplace.safety.fields.assemblyPoint')}
                value={assemblyPoint}
                onChange={(event) => setAssemblyPoint(event.target.value)}
              />
            </Box>
            <FormField
              label={t('workplace.safety.fields.message')}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <FormField
              label={t('workplace.safety.fields.safetyAction')}
              value={safetyAction}
              onChange={(event) => setSafetyAction(event.target.value)}
            />
            <FormField
              label={t('workplace.safety.fields.excludedSubjectKeys')}
              supportingText={t('workplace.safety.fields.excludedSubjectKeysHint')}
              value={excludedKeys}
              onChange={(event) => setExcludedKeys(event.target.value)}
            />
            <FormField
              label={t('workplace.safety.fields.reason')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={t('workplace.safety.activation.previewConfirmation')}
            />
            <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
              <Typography component="legend" variant="subtitle2">
                {t('workplace.safety.fields.channels')}
              </Typography>
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                {CHANNELS.map((channel) => (
                  <FormControlLabel
                    key={channel}
                    control={
                      <Checkbox
                        checked={channels.includes(channel)}
                        onChange={(event) => toggleChannel(channel, event.target.checked)}
                      />
                    }
                    label={t(`workplace.safety.channels.${channel}`)}
                  />
                ))}
              </Stack>
            </Box>
            {previewMutation.isError && (
              <InlineFeedback severity="error">
                {t('workplace.safety.activation.previewError')}
              </InlineFeedback>
            )}
            <ActionButton
              intent="primary"
              startIcon={<RadioTower size={17} />}
              disabled={!canMutate || !inputValid || !confirmed || !reason.trim()}
              loading={previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {t('workplace.safety.actions.previewActivation')}
            </ActionButton>
          </>
        ) : (
          <>
            <WorkplaceSafetyAudienceEvidence audience={preview.audience} />
            <WorkplaceSafetyConnectorEvidence connectors={preview.connectorTruth} />
            {previewReceipt && <WorkplaceSafetyReceiptEvidence receipt={previewReceipt} />}
            {previewReceipt?.state === 'RESULT_UNKNOWN' && (
              <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
                {t('workplace.safety.recovery.getOnly')}
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={async () => {
                    const checked = await getWorkplaceSafetyActivationPreview(
                      preview.activationPreviewId
                    );
                    setPreview(checked);
                    setPreviewReceipt(null);
                  }}
                >
                  {t('workplace.safety.actions.recheck')}
                </ActionButton>
              </InlineFeedback>
            )}
            {(preview.limitations.length > 0 || workplaceSafetyActivationBlocked(preview)) && (
              <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
                {preview.limitations.length
                  ? preview.limitations.join(' · ')
                  : t('workplace.safety.activation.connectorBlocked')}
              </InlineFeedback>
            )}
            <FormField
              label={t('workplace.safety.fields.reason')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={t('workplace.safety.activation.confirmation', {
                count: preview.audience.finalTargetCount,
              })}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton intent="secondary" onClick={() => setPreview(null)}>
                {t('workplace.safety.actions.edit')}
              </ActionButton>
              <ActionButton
                intent="danger"
                startIcon={<RadioTower size={17} />}
                disabled={
                  !canMutate ||
                  previewReceipt?.state === 'RESULT_UNKNOWN' ||
                  result?.receipt.state === 'RESULT_UNKNOWN' ||
                  workplaceSafetyActivationBlocked(preview) ||
                  !confirmed ||
                  !reason.trim()
                }
                loading={activateMutation.isPending}
                onClick={() => activateMutation.mutate()}
              >
                {t('workplace.safety.actions.activate')}
              </ActionButton>
            </Stack>
            {activateMutation.isError && (
              <InlineFeedback severity="error">
                {t('workplace.safety.activation.activateError')}
              </InlineFeedback>
            )}
            {result && <WorkplaceSafetyReceiptEvidence receipt={result.receipt} />}
            {result?.receipt.state === 'RESULT_UNKNOWN' && (
              <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
                {t('workplace.safety.recovery.getOnly')}
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={async () => {
                    const receipt = await getAdminWorkplaceSafetyCommand(
                      result.incident.incidentId,
                      result.receipt.commandId
                    );
                    const checked = { ...result, receipt };
                    setResult(checked);
                    if (receipt.state !== 'RESULT_UNKNOWN') await onActivated(checked);
                  }}
                >
                  {t('workplace.safety.actions.recheck')}
                </ActionButton>
              </InlineFeedback>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}
