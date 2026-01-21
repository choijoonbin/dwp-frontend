// ----------------------------------------------------------------------

import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

// ----------------------------------------------------------------------

type RolesFilterBarProps = {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  onCreateClick: () => void;
};

export const RolesFilterBar = ({ keyword, onKeywordChange, onCreateClick }: RolesFilterBarProps) => (
    <Card sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="검색 (역할명/코드)"
          size="small"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          sx={{ flex: 1 }}
        />
        <PermissionGate resource="menu.admin.roles" permission="CREATE">
          <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onCreateClick}>
            역할 추가
          </Button>
        </PermissionGate>
      </Stack>
    </Card>
  );
