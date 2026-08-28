import { formatDate } from '@dwp-frontend/shared-i18n';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

import type { TFunction } from 'i18next';
import type { GridColDef } from '@mui/x-data-grid';
import type { DisplayDomain } from '@dwp-frontend/shared-i18n';
import type { GroupRoleAssignment } from '@dwp-frontend/shared-utils';

import { resolveRoleAssignmentPresentationState } from './role-assignment-model';

type RoleAssignmentColumnOptions = {
  t: TFunction<'admin'>;
  display: (domain: DisplayDomain, code?: string | null) => string;
  roleNamesByCode: ReadonlyMap<string, string>;
  assignableRoleCodes: ReadonlySet<string>;
  busy: boolean;
  onRevoke: (assignment: GroupRoleAssignment) => void;
};

export type RoleAssignmentActionState =
  'REVOKE' | 'REVOKED' | 'EXPIRED' | 'MANAGED_ELSEWHERE' | 'NONE';

export function resolveRoleAssignmentActionState(
  assignment: GroupRoleAssignment,
  assignableRoleCodes: ReadonlySet<string>,
  now = Date.now()
): RoleAssignmentActionState {
  if (assignment.lifecycleState === 'REVOKED') return 'REVOKED';
  const presentationState = resolveRoleAssignmentPresentationState(assignment, now);
  if (presentationState === 'EXPIRED') return 'EXPIRED';
  if (presentationState !== 'ACTIVE' && presentationState !== 'SCHEDULED') return 'NONE';
  return assignableRoleCodes.has(assignment.roleCode) ? 'REVOKE' : 'MANAGED_ELSEWHERE';
}

export function createRoleAssignmentColumns({
  t,
  display,
  roleNamesByCode,
  assignableRoleCodes,
  busy,
  onRevoke,
}: RoleAssignmentColumnOptions): GridColDef<GroupRoleAssignment>[] {
  return [
    { field: 'groupName', headerName: t('roleGovernance.columns.group'), minWidth: 200, flex: 1 },
    {
      field: 'roleCode',
      headerName: t('roleGovernance.columns.role'),
      minWidth: 190,
      flex: 0.9,
      renderCell: ({ row }) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {roleNamesByCode.get(row.roleCode) ?? row.roleCode}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {row.roleCode}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'assignmentType',
      headerName: t('roleGovernance.columns.assignmentType'),
      width: 130,
      valueFormatter: (value) =>
        value === 'ACTIVE'
          ? t('roleGovernance.assignmentTypes.ACTIVE')
          : t('roleGovernance.assignmentTypes.ELIGIBLE'),
    },
    {
      field: 'scopeType',
      headerName: t('roleGovernance.columns.scope'),
      minWidth: 170,
      flex: 0.7,
      valueGetter: (_value, row) => {
        const scope = t(`roleGovernance.scopes.${row.scopeType}`);
        return row.scopeRef ? `${scope} / ${row.scopeRef}` : scope;
      },
    },
    {
      field: 'validTo',
      headerName: t('roleGovernance.columns.validTo'),
      width: 180,
      valueGetter: (_value, row) =>
        row.validTo
          ? formatDate(row.validTo, { dateStyle: 'medium', timeStyle: 'short' })
          : t('roleGovernance.noExpiry'),
    },
    {
      field: 'lifecycleState',
      headerName: t('roleGovernance.columns.status'),
      width: 120,
      renderCell: ({ row }) => {
        const state = resolveRoleAssignmentPresentationState(row);
        return (
          <Chip
            size="small"
            variant="outlined"
            color={state === 'ACTIVE' ? 'success' : state === 'SCHEDULED' ? 'info' : 'default'}
            label={display('states', state)}
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: t('roleGovernance.columns.actions'),
      headerAlign: 'center',
      align: 'center',
      width: 112,
      sortable: false,
      renderCell: ({ row }) => {
        const actionState = resolveRoleAssignmentActionState(row, assignableRoleCodes);
        if (actionState !== 'REVOKE') {
          return (
            <Typography variant="caption" color="text.secondary">
              {t(`roleGovernance.actions.assignmentStates.${actionState}`)}
            </Typography>
          );
        }
        const roleName = roleNamesByCode.get(row.roleCode) ?? row.roleCode;
        return (
          <ActionButton
            size="small"
            intent="quiet"
            disabled={busy}
            aria-label={t('roleGovernance.actions.revokeFor', {
              group: row.groupName,
              role: roleName,
            })}
            sx={{ color: 'error.main', fontWeight: 700 }}
            onClick={() => onRevoke(row)}
          >
            {t('roleGovernance.actions.revokeShort')}
          </ActionButton>
        );
      },
    },
  ];
}
