import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ContactRound,
  History,
  MailPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveMailContact,
  archiveMailContactGroup,
  createMailContact,
  createMailContactGroup,
  getMailAddressBook,
  getMailGroupSendHistory,
  HttpError,
  listPeople,
  replaceMailContactGroupMembers,
  resolveIdempotentMutationIntent,
  sendMailContactGroupMessage,
  updateMailContact,
  updateMailContactGroup,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormField,
  LoadingState,
  ConfirmDialog,
  GuidedEmptyState,
  PageCanvas,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  MailContactDialog,
  MailGroupDialog,
  MailGroupMembersDialog,
  MailGroupMessageDialog,
} from './mail-address-book-dialogs';
import { MailAddressBookContactWorkspace } from './mail-address-book-contact-workspace';
import { MailGroupReceiptDialog } from './mail-group-receipt-dialog';
import { MailPageHeading } from './mail-components';
import { mailComposeNavigationState } from './mail-compose-navigation';
import {
  clearMailSendAttempt,
  listMailSendAttempts,
  mailGroupSendScope,
  mailSendCustodyOwner,
  mailSendErrorDisposition,
  readMailSendAttempt,
  rememberMailSendAttempt,
} from './mail-send-attempt';

import type { MailGroupMessageAttempt } from './mail-address-book-dialogs';

import type {
  MailContact,
  MailContactGroup,
  MailContactInput,
  MailGroupSendReceipt,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;

type ArchiveTarget =
  { kind: 'contact'; value: MailContact } | { kind: 'group'; value: MailContactGroup };

const AVATAR_TONES = ['success.dark', 'info.dark', 'error.dark', 'warning.dark'] as const;
const MAIL_CLASSIFICATIONS = new Set(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isMailGroupMessageAttempt(value: unknown): value is MailGroupMessageAttempt {
  if (!isRecord(value) || !isRecord(value.group) || !isRecord(value.input)) return false;
  return (
    typeof value.group.groupId === 'string' &&
    Array.isArray(value.group.members) &&
    typeof value.input.subject === 'string' &&
    typeof value.input.body === 'string' &&
    typeof value.input.classification === 'string' &&
    MAIL_CLASSIFICATIONS.has(value.input.classification) &&
    (value.input.recipientMode === 'TO' || value.input.recipientMode === 'BCC') &&
    typeof value.input.idempotencyKey === 'string' &&
    Number.isInteger(value.input.groupVersion) &&
    (value.reviewRequired === undefined || typeof value.reviewRequired === 'boolean') &&
    (value.snapshotStale === undefined || typeof value.snapshotStale === 'boolean')
  );
}

function restoredGroupSendAttempts(owner: string) {
  return Object.fromEntries(
    listMailSendAttempts<unknown>(owner, 'group').flatMap(({ scope, attempt }) => {
      if (
        !isMailGroupMessageAttempt(attempt.payload) ||
        attempt.intent.key !== attempt.payload.input.idempotencyKey ||
        scope !== mailGroupSendScope(owner, attempt.payload.group.groupId)
      ) {
        clearMailSendAttempt(scope);
        return [];
      }
      return [[attempt.payload.group.groupId, attempt.payload] as const];
    })
  );
}

function persistGroupSendAttempt(owner: string, attempt: MailGroupMessageAttempt) {
  const { idempotencyKey, ...request } = attempt.input;
  rememberMailSendAttempt(mailGroupSendScope(owner, attempt.group.groupId), {
    intent: resolveIdempotentMutationIntent(
      null,
      { groupId: attempt.group.groupId, ...request },
      () => idempotencyKey
    ),
    payload: attempt,
  });
}

function initials(value: string) {
  const words = value.trim().split(/\s+/u);
  return words.length > 1
    ? `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase()
    : value.slice(0, 2).toUpperCase();
}

function toneFor(value: string) {
  const index = [...value].reduce((sum, character) => sum + character.codePointAt(0)!, 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function directorySeed(person: PersonSummary): MailContactInput | null {
  if (!person.workEmail) return null;
  return {
    displayName: person.displayName,
    emailAddress: person.workEmail,
    organizationName: person.organizationName ?? '',
    jobTitle: person.businessTitle ?? person.jobProfileName ?? '',
    phoneNumber: '',
    favorite: false,
  };
}

export function MailAddressBook() {
  const { t } = useTranslation('mail');
  const auth = useAuth();
  const custodyOwner = mailSendCustodyOwner(auth.user);
  const hasCustodyOwner = Boolean(auth.user);
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('view') === 'groups' ? 1 : params.get('view') === 'directory' ? 2 : 0;
  const selectedContactId = params.get('contact');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [contactDialog, setContactDialog] = useState<{
    contact?: MailContact | null;
    seed?: MailContactInput | null;
  } | null>(null);
  const [groupDialog, setGroupDialog] = useState<MailContactGroup | null | undefined>(undefined);
  const [membersGroup, setMembersGroup] = useState<MailContactGroup | null>(null);
  const [sendGroup, setSendGroup] = useState<MailContactGroup | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [receiptGroup, setReceiptGroup] = useState<MailContactGroup | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<MailGroupSendReceipt | null>(null);
  const [sendAttempts, setSendAttempts] = useState<Record<string, MailGroupMessageAttempt>>({});
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);

  useEffect(() => {
    setSendAttempts(hasCustodyOwner ? restoredGroupSendAttempts(custodyOwner) : {});
  }, [custodyOwner, hasCustodyOwner]);

  const addressBookQuery = useQuery({
    queryKey: ['mail', 'address-book', tab === 0 ? deferredSearch.trim() : ''],
    queryFn: () => getMailAddressBook({ query: tab === 0 ? deferredSearch : '', pageSize: 100 }),
    staleTime: 20_000,
  });
  const directoryQuery = useQuery({
    queryKey: ['mail', 'address-book', 'directory', deferredSearch.trim()],
    queryFn: ({ signal }) =>
      listPeople({
        query: deferredSearch.trim(),
        status: 'ACTIVE',
        size: 30,
        surface: 'directory',
        signal,
      }),
    enabled: tab === 2 && deferredSearch.trim().length >= 2,
    staleTime: 30_000,
  });
  const receiptHistoryQuery = useQuery({
    queryKey: ['mail', 'address-book', 'group-send-history', receiptGroup?.groupId],
    queryFn: () => getMailGroupSendHistory(receiptGroup!.groupId),
    enabled: Boolean(receiptGroup),
    staleTime: 10_000,
    retry: 1,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mail', 'address-book'] });
  };
  const contactMutation = useMutation({
    mutationFn: async ({
      contact,
      input,
    }: {
      contact?: MailContact | null;
      input: MailContactInput;
    }) =>
      contact
        ? updateMailContact(contact.contactId, { ...input, version: contact.version })
        : createMailContact({ ...input, idempotencyKey: crypto.randomUUID() }),
    onSuccess: async () => {
      setContactDialog(null);
      await refresh();
      toast.success(t('addressBook.contact.saved'));
    },
    onError: () => toast.error(t('addressBook.saveError')),
  });
  const groupMutation = useMutation({
    mutationFn: async ({
      group,
      input,
    }: {
      group?: MailContactGroup | null;
      input: { displayName: string; description: string };
    }) =>
      group
        ? updateMailContactGroup(group.groupId, { ...input, version: group.version })
        : createMailContactGroup({ ...input, idempotencyKey: crypto.randomUUID() }),
    onSuccess: async (group, variables) => {
      setGroupDialog(undefined);
      await refresh();
      toast.success(t('addressBook.group.saved'));
      if (!variables.group) setMembersGroup(group);
    },
    onError: () => toast.error(t('addressBook.saveError')),
  });
  const membersMutation = useMutation({
    mutationFn: ({ group, contactIds }: { group: MailContactGroup; contactIds: string[] }) =>
      replaceMailContactGroupMembers(group.groupId, {
        contactIds,
        idempotencyKey: crypto.randomUUID(),
        version: group.version,
      }),
    onSuccess: async () => {
      setMembersGroup(null);
      await refresh();
      toast.success(t('addressBook.members.saved'));
    },
    onError: () => toast.error(t('addressBook.conflictError')),
  });
  const archiveMutation = useMutation({
    mutationFn: async (target: ArchiveTarget) => {
      if (target.kind === 'contact') {
        await archiveMailContact(target.value.contactId, target.value.version);
      } else {
        await archiveMailContactGroup(target.value.groupId, target.value.version);
      }
    },
    onSuccess: async () => {
      if (
        archiveTarget?.kind === 'contact' &&
        archiveTarget.value.contactId === selectedContactId
      ) {
        const next = new URLSearchParams(params);
        next.delete('contact');
        setParams(next, { replace: true });
      }
      setArchiveTarget(null);
      await refresh();
      toast.success(t('addressBook.archived'));
    },
    onError: () => toast.error(t('addressBook.conflictError')),
  });
  const sendMutation = useMutation({
    mutationFn: ({
      group,
      input,
    }: {
      group: MailContactGroup;
      input: Parameters<typeof sendMailContactGroupMessage>[1];
    }) => sendMailContactGroupMessage(group.groupId, input),
    onSuccess: async (result, { group }) => {
      clearMailSendAttempt(mailGroupSendScope(custodyOwner, group.groupId));
      setSendDialogOpen(false);
      setSendGroup(null);
      if (result.receipt) {
        setLatestReceipt(result.receipt);
        setReceiptGroup(group);
      }
      setSendAttempts((current) => {
        const next = { ...current };
        delete next[group.groupId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      toast.success(t('addressBook.send.sent'));
    },
    onError: (error, { group }) => {
      if (mailSendErrorDisposition(error) !== 'REJECTED') return;
      const scope = mailGroupSendScope(custodyOwner, group.groupId);
      const attempt = readMailSendAttempt<MailGroupMessageAttempt>(scope)?.payload;
      if (!attempt) return;
      const conflict = error instanceof HttpError && error.status === 409;
      const nextAttempt = {
        ...attempt,
        input: conflict
          ? attempt.input
          : { ...attempt.input, idempotencyKey: crypto.randomUUID() },
        original: attempt.original ?? attempt,
        reviewRequired: true,
        snapshotStale: conflict,
      };
      persistGroupSendAttempt(custodyOwner, nextAttempt);
      setSendAttempts((current) => ({ ...current, [group.groupId]: nextAttempt }));
    },
  });
  const reviewRecipientsMutation = useMutation({
    mutationFn: async (attempt: MailGroupMessageAttempt) => {
      const latest = await getMailAddressBook({ pageSize: 100 });
      const group = latest.groups.find((item) => item.groupId === attempt.group.groupId);
      if (!group) throw new Error('Mail group is unavailable');
      return {
        ...attempt,
        group,
        input: {
          ...attempt.input,
          groupVersion: group.version,
          idempotencyKey: crypto.randomUUID(),
        },
        original: attempt.original ?? { group: attempt.group, input: attempt.input },
        reviewRequired: true,
        snapshotStale: false,
      };
    },
    onSuccess: (attempt) => {
      persistGroupSendAttempt(custodyOwner, attempt);
      setSendAttempts((current) => ({ ...current, [attempt.group.groupId]: attempt }));
      sendMutation.reset();
    },
  });

  const addressBook = addressBookQuery.data;
  const existingEmails = useMemo(
    () => new Set(addressBook?.contacts.items.map((contact) => contact.emailAddress) ?? []),
    [addressBook?.contacts.items]
  );
  const filteredGroups = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return addressBook?.groups ?? [];
    return (addressBook?.groups ?? []).filter((group) =>
      [group.displayName, group.description, ...group.members.map((member) => member.displayName)]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalized))
    );
  }, [addressBook?.groups, deferredSearch]);
  const anyBusy =
    contactMutation.isPending ||
    groupMutation.isPending ||
    membersMutation.isPending ||
    archiveMutation.isPending ||
    sendMutation.isPending ||
    reviewRecipientsMutation.isPending;

  return (
    <PageCanvas>
      <MailPageHeading
        eyebrow={t('addressBook.eyebrow')}
        title={t('addressBook.title')}
        description={t('addressBook.description')}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: 1, sm: 'auto' }}>
            <ActionButton
              intent="quiet"
              startIcon={<UserPlus size={17} />}
              onClick={() => setContactDialog({ contact: null })}
            >
              {t('addressBook.contact.new')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<UsersRound size={17} />}
              onClick={() => setGroupDialog(null)}
            >
              {t('addressBook.group.new')}
            </ActionButton>
          </Stack>
        }
      />

      {addressBookQuery.isError && (
        <ErrorState
          size="compact"
          title={t('addressBook.loadError')}
          onRetry={refresh}
          retryLabel={t('actions.retry')}
        />
      )}

      {addressBookQuery.isLoading ? (
        <LoadingState
          label={t('addressBook.directory.loading')}
          variant="skeleton"
          embedded
          skeletonHeights={[94, 420]}
          skeletonGap={2}
        />
      ) : addressBook ? (
        <Stack spacing={2.5}>
          <Box
            component="section"
            aria-label={t('addressBook.summaryLabel')}
            sx={(theme) => ({
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              borderBlock: 1,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.background.paper, 0.55),
            })}
          >
            {[
              ['contacts', addressBook.summary.contactCount],
              ['favorites', addressBook.summary.favoriteCount],
              ['groups', addressBook.summary.groupCount],
            ].map(([key, value], index) => (
              <Box
                key={key}
                sx={{
                  px: { xs: 0, sm: 2.25 },
                  py: 1.5,
                  borderLeft: { sm: index ? 1 : 0 },
                  borderTop: { xs: index ? 1 : 0, sm: 0 },
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t(`addressBook.summary.${key}`)}
                </Typography>
                <Typography
                  variant="h6"
                  component="p"
                  fontWeight="fontWeightBold"
                  sx={{ mt: 0.25 }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box>
            <FormField
              fullWidth
              value={search}
              label={tab === 2 ? t('addressBook.searchDirectory') : t('addressBook.search')}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 620 }}
            />
            <Tabs
              value={tab}
              onChange={(_event, value: number) => {
                const next = new URLSearchParams(params);
                const view = value === 1 ? 'groups' : value === 2 ? 'directory' : null;
                if (view) next.set('view', view);
                else next.delete('view');
                next.delete('contact');
                setParams(next, { replace: true });
                setSearch('');
              }}
              aria-label={t('addressBook.tabsLabel')}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ mt: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                icon={<ContactRound size={17} />}
                iconPosition="start"
                label={t('addressBook.tabs.contacts')}
              />
              <Tab
                icon={<UsersRound size={17} />}
                iconPosition="start"
                label={t('addressBook.tabs.groups')}
              />
              <Tab
                icon={<Search size={17} />}
                iconPosition="start"
                label={t('addressBook.tabs.directory')}
              />
            </Tabs>
          </Box>

          {tab === 0 && (
            <MailAddressBookContactWorkspace
              contacts={addressBook.contacts.items}
              selectedId={selectedContactId}
              onSelect={(contact) => {
                const next = new URLSearchParams(params);
                next.set('contact', contact.contactId);
                setParams(next);
              }}
              onBack={() => {
                const next = new URLSearchParams(params);
                next.delete('contact');
                setParams(next, { replace: true });
              }}
              onCompose={(contact) => {
                const next = new URLSearchParams(params);
                next.set('contact', contact.contactId);
                navigate('/mail/inbox?compose=open', {
                  state: mailComposeNavigationState(
                    { toEmail: contact.emailAddress },
                    `/mail/contacts?${next.toString()}`
                  ),
                });
              }}
              onEdit={(contact) => setContactDialog({ contact })}
              onArchive={(contact) => setArchiveTarget({ kind: 'contact', value: contact })}
            />
          )}
          {tab === 1 && (
            <GroupList
              groups={filteredGroups}
              onEdit={(group) => setGroupDialog(group)}
              onMembers={setMembersGroup}
              onSend={(group) => {
                setSendGroup(group);
                setSendDialogOpen(true);
                sendMutation.reset();
                reviewRecipientsMutation.reset();
              }}
              onHistory={(group) => {
                setLatestReceipt(null);
                setReceiptGroup(group);
              }}
              onArchive={(group) => setArchiveTarget({ kind: 'group', value: group })}
            />
          )}
          {tab === 2 && (
            <DirectoryList
              query={deferredSearch}
              people={directoryQuery.data?.items ?? []}
              loading={directoryQuery.isFetching}
              error={directoryQuery.isError}
              existingEmails={existingEmails}
              onAdd={(person) => {
                const seed = directorySeed(person);
                if (seed) setContactDialog({ contact: null, seed });
              }}
            />
          )}
        </Stack>
      ) : null}

      <MailContactDialog
        open={Boolean(contactDialog)}
        contact={contactDialog?.contact}
        seed={contactDialog?.seed}
        busy={contactMutation.isPending}
        onClose={() => setContactDialog(null)}
        onSubmit={(input) => contactMutation.mutate({ contact: contactDialog?.contact, input })}
      />
      <MailGroupDialog
        open={groupDialog !== undefined}
        group={groupDialog}
        busy={groupMutation.isPending}
        onClose={() => setGroupDialog(undefined)}
        onSubmit={(input) => groupMutation.mutate({ group: groupDialog, input })}
      />
      <MailGroupMembersDialog
        open={Boolean(membersGroup)}
        group={membersGroup}
        contacts={addressBook?.contacts.items ?? []}
        busy={membersMutation.isPending}
        onClose={() => setMembersGroup(null)}
        onSubmit={(contactIds) => {
          if (membersGroup) membersMutation.mutate({ group: membersGroup, contactIds });
        }}
      />
      <MailGroupMessageDialog
        open={sendDialogOpen}
        group={sendGroup}
        busy={sendMutation.isPending || reviewRecipientsMutation.isPending}
        retryFailed={
          sendMutation.isError && mailSendErrorDisposition(sendMutation.error) === 'UNCONFIRMED'
        }
        rejected={
          sendMutation.isError &&
          mailSendErrorDisposition(sendMutation.error) === 'REJECTED' &&
          !(sendMutation.error instanceof HttpError && sendMutation.error.status === 409)
        }
        conflict={sendMutation.error instanceof HttpError && sendMutation.error.status === 409}
        refreshFailed={reviewRecipientsMutation.isError}
        attempt={sendGroup ? (sendAttempts[sendGroup.groupId] ?? null) : null}
        onAttempt={(attempt) => {
          persistGroupSendAttempt(custodyOwner, attempt);
          setSendAttempts((current) => ({ ...current, [attempt.group.groupId]: attempt }));
        }}
        onClose={() => setSendDialogOpen(false)}
        onReviewLatest={() => {
          const attempt = sendGroup && sendAttempts[sendGroup.groupId];
          if (attempt) reviewRecipientsMutation.mutate(attempt);
        }}
        onSubmit={(input) => {
          if (!sendGroup) return;
          sendMutation.mutate({
            group: sendGroup,
            input,
          });
        }}
      />
      <MailGroupReceiptDialog
        group={receiptGroup}
        receipts={receiptHistoryQuery.data ?? []}
        latestReceipt={latestReceipt}
        loading={receiptHistoryQuery.isLoading}
        error={receiptHistoryQuery.isError}
        onClose={() => {
          setReceiptGroup(null);
          setLatestReceipt(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title={t('addressBook.archiveTitle')}
        description={t('addressBook.archiveDescription', {
          name: archiveTarget?.value.displayName ?? '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('addressBook.archive')}
        confirmingLabel={t('addressBook.archiving')}
        busy={archiveMutation.isPending}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (archiveTarget) archiveMutation.mutate(archiveTarget);
        }}
      />
      <Box role="status" aria-live="polite" sx={{ position: 'absolute', clip: 'rect(0 0 0 0)' }}>
        {anyBusy ? t('addressBook.updating') : ''}
      </Box>
    </PageCanvas>
  );
}

function GroupList({
  groups,
  onEdit,
  onMembers,
  onSend,
  onHistory,
  onArchive,
}: {
  groups: MailContactGroup[];
  onEdit: (group: MailContactGroup) => void;
  onMembers: (group: MailContactGroup) => void;
  onSend: (group: MailContactGroup) => void;
  onHistory: (group: MailContactGroup) => void;
  onArchive: (group: MailContactGroup) => void;
}) {
  const { t } = useTranslation('mail');
  if (!groups.length) {
    return (
      <GuidedEmptyState
        kind="empty"
        title={t('addressBook.group.emptyTitle')}
        description={t('addressBook.group.emptyDescription')}
      />
    );
  }
  return (
    <Box
      component="section"
      aria-label={t('addressBook.group.listTitle')}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
      }}
    >
      {groups.map((group) => (
        <Box
          key={group.groupId}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: COMPACT_RADIUS,
            bgcolor: 'background.paper',
            p: 2,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box
              sx={{
                width: 40,
                height: 40,
                display: 'grid',
                placeItems: 'center',
                borderRadius: COMPACT_RADIUS,
                bgcolor: 'var(--dwp-product-soft)',
                color: 'var(--dwp-product-accent)',
                flexShrink: 0,
              }}
            >
              <UsersRound size={20} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight="fontWeightBold">{group.displayName}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, minHeight: 40 }}>
                {group.description || t('addressBook.group.noDescription')}
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                <Chip
                  size="small"
                  label={t('addressBook.group.memberCount', { count: group.members.length })}
                />
                {group.members.slice(0, 2).map((member) => (
                  <Chip
                    key={member.contactId}
                    size="small"
                    variant="outlined"
                    label={member.displayName}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            flexWrap="wrap"
            useFlexGap
            justifyContent="flex-end"
            sx={{ mt: 2 }}
          >
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => onEdit(group)}
              startIcon={<Pencil size={15} />}
            >
              {t('addressBook.group.edit')}
            </ActionButton>
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => onMembers(group)}
              startIcon={<Plus size={15} />}
            >
              {t('addressBook.group.members')}
            </ActionButton>
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => onHistory(group)}
              startIcon={<History size={15} />}
            >
              {t('addressBook.group.history')}
            </ActionButton>
            <ActionButton
              intent="primary"
              size="small"
              onClick={() => onSend(group)}
              startIcon={<MailPlus size={15} />}
              disabled={!group.members.length}
            >
              {t('addressBook.group.send')}
            </ActionButton>
            <ActionIconButton
              size="small"
              label={t('addressBook.archive')}
              onClick={() => onArchive(group)}
            >
              <Trash2 size={16} />
            </ActionIconButton>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

function DirectoryList({
  query,
  people,
  loading,
  error,
  existingEmails,
  onAdd,
}: {
  query: string;
  people: PersonSummary[];
  loading: boolean;
  error: boolean;
  existingEmails: Set<string>;
  onAdd: (person: PersonSummary) => void;
}) {
  const { t } = useTranslation('mail');
  if (query.trim().length < 2) {
    return (
      <GuidedEmptyState
        kind="first-use"
        title={t('addressBook.directory.startTitle')}
        description={t('addressBook.directory.startDescription')}
      />
    );
  }
  if (loading) return <LoadingState size="compact" label={t('addressBook.directory.loading')} />;
  if (error) return <ErrorState size="compact" title={t('addressBook.directory.error')} />;
  if (!people.length) {
    return (
      <GuidedEmptyState
        kind="no-results"
        title={t('addressBook.directory.emptyTitle')}
        description={t('addressBook.directory.emptyDescription')}
      />
    );
  }
  return (
    <Box
      component="section"
      aria-label={t('addressBook.directory.title')}
      sx={{ borderTop: 1, borderColor: 'divider' }}
    >
      {people.map((person) => {
        const saved = Boolean(person.workEmail && existingEmails.has(person.workEmail));
        return (
          <Box
            key={person.personId}
            sx={{
              py: 1.25,
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Avatar
              sx={{
                bgcolor: toneFor(person.displayName),
                width: 40,
                height: 40,
                fontSize: 'caption.fontSize',
              }}
            >
              {initials(person.displayName)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight="fontWeightBold">{person.displayName}</Typography>
              <Typography variant="body2" noWrap>
                {person.workEmail ?? t('addressBook.directory.noEmail')}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {[person.organizationName, person.businessTitle].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
            <ActionButton
              intent={saved ? 'quiet' : 'primary'}
              size="small"
              disabled={!person.workEmail || saved}
              startIcon={<UserPlus size={15} />}
              onClick={() => onAdd(person)}
            >
              {saved ? t('addressBook.directory.saved') : t('addressBook.directory.add')}
            </ActionButton>
          </Box>
        );
      })}
    </Box>
  );
}
