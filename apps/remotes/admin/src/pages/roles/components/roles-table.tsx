// ----------------------------------------------------------------------

import { memo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import type { RoleRowModel } from '../types';

// ----------------------------------------------------------------------

type RolesTableProps = {
  roles: RoleRowModel[];
  selectedRoleId: string | null;
  onRoleSelect: (roleId: string) => void;
  isLoading: boolean;
  error: Error | null;
};

export const RolesTable = memo(({ roles, selectedRoleId, onRoleSelect, isLoading, error }: RolesTableProps) => {
  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <Box sx={{ p: 2 }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
          ))}
        </Box>
      </Card>
    );
  }

  if (roles.length === 0) {
    return (
      <Card>
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            데이터가 없습니다.
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card>
      <List>
        {roles.map((role, idx) => (
          <RoleRow
            // Fallback key guards against missing/duplicate ids from API
            key={role.id || `${role.roleCode}-${idx}`}
            role={role}
            selected={selectedRoleId === role.id}
            onSelect={onRoleSelect}
          />
        ))}
      </List>
    </Card>
  );
});

RolesTable.displayName = 'RolesTable';

// Memoized row component for performance
const RoleRow = memo<{
  role: RoleRowModel;
  selected: boolean;
  onSelect: (roleId: string) => void;
}>(({ role, selected, onSelect }) => (
    <ListItem disablePadding>
      <ListItemButton
        selected={selected}
        onClick={() => onSelect(role.id)}
        sx={{
          borderLeft: selected ? 3 : 0,
          borderColor: 'primary.main',
        }}
      >
        <ListItemText
          primary={role.roleName}
          secondaryTypographyProps={{ component: 'div' }}
          secondary={
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {role.roleCode}
              </Typography>
              <Chip label={role.statusLabel} color={role.statusColor} size="small" sx={{ height: 18 }} />
            </Stack>
          }
        />
      </ListItemButton>
    </ListItem>
  ));

RoleRow.displayName = 'RoleRow';
