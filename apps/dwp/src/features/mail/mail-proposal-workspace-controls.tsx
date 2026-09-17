import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { ActionButton, FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  MailActionProposal,
  MailProposalStatus,
  MailProposalType,
} from '@dwp-frontend/shared-utils';

export type MailProposalFilters = Readonly<{
  status?: MailProposalStatus;
  type?: MailProposalType;
}>;

type EditablePayloadValue = boolean | number | string | string[];

const STATUSES: readonly MailProposalStatus[] = [
  'PROPOSED',
  'ACCEPTED',
  'DISMISSED',
  'EXPIRED',
  'EXECUTED',
];

const TYPES: readonly MailProposalType[] = [
  'DRAFT_REPLY',
  'CREATE_CALENDAR_EVENT',
  'CREATE_LEAVE_REQUEST',
  'CREATE_TASK',
  'ESCALATE_NOTIFICATION',
];

export function mailProposalFiltersFromSearch(params: URLSearchParams): MailProposalFilters {
  const status = params.get('status');
  const type = params.get('type');
  return {
    ...(STATUSES.includes(status as MailProposalStatus)
      ? { status: status as MailProposalStatus }
      : {}),
    ...(TYPES.includes(type as MailProposalType) ? { type: type as MailProposalType } : {}),
  };
}

export function updateMailProposalFilterSearch(
  params: URLSearchParams,
  filters: MailProposalFilters
) {
  const next = new URLSearchParams(params);
  if (filters.status) next.set('status', filters.status);
  else next.delete('status');
  if (filters.type) next.set('type', filters.type);
  else next.delete('type');
  next.delete('proposalId');
  return next;
}

export function MailProposalFilterControls({
  value,
  disabled = false,
  onChange,
}: {
  value: MailProposalFilters;
  disabled?: boolean;
  onChange: (filters: MailProposalFilters) => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
      <SelectField<string>
        size="small"
        label={t('proposal.filters.status', { defaultValue: 'Status' })}
        value={value.status ?? ''}
        disabled={disabled}
        options={[
          { value: '', label: t('proposal.filters.allStatuses', { defaultValue: 'All statuses' }) },
          ...STATUSES.map((status) => ({
            value: status,
            label: t(`proposal.status.${status}`, { defaultValue: status }),
          })),
        ]}
        onValueChange={(status) =>
          onChange({ ...value, status: (status || undefined) as MailProposalStatus | undefined })
        }
      />
      <SelectField<string>
        size="small"
        label={t('proposal.filters.type', { defaultValue: 'Action type' })}
        value={value.type ?? ''}
        disabled={disabled}
        options={[
          {
            value: '',
            label: t('proposal.filters.allTypes', { defaultValue: 'All action types' }),
          },
          ...TYPES.map((type) => ({
            value: type,
            label: t(`proposal.typeFilter.${type}`, { defaultValue: type }),
          })),
        ]}
        onValueChange={(type) =>
          onChange({ ...value, type: (type || undefined) as MailProposalType | undefined })
        }
      />
    </Stack>
  );
}

export function MailProposalPayloadEditor({
  proposal,
  busy,
  error = false,
  onClose,
  onSave,
}: {
  proposal: MailActionProposal | null;
  busy: boolean;
  error?: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation('mail');
  const fields = useMemo(
    () => editableProposalPayload(proposal?.proposedPayload ?? {}),
    [proposal]
  );
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => setValues(payloadEditorValues(fields)), [fields]);
  const invalid = fields.some(
    ([key, value]) => typeof value === 'number' && !Number.isFinite(Number(values[key]))
  );
  return (
    <FormDialog
      open={Boolean(proposal)}
      title={t('proposal.payloadEditor.title', { defaultValue: 'Edit proposal details' })}
      description={t('proposal.payloadEditor.description', {
        defaultValue:
          'Update reviewable details before accepting. Policy and confirmation fields remain locked.',
      })}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('proposal.payloadEditor.save', { defaultValue: 'Save changes' })}
      submittingLabel={t('proposal.payloadEditor.saving', { defaultValue: 'Saving' })}
      busy={busy}
      submitDisabled={invalid || fields.length === 0}
      onClose={onClose}
      onSubmit={() => {
        if (!proposal || invalid) return;
        onSave(applyProposalPayloadEditorValues(proposal.proposedPayload, fields, values));
      }}
    >
      <Stack spacing={1.5}>
        {error && (
          <Alert severity="error">
            {t('proposal.payloadEditor.error', {
              defaultValue:
                'The proposal changed or could not be saved. Refresh and review it again.',
            })}
          </Alert>
        )}
        {fields.length ? (
          fields.map(([key, value]) => (
            <FormField
              key={key}
              label={humanizePayloadKey(key)}
              value={values[key] ?? ''}
              type={typeof value === 'number' ? 'number' : 'text'}
              multiline={typeof value === 'string' && value.length > 80}
              minRows={typeof value === 'string' && value.length > 80 ? 3 : undefined}
              inputProps={{ maxLength: 2_000 }}
              onChange={(event) =>
                setValues((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('proposal.payloadEditor.noFields', {
              defaultValue: 'This proposal has no editable details.',
            })}
          </Typography>
        )}
        <Box sx={{ p: 1.25, bgcolor: 'action.hover' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Pencil size={15} />
            <Typography variant="caption" color="text.secondary">
              {t('proposal.payloadEditor.safety', {
                defaultValue:
                  'Saving changes creates a new proposal version. Final execution still happens in the responsible app.',
              })}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </FormDialog>
  );
}

export function MailProposalEditButton({
  proposal,
  disabled,
  onEdit,
}: {
  proposal: MailActionProposal;
  disabled?: boolean;
  onEdit: (proposal: MailActionProposal) => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <ActionButton
      intent="quiet"
      size="small"
      startIcon={<Pencil size={14} />}
      disabled={disabled || proposal.status !== 'PROPOSED'}
      onClick={() => onEdit(proposal)}
    >
      {t('proposal.payloadEditor.edit', { defaultValue: 'Edit details' })}
    </ActionButton>
  );
}

export function editableProposalPayload(payload: Record<string, unknown>) {
  return Object.entries(payload).filter(
    (entry): entry is [string, EditablePayloadValue] =>
      entry[0] !== 'requiresConfirmation' &&
      (typeof entry[1] === 'string' ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean' ||
        (Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string')))
  );
}

function payloadEditorValues(fields: Array<[string, EditablePayloadValue]>) {
  return Object.fromEntries(
    fields.map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)])
  );
}

export function applyProposalPayloadEditorValues(
  source: Record<string, unknown>,
  fields: Array<[string, EditablePayloadValue]>,
  values: Record<string, string>
) {
  const result: Record<string, unknown> = { ...source, requiresConfirmation: true };
  for (const [key, original] of fields) {
    const value = values[key] ?? '';
    if (typeof original === 'number') result[key] = Number(value);
    else if (typeof original === 'boolean') result[key] = value.toLowerCase() === 'true';
    else if (Array.isArray(original)) {
      result[key] = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 50);
    } else result[key] = value.trim();
  }
  return result;
}

function humanizePayloadKey(key: string) {
  return key
    .replaceAll(/([a-z])([A-Z])/gu, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./u, (character) => character.toUpperCase());
}
