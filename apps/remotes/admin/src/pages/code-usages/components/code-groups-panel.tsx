// ----------------------------------------------------------------------

import type { CodeUsageSummary } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

type CodeGroupsPanelProps = {
  resourceKey: string;
  groups: CodeUsageSummary[];
  isLoading: boolean;
  error: Error | null;
  anchorEl: HTMLElement | null;
  selectedUsage: CodeUsageSummary | null;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, usage: CodeUsageSummary) => void;
  onMenuClose: () => void;
  onAddGroup: () => void;
  onEdit: (usage: CodeUsageSummary) => void;
  onDelete: (usage: CodeUsageSummary) => void;
  onToggleEnabled: (usage: CodeUsageSummary) => void;
};

export const CodeGroupsPanel = memo(({
  resourceKey,
  groups,
  isLoading,
  error,
  anchorEl,
  selectedUsage,
  onMenuOpen,
  onMenuClose,
  onAddGroup,
  onEdit,
  onDelete,
  onToggleEnabled,
}: CodeGroupsPanelProps) => {
  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack spacing={0.5}>
              <Typography variant="h6">{resourceKey || '메뉴를 선택하세요'}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {resourceKey
                  ? '이 메뉴에서 사용할 코드 그룹을 관리합니다. 각 그룹의 코드는 드롭다운에서 사용할 수 있습니다.'
                  : '좌측에서 메뉴를 선택하면 해당 메뉴의 코드 그룹 목록이 표시됩니다.'}
              </Typography>
            </Stack>
            {resourceKey && (
              <PermissionGate resource="menu.admin.code-usages" permission="CREATE">
                <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onAddGroup}>
                  그룹 추가
                </Button>
              </PermissionGate>
            )}
          </Stack>
        </Box>

        {isLoading ? (
          <Box sx={{ p: 2 }}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : !resourceKey ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              좌측에서 메뉴를 선택하세요.
            </Typography>
          </Box>
        ) : groups.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              등록된 코드 그룹이 없습니다. &quot;그룹 추가&quot; 버튼을 클릭하여 추가하세요.
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>코드 그룹 키</TableCell>
                <TableCell>상태</TableCell>
                <TableCell align="right">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((usage) => (
                <TableRow key={usage.id}>
                  <TableCell>{usage.codeGroupKey}</TableCell>
                  <TableCell>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={usage.enabled}
                          onChange={() => onToggleEnabled(usage)}
                          size="small"
                        />
                      }
                      label={<Chip label={usage.enabled ? '활성' : '비활성'} size="small" color={usage.enabled ? 'success' : 'default'} />}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={(e) => onMenuOpen(e, usage)}>
                      <Iconify icon="solar:menu-dots-bold" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl) && Boolean(selectedUsage)} onClose={onMenuClose}>
        <PermissionGate resource="menu.admin.code-usages" permission="UPDATE">
          <MenuItem onClick={() => selectedUsage && onEdit(selectedUsage)}>
            <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
            편집
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.code-usages" permission="DELETE">
          <MenuItem onClick={() => selectedUsage && onDelete(selectedUsage)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>
    </>
  );
});

CodeGroupsPanel.displayName = 'CodeGroupsPanel';
