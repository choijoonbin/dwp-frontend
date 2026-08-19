import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Trash2, UserPlus, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMessagingConversationMember,
  getMessagingConversationMembers,
  leaveMessagingConversation,
  removeMessagingConversationMember,
  searchMessagingPeople,
  updateMessagingConversationMemberRole,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  AutocompleteField,
  ConfirmDialog,
  ContentDialog,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { Theme } from '@mui/material/styles';
import type {
  MessagingConversation,
  MessagingManagedMember,
  MessagingMemberRole,
  MessagingPerson,
} from '@dwp-frontend/shared-utils';

import { messagingInitials } from './messaging-components';

type PendingRemoval = MessagingManagedMember | 'LEAVE' | null;

const PROTECTED_SOURCES = new Set(['SPACE_MIRRORED', 'SYSTEM']);

export function MessagingMembersDialog({
  open,
  conversation,
  onClose,
  onLeft,
}: {
  open: boolean;
  conversation: MessagingConversation;
  onClose: () => void;
  onLeft: () => void;
}) {
  const { t } = useTranslation('messaging');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const fullScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const [peopleSearch, setPeopleSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<MessagingPerson | null>(null);
  const [addRole, setAddRole] = useState<MessagingMemberRole>('MEMBER');
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval>(null);
  const membershipQuery = useQuery({
    queryKey: ['messaging', 'members', conversation.conversationId],
    queryFn: () => getMessagingConversationMembers(conversation.conversationId),
    enabled: open,
    staleTime: 10_000,
    retry: 1,
  });
  const currentMember = membershipQuery.data?.members.find(
    (member) => member.userId === auth.user?.userId
  );
  const canManage = currentMember?.role === 'OWNER' || currentMember?.role === 'MODERATOR';
  const canManageOwners = currentMember?.role === 'OWNER';
  const peopleQuery = useQuery({
    queryKey: ['messaging', 'people', 'membership', peopleSearch.trim()],
    queryFn: () => searchMessagingPeople(peopleSearch.trim()),
    enabled: open && canManage && peopleSearch.trim().length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
  const candidates = useMemo(() => {
    const memberIds = new Set(membershipQuery.data?.members.map((member) => member.userId));
    return (peopleQuery.data ?? []).filter((person) => !memberIds.has(person.userId));
  }, [membershipQuery.data?.members, peopleQuery.data]);
  const syncMembership = (
    membership: Awaited<ReturnType<typeof getMessagingConversationMembers>>
  ) => {
    queryClient.setQueryData(['messaging', 'members', conversation.conversationId], membership);
    void queryClient.invalidateQueries({
      queryKey: ['messaging', 'conversation', conversation.conversationId],
    });
    void queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
  };
  const addMutation = useMutation({
    mutationFn: () =>
      addMessagingConversationMember({
        conversationId: conversation.conversationId,
        userId: selectedPerson!.userId,
        role: addRole,
        conversationVersion: membershipQuery.data!.conversationVersion,
      }),
    onSuccess: (result) => {
      syncMembership(result.membership);
      setSelectedPerson(null);
      setPeopleSearch('');
      toast.success(t('members.added'));
    },
    onError: () => {
      toast.error(t('members.mutationError'));
      void membershipQuery.refetch();
    },
  });
  const roleMutation = useMutation({
    mutationFn: ({ member, role }: { member: MessagingManagedMember; role: MessagingMemberRole }) =>
      updateMessagingConversationMemberRole({
        conversationId: conversation.conversationId,
        userId: member.userId,
        role,
        version: member.version,
      }),
    onSuccess: (result) => {
      syncMembership(result.membership);
      toast.success(t('members.roleUpdated'));
    },
    onError: () => {
      toast.error(t('members.mutationError'));
      void membershipQuery.refetch();
    },
  });
  const removeMutation = useMutation({
    mutationFn: (member: MessagingManagedMember) =>
      removeMessagingConversationMember({
        conversationId: conversation.conversationId,
        userId: member.userId,
        version: member.version,
      }),
    onSuccess: (result) => {
      syncMembership(result.membership);
      setPendingRemoval(null);
      toast.success(t('members.removed'));
    },
    onError: () => {
      toast.error(t('members.mutationError'));
      void membershipQuery.refetch();
    },
  });
  const leaveMutation = useMutation({
    mutationFn: () =>
      leaveMessagingConversation({
        conversationId: conversation.conversationId,
        version: currentMember!.version,
      }),
    onSuccess: () => {
      setPendingRemoval(null);
      onClose();
      onLeft();
      void queryClient.invalidateQueries({ queryKey: ['messaging'] });
      toast.success(t('members.left'));
    },
    onError: () => {
      toast.error(t('members.leaveError'));
      void membershipQuery.refetch();
    },
  });
  const roleOptions = (['VIEWER', 'MEMBER', 'MODERATOR', 'OWNER'] as const).map((role) => ({
    value: role,
    label: t(`members.roles.${role}`),
    disabled: role === 'OWNER' && !canManageOwners,
  }));
  const busy =
    addMutation.isPending ||
    roleMutation.isPending ||
    removeMutation.isPending ||
    leaveMutation.isPending;

  return (
    <>
      <ContentDialog
        open={open}
        title={t('members.title')}
        description={t('members.description', { name: conversation.name })}
        closeLabel={t('actions.close')}
        onClose={onClose}
        busy={busy}
        fullScreen={fullScreen}
        maxWidth="md"
        titleStart={<Users size={22} color="var(--dwp-product-accent)" />}
        contentDividers
        contentSx={{ p: 0 }}
      >
        {membershipQuery.isLoading ? (
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={76} />
            <Skeleton variant="rounded" height={260} />
          </Stack>
        ) : membershipQuery.isError || !membershipQuery.data ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {t('members.loadError')}
          </Alert>
        ) : (
          <Stack divider={<Divider flexItem />}>
            {canManage && (
              <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.25 }}>
                  {t('members.addTitle')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 180px auto' },
                    gap: 1,
                    alignItems: 'start',
                  }}
                >
                  <AutocompleteField<MessagingPerson>
                    label={t('members.searchLabel')}
                    options={candidates}
                    value={selectedPerson}
                    loading={peopleQuery.isLoading}
                    filterOptions={(options) => options}
                    getOptionLabel={(person) => `${person.displayName} · ${person.emailAddress}`}
                    isOptionEqualToValue={(option, value) => option.userId === value.userId}
                    onInputChange={(_, value, reason) => {
                      if (reason === 'input') setPeopleSearch(value);
                    }}
                    onChange={(_, person) => setSelectedPerson(person)}
                  />
                  <SelectField<MessagingMemberRole>
                    label={t('members.roleLabel')}
                    value={addRole}
                    options={roleOptions}
                    onValueChange={(value) => value && setAddRole(value)}
                  />
                  <ActionButton
                    intent="primary"
                    startIcon={<UserPlus size={17} />}
                    disabled={!selectedPerson || busy}
                    loading={addMutation.isPending}
                    loadingLabel={t('members.adding')}
                    onClick={() => addMutation.mutate()}
                    sx={{ minHeight: 40, mt: { sm: 1.8 } }}
                  >
                    {t('members.add')}
                  </ActionButton>
                </Box>
              </Box>
            )}

            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ px: 2, py: 1.25 }}>
                <Typography variant="subtitle2" fontWeight={800}>
                  {t('members.listTitle')}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('members.count', { count: membershipQuery.data.members.length })}
                />
              </Stack>
              <Divider />
              {membershipQuery.data.members.map((member) => {
                const protectedMembership = PROTECTED_SOURCES.has(member.membershipSource);
                const isSelf = member.userId === auth.user?.userId;
                const canChangeRole =
                  canManage &&
                  !protectedMembership &&
                  !isSelf &&
                  (member.role !== 'OWNER' || canManageOwners);
                const canRemove = canChangeRole;
                return (
                  <Stack
                    key={member.userId}
                    direction="row"
                    spacing={1.25}
                    alignItems="center"
                    sx={{ minHeight: 70, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Avatar sx={{ width: 36, height: 36, fontSize: 12, fontWeight: 800 }}>
                      {messagingInitials(member.displayName)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography variant="body2" fontWeight={780} noWrap>
                          {member.displayName}
                        </Typography>
                        {isSelf && (
                          <Chip size="small" label={t('members.me')} sx={{ height: 20 }} />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {member.jobTitle || member.emailAddress}
                      </Typography>
                    </Box>
                    {protectedMembership ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`members.sources.${member.membershipSource}`)}
                      />
                    ) : (
                      <SelectField<MessagingMemberRole>
                        value={member.role}
                        options={roleOptions}
                        disabled={!canChangeRole || busy}
                        onValueChange={(role) =>
                          role && role !== member.role && roleMutation.mutate({ member, role })
                        }
                        size="small"
                        fullWidth={false}
                        inputProps={{
                          'aria-label': t('members.memberRoleLabel', { name: member.displayName }),
                        }}
                        sx={{ width: 150 }}
                      />
                    )}
                    {canRemove && (
                      <ActionIconButton
                        label={t('members.removeLabel', { name: member.displayName })}
                        intent="danger"
                        disabled={busy}
                        onClick={() => setPendingRemoval(member)}
                      >
                        <Trash2 size={16} />
                      </ActionIconButton>
                    )}
                  </Stack>
                );
              })}
            </Box>

            {currentMember && !PROTECTED_SOURCES.has(currentMember.membershipSource) && (
              <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
                <ActionButton
                  intent="danger"
                  startIcon={<LogOut size={17} />}
                  disabled={busy}
                  onClick={() => setPendingRemoval('LEAVE')}
                >
                  {t('members.leave')}
                </ActionButton>
              </Stack>
            )}
          </Stack>
        )}
      </ContentDialog>
      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title={pendingRemoval === 'LEAVE' ? t('members.leaveTitle') : t('members.removeTitle')}
        description={
          pendingRemoval === 'LEAVE'
            ? t('members.leaveDescription')
            : t('members.removeDescription', {
                name: pendingRemoval?.displayName ?? '',
              })
        }
        cancelLabel={t('actions.cancel')}
        confirmLabel={pendingRemoval === 'LEAVE' ? t('members.leave') : t('members.remove')}
        confirmingLabel={t('members.updating')}
        intent="danger"
        busy={removeMutation.isPending || leaveMutation.isPending}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval === 'LEAVE') leaveMutation.mutate();
          else if (pendingRemoval) removeMutation.mutate(pendingRemoval);
        }}
      />
    </>
  );
}
