// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { memo, useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { flattenMenuTree } from '../adapters/menu-adapter';

import type { MenuFormState } from '../types';

// ----------------------------------------------------------------------

type MenuDetailEditorProps = {
  menu: AdminMenuNode | null;
  menusTree: AdminMenuNode[];
  formData: MenuFormState;
  validationErrors: Record<string, string>;
  isLoading: boolean;
  onFormChange: <K extends keyof MenuFormState>(field: K, value: MenuFormState[K]) => void;
  onSave: () => void;
  onDelete: () => void;
};

export const MenuDetailEditor = memo(({
  menu,
  menusTree,
  formData,
  validationErrors,
  isLoading,
  onFormChange,
  onSave,
  onDelete,
}: MenuDetailEditorProps) => {
  // Flatten tree for parent selection (exclude current menu in edit mode)
  const flatMenus = useMemo(() => {
    if (menu) {
      return flattenMenuTree(menusTree, menu.id);
    }
    return flattenMenuTree(menusTree);
  }, [menusTree, menu]);

  if (!menu) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          좌측에서 메뉴를 선택하세요.
        </Typography>
      </Card>
    );
  }

  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h6">메뉴 편집</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            메뉴 정보를 수정할 수 있습니다.
          </Typography>
        </Stack>

        <Stack spacing={2}>
          <TextField
            label="메뉴 키"
            fullWidth
            value={formData.menuKey}
            disabled
            helperText="메뉴 키는 수정할 수 없습니다."
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

        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={onSave} disabled={isLoading} startIcon={<Iconify icon="solar:diskette-bold" />}>
            저장
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={onDelete}
            disabled={isLoading}
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          >
            삭제
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
});

MenuDetailEditor.displayName = 'MenuDetailEditor';
