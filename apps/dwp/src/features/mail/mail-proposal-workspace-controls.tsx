import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { ActionButton, FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  MailActionProposal,
  MailAccount,
  MailProposalStatus,
  MailProposalType,
} from '@dwp-frontend/shared-utils';

export type MailProposalFilters = Readonly<{
  status?: MailProposalStatus;
  type?: MailProposalType;
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
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
  const page = Number(params.get('page') ?? 0);
  const pageSize = Number(params.get('pageSize') ?? 20);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  return {
    ...(STATUSES.includes(status as MailProposalStatus)
      ? { status: status as MailProposalStatus }
      : {}),
    ...(TYPES.includes(type as MailProposalType) ? { type: type as MailProposalType } : {}),
    ...(params.get('accountId') ? { accountId: params.get('accountId')! } : {}),
    ...(dateFrom && datePattern.test(dateFrom) ? { dateFrom } : {}),
    ...(dateTo && datePattern.test(dateTo) ? { dateTo } : {}),
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 20,
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
  if (filters.accountId) next.set('accountId', filters.accountId);
  else next.delete('accountId');
  if (filters.dateFrom) next.set('dateFrom', filters.dateFrom);
  else next.delete('dateFrom');
  if (filters.dateTo) next.set('dateTo', filters.dateTo);
  else next.delete('dateTo');
  if (filters.page > 0) next.set('page', String(filters.page));
  else next.delete('page');
  if (filters.pageSize !== 20) next.set('pageSize', String(filters.pageSize));
  else next.delete('pageSize');
  return next;
}

export function MailProposalFilterControls({
  value,
  accounts,
  disabled = false,
  onChange,
}: {
  value: MailProposalFilters;
  accounts: readonly MailAccount[];
  disabled?: boolean;
  onChange: (filters: MailProposalFilters) => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Stack spacing={1} sx={{ mt: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <SelectField<string>
          size="small"
          label={t('proposal.filters.status', { defaultValue: 'Status' })}
          value={value.status ?? ''}
          disabled={disabled}
          options={[
            {
              value: '',
              label: t('proposal.filters.allStatuses', { defaultValue: 'All statuses' }),
            },
            ...STATUSES.map((status) => ({
              value: status,
              label: t(`proposal.status.${status}`, { defaultValue: status }),
            })),
          ]}
          onValueChange={(status) =>
            onChange({
              ...value,
              page: 0,
              status: (status || undefined) as MailProposalStatus | undefined,
            })
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
            onChange({
              ...value,
              page: 0,
              type: (type || undefined) as MailProposalType | undefined,
            })
          }
        />
        <SelectField<string>
          size="small"
          label={t('proposal.filters.account', { defaultValue: 'Source account' })}
          value={value.accountId ?? ''}
          disabled={disabled}
          options={[
            {
              value: '',
              label: t('proposal.filters.allAccounts', { defaultValue: 'All accounts' }),
            },
            ...accounts.map((account) => ({
              value: account.accountId,
              label: `${account.displayName} · ${account.emailAddress}`,
            })),
          ]}
          onValueChange={(accountId) =>
            onChange({ ...value, page: 0, accountId: accountId || undefined })
          }
        />
        <FormField
          size="small"
          type="date"
          label={t('proposal.filters.dateFrom', { defaultValue: 'From date' })}
          value={value.dateFrom ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...value, page: 0, dateFrom: event.target.value || undefined })
          }
        />
        <FormField
          size="small"
          type="date"
          label={t('proposal.filters.dateTo', { defaultValue: 'To date' })}
          value={value.dateTo ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...value, page: 0, dateTo: event.target.value || undefined })
          }
        />
      </Stack>
      {(value.status || value.type || value.accountId || value.dateFrom || value.dateTo) && (
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {value.status && <Chip size="small" label={t(`proposal.status.${value.status}`)} />}
          {value.type && <Chip size="small" label={t(`proposal.typeFilter.${value.type}`)} />}
          {value.accountId && (
            <Chip
              size="small"
              label={
                accounts.find((account) => account.accountId === value.accountId)?.displayName ??
                value.accountId
              }
            />
          )}
          {value.dateFrom && (
            <Chip size="small" label={`${t('proposal.filters.dateFrom')}: ${value.dateFrom}`} />
          )}
          {value.dateTo && (
            <Chip size="small" label={`${t('proposal.filters.dateTo')}: ${value.dateTo}`} />
          )}
          <ActionButton
            intent="quiet"
            size="small"
            onClick={() => onChange({ page: 0, pageSize: value.pageSize })}
          >
            {t('proposal.filters.clear', { defaultValue: 'Clear filters' })}
          </ActionButton>
        </Stack>
      )}
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
