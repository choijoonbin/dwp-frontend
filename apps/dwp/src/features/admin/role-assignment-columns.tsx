import { Ban } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

import type { TFunction } from 'i18next';
import type { GridColDef } from '@mui/x-data-grid';
import type { DisplayDomain } from '@dwp-frontend/shared-i18n';
import type { GroupRoleAssignment } from '@dwp-frontend/shared-utils';

type RoleAssignmentColumnOptions = {
  t: TFunction<'admin'>;
  display: (domain: DisplayDomain, code?: string | null) => string;
  roleNamesByCode: ReadonlyMap<string, string>;
  assignableRoleCodes: ReadonlySet<string>;
  busy: boolean;
  onRevoke: (assignment: GroupRoleAssignment) => void;
};

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
      valueFormatter: (value) => display('assignmentTypes', String(value)),
    },
    {
      field: 'scopeType',
      headerName: t('roleGovernance.columns.scope'),
      minWidth: 170,
      flex: 0.7,
      valueGetter: (_value, row) => {
        const scope = display('scopeTypes', row.scopeType);
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
      renderCell: ({ row }) => (
        <Chip
          size="small"
          variant="outlined"
          color={row.lifecycleState === 'ACTIVE' ? 'success' : 'default'}
          label={display('states', row.lifecycleState)}
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 64,
      sortable: false,
      renderCell: ({ row }) => (
        <ActionIconButton
          size="small"
          intent="danger"
          label={t('roleGovernance.actions.revoke')}
          disabled={
            busy || row.lifecycleState !== 'ACTIVE' || !assignableRoleCodes.has(row.roleCode)
          }
          onClick={() => onRevoke(row)}
        >
          <Ban size={16} />
        </ActionIconButton>
      ),
    },
  ];
}
