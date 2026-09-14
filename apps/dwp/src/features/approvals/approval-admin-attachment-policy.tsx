import { useTranslation } from 'react-i18next';
import { Check, FileLock2, Minus, PencilLine, RefreshCcw, Rocket } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import { APPROVAL_ATTACHMENT_MEDIA_TYPES } from '@dwp-frontend/shared-utils/api/approval-attachment-contract';
import { ApprovalSurface } from './approval-ui';
import { readApprovalAttachmentRules } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';
import type {
  ApprovalAttachmentPolicy,
  ApprovalAttachmentRules,
} from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';

const bounds = [
  ['maxFileBytes', 1, 26_214_400],
  ['maxFiles', 1, 10],
  ['maxRequestBytes', 1, 104_857_600],
  ['maxConcurrentUploads', 1, 2],
  ['grantTtlSeconds', 60, 900],
  ['retentionDays', 1, 3650],
] as const;
const flags = ['allowUpload', 'allowDownload'] as const;
const properties = [...flags, ...bounds.map(([key]) => key), 'allowedMediaTypes'] as const;
export function approvalAttachmentPolicyRulesValid(rules: ApprovalAttachmentRules) {
  try {
    readApprovalAttachmentRules(rules);
    return true;
  } catch {
    return false;
  }
}
type Props = {
  policy: ApprovalAttachmentPolicy;
  draft: ApprovalAttachmentRules | null;
  draftPolicy: ApprovalAttachmentPolicy | null;
  canEdit: boolean;
  canPublish: boolean;
  busy: boolean;
  refreshing: boolean;
  draftReady: boolean;
  draftLocked: boolean;
  onEdit: () => void;
  onReview: () => void;
  onRefresh: () => void;
  onChange: (rules: ApprovalAttachmentRules) => void;
  onSave: () => void;
  onClose: () => void;
};

export function ApprovalAdminAttachmentPolicy(props: Props) {
  const { t } = useTranslation('approvals');
  const { policy, draft, draftPolicy } = props;
  const renderValue = (
    value: ApprovalAttachmentRules[keyof ApprovalAttachmentRules] | undefined
  ) => {
    if (typeof value === 'boolean')
      return (
        <Box
          component="span"
          role="img"
          aria-label={t(`admin.document.${value ? 'enabled' : 'disabled'}`)}
        >
          {value ? <Check size={16} /> : <Minus size={16} />}
        </Box>
      );
    if (Array.isArray(value))
      return (
        <Stack gap={0.5} alignItems="flex-end">
          {value.map((type) => (
            <Box key={type} sx={{ typography: 'caption', overflowWrap: 'anywhere' }}>
              {type}
            </Box>
          ))}
        </Stack>
      );
    return typeof value === 'number' ? value : '-';
  };
  return (
    <>
      <ApprovalSurface
        title={t('admin.attachmentPolicy.title')}
        meta={t('admin.attachmentPolicy.description')}
        action={
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            <ActionIconButton
              label={t('actions.refresh')}
              tooltipDisablePortal
              loading={props.refreshing}
              onClick={props.onRefresh}
            >
              <RefreshCcw size={16} />
            </ActionIconButton>
            <ActionIconButton
              label={t('admin.attachmentPolicy.edit')}
              tooltipDisablePortal
              disabled={!props.canEdit || props.busy}
              onClick={props.onEdit}
            >
              <PencilLine size={16} />
            </ActionIconButton>
          </Stack>
        }
      >
        <Stack gap={2} sx={{ p: 2, minWidth: 0 }}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <FileLock2 size={18} />
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t('admin.document.scope')}
            </Box>
            <Chip size="small" variant="outlined" label={policy.resourceSetKey} />
            <Chip size="small" label={`v${policy.version}`} />
          </Stack>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
              gap: 2,
            }}
          >
            {(['providerReadiness', 'downloadReadiness'] as const).map((key) => (
              <Box key={key}>
                <Box component="dt" sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {t(`admin.attachmentPolicy.${key}`)}
                </Box>
                <Box component="dd" sx={{ m: 0, typography: 'body2', overflowWrap: 'anywhere' }}>
                  {policy[key]}
                </Box>
              </Box>
            ))}
          </Box>
          <AttachmentPolicyComparison policy={policy} />
          <InlineFeedback severity="info">
            {t('admin.attachmentPolicy.readinessNotice')}
          </InlineFeedback>
          <InlineFeedback severity={policy.publishEligible ? 'info' : 'warning'}>
            {t(`admin.attachmentPolicy.reason.${policy.publishReason}`)}
          </InlineFeedback>
          {policy.pending ? (
            <ActionButton
              intent="primary"
              startIcon={<Rocket size={16} />}
              disabled={!props.canPublish || props.busy}
              onClick={props.onReview}
            >
              {t('actions.publish')}
            </ActionButton>
          ) : null}
        </Stack>
      </ApprovalSurface>
      <FormDialog
        open={Boolean(draft && draftPolicy)}
        title={t('admin.attachmentPolicy.edit')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        busy={props.busy}
        submitDisabled={!props.draftReady || !draft || !approvalAttachmentPolicyRulesValid(draft)}
        onClose={props.onClose}
        onSubmit={props.onSave}
        maxWidth="md"
        mobileFullScreen
      >
        {draft && draftPolicy ? (
          <Stack gap={2}>
            <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {`${draftPolicy.resourceSetKey} · v${draftPolicy.version} · `}
              {draftPolicy.pendingRulesSha256 ?? draftPolicy.publishedRulesSha256}
            </Box>
            {!props.draftReady ? (
              <InlineFeedback severity="warning">
                {t('admin.attachmentPolicy.sourceChanged')}
              </InlineFeedback>
            ) : null}
            {flags.map((key) => (
              <FormControlLabel
                key={key}
                label={t(`admin.attachmentPolicy.${key}`)}
                control={
                  <Switch
                    checked={draft[key]}
                    disabled={!props.draftReady || props.busy || props.draftLocked}
                    onChange={(_event, checked) => props.onChange({ ...draft, [key]: checked })}
                  />
                }
              />
            ))}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
                gap: 2,
              }}
            >
              {bounds.map(([key, min, max]) => (
                <FormField
                  key={key}
                  label={t(`admin.attachmentPolicy.${key}`)}
                  type="number"
                  value={Number.isFinite(draft[key]) ? draft[key] : ''}
                  disabled={!props.draftReady || props.busy || props.draftLocked}
                  slotProps={{ htmlInput: { min, max, step: 1, inputMode: 'numeric' } }}
                  errorMessage={
                    Number.isSafeInteger(draft[key]) && draft[key] >= min && draft[key] <= max
                      ? undefined
                      : t('admin.attachmentPolicy.invalidRules')
                  }
                  onChange={(event) =>
                    props.onChange({
                      ...draft,
                      [key]: event.target.value === '' ? NaN : Number(event.target.value),
                    })
                  }
                />
              ))}
            </Box>
            <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
              <Box component="legend" sx={{ typography: 'subtitle2' }}>
                {t('admin.attachmentPolicy.allowedMediaTypes')}
              </Box>
              <Stack>
                {APPROVAL_ATTACHMENT_MEDIA_TYPES.map((type) => (
                  <FormControlLabel
                    key={type}
                    sx={{
                      minWidth: 0,
                      '& .MuiFormControlLabel-label': { overflowWrap: 'anywhere' },
                    }}
                    label={type}
                    control={
                      <Checkbox
                        checked={draft.allowedMediaTypes.includes(type)}
                        disabled={!props.draftReady || props.busy || props.draftLocked}
                        onChange={(_event, checked) =>
                          props.onChange({
                            ...draft,
                            allowedMediaTypes: checked
                              ? [...draft.allowedMediaTypes, type]
                              : draft.allowedMediaTypes.filter((value) => value !== type),
                          })
                        }
                      />
                    }
                  />
                ))}
              </Stack>
            </Box>
            {!approvalAttachmentPolicyRulesValid(draft) ? (
              <InlineFeedback severity="error">
                {t('admin.attachmentPolicy.invalidRules')}
              </InlineFeedback>
            ) : null}
          </Stack>
        ) : null}
      </FormDialog>
    </>
  );

  function AttachmentPolicyComparison({ policy: source }: { policy: ApprovalAttachmentPolicy }) {
    return (
      <Box role="table" aria-label={t('admin.attachmentPolicy.title')} sx={{ minWidth: 0 }}>
        <Box
          role="row"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)',
            gap: 1,
            pb: 1,
          }}
        >
          <Box role="columnheader" sx={{ typography: 'caption' }}>
            {t('admin.studio.changeField')}
          </Box>
          <Box role="columnheader" sx={{ typography: 'caption' }}>
            {t('admin.document.published')} {source.publishedRevision}
          </Box>
          <Box role="columnheader" sx={{ typography: 'caption' }}>
            {t('admin.document.pending')} {source.pendingRevision ?? t('admin.document.noPending')}
          </Box>
        </Box>
        {properties.map((key) => (
          <Box
            key={key}
            role="row"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)',
              gap: 1,
              py: 1,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Box
              role="rowheader"
              sx={{
                typography: 'body2',
                overflowWrap: 'anywhere',
                color:
                  source.pending &&
                  JSON.stringify(source.published[key]) !== JSON.stringify(source.pending[key])
                    ? 'primary.main'
                    : 'text.primary',
              }}
            >
              {t(`admin.attachmentPolicy.${key}`)}
            </Box>
            <Box
              role="cell"
              sx={{ typography: 'body2', textAlign: 'right', overflowWrap: 'anywhere' }}
            >
              {renderValue(source.published[key])}
            </Box>
            <Box
              role="cell"
              sx={{ typography: 'body2', textAlign: 'right', overflowWrap: 'anywhere' }}
            >
              {renderValue(source.pending?.[key])}
            </Box>
          </Box>
        ))}
        {[source.publishedRulesSha256, source.pendingRulesSha256].map((sha, index) => (
          <Box
            key={index}
            sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere', pt: 1 }}
          >
            {t(index ? 'admin.document.pending' : 'admin.document.published')} · {sha ?? '-'}
          </Box>
        ))}
      </Box>
    );
  }
}
