import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, FileText, Paperclip, Trash2, UsersRound } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  deleteMailAttachment,
  getMailComposeContext,
  uploadMailAttachment,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  MailAttachment,
  MailComposeOptions,
  MailRecipient,
  MailSignature,
  MailTemplate,
} from '@dwp-frontend/shared-utils';
import { MailRecipientPicker } from './mail-recipient-picker';

type InsertRequest =
  { kind: 'template'; value: MailTemplate } | { kind: 'signature'; value: MailSignature };

const EMPTY_ATTACHMENTS: MailAttachment[] = [];

export function MailComposeOptionsFields({
  toEmail,
  options,
  initialAttachments = EMPTY_ATTACHMENTS,
  disabled,
  hasBody,
  onToEmailChange,
  onChange,
  onAttachmentReadyChange,
  onInsertTemplate,
  onInsertSignature,
}: {
  toEmail: string;
  options: MailComposeOptions;
  initialAttachments?: MailAttachment[];
  disabled: boolean;
  hasBody: boolean;
  onToEmailChange: (value: string) => void;
  onChange: (value: MailComposeOptions) => void;
  onAttachmentReadyChange: (ready: boolean) => void;
  onInsertTemplate: (template: MailTemplate) => void;
  onInsertSignature: (signature: MailSignature) => void;
}) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const defaultsAppliedRef = useRef(false);
  const attachmentReadyRef = useRef<boolean | null>(null);
  const optionsRef = useRef(options);
  const onChangeRef = useRef(onChange);
  optionsRef.current = options;
  onChangeRef.current = onChange;
  const commitOptions = useCallback((next: MailComposeOptions) => {
    optionsRef.current = next;
    onChangeRef.current(next);
  }, []);
  const [ccOpen, setCcOpen] = useState(() => options.recipients.some((item) => item.type !== 'TO'));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [insertRequest, setInsertRequest] = useState<InsertRequest | null>(null);
  const context = useQuery({
    queryKey: ['mail', 'compose-context'],
    queryFn: getMailComposeContext,
    staleTime: 30_000,
    retry: 1,
  });
  const upload = useMutation({
    mutationFn: uploadMailAttachment,
    onSuccess: (attachment) => {
      setAttachments((current) => [
        ...current.filter((item) => item.attachmentId !== attachment.attachmentId),
        attachment,
      ]);
      const current = optionsRef.current;
      commitOptions({
        ...current,
        attachmentIds: [...new Set([...current.attachmentIds, attachment.attachmentId])],
      });
    },
    onError: () => toast.error(t('compose.attachments.uploadError')),
  });
  const remove = useMutation({
    mutationFn: deleteMailAttachment,
    onSuccess: (_result, attachmentId) => {
      setAttachments((current) => current.filter((item) => item.attachmentId !== attachmentId));
      const current = optionsRef.current;
      commitOptions({
        ...current,
        attachmentIds: current.attachmentIds.filter((id) => id !== attachmentId),
      });
    },
    onError: () => toast.error(t('compose.attachments.deleteError')),
  });

  useEffect(() => {
    setAttachments((current) =>
      sameAttachments(current, initialAttachments) ? current : initialAttachments
    );
  }, [initialAttachments]);

  useEffect(() => {
    const ready =
      !upload.isPending && attachments.every((attachment) => attachment.scanState === 'READY');
    if (attachmentReadyRef.current === ready) return;
    attachmentReadyRef.current = ready;
    onAttachmentReadyChange(ready);
  }, [attachments, onAttachmentReadyChange, upload.isPending]);

  useEffect(() => {
    if (!context.data || defaultsAppliedRef.current) return;
    defaultsAppliedRef.current = true;
    const current = optionsRef.current;
    const defaultAccountId = current.accountId ?? context.data.preferences.defaultAccountId;
    const defaultSignature = context.data.signatures.find(
      (item) => item.signatureId === context.data.preferences.defaultSignatureId
    );
    commitOptions({ ...current, accountId: defaultAccountId ?? null });
    if (!hasBody && !current.signatureId && defaultSignature) {
      commitOptions({
        ...optionsRef.current,
        accountId: defaultAccountId ?? null,
        signatureId: defaultSignature.signatureId,
      });
      onInsertSignature(defaultSignature);
    }
  }, [commitOptions, context.data, hasBody, onInsertSignature]);

  const recipientValues = useMemo(
    () => ({
      TO: recipientString(
        options.recipients.filter((item) => item.type === 'TO'),
        toEmail
      ),
      CC: recipientString(options.recipients.filter((item) => item.type === 'CC')),
      BCC: recipientString(options.recipients.filter((item) => item.type === 'BCC')),
    }),
    [options.recipients, toEmail]
  );

  const setRecipients = (type: MailRecipient['type'], value: string) => {
    const parsed = parseRecipients(value, type);
    const current = optionsRef.current;
    const other = current.recipients.filter((item) => item.type !== type);
    if (type === 'TO') onToEmailChange(parsed[0]?.email ?? '');
    commitOptions({ ...current, recipients: [...other, ...parsed] });
  };
  const performInsert = (request: InsertRequest) => {
    if (request.kind === 'template') {
      commitOptions({
        ...optionsRef.current,
        templateId: request.value.templateId,
        bodyFormat: request.value.bodyFormat,
      });
      const recipientName = options.recipients.find((item) => item.type === 'TO')?.name ?? '';
      onInsertTemplate({
        ...request.value,
        subject: resolveTemplateVariables(request.value.subject ?? '', {
          ...context.data?.variables,
          recipientName,
        }),
        body: resolveTemplateVariables(request.value.body, {
          ...context.data?.variables,
          recipientName,
        }),
      });
    } else {
      commitOptions({
        ...optionsRef.current,
        signatureId: request.value.signatureId,
        bodyFormat: request.value.bodyFormat === 'HTML' ? 'HTML' : optionsRef.current.bodyFormat,
      });
      onInsertSignature(request.value);
    }
    setInsertRequest(null);
  };
  const requestInsert = (request: InsertRequest) => {
    if (hasBody) setInsertRequest(request);
    else performInsert(request);
  };
  const capabilities = context.data?.capabilities;
  const activeAccounts =
    context.data?.accounts.filter((account) => account.connectionState === 'ACTIVE') ?? [];

  return (
    <Stack spacing={2}>
      {context.isError && <Alert severity="error">{t('compose.optionsLoadError')}</Alert>}
      <SelectField
        label={t('compose.from')}
        value={options.accountId ?? context.data?.preferences.defaultAccountId ?? ''}
        options={activeAccounts.map((account) => ({
          value: account.accountId,
          label: `${account.displayName} · ${account.emailAddress}`,
        }))}
        disabled={disabled || context.isLoading}
        onValueChange={(value) =>
          commitOptions({ ...optionsRef.current, accountId: value || null })
        }
      />
      <Box>
        <FormField
          required
          type="text"
          label={t('compose.to')}
          value={recipientValues.TO}
          autoFocus
          autoComplete="off"
          disabled={disabled}
          errorMessage={
            recipientValues.TO && !recipientsValid(recipientValues.TO)
              ? t('compose.invalidRecipients')
              : undefined
          }
          supportingText={t('compose.recipientHelp')}
          onChange={(event) => setRecipients('TO', event.target.value)}
        />
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
          <ActionButton
            intent="quiet"
            size="small"
            disabled={disabled}
            onClick={() => setCcOpen((value) => !value)}
          >
            {ccOpen ? t('compose.hideCcBcc') : t('compose.showCcBcc')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<UsersRound size={15} />}
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            {t('compose.recipientPicker.open')}
          </ActionButton>
        </Stack>
      </Box>
      <Collapse in={ccOpen} unmountOnExit>
        <Stack spacing={1.5}>
          <FormField
            type="text"
            label={t('compose.cc')}
            value={recipientValues.CC}
            disabled={disabled || !capabilities?.cc}
            errorMessage={
              recipientValues.CC && !recipientsValid(recipientValues.CC)
                ? t('compose.invalidRecipients')
                : undefined
            }
            onChange={(event) => setRecipients('CC', event.target.value)}
          />
          <FormField
            type="text"
            label={t('compose.bcc')}
            value={recipientValues.BCC}
            disabled={disabled || !capabilities?.bcc}
            errorMessage={
              recipientValues.BCC && !recipientsValid(recipientValues.BCC)
                ? t('compose.invalidRecipients')
                : undefined
            }
            onChange={(event) => setRecipients('BCC', event.target.value)}
          />
        </Stack>
      </Collapse>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <SelectField
          label={t('compose.format')}
          value={options.bodyFormat}
          options={[
            { value: 'TEXT', label: t('compose.formatText') },
            { value: 'HTML', label: t('compose.formatRich'), disabled: !capabilities?.html },
          ]}
          disabled={disabled}
          onValueChange={(value) =>
            value && commitOptions({ ...optionsRef.current, bodyFormat: value })
          }
        />
        <SelectField
          label={t('compose.template')}
          value={options.templateId ?? ''}
          options={[
            { value: '', label: t('compose.noTemplate') },
            ...(context.data?.templates ?? []).map((item) => ({
              value: item.templateId,
              label: item.name,
            })),
          ]}
          disabled={disabled}
          onValueChange={(value) => {
            const selected = context.data?.templates.find((item) => item.templateId === value);
            if (selected) requestInsert({ kind: 'template', value: selected });
            else commitOptions({ ...optionsRef.current, templateId: null });
          }}
        />
        <SelectField
          label={t('compose.signature')}
          value={options.signatureId ?? ''}
          options={[
            { value: '', label: t('compose.noSignature') },
            ...(context.data?.signatures ?? []).map((item) => ({
              value: item.signatureId,
              label: item.name,
            })),
          ]}
          disabled={disabled}
          onValueChange={(value) => {
            const selected = context.data?.signatures.find((item) => item.signatureId === value);
            if (selected) requestInsert({ kind: 'signature', value: selected });
            else commitOptions({ ...optionsRef.current, signatureId: null });
          }}
        />
      </Box>
      <Box component="section" aria-label={t('compose.attachments.title')}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              {t('compose.attachments.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('compose.attachments.limit', {
                value: Math.floor((capabilities?.maximumAttachmentBytes ?? 0) / 1_048_576),
              })}
            </Typography>
          </Box>
          <ActionButton
            intent="secondary"
            startIcon={<Paperclip size={16} />}
            disabled={disabled || upload.isPending || !capabilities?.attachments}
            loading={upload.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('compose.attachments.add')}
          </ActionButton>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            multiple
            onChange={(event) => {
              for (const file of Array.from(event.target.files ?? [])) upload.mutate(file);
              event.target.value = '';
            }}
          />
        </Stack>
        {attachments.length > 0 && (
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1, borderBlock: 1, borderColor: 'divider' }}
          >
            {attachments.map((attachment) => (
              <Stack
                key={attachment.attachmentId}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ py: 1 }}
              >
                <FileText size={16} aria-hidden />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={650} noWrap>
                    {attachment.fileName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`compose.attachments.state.${attachment.scanState}`)} ·{' '}
                    {formatBytes(attachment.sizeBytes)}
                  </Typography>
                </Box>
                <ActionButton
                  aria-label={t('compose.attachments.remove', { name: attachment.fileName })}
                  intent="quiet"
                  disabled={disabled || remove.isPending}
                  onClick={() => remove.mutate(attachment.attachmentId)}
                >
                  <Trash2 size={16} />
                </ActionButton>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
      <Box component="section" sx={{ borderBlock: 1, borderColor: 'divider', py: 1.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={800}>
              {t('compose.schedule')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('compose.scheduleDescription')}
            </Typography>
          </Box>
          {options.scheduledAt ? (
            <ActionButton
              intent="quiet"
              onClick={() =>
                commitOptions({ ...optionsRef.current, scheduledAt: null, timeZone: null })
              }
            >
              {t('compose.sendNow')}
            </ActionButton>
          ) : (
            <ActionButton
              intent="secondary"
              startIcon={<CalendarClock size={16} />}
              disabled={disabled || !capabilities?.scheduling}
              onClick={() =>
                commitOptions({
                  ...optionsRef.current,
                  scheduledAt: defaultSchedule(),
                  timeZone: resolveSystemTimeZone('UTC'),
                })
              }
            >
              {t('compose.scheduleAction')}
            </ActionButton>
          )}
        </Stack>
        {options.scheduledAt && (
          <FormField
            type="datetime-local"
            label={t('compose.scheduledAt')}
            value={localDateTime(new Date(options.scheduledAt))}
            disabled={disabled}
            slotProps={{ inputLabel: { shrink: true } }}
            errorMessage={
              new Date(options.scheduledAt).getTime() <= Date.now()
                ? t('compose.futureScheduleRequired')
                : undefined
            }
            onChange={(event) => {
              const value = event.target.value;
              commitOptions({
                ...optionsRef.current,
                scheduledAt: value ? new Date(value).toISOString() : null,
                timeZone: value
                  ? (optionsRef.current.timeZone ?? resolveSystemTimeZone('UTC'))
                  : null,
              });
            }}
            sx={{ mt: 1.5 }}
          />
        )}
      </Box>
      {options.recipients.some((item) => item.type === 'BCC') && (
        <Alert severity="info">{t('compose.bccPrivacy')}</Alert>
      )}
      {attachments.some((item) => item.scanState !== 'READY') && (
        <Alert severity="warning">{t('compose.attachments.pendingBlocksSend')}</Alert>
      )}
      <ConfirmDialog
        open={Boolean(insertRequest)}
        title={
          insertRequest?.kind === 'template'
            ? t('compose.replaceWithTemplateTitle')
            : t('compose.appendSignatureTitle')
        }
        description={
          insertRequest?.kind === 'template'
            ? t('compose.replaceWithTemplateDescription')
            : t('compose.appendSignatureDescription')
        }
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('compose.insert')}
        onClose={() => setInsertRequest(null)}
        onConfirm={() => {
          if (insertRequest) performInsert(insertRequest);
        }}
      />
      <MailRecipientPicker
        open={pickerOpen}
        disabled={disabled}
        recipients={options.recipients}
        onClose={() => setPickerOpen(false)}
        onChange={(recipients) => {
          commitOptions({ ...optionsRef.current, recipients });
          onToEmailChange(recipients.find((item) => item.type === 'TO')?.email ?? '');
          if (recipients.some((item) => item.type !== 'TO')) setCcOpen(true);
        }}
      />
    </Stack>
  );
}

export function mailComposeOptionsCanSend(
  options: MailComposeOptions,
  attachments: MailAttachment[] = []
) {
  const recipients = options.recipients;
  return (
    recipients.some((item) => item.type === 'TO') &&
    recipients.every((item) => /^\S+@\S+\.\S+$/u.test(item.email)) &&
    (!options.scheduledAt || new Date(options.scheduledAt).getTime() > Date.now()) &&
    attachments.every((item) => item.scanState === 'READY')
  );
}

function parseRecipients(value: string, type: MailRecipient['type']): MailRecipient[] {
  return value
    .split(/[;,\n]/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const matched = /^(.*?)\s*<([^<>]+)>$/u.exec(part);
      return matched
        ? { type, name: matched[1].trim() || null, email: matched[2].trim() }
        : { type, name: null, email: part };
    });
}

function recipientString(recipients: MailRecipient[], fallback = '') {
  if (!recipients.length) return fallback;
  return recipients
    .map((item) => (item.name ? `${item.name} <${item.email}>` : item.email))
    .join(', ');
}

function recipientsValid(value: string) {
  return parseRecipients(value, 'TO').every((item) => /^\S+@\S+\.\S+$/u.test(item.email));
}

function defaultSchedule() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}
function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
function formatBytes(value: number) {
  return value >= 1_048_576
    ? `${(value / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(value / 1024))} KB`;
}

function sameAttachments(left: MailAttachment[], right: MailAttachment[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const candidate = right[index];
      return (
        candidate?.attachmentId === item.attachmentId &&
        candidate.scanState === item.scanState &&
        candidate.fileName === item.fileName &&
        candidate.sizeBytes === item.sizeBytes
      );
    })
  );
}

function resolveTemplateVariables(
  value: string,
  variables: Partial<Record<'displayName' | 'department' | 'recipientName', string | null>>
) {
  return value.replace(
    /\{\{(displayName|department|recipientName)\}\}/gu,
    (_match, key: keyof typeof variables) => variables[key] ?? ''
  );
}
