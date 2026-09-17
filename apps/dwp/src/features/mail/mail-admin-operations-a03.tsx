import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Trash2, UserRoundPlus, UsersRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMailSharedInboxMemberCandidates } from '@dwp-frontend/shared-utils';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  enabledSharedInboxPermissions,
  sharedInboxPermissionInputIsValid,
} from './mail-admin-operations-model';
import { Facts, Section, StateChip } from './mail-admin-operations-ui-shared';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type {
  MailSharedInboxAccess,
  MailSharedInboxMember,
  MailSharedInboxMemberInput,
  MailSharedInboxMemberRevokePreview,
  MailSharedInboxPermissionSet,
} from './mail-admin-operations-model';
import type { MailAdminOperationsContentProps } from './mail-admin-operations-ui-shared';

const EMPTY_PERMISSIONS: MailSharedInboxPermissionSet = {
  read: true,
  sendAs: false,
  sendOnBehalf: false,
  assign: false,
  manage: false,
};

export function MailSharedInboxMemberEditor({
  open,
  access,
  member,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  access: MailSharedInboxAccess | null;
  member: MailSharedInboxMember | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: MailSharedInboxMemberInput) => void;
}) {
  const { t } = useTranslation('mail');
  const [peopleQuery, setPeopleQuery] = useState('');
  const deferredPeopleQuery = useDeferredValue(peopleQuery.trim());
  const [selectedCandidate, setSelectedCandidate] = useState<
    Awaited<ReturnType<typeof getMailSharedInboxMemberCandidates>>[number] | null
  >(null);
  const [expiresAt, setExpiresAt] = useState(member?.expiresAt?.slice(0, 10) ?? '');
  const [permissions, setPermissions] = useState<MailSharedInboxPermissionSet>(
    member?.permissions ?? EMPTY_PERMISSIONS
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const candidates = useQuery({
    queryKey: ['mail', 'admin', 'shared-inbox-member-candidates', deferredPeopleQuery],
    queryFn: ({ signal }) => getMailSharedInboxMemberCandidates(deferredPeopleQuery, 20, signal),
    enabled: open && !member && deferredPeopleQuery.length >= 2,
    staleTime: 15_000,
    retry: false,
  });
  const selectedUser = member ?? selectedCandidate;
  const input: MailSharedInboxMemberInput = {
    userId: selectedUser?.userId ?? Number.NaN,
    displayName: selectedUser?.displayName ?? '',
    permissions,
    expiresAt: expiresAt ? `${expiresAt}T23:59:59.999Z` : null,
    impactAcknowledged: acknowledged,
    version: member?.version ?? access?.version ?? 0,
  };
  const toggle = (permission: keyof MailSharedInboxPermissionSet) =>
    setPermissions((current) => ({ ...current, [permission]: !current[permission] }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {member
          ? t('admin.operationsWorkspace.a03.editMember', { defaultValue: 'Edit member access' })
          : t('admin.operationsWorkspace.a03.addMember', { defaultValue: 'Add member' })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {member ? (
            <Box sx={{ p: 1.5, border: 1, borderColor: 'divider' }}>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {member.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('admin.operationsWorkspace.a03.memberIdentity', {
                  defaultValue: '{{department}} · User {{userId}}',
                  department:
                    member.department ??
                    t('admin.operationsWorkspace.a03.noDepartment', {
                      defaultValue: 'Department unavailable',
                    }),
                  userId: member.userId,
                })}
              </Typography>
            </Box>
          ) : (
            <>
              <TextField
                autoFocus
                label={t('admin.operationsWorkspace.a03.searchPeople', {
                  defaultValue: 'Search people in this tenant',
                })}
                value={peopleQuery}
                helperText={t('admin.operationsWorkspace.a03.searchPeopleHelp', {
                  defaultValue: 'Enter at least two characters, then select one verified person.',
                })}
                onChange={(event) => {
                  setPeopleQuery(event.target.value);
                  setSelectedCandidate(null);
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={17} aria-hidden />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {candidates.isFetching ? (
                <InlineFeedback severity="info">
                  {t('admin.operationsWorkspace.a03.searchingPeople', {
                    defaultValue: 'Searching the tenant directory…',
                  })}
                </InlineFeedback>
              ) : candidates.isError ? (
                <InlineFeedback severity="warning">
                  {t('admin.operationsWorkspace.a03.peopleUnavailable', {
                    defaultValue:
                      'Verified people could not be loaded. Member changes remain blocked.',
                  })}
                </InlineFeedback>
              ) : deferredPeopleQuery.length >= 2 && !candidates.data?.length ? (
                <InlineFeedback severity="info">
                  {t('admin.operationsWorkspace.a03.noPeople', {
                    defaultValue: 'No active people matched in this tenant.',
                  })}
                </InlineFeedback>
              ) : null}
              {candidates.data?.length ? (
                <Stack
                  role="listbox"
                  aria-label={t('admin.operationsWorkspace.a03.peopleResults', {
                    defaultValue: 'Verified people',
                  })}
                  spacing={0.5}
                >
                  {candidates.data.map((candidate) => {
                    const duplicate = access?.members.some(
                      (existing) =>
                        existing.userId === candidate.userId && existing.state !== 'REVOKED'
                    );
                    const selected = selectedCandidate?.userId === candidate.userId;
                    return (
                      <Box
                        component="button"
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={duplicate}
                        key={candidate.userId}
                        onClick={() => setSelectedCandidate(candidate)}
                        sx={{
                          p: 1.25,
                          border: 1,
                          borderColor: selected ? 'primary.main' : 'divider',
                          bgcolor: selected ? 'action.selected' : 'background.paper',
                          color: 'text.primary',
                          textAlign: 'left',
                          cursor: duplicate ? 'not-allowed' : 'pointer',
                          opacity: duplicate ? 0.6 : 1,
                        }}
                      >
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          {candidate.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[candidate.department, candidate.email].filter(Boolean).join(' · ') ||
                            `User ${candidate.userId}`}
                          {duplicate
                            ? ` · ${t('admin.operationsWorkspace.a03.alreadyMember', {
                                defaultValue: 'Already a member',
                              })}`
                            : ''}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              ) : null}
            </>
          )}
          <TextField
            label={t('admin.operationsWorkspace.a03.expiresAt', { defaultValue: 'Access expiry' })}
            type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
          <Box>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {t('admin.operationsWorkspace.a03.permissions', { defaultValue: 'Permissions' })}
            </Typography>
            {(Object.keys(permissions) as Array<keyof MailSharedInboxPermissionSet>).map(
              (permission) => (
                <FormControlLabel
                  key={permission}
                  control={
                    <Checkbox
                      checked={permissions[permission]}
                      onChange={() => toggle(permission)}
                    />
                  }
                  label={permission}
                />
              )
            )}
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={(_event, checked) => setAcknowledged(checked)}
              />
            }
            label={t('admin.operationsWorkspace.a03.impactAcknowledgement', {
              defaultValue:
                'I reviewed assignment, draft, pending command, and provider revocation impact.',
            })}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <ActionButton intent="quiet" onClick={onClose}>
          {t('actions.cancel')}
        </ActionButton>
        <ActionButton
          intent="primary"
          loading={busy}
          disabled={!sharedInboxPermissionInputIsValid(input)}
          onClick={() => onSave(input)}
        >
          {t('actions.save')}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}

export function SharedAccessSurface({
  overview,
  access,
  canManage,
  busyAction,
  onOpenSettings,
  onAdd,
  onUpdate,
  onPreviewRevoke,
  onRemove,
}: {
  overview: MailAdminOverview;
  access?: readonly MailSharedInboxAccess[];
  canManage: boolean;
  busyAction?: string | null;
  onOpenSettings?: () => void;
  onAdd?: MailAdminOperationsContentProps['onAddSharedMember'];
  onUpdate?: MailAdminOperationsContentProps['onUpdateSharedMember'];
  onPreviewRevoke?: MailAdminOperationsContentProps['onPreviewSharedMemberRevoke'];
  onRemove?: MailAdminOperationsContentProps['onRemoveSharedMember'];
}) {
  const { t } = useTranslation('mail');
  const [editor, setEditor] = useState<{
    access: MailSharedInboxAccess;
    member: MailSharedInboxMember | null;
  } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{
    access: MailSharedInboxAccess;
    member: MailSharedInboxMember;
  } | null>(null);
  const [revokeAcknowledged, setRevokeAcknowledged] = useState(false);
  const [revokePreview, setRevokePreview] = useState<MailSharedInboxMemberRevokePreview | null>(
    null
  );
  const [revokePreviewLoading, setRevokePreviewLoading] = useState(false);
  const [revokePreviewError, setRevokePreviewError] = useState(false);
  const [revokePreviewAttempt, setRevokePreviewAttempt] = useState(0);
  useEffect(() => {
    if (!revokeTarget || !onPreviewRevoke) {
      setRevokePreview(null);
      setRevokePreviewLoading(false);
      setRevokePreviewError(Boolean(revokeTarget));
      return;
    }
    let cancelled = false;
    setRevokePreview(null);
    setRevokePreviewError(false);
    setRevokePreviewLoading(true);
    void onPreviewRevoke(revokeTarget.access.sharedInboxId, revokeTarget.member)
      .then((preview) => {
        if (!cancelled) setRevokePreview(preview);
      })
      .catch(() => {
        if (!cancelled) setRevokePreviewError(true);
      })
      .finally(() => {
        if (!cancelled) setRevokePreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onPreviewRevoke, revokePreviewAttempt, revokeTarget]);
  useEffect(() => {
    if (!revokeTarget || !access) return;
    const latestAccess = access.find(
      (item) => item.sharedInboxId === revokeTarget.access.sharedInboxId
    );
    const latestMember = latestAccess?.members.find(
      (item) => item.memberId === revokeTarget.member.memberId
    );
    if (!latestAccess || !latestMember || latestMember.state === 'REVOKED') {
      setRevokeTarget(null);
      setRevokeAcknowledged(false);
      return;
    }
    if (latestMember.version !== revokeTarget.member.version) {
      setRevokeTarget({ access: latestAccess, member: latestMember });
      setRevokeAcknowledged(false);
    }
  }, [access, revokeTarget]);
  const revokeHasImpact = Boolean(
    revokePreview &&
    (revokePreview.activeAssignments > 0 ||
      revokePreview.openDrafts > 0 ||
      revokePreview.pendingCommands > 0 ||
      revokePreview.providerRevocationRequired)
  );
  return (
    <Stack spacing={2.5}>
      {!access ? (
        <InlineFeedback severity="warning">
          {t('admin.operationsWorkspace.a03.evidenceMissing', {
            defaultValue:
              'Member and provider-delegation evidence could not be loaded. Access changes remain blocked.',
          })}
        </InlineFeedback>
      ) : null}
      {overview.sharedInboxes.map((inbox) => {
        const inboxAccess = access?.find((item) => item.sharedInboxId === inbox.sharedInboxId);
        return (
          <Section
            key={inbox.sharedInboxId}
            title={inbox.displayName}
            description={`${inbox.address} · ${inbox.lifecycleState}`}
            action={
              <Stack direction="row" spacing={1}>
                {onOpenSettings ? (
                  <ActionButton
                    intent="quiet"
                    size="small"
                    disabled={!canManage}
                    onClick={onOpenSettings}
                  >
                    {t('admin.shared.configure')}
                  </ActionButton>
                ) : null}
                <ActionButton
                  intent="primary"
                  size="small"
                  disabled={!canManage || !inboxAccess || !onAdd}
                  startIcon={<UserRoundPlus size={15} />}
                  onClick={() => inboxAccess && setEditor({ access: inboxAccess, member: null })}
                >
                  {t('admin.operationsWorkspace.a03.addMember', { defaultValue: 'Add member' })}
                </ActionButton>
              </Stack>
            }
          >
            {inboxAccess ? (
              <>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
                  <UsersRound size={18} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {t('admin.operationsWorkspace.a03.memberCount', {
                      defaultValue: '{{count}} members',
                      count: inboxAccess.members.length,
                    })}
                  </Typography>
                  <StateChip label={inboxAccess.providerState} />
                </Stack>
                {inboxAccess.members.map((member) => (
                  <Box key={member.memberId}>
                    <Divider />
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.25}
                      alignItems={{ xs: 'stretch', md: 'center' }}
                      sx={{ p: 2 }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          {member.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {member.department ?? `User ${member.userId}`} ·{' '}
                          {enabledSharedInboxPermissions(member.permissions).join(', ')}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 0.75 }}
                        >
                          {(
                            Object.keys(member.permissions) as Array<
                              keyof MailSharedInboxPermissionSet
                            >
                          ).map((permission) => (
                            <Chip
                              key={permission}
                              size="small"
                              variant="outlined"
                              color={member.permissions[permission] ? 'success' : 'default'}
                              label={`${permission}: ${member.permissions[permission] ? 'Allowed' : 'Denied'}`}
                            />
                          ))}
                        </Stack>
                        {member.expiresAt ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            {t('admin.operationsWorkspace.a03.expires', {
                              defaultValue: 'Expires {{time}}',
                              time: member.expiresAt,
                            })}
                          </Typography>
                        ) : null}
                      </Box>
                      <StateChip label={member.state} />
                      <StateChip label={member.providerState} />
                      <ActionButton
                        size="small"
                        intent="secondary"
                        disabled={!canManage || !onUpdate}
                        onClick={() => setEditor({ access: inboxAccess, member })}
                      >
                        {t('actions.edit', { defaultValue: 'Edit' })}
                      </ActionButton>
                      <ActionButton
                        size="small"
                        intent="danger"
                        loading={busyAction === `remove-member:${member.memberId}`}
                        disabled={!canManage || member.state === 'REVOKED' || !onRemove}
                        startIcon={<Trash2 size={15} />}
                        onClick={() => {
                          setRevokeAcknowledged(false);
                          setRevokeTarget({ access: inboxAccess, member });
                        }}
                      >
                        {t('admin.operationsWorkspace.a03.revoke', { defaultValue: 'Revoke' })}
                      </ActionButton>
                    </Stack>
                  </Box>
                ))}
              </>
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="warning.main">
                  {t('admin.operationsWorkspace.a03.accessUnavailable', {
                    defaultValue: 'Access details are unavailable for this inbox.',
                  })}
                </Typography>
              </Box>
            )}
          </Section>
        );
      })}
      {!overview.sharedInboxes.length ? (
        <InlineFeedback severity="info">{t('admin.shared.emptyTitle')}</InlineFeedback>
      ) : null}
      {editor ? (
        <MailSharedInboxMemberEditor
          key={`${editor.access.sharedInboxId}:${editor.member?.memberId ?? 'new'}`}
          open
          access={editor.access}
          member={editor.member}
          busy={busyAction === 'save-member'}
          onClose={() => setEditor(null)}
          onSave={(input) => {
            if (editor.member)
              onUpdate?.(editor.access.sharedInboxId, editor.member.memberId, input);
            else onAdd?.(editor.access.sharedInboxId, input);
          }}
        />
      ) : null}
      <Dialog
        open={Boolean(revokeTarget)}
        onClose={() => {
          setRevokeTarget(null);
          setRevokeAcknowledged(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('admin.operationsWorkspace.a03.revoke', { defaultValue: 'Revoke access' })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {t('admin.operationsWorkspace.a03.revokeImpact', {
              defaultValue:
                'Review active assignments, open drafts, pending commands, and provider revocation before removing access.',
            })}
          </Typography>
          {revokePreviewLoading ? (
            <InlineFeedback severity="info">
              {t('admin.operationsWorkspace.a03.loadingRevokePreview', {
                defaultValue: 'Loading the current member-specific impact…',
              })}
            </InlineFeedback>
          ) : revokePreviewError || !revokePreview ? (
            <InlineFeedback severity="warning">
              {t('admin.operationsWorkspace.a03.impactUnavailable', {
                defaultValue:
                  'Current member-specific impact could not be verified. Revocation remains blocked.',
              })}
            </InlineFeedback>
          ) : (
            <Stack spacing={1.25}>
              <Facts
                items={[
                  {
                    label: 'Active assignments',
                    value: revokePreview.activeAssignments,
                  },
                  { label: 'Open drafts', value: revokePreview.openDrafts },
                  { label: 'Pending commands', value: revokePreview.pendingCommands },
                  {
                    label: 'Provider revocation',
                    value: revokePreview.providerRevocationRequired ? 'Required' : 'Not required',
                  },
                ]}
              />
              <Typography variant="caption" color="text.secondary">
                {t('admin.operationsWorkspace.a03.previewExpiry', {
                  defaultValue: 'This impact preview expires at {{time}}.',
                  time: revokePreview.expiresAt,
                })}
              </Typography>
              {revokeHasImpact ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={revokeAcknowledged}
                      onChange={(event) => setRevokeAcknowledged(event.target.checked)}
                    />
                  }
                  label={t('admin.operationsWorkspace.a03.acknowledgeRevokeImpact', {
                    defaultValue: 'I reviewed this member-specific impact.',
                  })}
                />
              ) : null}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <ActionButton
            intent="quiet"
            onClick={() => {
              setRevokeTarget(null);
              setRevokeAcknowledged(false);
            }}
          >
            {t('actions.cancel')}
          </ActionButton>
          <ActionButton
            intent="danger"
            loading={Boolean(
              revokeTarget && busyAction === `remove-member:${revokeTarget.member.memberId}`
            )}
            disabled={
              !revokeTarget ||
              !onRemove ||
              !revokePreview ||
              revokePreviewLoading ||
              (revokeHasImpact && !revokeAcknowledged)
            }
            onClick={async () => {
              if (!revokeTarget || !revokePreview || !onRemove) return;
              const completed = await onRemove(
                revokeTarget.access.sharedInboxId,
                revokeTarget.member,
                revokePreview,
                revokeAcknowledged
              );
              if (completed === false) {
                setRevokePreviewAttempt((attempt) => attempt + 1);
                return;
              }
              setRevokeTarget(null);
              setRevokeAcknowledged(false);
            }}
          >
            {t('admin.operationsWorkspace.a03.confirmRevoke', {
              defaultValue: 'Confirm revocation',
            })}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
