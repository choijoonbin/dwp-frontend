import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UsersRound } from 'lucide-react';
import { ActionButton, FormDialog, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  MailClassification,
  MailContact,
  MailContactGroup,
  MailContactInput,
} from '@dwp-frontend/shared-utils';

const EMPTY_CONTACT: MailContactInput = {
  displayName: '',
  emailAddress: '',
  organizationName: '',
  jobTitle: '',
  phoneNumber: '',
  favorite: false,
};

export function MailContactDialog({
  open,
  contact,
  seed,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  contact?: MailContact | null;
  seed?: MailContactInput | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: MailContactInput) => void;
}) {
  const { t } = useTranslation('mail');
  const [form, setForm] = useState<MailContactInput>(EMPTY_CONTACT);

  useEffect(() => {
    if (!open) return;
    setForm(
      contact
        ? {
            displayName: contact.displayName,
            emailAddress: contact.emailAddress,
            organizationName: contact.organizationName ?? '',
            jobTitle: contact.jobTitle ?? '',
            phoneNumber: contact.phoneNumber ?? '',
            favorite: contact.favorite,
          }
        : (seed ?? EMPTY_CONTACT)
    );
  }, [contact, open, seed]);

  const valid = Boolean(form.displayName.trim() && /^\S+@\S+\.\S+$/u.test(form.emailAddress));
  return (
    <FormDialog
      open={open}
      busy={busy}
      onClose={onClose}
      mobileFullScreen
      title={contact ? t('addressBook.contact.editTitle') : t('addressBook.contact.createTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      submitDisabled={!valid}
      onSubmit={() => onSubmit(form)}
    >
      <Stack spacing={2} sx={{ pt: 0.75 }}>
        <FormField
          required
          autoFocus
          label={t('addressBook.contact.name')}
          value={form.displayName}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
        />
        <FormField
          required
          type="email"
          label={t('addressBook.contact.email')}
          value={form.emailAddress}
          inputProps={{ maxLength: 255 }}
          onChange={(event) => setForm({ ...form, emailAddress: event.target.value })}
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <FormField
            label={t('addressBook.contact.organization')}
            value={form.organizationName ?? ''}
            inputProps={{ maxLength: 200 }}
            onChange={(event) => setForm({ ...form, organizationName: event.target.value })}
          />
          <FormField
            label={t('addressBook.contact.jobTitle')}
            value={form.jobTitle ?? ''}
            inputProps={{ maxLength: 160 }}
            onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
          />
        </Box>
        <FormField
          label={t('addressBook.contact.phone')}
          value={form.phoneNumber ?? ''}
          inputProps={{ maxLength: 40 }}
          onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
        />
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Checkbox
            checked={form.favorite}
            onChange={(event) => setForm({ ...form, favorite: event.target.checked })}
            inputProps={{ 'aria-label': t('addressBook.contact.favorite') }}
          />
          <Typography variant="body2">{t('addressBook.contact.favorite')}</Typography>
        </Stack>
      </Stack>
    </FormDialog>
  );
}

export function MailGroupDialog({
  open,
  group,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  group?: MailContactGroup | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { displayName: string; description: string }) => void;
}) {
  const { t } = useTranslation('mail');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (!open) return;
    setDisplayName(group?.displayName ?? '');
    setDescription(group?.description ?? '');
  }, [group, open]);
  return (
    <FormDialog
      open={open}
      busy={busy}
      onClose={onClose}
      mobileFullScreen
      title={group ? t('addressBook.group.editTitle') : t('addressBook.group.createTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      submitDisabled={!displayName.trim()}
      onSubmit={() => onSubmit({ displayName, description })}
    >
      <Stack spacing={2} sx={{ pt: 0.75 }}>
        <FormField
          required
          autoFocus
          label={t('addressBook.group.name')}
          value={displayName}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <FormField
          multiline
          minRows={3}
          label={t('addressBook.group.description')}
          value={description}
          inputProps={{ maxLength: 500 }}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function MailGroupMembersDialog({
  open,
  group,
  contacts,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  group: MailContactGroup | null;
  contacts: MailContact[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (contactIds: string[]) => void;
}) {
  const { t } = useTranslation('mail');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(group?.members.map((member) => member.contactId) ?? []);
  }, [group, open]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return contacts;
    return contacts.filter((contact) =>
      [contact.displayName, contact.emailAddress, contact.organizationName]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalized))
    );
  }, [contacts, query]);
  return (
    <FormDialog
      open={open}
      busy={busy}
      onClose={onClose}
      mobileFullScreen
      title={t('addressBook.members.title', { name: group?.displayName ?? '' })}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('addressBook.members.save')}
      submittingLabel={t('actions.saving')}
      onSubmit={() => onSubmit(selected)}
      secondaryActions={
        <Typography variant="caption" color="text.secondary">
          {t('addressBook.members.selected', { count: selected.length })}
        </Typography>
      }
    >
      <FormField
        fullWidth
        value={query}
        label={t('addressBook.searchContacts')}
        onChange={(event) => setQuery(event.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={17} />
            </InputAdornment>
          ),
        }}
      />
      <Box
        role="group"
        aria-label={t('addressBook.members.available')}
        sx={{ mt: 1.5, maxHeight: 360, overflowY: 'auto', borderTop: 1, borderColor: 'divider' }}
      >
        {visible.map((contact) => {
          const checked = selected.includes(contact.contactId);
          return (
            <Box
              component="label"
              key={contact.contactId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                py: 0.75,
                borderBottom: 1,
                borderColor: 'divider',
                cursor: 'pointer',
              }}
            >
              <Checkbox
                checked={checked}
                onChange={() =>
                  setSelected((current) =>
                    checked
                      ? current.filter((id) => id !== contact.contactId)
                      : [...current, contact.contactId]
                  )
                }
              />
              <ListItemText primary={contact.displayName} secondary={contact.emailAddress} />
            </Box>
          );
        })}
      </Box>
    </FormDialog>
  );
}

type MailGroupMessageSnapshot = {
  group: MailContactGroup;
  input: {
    subject: string;
    body: string;
    classification: MailClassification;
    idempotencyKey: string;
    groupVersion: number;
  };
};

export type MailGroupMessageAttempt = MailGroupMessageSnapshot & {
  original?: MailGroupMessageSnapshot;
  reviewRequired?: boolean;
};

export function MailGroupMessageDialog({
  open,
  group,
  busy,
  retryFailed = false,
  conflict = false,
  refreshFailed = false,
  attempt,
  onAttempt,
  onReviewLatest,
  onClose,
  onSubmit,
}: {
  open: boolean;
  group: MailContactGroup | null;
  busy: boolean;
  retryFailed?: boolean;
  conflict?: boolean;
  refreshFailed?: boolean;
  attempt: MailGroupMessageAttempt | null;
  onAttempt: (attempt: MailGroupMessageAttempt) => void;
  onReviewLatest: () => void;
  onClose: () => void;
  onSubmit: (input: MailGroupMessageAttempt['input']) => void;
}) {
  const { t } = useTranslation('mail');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [classification, setClassification] = useState<MailClassification>('INTERNAL');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!open || !group) return;
    setSubject(attempt?.input.subject ?? '');
    setBody(attempt?.input.body ?? '');
    setClassification(attempt?.input.classification ?? 'INTERNAL');
    setConfirmed(Boolean(attempt) && !attempt?.reviewRequired);
  }, [open, group, attempt]);
  const reviewedGroup = attempt?.group ?? group;
  const locked = busy || Boolean(attempt);
  const valid = Boolean(
    reviewedGroup?.members.length && subject.trim() && body.trim() && confirmed
  );
  return (
    <FormDialog
      open={open}
      busy={busy}
      onClose={onClose}
      mobileFullScreen
      maxWidth="md"
      title={t('addressBook.send.title', { name: reviewedGroup?.displayName ?? '' })}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(
        attempt && !attempt.reviewRequired ? 'addressBook.send.retry' : 'addressBook.send.submit'
      )}
      submittingLabel={t('addressBook.send.sending')}
      submitDisabled={!valid}
      onSubmit={() => {
        if (attempt) {
          onAttempt({ ...attempt, reviewRequired: false });
          onSubmit(attempt.input);
        } else if (group && valid) {
          const next = {
            group,
            input: {
              subject,
              body,
              classification,
              groupVersion: group.version,
              idempotencyKey: crypto.randomUUID(),
            },
          };
          onAttempt(next);
          onSubmit(next.input);
        }
      }}
    >
      <Stack spacing={2} sx={{ pt: 0.75 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ p: 1.5, bgcolor: 'action.hover', color: 'text.secondary' }}
        >
          <UsersRound size={20} />
          <Typography variant="body2">
            {t('addressBook.send.recipients', { count: reviewedGroup?.members.length ?? 0 })}
          </Typography>
        </Stack>
        <Box
          component="ul"
          aria-label={t('addressBook.send.recipientList')}
          sx={{ m: 0, px: 2, py: 1, maxHeight: 180, overflowY: 'auto', bgcolor: 'action.hover' }}
        >
          {reviewedGroup?.members.map((member) => (
            <Box component="li" key={member.contactId} sx={{ py: 0.5, overflowWrap: 'anywhere' }}>
              <Typography variant="body2">{member.displayName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {member.emailAddress}
              </Typography>
            </Box>
          ))}
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              disabled={busy || (Boolean(attempt) && !attempt?.reviewRequired)}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
          }
          label={t('addressBook.send.confirmRecipients')}
        />
        {(retryFailed || attempt) && !busy && (
          <Typography role="alert" variant="body2" color="warning.main">
            {t('addressBook.send.retryNotice')}
          </Typography>
        )}
        {(conflict || attempt?.original) && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {t('addressBook.send.conflictNotice')}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <ActionButton intent="quiet" disabled={busy} onClick={onReviewLatest}>
                {t('addressBook.send.reviewLatest')}
              </ActionButton>
              {attempt?.original && (
                <ActionButton
                  intent="quiet"
                  disabled={busy}
                  onClick={() => onSubmit(attempt.original!.input)}
                >
                  {t('addressBook.send.checkOriginal')}
                </ActionButton>
              )}
            </Stack>
          </Stack>
        )}
        {refreshFailed && (
          <Typography role="alert" variant="body2" color="error.main">
            {t('addressBook.send.refreshError')}
          </Typography>
        )}
        <FormField
          required
          autoFocus
          disabled={locked}
          label={t('compose.subject')}
          value={subject}
          inputProps={{ maxLength: 500 }}
          onChange={(event) => setSubject(event.target.value)}
        />
        <FormField
          required
          multiline
          disabled={locked}
          minRows={8}
          label={t('compose.body')}
          value={body}
          inputProps={{ maxLength: 100_000 }}
          onChange={(event) => setBody(event.target.value)}
        />
        <FormControl disabled={locked}>
          <InputLabel id="mail-group-classification-label">
            {t('addressBook.send.classification')}
          </InputLabel>
          <Select
            labelId="mail-group-classification-label"
            label={t('addressBook.send.classification')}
            value={classification}
            onChange={(event) => setClassification(event.target.value as MailClassification)}
          >
            {(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const).map((value) => (
              <MenuItem key={value} value={value}>
                {t(`classification.${value}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </FormDialog>
  );
}
