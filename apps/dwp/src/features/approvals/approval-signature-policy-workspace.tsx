import { useTranslation } from 'react-i18next';
import { ArchiveRestore, PencilLine, RefreshCcw, Rocket, ShieldPlus } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import {
  APPROVAL_SIGNATURE_CLASSIFICATIONS,
  APPROVAL_SIGNATURE_PROVIDER_KINDS,
} from './approval-signature-policy-model';
import { approvalSignatureSourceState } from './approval-signature-source-state';
import { useApprovalSignaturePolicyController } from './use-approval-signature-policy-controller';
import { ApprovalSurface } from './approval-ui';
import type { SignatureProviderPolicyRules } from '@dwp-frontend/shared-utils/api/approval-signature-provider-policy-contract';

const policyFlags = [
  'signingEnabled',
  'requireVerifiedProviderAccount',
  'requireAuthenticatedWebhook',
  'requireTrustedCertificateChain',
  'requireFreshRevocationEvidence',
  'requireTrustedTimestamp',
  'requireComplianceWormStorage',
] as const;

export function ApprovalSignaturePolicyWorkspace() {
  const { t } = useTranslation('approvals');
  const controller = useApprovalSignaturePolicyController();
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  const editor = controller.editor;
  const policy = controller.policy.data;
  const overviewState = approvalSignatureSourceState(controller.overview);

  if (overviewState === 'LOADING')
    return <LoadingState label={label('policy')} variant="skeleton" size="compact" />;
  if (!controller.overview.data)
    return (
      <ErrorState
        title={label('policy')}
        description={t('admin.signaturePolicy.sourceUnavailable')}
        retryLabel={t('actions.retry')}
        retrying={controller.overview.isFetching}
        onRetry={() => void controller.refresh()}
      />
    );

  return (
    <Stack gap={2} minWidth={0} data-approval-signature-policy-workspace>
      {controller.feedback ? (
        <InlineFeedback severity="warning">
          {t(
            controller.feedback === 'UNKNOWN'
              ? 'admin.signaturePolicy.commandUnknown'
              : 'admin.signatureDiagnostics.sourceChanged'
          )}
        </InlineFeedback>
      ) : null}
      <ApprovalSurface
        title={t('admin.signaturePolicy.title')}
        meta={t('admin.signaturePolicy.description')}
        action={
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            <ActionIconButton
              label={t('actions.refresh')}
              tooltipDisablePortal
              loading={controller.overview.isFetching || controller.policy.isFetching}
              disabled={controller.busy}
              onClick={() => void controller.refresh()}
            >
              <RefreshCcw size={16} />
            </ActionIconButton>
            <ActionIconButton
              data-approval-signature-policy-edit
              label={t('actions.edit')}
              tooltipDisablePortal
              disabled={!controller.canEdit || controller.busy}
              onClick={controller.openEditor}
            >
              <PencilLine size={16} />
            </ActionIconButton>
          </Stack>
        }
      >
        <Stack gap={2} sx={{ p: 2, minWidth: 0 }}>
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <Chip
              size="small"
              color={policy?.published ? 'success' : 'default'}
              label={
                policy
                  ? t('admin.signatureDiagnostics.labels.policyVersion', {
                      version: policy.version,
                    })
                  : t('admin.signatureDiagnostics.labels.policyUnknown')
              }
            />
            {policy?.workingDraft ? (
              <Chip size="small" variant="outlined" label={label('workingDraft')} />
            ) : null}
            {controller.overview.data ? (
              <Chip
                size="small"
                variant="outlined"
                label={controller.overview.data.scope.resourceSetKey}
              />
            ) : null}
          </Stack>
          {controller.policyMissing ? (
            <InlineFeedback
              severity="warning"
              action={
                <ActionButton
                  intent="primary"
                  size="small"
                  startIcon={<ShieldPlus size={16} />}
                  loading={controller.busy}
                  disabled={!controller.canInitialize}
                  onClick={controller.initialize}
                >
                  {t('admin.signaturePolicy.initialize')}
                </ActionButton>
              }
            >
              {t('admin.signaturePolicy.initializeNotice')}
            </InlineFeedback>
          ) : null}
          {policy?.publishReview ? (
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0,1fr)',
                  sm: 'minmax(9rem,.35fr) minmax(0,1fr)',
                },
                gap: 1,
                typography: 'caption',
              }}
            >
              <Box component="dt" color="text.secondary">
                {label('reviewDigest')}
              </Box>
              <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                {policy.publishReview.reviewContentSha256}
              </Box>
              <Box component="dt" color="text.secondary">
                {label('highApproval')}
              </Box>
              <Box component="dd" sx={{ m: 0 }}>
                {policy.publishReview.reasonCodes.join(', ')}
              </Box>
            </Box>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
            <ActionButton
              data-approval-signature-worm
              intent="secondary"
              startIcon={<ArchiveRestore size={16} />}
              disabled={!controller.canInspectWorm || controller.busy}
              onClick={controller.openWorm}
            >
              {t('admin.signaturePolicy.inspectWorm')}
            </ActionButton>
            {policy?.workingDraft ? (
              <ActionButton
                data-approval-signature-policy-publish
                intent="primary"
                startIcon={<Rocket size={16} />}
                disabled={!controller.canPublish || controller.busy}
                onClick={controller.publish}
              >
                {t('actions.publish')}
              </ActionButton>
            ) : null}
          </Stack>
          <InlineFeedback severity="info">
            {t('admin.signaturePolicy.commandSeparation')}
          </InlineFeedback>
        </Stack>
      </ApprovalSurface>

      <FormDialog
        open={Boolean(editor)}
        title={label('workingDraft')}
        description={t('admin.signaturePolicy.editorDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        busy={controller.busy}
        submitDisabled={!controller.editorReady}
        onClose={controller.closeEditor}
        onSubmit={controller.save}
        maxWidth="md"
        mobileFullScreen
      >
        {editor ? (
          <PolicyEditor
            rules={editor.rules}
            configurationProviderId={editor.configurationProviderId}
            providers={controller.availableProviders.map((provider) => ({
              id: provider.providerId!,
              label: provider.displayName,
            }))}
            disabled={controller.busy}
            valid={controller.editorReady}
            onChange={controller.changeRules}
            onConfigurationChange={controller.changeConfigurationProvider}
          />
        ) : null}
      </FormDialog>

      <FormDialog
        open={controller.wormProviderId !== null}
        title={label('worm')}
        description={t('admin.signaturePolicy.wormDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.signaturePolicy.inspectWorm')}
        busy={controller.busy}
        submitDisabled={!controller.wormProviderId || Boolean(controller.feedback)}
        onClose={controller.closeWorm}
        onSubmit={() => void controller.inspectWorm()}
        maxWidth="sm"
        mobileFullScreen
      >
        <Stack gap={2}>
          <SelectField
            label={label('providers')}
            value={controller.wormProviderId ?? ''}
            disabled={controller.busy}
            options={controller.availableProviders.map((provider) => ({
              value: provider.providerId!,
              label: provider.displayName,
            }))}
            onValueChange={(value) => controller.changeWormProvider(value || null)}
          />
          <FormField
            label={t('admin.signaturePolicy.artifactId')}
            value={controller.wormArtifactId}
            disabled={controller.busy}
            onChange={(event) => controller.changeWormArtifact(event.target.value)}
          />
          <InlineFeedback severity="warning">{t('admin.signaturePolicy.wormTruth')}</InlineFeedback>
        </Stack>
      </FormDialog>
      <ApprovalHighRiskCommandDialog controller={controller.highRisk} />
    </Stack>
  );
}

function PolicyEditor({
  rules,
  configurationProviderId,
  providers,
  disabled,
  valid,
  onChange,
  onConfigurationChange,
}: {
  rules: SignatureProviderPolicyRules;
  configurationProviderId: string | null;
  providers: readonly { id: string; label: string }[];
  disabled: boolean;
  valid: boolean;
  onChange: (rules: SignatureProviderPolicyRules) => void;
  onConfigurationChange: (providerId: string | null) => void;
}) {
  const { t } = useTranslation('approvals');
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  return (
    <Stack
      gap={2}
      minWidth={0}
      sx={{
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          color: 'CanvasText',
          '& .MuiFormControlLabel-label': { color: 'CanvasText' },
        },
      }}
    >
      {policyFlags.map((key) => (
        <FormControlLabel
          key={key}
          label={label(key)}
          control={
            <Switch
              checked={rules[key]}
              disabled={
                disabled ||
                key === 'requireVerifiedProviderAccount' ||
                key === 'requireAuthenticatedWebhook'
              }
              onChange={(_event, checked) => onChange({ ...rules, [key]: checked })}
            />
          }
        />
      ))}
      <ChoiceGroup
        legend={label('requiredProviderKinds')}
        options={APPROVAL_SIGNATURE_PROVIDER_KINDS}
        selected={rules.requiredProviderKinds}
        disabled={disabled}
        render={(value) => t(`admin.signatureDiagnostics.kinds.${value}`)}
        onChange={(values) => onChange({ ...rules, requiredProviderKinds: values })}
      />
      <ChoiceGroup
        legend={label('allowedClassifications')}
        options={APPROVAL_SIGNATURE_CLASSIFICATIONS}
        selected={rules.allowedClassifications}
        disabled={disabled}
        render={(value) => value}
        onChange={(values) => onChange({ ...rules, allowedClassifications: values })}
      />
      <SelectField
        label={label('configurationBinding')}
        value={configurationProviderId ?? ''}
        disabled={disabled}
        options={[
          { value: '', label: label('none') },
          ...providers.map((provider) => ({ value: provider.id, label: provider.label })),
        ]}
        onValueChange={(value) => onConfigurationChange(value || null)}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
          gap: 2,
        }}
      >
        <FormField
          type="number"
          label={label('minimumRetentionDays')}
          value={Number.isFinite(rules.minimumRetentionDays) ? rules.minimumRetentionDays : ''}
          disabled={disabled}
          slotProps={{ htmlInput: { min: 1, max: 36_500, step: 1, inputMode: 'numeric' } }}
          onChange={(event) =>
            onChange({
              ...rules,
              minimumRetentionDays:
                event.target.value === '' ? Number.NaN : Number(event.target.value),
            })
          }
        />
        <FormField
          type="number"
          label={label('probeMaxAgeSeconds')}
          value={Number.isFinite(rules.probeMaxAgeSeconds) ? rules.probeMaxAgeSeconds : ''}
          disabled={disabled}
          slotProps={{ htmlInput: { min: 60, max: 86_400, step: 1, inputMode: 'numeric' } }}
          onChange={(event) =>
            onChange({
              ...rules,
              probeMaxAgeSeconds:
                event.target.value === '' ? Number.NaN : Number(event.target.value),
            })
          }
        />
      </Box>
      <FormField
        label={label('trustBundleId')}
        value={rules.trustBundleId ?? ''}
        disabled={disabled}
        onChange={(event) => onChange({ ...rules, trustBundleId: event.target.value || null })}
      />
      {!valid ? (
        <InlineFeedback severity="error">{t('admin.signaturePolicy.invalidRules')}</InlineFeedback>
      ) : null}
    </Stack>
  );
}

function ChoiceGroup<T extends string>({
  legend,
  options,
  selected,
  disabled,
  render,
  onChange,
}: {
  legend: string;
  options: readonly T[];
  selected: readonly T[];
  disabled: boolean;
  render: (value: T) => string;
  onChange: (values: readonly T[]) => void;
}) {
  return (
    <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
      <Box component="legend" sx={{ typography: 'subtitle2' }}>
        {legend}
      </Box>
      <Stack>
        {options.map((value) => (
          <FormControlLabel
            key={value}
            label={render(value)}
            control={
              <Checkbox
                checked={selected.includes(value)}
                disabled={disabled}
                onChange={(_event, checked) =>
                  onChange(
                    checked ? [...selected, value] : selected.filter((item) => item !== value)
                  )
                }
              />
            }
          />
        ))}
      </Stack>
    </Box>
  );
}
