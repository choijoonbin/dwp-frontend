import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, UserRoundPlus, UsersRound } from 'lucide-react';
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

function MemberEditor({
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
  const [userId, setUserId] = useState(member?.userId ? String(member.userId) : '');
  const [displayName, setDisplayName] = useState(member?.displayName ?? '');
  const [expiresAt, setExpiresAt] = useState(member?.expiresAt?.slice(0, 10) ?? '');
  const [permissions, setPermissions] = useState<MailSharedInboxPermissionSet>(
    member?.permissions ?? EMPTY_PERMISSIONS
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const input: MailSharedInboxMemberInput = {
    userId: Number(userId),
    displayName,
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
          <TextField
            label={t('admin.operationsWorkspace.a03.userId', { defaultValue: 'User ID' })}
            type="number"
            disabled={Boolean(member)}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          />
          <TextField
            label={t('admin.operationsWorkspace.a03.memberName', { defaultValue: 'Display name' })}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
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
  onRemove,
}: {
  overview: MailAdminOverview;
  access?: readonly MailSharedInboxAccess[];
  canManage: boolean;
  busyAction?: string | null;
  onOpenSettings?: () => void;
  onAdd?: MailAdminOperationsContentProps['onAddSharedMember'];
  onUpdate?: MailAdminOperationsContentProps['onUpdateSharedMember'];
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
                        onClick={() => setRevokeTarget({ access: inboxAccess, member })}
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
        <MemberEditor
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
        onClose={() => setRevokeTarget(null)}
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
          {revokeTarget?.access.impact ? (
            <Facts
              items={[
                {
                  label: 'Active assignments',
                  value: revokeTarget.access.impact.activeAssignments,
                },
                { label: 'Open drafts', value: revokeTarget.access.impact.openDrafts },
                { label: 'Pending commands', value: revokeTarget.access.impact.pendingCommands },
              ]}
            />
          ) : (
            <InlineFeedback severity="warning">
              {t('admin.operationsWorkspace.a03.impactUnavailable', {
                defaultValue:
                  'Detailed impact counts are unavailable. Provider revocation may complete separately.',
              })}
            </InlineFeedback>
          )}
        </DialogContent>
        <DialogActions>
          <ActionButton intent="quiet" onClick={() => setRevokeTarget(null)}>
            {t('actions.cancel')}
          </ActionButton>
          <ActionButton
            intent="danger"
            disabled={!revokeTarget || !onRemove}
            onClick={() => {
              if (!revokeTarget) return;
              onRemove?.(
                revokeTarget.access.sharedInboxId,
                revokeTarget.member,
                revokeTarget.member.version
              );
              setRevokeTarget(null);
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
