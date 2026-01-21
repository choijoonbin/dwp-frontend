// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { memo, useMemo } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import { flattenMenuTree } from '../adapters/menu-adapter';

import type { MenuFormState } from '../types';

// ----------------------------------------------------------------------

type MenuCreateModalProps = {
  open: boolean;
  menusTree: AdminMenuNode[];
  formData: MenuFormState;
  validationErrors: Record<string, string>;
  isLoading: boolean;
  onClose: () => void;
  onFormChange: <K extends keyof MenuFormState>(field: K, value: MenuFormState[K]) => void;
  onSubmit: () => void;
};

export const MenuCreateModal = memo(({
  open,
  menusTree,
  formData,
  validationErrors,
  isLoading,
  onClose,
  onFormChange,
  onSubmit,
}: MenuCreateModalProps) => {
  // Flatten tree for parent selection
  const flatMenus = useMemo(() => flattenMenuTree(menusTree), [menusTree]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>메뉴 추가</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="메뉴 키 *"
            fullWidth
            value={formData.menuKey}
            onChange={(e) => onFormChange('menuKey', e.target.value)}
            required
            error={!!validationErrors.menuKey}
            helperText={validationErrors.menuKey || '예: menu.admin.users'}
          />
          <TextField
            label="메뉴명 *"
            fullWidth
            value={formData.menuName}
            onChange={(e) => onFormChange('menuName', e.target.value)}
            required
            error={!!validationErrors.menuName}
            helperText={validationErrors.menuName}
          />
          <TextField
            label="Path"
            fullWidth
            value={formData.path}
            onChange={(e) => onFormChange('path', e.target.value)}
            placeholder="/admin/users"
          />
          <TextField
            label="아이콘"
            fullWidth
            value={formData.icon}
            onChange={(e) => onFormChange('icon', e.target.value)}
            placeholder="solar:user-bold"
            helperText="Iconify 아이콘 이름을 입력하세요"
          />
          <TextField
            label="그룹"
            fullWidth
            value={formData.group}
            onChange={(e) => onFormChange('group', e.target.value)}
            placeholder="MANAGEMENT"
          />
          <TextField
            select
            label="부모 메뉴"
            fullWidth
            value={formData.parentId}
            onChange={(e) => onFormChange('parentId', e.target.value)}
          >
            <MenuItem value="">없음 (최상위)</MenuItem>
            {flatMenus.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.menuName} ({m.menuKey})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="정렬 순서"
            type="number"
            fullWidth
            value={formData.sortOrder}
            onChange={(e) => onFormChange('sortOrder', e.target.value)}
            helperText="숫자가 작을수록 위에 표시됩니다"
          />
          <FormControlLabel
            control={
              <Switch checked={formData.enabled} onChange={(e) => onFormChange('enabled', e.target.checked)} />
            }
            label="활성화"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={!formData.menuKey || !formData.menuName || isLoading}
        >
          생성
        </Button>
      </DialogActions>
    </Dialog>
  );
});

MenuCreateModal.displayName = 'MenuCreateModal';
