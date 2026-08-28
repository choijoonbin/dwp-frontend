import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, FormDialog, SelectField } from '@dwp-frontend/design-system';
import { useRoleDisplay } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  localizedCodeLabel,
  permissionCodeLabel,
  permissionEffectLabel,
  resourceTypeLabel,
  rolePermissionCodes,
} from './role-governance-display';
import {
  calculateRolePermissionDiff,
  rolePermissionKey,
  rolePermissionSelectionMap,
  rolePermissionSelections,
  type RolePermissionChange,
} from './role-governance-permission-model';

import type {
  GovernanceResource,
  GovernanceRole,
  PermissionEffect,
  PermissionSelection,
} from '@dwp-frontend/shared-utils';

function PermissionChangeList({
  changes,
  resourcesById,
}: {
  changes: readonly RolePermissionChange[];
  resourcesById: ReadonlyMap<number, GovernanceResource>;
}) {
  const { t } = useTranslation('admin');
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {changes.map((change) => {
        const resource = resourcesById.get(change.resourceId);
        return (
          <Typography component="li" variant="body2" key={change.key}>
            {t('roleGovernance.permissionDialog.changeItem', {
              resource: resource?.name ?? String(change.resourceId),
              permission: localizedCodeLabel(
                permissionCodeLabel(change.permissionCode, t),
                change.permissionCode
              ),
              before: localizedCodeLabel(
                permissionEffectLabel(change.before ?? 'NONE', t),
                change.before ?? 'NONE'
              ),
              after: localizedCodeLabel(
                permissionEffectLabel(change.after ?? 'NONE', t),
                change.after ?? 'NONE'
              ),
            })}
          </Typography>
        );
      })}
    </Box>
  );
}

export function RoleGovernancePermissionDialog({
  role,
  resources,
  busy,
  onClose,
  onSave,
}: {
  role: GovernanceRole;
  resources: GovernanceResource[];
  busy: boolean;
  onClose: () => void;
  onSave: (permissions: PermissionSelection[]) => Promise<boolean>;
}) {
  const { t } = useTranslation('admin');
  const displayRole = useRoleDisplay();
  const roleDisplay = displayRole(role.code, role.name, role.description);
  const initial = useMemo(() => rolePermissionSelectionMap(role.permissions), [role.permissions]);
  const permissionCodes = useMemo(() => rolePermissionCodes(role.permissions), [role.permissions]);
  const [selection, setSelection] = useState<Map<string, PermissionEffect>>(() => new Map(initial));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selections = useMemo(() => rolePermissionSelections(selection), [selection]);
  const diff = useMemo(
    () => calculateRolePermissionDiff(role.permissions, selections, role.privileged),
    [role.permissions, role.privileged, selections]
  );
  const resourcesById = useMemo(
    () => new Map(resources.map((resource) => [resource.resourceId, resource])),
    [resources]
  );

  const setGrant = (resourceId: number, permissionCode: string, value: string) => {
    setSelection((current) => {
      const next = new Map(current);
      const key = rolePermissionKey(resourceId, permissionCode);
      if (!value) next.delete(key);
      else next.set(key, value as PermissionEffect);
      return next;
    });
  };
  const submit = async () => {
    const saved = await onSave(selections);
    if (saved) setConfirmOpen(false);
  };
  const handleSave = () => {
    if (!diff.hasChanges || busy) return;
    if (diff.requiresConfirmation) setConfirmOpen(true);
    else void submit();
  };

  return (
    <>
      <FormDialog
        open
        maxWidth="lg"
        mobileFullScreen
        title={t('roleGovernance.permissionDialog.title', { role: roleDisplay.name })}
        description={t('roleGovernance.permissionDialog.description')}
        cancelLabel={t('common.actions.cancel')}
        submitLabel={t('roleGovernance.actions.savePermissions')}
        busy={busy}
        submitDisabled={!diff.hasChanges}
        onClose={onClose}
        onSubmit={handleSave}
      >
        <Box sx={{ overflowX: 'auto', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Box
            component="table"
            sx={{
              width: 1,
              minWidth: 760,
              borderCollapse: 'collapse',
              '& th, & td': {
                px: 1.25,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
                textAlign: 'left',
              },
            }}
          >
            <Box component="thead">
              <Box component="tr">
                <Box component="th">
                  <Typography variant="caption">{t('roleGovernance.columns.resource')}</Typography>
                </Box>
                {permissionCodes.map((code) => (
                  <Box component="th" key={code}>
                    <Typography variant="caption" display="block">
                      {permissionCodeLabel(code, t)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {code}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {resources.map((resource) => (
                <Box component="tr" key={resource.resourceId}>
                  <Box component="td">
                    <Typography variant="body2" fontWeight={700}>
                      {resource.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {localizedCodeLabel(resourceTypeLabel(resource.type, t), resource.type)} ·{' '}
                      {resource.key}
                    </Typography>
                  </Box>
                  {permissionCodes.map((code) => (
                    <Box component="td" key={code}>
                      <SelectField
                        size="small"
                        value={selection.get(rolePermissionKey(resource.resourceId, code)) ?? ''}
                        options={[
                          { value: '', label: t('roleGovernance.effects.NONE') },
                          {
                            value: 'ALLOW',
                            label: localizedCodeLabel(permissionEffectLabel('ALLOW', t), 'ALLOW'),
                          },
                          {
                            value: 'DENY',
                            label: localizedCodeLabel(permissionEffectLabel('DENY', t), 'DENY'),
                          },
                        ]}
                        onValueChange={(value) => setGrant(resource.resourceId, code, value)}
                        inputProps={{
                          'aria-label': t('roleGovernance.permissionDialog.grantLabel', {
                            resource: resource.name,
                            permission: localizedCodeLabel(permissionCodeLabel(code, t), code),
                          }),
                        }}
                        sx={{ width: 104 }}
                      />
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
        {diff.hasChanges ? (
          <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }} role="status">
            <Chip
              size="small"
              label={t('roleGovernance.permissionDialog.summaryAdded', {
                count: diff.added.length,
              })}
            />
            <Chip
              size="small"
              label={t('roleGovernance.permissionDialog.summaryRemoved', {
                count: diff.removed.length,
              })}
            />
            <Chip
              size="small"
              label={t('roleGovernance.permissionDialog.summaryChanged', {
                count: diff.effectChanged.length,
              })}
            />
          </Stack>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={confirmOpen}
        title={t('roleGovernance.permissionDialog.confirmTitle', { role: roleDisplay.name })}
        description={t('roleGovernance.permissionDialog.confirmDescription')}
        cancelLabel={t('common.actions.cancel')}
        confirmLabel={t('roleGovernance.permissionDialog.confirm')}
        confirmingLabel={t('roleGovernance.permissionDialog.confirming')}
        busy={busy}
        intent="danger"
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        details={
          <Stack gap={1.25}>
            {role.privileged ? (
              <Alert severity="warning">
                {t('roleGovernance.permissionDialog.privilegedWarning')}
              </Alert>
            ) : null}
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={t('roleGovernance.permissionDialog.summaryAdded', {
                  count: diff.added.length,
                })}
              />
              <Chip
                size="small"
                color={diff.removed.length ? 'error' : 'default'}
                variant="outlined"
                label={t('roleGovernance.permissionDialog.summaryRemoved', {
                  count: diff.removed.length,
                })}
              />
              <Chip
                size="small"
                color={diff.denyChanges.length ? 'warning' : 'default'}
                variant="outlined"
                label={t('roleGovernance.permissionDialog.summaryChanged', {
                  count: diff.effectChanged.length,
                })}
              />
            </Stack>
            <PermissionChangeList changes={diff.changes} resourcesById={resourcesById} />
          </Stack>
        }
      />
    </>
  );
}
