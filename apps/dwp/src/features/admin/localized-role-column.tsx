import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { GridColDef } from '@mui/x-data-grid';
import type { RoleDisplayCopy } from '@dwp-frontend/shared-i18n';

type RoleRow = {
  roleCode: string;
  roleName: string;
};

type RoleOptionRow = RoleRow & {
  roleId: number;
};

type RoleDisplayResolver = (
  code: string,
  name: string,
  description?: string | null
) => RoleDisplayCopy;

export function localizedRoleNameColumn<Row extends RoleRow>(
  headerName: string,
  displayRole: RoleDisplayResolver,
  minWidth: number
): GridColDef<Row> {
  return {
    field: 'roleName',
    headerName,
    minWidth,
    flex: 1,
    valueGetter: (_value, row) => displayRole(row.roleCode, row.roleName).name,
  };
}

export function localizedRoleIdentityColumn<Row extends RoleRow>(
  headerName: string,
  displayRole: RoleDisplayResolver,
  minWidth: number,
  flex = 1
): GridColDef<Row> {
  return {
    field: 'roleName',
    headerName,
    minWidth,
    flex,
    renderCell: ({ row }) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={650} noWrap>
          {displayRole(row.roleCode, row.roleName).name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {row.roleCode}
        </Typography>
      </Box>
    ),
  };
}

export function localizedRoleOptions<Row extends RoleOptionRow>(
  roles: readonly Row[],
  displayRole: RoleDisplayResolver
) {
  return roles.map((role) => ({
    value: String(role.roleId),
    label: displayRole(role.roleCode, role.roleName).name,
  }));
}
