import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Search, ShieldAlert, UsersRound } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import type {
  DirectoryGroup,
  DirectoryMember,
  OrganizationUnit,
  CreateDirectoryGroupRequest,
  CreateOrganizationUnitRequest,
  UpdateDirectoryGroupRequest,
  UpdateOrganizationUnitRequest,
} from '@dwp-frontend/shared-utils';

function sortedIds(values: Iterable<number>): number[] {
  return [...values].sort((left, right) => left - right);
}

function equalIds(left: number[], right: number[]): boolean {
  const normalizedLeft = sortedIds(left);
  const normalizedRight = sortedIds(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function isDescendant(
  candidate: OrganizationUnit,
  targetId: number,
  organizations: OrganizationUnit[]
): boolean {
  const byId = new Map(organizations.map((organization) => [organization.orgUnitId, organization]));
  const visited = new Set<number>();
  let current: OrganizationUnit | undefined = candidate;
  while (current?.parentOrgUnitId) {
    if (current.parentOrgUnitId === targetId) return true;
    if (visited.has(current.parentOrgUnitId)) return false;
    visited.add(current.parentOrgUnitId);
    current = byId.get(current.parentOrgUnitId);
  }
  return false;
}

type OrganizationDialogProps = {
  open: boolean;
  value?: OrganizationUnit | null;
  organizations: OrganizationUnit[];
  parentLoading: boolean;
  busy: boolean;
  onParentSearch: (value: string) => void;
  onClose: () => void;
  onCreate: (request: CreateOrganizationUnitRequest) => Promise<void>;
  onUpdate: (request: UpdateOrganizationUnitRequest) => Promise<void>;
};

type ParentOrganizationOption = Pick<OrganizationUnit, 'orgUnitId' | 'orgKey' | 'name'>;

export function OrganizationDialog({
  open,
  value,
  organizations,
  parentLoading,
  busy,
  onParentSearch,
  onClose,
  onCreate,
  onUpdate,
}: OrganizationDialogProps) {
  const { t } = useTranslation('admin');
  const [orgKey, setOrgKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    if (!open) return;
    setOrgKey(value?.orgKey ?? '');
    setName(value?.name ?? '');
    setDescription(value?.description ?? '');
    setParentId(value?.parentOrgUnitId ? String(value.parentOrgUnitId) : '');
  }, [open, value]);

  const parentOptions = useMemo(
    () =>
      organizations
        .filter(
          (organization) =>
            organization.status === 'ACTIVE' &&
            organization.orgUnitId !== value?.orgUnitId &&
            (!value || !isDescendant(organization, value.orgUnitId, organizations))
        )
        .map<ParentOrganizationOption>(({ orgUnitId, orgKey, name: organizationName }) => ({
          orgUnitId,
          orgKey,
          name: organizationName,
        })),
    [organizations, value]
  );
  const selectedParent = useMemo(() => {
    if (!parentId) return null;
    const id = Number(parentId);
    return (
      parentOptions.find((organization) => organization.orgUnitId === id) ??
      (value?.parentOrgUnitId === id
        ? {
            orgUnitId: id,
            orgKey: '',
            name: value.parentName || t('directory.organizationFallback', { id }),
          }
        : null)
    );
  }, [parentId, parentOptions, t, value]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parentOrgUnitId = parentId ? Number(parentId) : undefined;
    if (value) {
      await onUpdate({
        name: name.trim(),
        description: description.trim(),
        parentOrgUnitId,
        version: value.version,
      });
      return;
    }
    await onCreate({
      orgKey: orgKey.trim(),
      name: name.trim(),
      description: description.trim(),
      parentOrgUnitId,
    });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={(event) => void submit(event)}>
        <DialogTitle>
          {value
            ? t('directory.dialogs.organization.editTitle')
            : t('directory.dialogs.organization.newTitle')}
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          <TextField
            autoFocus={!value}
            label={t('directory.fields.organizationKey')}
            value={orgKey}
            onChange={(event) => setOrgKey(event.target.value.toUpperCase())}
            disabled={Boolean(value)}
            required
            inputProps={{ pattern: '[A-Za-z][A-Za-z0-9_.-]{0,99}', maxLength: 100 }}
          />
          <TextField
            autoFocus={Boolean(value)}
            label={t('directory.fields.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            inputProps={{ maxLength: 200 }}
          />
          <Autocomplete
            options={parentOptions}
            value={selectedParent}
            loading={parentLoading}
            filterOptions={(options) => options}
            getOptionLabel={(organization) =>
              organization.orgKey
                ? `${organization.name} (${organization.orgKey})`
                : organization.name
            }
            isOptionEqualToValue={(option, selected) => option.orgUnitId === selected.orgUnitId}
            onInputChange={(_event, nextValue, reason) => {
              if (reason === 'input') onParentSearch(nextValue);
            }}
            onChange={(_event, organization) =>
              setParentId(organization ? String(organization.orgUnitId) : '')
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('directory.fields.parentOrganization')}
                placeholder={t('directory.noParent')}
              />
            )}
          />
          <TextField
            label={t('directory.fields.description')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={3}
            inputProps={{ maxLength: 2000 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !orgKey.trim() || !name.trim()}
          >
            {value ? t('directory.actions.saveChanges') : t('directory.actions.createOrganization')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

type GroupDialogProps = {
  open: boolean;
  value?: DirectoryGroup | null;
  busy: boolean;
  onClose: () => void;
  onCreate: (request: CreateDirectoryGroupRequest) => Promise<void>;
  onUpdate: (request: UpdateDirectoryGroupRequest) => Promise<void>;
};

export function GroupDialog({ open, value, busy, onClose, onCreate, onUpdate }: GroupDialogProps) {
  const { t } = useTranslation('admin');
  const [groupKey, setGroupKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setGroupKey(value?.groupKey ?? '');
    setDisplayName(value?.displayName ?? '');
    setDescription(value?.description ?? '');
  }, [open, value]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (value) {
      await onUpdate({
        displayName: displayName.trim(),
        description: description.trim(),
        version: value.version,
      });
      return;
    }
    await onCreate({
      groupKey: groupKey.trim(),
      displayName: displayName.trim(),
      description: description.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={(event) => void submit(event)}>
        <DialogTitle>
          {value ? t('directory.dialogs.group.editTitle') : t('directory.dialogs.group.newTitle')}
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          <TextField
            autoFocus={!value}
            label={t('directory.fields.groupKey')}
            value={groupKey}
            onChange={(event) => setGroupKey(event.target.value.toUpperCase())}
            disabled={Boolean(value)}
            required
            inputProps={{ pattern: '[A-Za-z][A-Za-z0-9_.-]{0,99}', maxLength: 100 }}
          />
          <TextField
            autoFocus={Boolean(value)}
            label={t('directory.fields.displayName')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            label={t('directory.fields.description')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={3}
            inputProps={{ maxLength: 2000 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !groupKey.trim() || !displayName.trim()}
          >
            {value ? t('directory.actions.saveChanges') : t('directory.actions.createGroup')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export type MemberDialogTarget =
  | { kind: 'organization'; value: OrganizationUnit }
  | { kind: 'group'; value: DirectoryGroup };

type MemberDialogProps = {
  target: MemberDialogTarget | null;
  members: DirectoryMember[];
  candidates: DirectoryMember[];
  loading: boolean;
  busy: boolean;
  search: string;
  onSearch: (value: string) => void;
  onClose: () => void;
  onSave: (userIds: number[]) => Promise<void>;
};

export function DirectoryMemberDialog({
  target,
  members,
  candidates,
  loading,
  busy,
  search,
  onSearch,
  onClose,
  onSave,
}: MemberDialogProps) {
  const { t } = useTranslation('admin');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelected(new Set(members.map((member) => member.userId)));
  }, [members, target]);

  const mergedCandidates = useMemo(() => {
    const byId = new Map<number, DirectoryMember>();
    [...members, ...candidates].forEach((member) => byId.set(member.userId, member));
    return [...byId.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
    );
  }, [candidates, members]);

  const currentIds = members.map((member) => member.userId);
  const targetName =
    target?.kind === 'organization' ? target.value.name : target?.value.displayName;
  const targetKey = target?.kind === 'organization' ? target.value.orgKey : target?.value.groupKey;

  const toggle = (userId: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <Dialog open={Boolean(target)} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('directory.dialogs.members.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important', px: { xs: 2, sm: 3 } }}>
        {target && (
          <>
            <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 2 }}>
              <Avatar
                variant="rounded"
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: 'text.primary',
                  color: 'background.paper',
                }}
              >
                {target.kind === 'organization' ? (
                  <Building2 size={20} strokeWidth={1.8} />
                ) : (
                  <UsersRound size={20} strokeWidth={1.8} />
                )}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {targetName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {targetKey} / {t('directory.selectedCount', { count: selected.size })}
                </Typography>
              </Box>
            </Stack>

            <TextField
              fullWidth
              size="small"
              label={t('directory.fields.findUsers')}
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} strokeWidth={1.8} />
                  </InputAdornment>
                ),
              }}
            />

            <Box
              aria-label={t('directory.directoryUsers')}
              sx={{
                mt: 1.5,
                maxHeight: 380,
                overflowY: 'auto',
                borderBlock: 1,
                borderColor: 'divider',
              }}
            >
              {loading ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 5, textAlign: 'center' }}
                >
                  {t('directory.loadingUsers')}
                </Typography>
              ) : mergedCandidates.length ? (
                mergedCandidates.map((member) => {
                  const assignedElsewhere =
                    target.kind === 'organization' &&
                    member.primaryOrgUnitId != null &&
                    member.primaryOrgUnitId !== target.value.orgUnitId;
                  return (
                    <FormControlLabel
                      key={member.userId}
                      control={
                        <Checkbox
                          checked={selected.has(member.userId)}
                          onChange={() => toggle(member.userId)}
                        />
                      }
                      label={
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          gap={1}
                          sx={{ width: 1, minWidth: 0 }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {member.displayName}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              display="block"
                            >
                              {member.email || t('access.userFallback', { id: member.userId })}
                            </Typography>
                          </Box>
                          {member.primaryOrgName && (
                            <Chip
                              label={
                                assignedElsewhere
                                  ? t('directory.moveFrom', { organization: member.primaryOrgName })
                                  : member.primaryOrgName
                              }
                              size="small"
                              color={assignedElsewhere ? 'warning' : 'default'}
                              variant="outlined"
                              sx={{ maxWidth: 180 }}
                            />
                          )}
                        </Stack>
                      }
                      sx={{
                        width: 1,
                        m: 0,
                        py: 0.75,
                        pr: 1,
                        borderTop: 1,
                        borderColor: 'divider',
                        '& .MuiFormControlLabel-label': { minWidth: 0, flex: 1 },
                      }}
                    />
                  );
                })
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 5, textAlign: 'center' }}
                >
                  {t('access.noUsers')}
                </Typography>
              )}
            </Box>

            <Stack
              direction="row"
              alignItems="flex-start"
              gap={1}
              sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
            >
              <ShieldAlert size={18} strokeWidth={1.8} aria-hidden="true" />
              <Typography variant="body2" color="text.secondary">
                {target.kind === 'organization'
                  ? t('directory.dialogs.members.organizationNotice')
                  : t('directory.dialogs.members.groupNotice')}
              </Typography>
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || loading || equalIds(currentIds, [...selected])}
          onClick={() => void onSave(sortedIds(selected))}
        >
          {t('directory.actions.saveMembers')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
