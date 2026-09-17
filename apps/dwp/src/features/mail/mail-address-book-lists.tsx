import { useTranslation } from 'react-i18next';
import { History, MailPlus, Pencil, Plus, Trash2, UserPlus, UsersRound } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailContactGroup, PersonSummary } from '@dwp-frontend/shared-utils';

const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;
const AVATAR_TONES = ['success.dark', 'info.dark', 'error.dark', 'warning.dark'] as const;

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

export function AddressBookPagination({
  page,
  pageSize,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation('mail');
  if (total <= pageSize && page === 0) return null;
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      alignItems={{ sm: 'center' }}
      justifyContent="space-between"
    >
      <Typography variant="caption" color="text.secondary">
        {t('addressBook.pagination.summary', {
          defaultValue: '{{from}}–{{to}} of {{total}} contacts',
          from: total ? page * pageSize + 1 : 0,
          to: Math.min((page + 1) * pageSize, total),
          total,
        })}
      </Typography>
      <Stack direction="row" spacing={1}>
        <ActionButton
          intent="secondary"
          size="small"
          disabled={loading || page <= 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          {t('addressBook.pagination.previous', { defaultValue: 'Previous' })}
        </ActionButton>
        <ActionButton
          intent="secondary"
          size="small"
          disabled={loading || (page + 1) * pageSize >= total}
          onClick={() => onPageChange(page + 1)}
        >
          {t('addressBook.pagination.next', { defaultValue: 'Next' })}
        </ActionButton>
      </Stack>
    </Stack>
  );
}

export function GroupList({
  groups,
  canUpdate,
  canSend,
  onEdit,
  onMembers,
  onSend,
  onHistory,
  onArchive,
}: {
  groups: MailContactGroup[];
  canUpdate: boolean;
  canSend: boolean;
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
              disabled={!canUpdate}
              onClick={() => onEdit(group)}
              startIcon={<Pencil size={15} />}
            >
              {t('addressBook.group.edit')}
            </ActionButton>
            <ActionButton
              intent="quiet"
              size="small"
              disabled={!canUpdate}
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
              disabled={!canSend || !group.members.length}
            >
              {t('addressBook.group.send')}
            </ActionButton>
            <ActionIconButton
              size="small"
              label={t('addressBook.archive')}
              disabled={!canUpdate}
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

export function DirectoryList({
  query,
  people,
  loading,
  error,
  page,
  hasMore,
  existingEmails,
  canAdd,
  onAdd,
  onViewProfile,
  onCompose,
  onPrevious,
  onNext,
}: {
  query: string;
  people: PersonSummary[];
  loading: boolean;
  error: boolean;
  page: number;
  hasMore: boolean;
  existingEmails: Set<string>;
  canAdd: boolean;
  onAdd: (person: PersonSummary) => void;
  onViewProfile: (person: PersonSummary) => void;
  onCompose: (person: PersonSummary) => void;
  onPrevious: () => void;
  onNext: () => void;
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
  if (!people.length && page === 0) {
    return (
      <GuidedEmptyState
        kind="no-results"
        title={t('addressBook.directory.emptyTitle')}
        description={t('addressBook.directory.emptyDescription')}
      />
    );
  }
  return (
    <Stack component="section" aria-label={t('addressBook.directory.title')} spacing={1.5}>
      <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
        {people.map((person) => {
          const saved = Boolean(person.workEmail && existingEmails.has(person.workEmail));
          return (
            <Box
              key={person.personId}
              sx={{
                py: 1.25,
                display: 'grid',
                gridTemplateColumns: { xs: 'auto minmax(0, 1fr)', sm: 'auto minmax(0, 1fr) auto' },
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
              <Stack
                direction="row"
                spacing={0.75}
                flexWrap="wrap"
                useFlexGap
                sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, justifyContent: 'flex-end' }}
              >
                <ActionButton intent="quiet" size="small" onClick={() => onViewProfile(person)}>
                  {t('addressBook.directory.profile')}
                </ActionButton>
                <ActionButton
                  intent="secondary"
                  size="small"
                  disabled={!person.workEmail}
                  startIcon={<MailPlus size={15} />}
                  onClick={() => onCompose(person)}
                >
                  {t('addressBook.directory.compose')}
                </ActionButton>
                <ActionButton
                  intent={saved ? 'quiet' : 'primary'}
                  size="small"
                  disabled={!canAdd || !person.workEmail || saved}
                  startIcon={<UserPlus size={15} />}
                  onClick={() => onAdd(person)}
                >
                  {saved ? t('addressBook.directory.saved') : t('addressBook.directory.add')}
                </ActionButton>
              </Stack>
            </Box>
          );
        })}
      </Box>
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <ActionButton
          intent="secondary"
          size="small"
          disabled={loading || page === 0}
          onClick={onPrevious}
        >
          {t('addressBook.pagination.previous', { defaultValue: 'Previous' })}
        </ActionButton>
        <ActionButton
          intent="secondary"
          size="small"
          disabled={loading || !hasMore}
          onClick={onNext}
        >
          {t('addressBook.pagination.next', { defaultValue: 'Next' })}
        </ActionButton>
      </Stack>
    </Stack>
  );
}
