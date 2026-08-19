import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Search, UserPlus, UserRoundX, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ConfirmDialog,
  DatePickerField,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  decideSpaceAccessRequest,
  getSpaceMembers,
  getSpaceOwnerAccessRequests,
  listPeople,
  revokeSpaceMember,
  saveSpaceMember,
  updateSpaceMember,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { SpaceStatusChip } from './space-ui';

import type {
  PersonSummary,
  SpaceAccessRequest,
  SpaceMember,
  SpaceRole,
} from '@dwp-frontend/shared-utils';

const ROLES: SpaceRole[] = ['VIEWER', 'CONTRIBUTOR', 'EDITOR', 'MODERATOR', 'OWNER', 'GUEST'];

function AddMemberDialog({
  open,
  spaceKey,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  spaceKey: string;
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    principalType: 'USER' | 'GROUP';
    principalRef: string;
    memberRole: SpaceRole;
    validUntil?: string | null;
  }) => void;
}) {
  const { t } = useTranslation('spaces');
  const [type, setType] = useState<'USER' | 'GROUP'>('USER');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PersonSummary | null>(null);
  const [groupRef, setGroupRef] = useState('');
  const [role, setRole] = useState<SpaceRole>('VIEWER');
  const [validUntil, setValidUntil] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const people = useQuery({
    queryKey: ['spaces', 'people-search', deferredQuery],
    queryFn: () => listPeople({ query: deferredQuery, size: 8 }),
    enabled: open && type === 'USER' && deferredQuery.length >= 2,
  });
  useEffect(() => {
    if (!open) return;
    setType('USER');
    setQuery('');
    setSelected(null);
    setGroupRef('');
    setRole('VIEWER');
    setValidUntil('');
  }, [open, spaceKey]);
  const principalRef = type === 'USER' ? (selected?.personId ?? '') : groupRef.trim();
  return (
    <FormDialog
      open={open}
      title={t('members.addTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.addMember')}
      submittingLabel={t('actions.addMember')}
      busy={busy}
      submitDisabled={!principalRef}
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() =>
        onSave({
          principalType: type,
          principalRef,
          memberRole: role,
          validUntil: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null,
        })
      }
    >
      <Stack gap={2}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={type}
          onChange={(_, next) => {
            if (next) {
              setType(next);
              setSelected(null);
            }
          }}
          aria-label={t('members.principalType')}
        >
          <ToggleButton value="USER">{t('principal.USER')}</ToggleButton>
          <ToggleButton value="GROUP">{t('principal.GROUP')}</ToggleButton>
        </ToggleButtonGroup>
        {type === 'USER' ? (
          <>
            <FormField
              autoFocus
              label={t('members.searchPeople')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
            />
            {people.isFetching && <Skeleton variant="rounded" height={100} />}
            {people.data?.items.map((person) => (
              <ActionButton
                key={person.personId}
                intent={selected?.personId === person.personId ? 'primary' : 'secondary'}
                onClick={() => setSelected(person)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1 }}
                startIcon={
                  <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                    {person.displayName.slice(0, 1)}
                  </Avatar>
                }
                endIcon={selected?.personId === person.personId ? <Check size={16} /> : undefined}
              >
                <Box>
                  <Typography variant="body2" fontWeight={750}>
                    {person.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {person.workEmail ?? person.organizationName}
                  </Typography>
                </Box>
              </ActionButton>
            ))}
          </>
        ) : (
          <FormField
            autoFocus
            label={t('members.groupKey')}
            value={groupRef}
            onChange={(event) => setGroupRef(event.target.value.toUpperCase())}
            supportingText={t('members.groupKeyHelp')}
          />
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('members.role')}
            value={role}
            onChange={(event) => setRole(event.target.value as SpaceRole)}
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`role.${value}`)}
              </option>
            ))}
          </FormField>
          <DatePickerField
            label={t('members.validUntil')}
            value={validUntil || null}
            onValueChange={(value) => setValidUntil(value ?? '')}
          />
        </Box>
      </Stack>
    </FormDialog>
  );
}

function MemberRow({
  member,
  busy,
  onUpdate,
  onRevoke,
}: {
  member: SpaceMember;
  busy: boolean;
  onUpdate: (member: SpaceMember, role: SpaceRole) => void;
  onRevoke: (member: SpaceMember) => void;
}) {
  const { t } = useTranslation('spaces');
  const [role, setRole] = useState(member.memberRole);
  useEffect(() => setRole(member.memberRole), [member.memberRole]);
  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Stack direction="row" gap={1.25} alignItems="center">
          <Avatar sx={{ width: 34, height: 34, fontSize: 12 }}>
            {member.principalType === 'GROUP' ? 'G' : member.principalRef.slice(0, 1).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={750}>
              {member.principalRef}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(`principal.${member.principalType}`)} ·{' '}
              {t(`membershipSource.${member.membershipSource}`, {
                defaultValue: member.membershipSource,
              })}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <FormField
            select
            SelectProps={{ native: true }}
            size="small"
            value={role}
            onChange={(event) => setRole(event.target.value as SpaceRole)}
            aria-label={t('members.role')}
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`role.${value}`)}
              </option>
            ))}
          </FormField>
          <ActionButton
            intent="quiet"
            size="small"
            disabled={busy || role === member.memberRole}
            onClick={() => onUpdate(member, role)}
          >
            {t('actions.save')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<UserRoundX size={15} />}
            disabled={busy}
            onClick={() => onRevoke(member)}
          >
            {t('actions.revoke')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

function AccessRequestRow({
  item,
  busy,
  onDecision,
}: {
  item: SpaceAccessRequest;
  busy: boolean;
  onDecision: (item: SpaceAccessRequest, decision: 'APPROVE' | 'REJECT') => void;
}) {
  const { t } = useTranslation('spaces');
  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
        <Box>
          <Typography variant="body2" fontWeight={750}>
            {item.requesterName ?? item.requesterUserId}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {item.justification}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t(`role.${item.requestedRole}`)} ·{' '}
            {formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <SpaceStatusChip value={item.status} />
          {item.status === 'PENDING' && (
            <>
              <ActionButton
                intent="quiet"
                size="small"
                disabled={busy}
                onClick={() => onDecision(item, 'REJECT')}
              >
                {t('actions.reject')}
              </ActionButton>
              <ActionButton
                intent="primary"
                size="small"
                disabled={busy}
                onClick={() => onDecision(item, 'APPROVE')}
              >
                {t('actions.approve')}
              </ActionButton>
            </>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export function SpaceMemberManager({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation('spaces');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<SpaceMember | null>(null);
  const [decision, setDecision] = useState<{
    item: SpaceAccessRequest;
    decision: 'APPROVE' | 'REJECT';
  } | null>(null);
  const [note, setNote] = useState('');
  const members = useQuery({
    queryKey: ['spaces', 'members', spaceKey],
    queryFn: () => getSpaceMembers(spaceKey),
  });
  const requests = useQuery({
    queryKey: ['spaces', 'owner-access-requests', spaceKey],
    queryFn: () => getSpaceOwnerAccessRequests(spaceKey, 'ALL'),
  });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['spaces', 'members', spaceKey] }),
      queryClient.invalidateQueries({ queryKey: ['spaces', 'owner-access-requests', spaceKey] }),
      queryClient.invalidateQueries({ queryKey: ['spaces', 'detail', spaceKey] }),
    ]);
  };
  const addMutation = useMutation({
    mutationFn: (input: Parameters<typeof saveSpaceMember>[1]) => saveSpaceMember(spaceKey, input),
    onSuccess: async () => {
      await invalidate();
      setAddOpen(false);
      toast.success(t('members.saved'));
    },
    onError: () => toast.error(t('members.error')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ member, role }: { member: SpaceMember; role: SpaceRole }) =>
      updateSpaceMember(spaceKey, member.membershipId, {
        memberRole: role,
        validUntil: member.validUntil,
        expectedVersion: member.version,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(t('members.saved'));
    },
    onError: () => toast.error(t('members.error')),
  });
  const revokeMutation = useMutation({
    mutationFn: (member: SpaceMember) => revokeSpaceMember(spaceKey, member.membershipId),
    onSuccess: async () => {
      await invalidate();
      setRevokeTarget(null);
      toast.success(t('members.revoked'));
    },
    onError: () => toast.error(t('members.lastOwnerError')),
  });
  const decisionMutation = useMutation({
    mutationFn: () =>
      decideSpaceAccessRequest(spaceKey, decision!.item.accessRequestId, {
        decision: decision!.decision,
        note,
        expectedVersion: decision!.item.version,
      }),
    onSuccess: async () => {
      await invalidate();
      setDecision(null);
      toast.success(t('access.decided'));
    },
    onError: () => toast.error(t('access.error')),
  });
  const busy =
    addMutation.isPending ||
    updateMutation.isPending ||
    revokeMutation.isPending ||
    decisionMutation.isPending;
  if (members.isLoading || requests.isLoading) return <Skeleton variant="rounded" height={360} />;
  if (members.isError || requests.isError)
    return <Alert severity="error">{t('detail.membersLoadError')}</Alert>;
  return (
    <Stack gap={3}>
      <Paper component="section" variant="outlined" sx={{ borderRadius: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
          <Box>
            <Typography component="h2" variant="h6">
              {t('members.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('members.description')}
            </Typography>
          </Box>
          <ActionButton
            intent="primary"
            startIcon={<UserPlus size={16} />}
            onClick={() => setAddOpen(true)}
          >
            {t('actions.addMember')}
          </ActionButton>
        </Stack>
        <Divider />
        <Stack divider={<Divider flexItem />}>
          {members.data?.map((member) => (
            <MemberRow
              key={member.membershipId}
              member={member}
              busy={busy}
              onUpdate={(item, role) => updateMutation.mutate({ member: item, role })}
              onRevoke={setRevokeTarget}
            />
          ))}
        </Stack>
      </Paper>
      <Paper component="section" variant="outlined" sx={{ borderRadius: 1 }}>
        <Stack direction="row" gap={1} alignItems="center" sx={{ p: 2 }}>
          <UsersRound size={18} />
          <Box>
            <Typography component="h2" variant="h6">
              {t('members.requestsTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('members.requestsDescription')}
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <Stack divider={<Divider flexItem />}>
          {requests.data
            ?.filter((item) => item.status === 'PENDING')
            .map((item) => (
              <AccessRequestRow
                key={item.accessRequestId}
                item={item}
                busy={busy}
                onDecision={(request, next) => {
                  setDecision({ item: request, decision: next });
                  setNote('');
                }}
              />
            ))}
          {!requests.data?.some((item) => item.status === 'PENDING') && (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('members.noRequests')}
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>
      <AddMemberDialog
        open={addOpen}
        spaceKey={spaceKey}
        busy={busy}
        onClose={() => setAddOpen(false)}
        onSave={(input) => addMutation.mutate(input)}
      />
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t('members.revokeTitle')}
        description={t('members.revokeDescription', {
          principal: revokeTarget?.principalRef ?? '',
          role: revokeTarget ? t(`role.${revokeTarget.memberRole}`) : '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('members.revokeConfirm')}
        confirmingLabel={t('members.revoking')}
        intent="danger"
        busy={revokeMutation.isPending}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget);
        }}
      />
      <FormDialog
        open={Boolean(decision)}
        title={t(decision?.decision === 'APPROVE' ? 'access.approveTitle' : 'access.rejectTitle')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(decision?.decision === 'APPROVE' ? 'actions.approve' : 'actions.reject')}
        submittingLabel={t(decision?.decision === 'APPROVE' ? 'actions.approve' : 'actions.reject')}
        submitIntent={decision?.decision === 'REJECT' ? 'danger' : 'primary'}
        busy={busy}
        submitDisabled={note.trim().length < 5}
        maxWidth="sm"
        onClose={() => setDecision(null)}
        onSubmit={() => decisionMutation.mutate()}
      >
        <FormField
          autoFocus
          multiline
          minRows={4}
          label={t('access.decisionNote')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          supportingText={t('access.decisionNoteHelp')}
        />
      </FormDialog>
    </Stack>
  );
}
