import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, UsersRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMailAddressBook } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  FormDialog,
  FormField,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailRecipient } from '@dwp-frontend/shared-utils';

export function MailRecipientPicker({
  open,
  disabled,
  recipients,
  onClose,
  onChange,
}: {
  open: boolean;
  disabled: boolean;
  recipients: MailRecipient[];
  onClose: () => void;
  onChange: (recipients: MailRecipient[]) => void;
}) {
  const { t } = useTranslation('mail');
  const [type, setType] = useState<MailRecipient['type']>('TO');
  const [query, setQuery] = useState('');
  const addressBook = useQuery({
    queryKey: ['mail', 'address-book', 'compose-picker'],
    queryFn: () => getMailAddressBook({ pageSize: 200 }),
    enabled: open,
    staleTime: 30_000,
    retry: 1,
  });
  const normalized = query.trim().toLowerCase();
  const contacts = useMemo(
    () =>
      (addressBook.data?.contacts.items ?? []).filter((contact) =>
        [contact.displayName, contact.emailAddress, contact.organizationName]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalized))
      ),
    [addressBook.data?.contacts.items, normalized]
  );
  const groups = useMemo(
    () =>
      (addressBook.data?.groups ?? []).filter(
        (group) =>
          group.displayName.toLowerCase().includes(normalized) ||
          group.members.some((member) =>
            [member.displayName, member.emailAddress]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(normalized))
          )
      ),
    [addressBook.data?.groups, normalized]
  );

  const add = (next: Array<{ displayName?: string | null; emailAddress: string }>) => {
    const known = new Set(recipients.map((recipient) => recipient.email.toLowerCase()));
    const additions = next
      .filter((recipient) => !known.has(recipient.emailAddress.toLowerCase()))
      .map<MailRecipient>((recipient) => ({
        type,
        name: recipient.displayName ?? null,
        email: recipient.emailAddress,
      }));
    onChange([...recipients, ...additions]);
  };
  const selected = new Set(recipients.map((recipient) => recipient.email.toLowerCase()));

  return (
    <FormDialog
      open={open}
      mobileFullScreen
      title={t('compose.recipientPicker.title')}
      description={t('compose.recipientPicker.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.done')}
      busy={false}
      onClose={onClose}
      onSubmit={onClose}
    >
      <Stack spacing={1.5}>
        <SelectField
          label={t('compose.recipientPicker.role')}
          value={type}
          options={(['TO', 'CC', 'BCC'] as const).map((value) => ({
            value,
            label: t(`compose.recipientPicker.roleValue.${value}`),
          }))}
          disabled={disabled}
          onValueChange={(value) => value && setType(value)}
        />
        <FormField
          type="search"
          label={t('compose.recipientPicker.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={17} />
              </InputAdornment>
            ),
          }}
        />
        {addressBook.isLoading && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={60} />
            <Skeleton variant="rounded" height={60} />
          </Stack>
        )}
        {addressBook.isError && (
          <Alert severity="error">{t('compose.recipientPicker.loadError')}</Alert>
        )}
        {!addressBook.isLoading && !addressBook.isError && !contacts.length && !groups.length && (
          <GuidedEmptyState
            kind={normalized ? 'no-results' : 'first-use'}
            title={t('compose.recipientPicker.emptyTitle')}
            description={t('compose.recipientPicker.emptyDescription')}
          />
        )}
        {groups.length > 0 && (
          <Box component="section" aria-label={t('compose.recipientPicker.groups')}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
              {t('compose.recipientPicker.groups')}
            </Typography>
            <Stack divider={<Divider flexItem />} sx={{ borderBlock: 1, borderColor: 'divider' }}>
              {groups.map((group) => {
                const remaining = group.members.filter(
                  (member) => !selected.has(member.emailAddress.toLowerCase())
                );
                return (
                  <Stack
                    key={group.groupId}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ py: 1 }}
                  >
                    <UsersRound size={17} aria-hidden />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {group.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('compose.recipientPicker.memberCount', { count: group.members.length })}
                      </Typography>
                    </Box>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      disabled={disabled || remaining.length === 0}
                      onClick={() => add(group.members)}
                    >
                      {remaining.length
                        ? t('compose.recipientPicker.addGroup')
                        : t('compose.recipientPicker.added')}
                    </ActionButton>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        )}
        {contacts.length > 0 && (
          <Box component="section" aria-label={t('compose.recipientPicker.contacts')}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
              {t('compose.recipientPicker.contacts')}
            </Typography>
            <Stack divider={<Divider flexItem />} sx={{ borderBlock: 1, borderColor: 'divider' }}>
              {contacts.map((contact) => {
                const added = selected.has(contact.emailAddress.toLowerCase());
                return (
                  <Stack
                    key={contact.contactId}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ py: 1 }}
                  >
                    <UserPlus size={17} aria-hidden />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {contact.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {contact.emailAddress}
                      </Typography>
                    </Box>
                    {added ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('compose.recipientPicker.added')}
                      />
                    ) : (
                      <ActionButton
                        intent="quiet"
                        size="small"
                        disabled={disabled}
                        onClick={() => add([contact])}
                      >
                        {t('compose.recipientPicker.add')}
                      </ActionButton>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        )}
      </Stack>
    </FormDialog>
  );
}
