// ----------------------------------------------------------------------

import type { SyntheticEvent } from 'react';
import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { Iconify } from '@dwp-frontend/design-system';
import { memo, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';

import { MENU_ICON_OPTIONS } from './menu-icon-options';
import { flattenMenuTree } from '../adapters/menu-adapter';

import type { MenuFormState } from '../types';

// ----------------------------------------------------------------------

type MenuCreateModalProps = {
  open: boolean;
  parentMenu: AdminMenuNode | null;
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
  parentMenu,
  menusTree,
  formData,
  validationErrors,
  isLoading,
  onClose,
  onFormChange,
  onSubmit,
}: MenuCreateModalProps) => {
  const [menuType, setMenuType] = useState<'route' | 'folder'>('route');
  const flatMenus = useMemo(() => flattenMenuTree(menusTree), [menusTree]);

  useEffect(() => {
    if (open) {
      setMenuType('route');
    }
  }, [open]);

  const handleTypeChange = (_: SyntheticEvent, value: 'route' | 'folder' | null) => {
    if (!value) return;
    setMenuType(value);
    if (value === 'folder') {
      onFormChange('path', '');
    }
  };

  const isValid = formData.menuKey.trim() && formData.menuName.trim() && (menuType === 'folder' || formData.path.trim());

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>새 메뉴 생성</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {parentMenu ? (
            <>
              <strong>{parentMenu.menuName}</strong> 하위에 새 메뉴를 생성합니다.
            </>
          ) : (
            '최상위 메뉴를 생성합니다.'
          )}
        </Typography>

        <Tabs value={menuType} onChange={handleTypeChange} variant="fullWidth">
          <Tab
            value="route"
            label="라우트 메뉴"
            icon={<Iconify icon="solar:document-text-bold" width={16} />}
            iconPosition="start"
          />
          <Tab
            value="folder"
            label="폴더/그룹"
            icon={<Iconify icon="solar:folder-bold" width={16} />}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ mt: 2, mb: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {menuType === 'route'
              ? '클릭 시 지정된 경로로 이동하는 메뉴입니다.'
              : '하위 메뉴를 그룹화하는 폴더입니다. 클릭 시 첫 번째 활성 하위 메뉴로 이동합니다.'}
          </Typography>
        </Box>

        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="메뉴 이름 *"
                fullWidth
                value={formData.menuName}
                onChange={(event) => onFormChange('menuName', event.target.value)}
                error={!!validationErrors.menuName}
                helperText={validationErrors.menuName}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="메뉴 키 *"
                fullWidth
                value={formData.menuKey}
                onChange={(event) => onFormChange('menuKey', event.target.value)}
                error={!!validationErrors.menuKey}
                helperText={validationErrors.menuKey || '예: menu.admin.example'}
              />
            </Grid>
          </Grid>

          {menuType === 'route' && (
            <TextField
              label="라우트 경로 *"
              fullWidth
              value={formData.path}
              onChange={(event) => onFormChange('path', event.target.value)}
              placeholder="/admin/example"
            />
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                freeSolo
                options={MENU_ICON_OPTIONS}
                value={formData.icon || ''}
                onChange={(_, value) => onFormChange('icon', value || '')}
                onInputChange={(_, value) => onFormChange('icon', value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="아이콘 (Iconify)"
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          {formData.icon ? (
                            <InputAdornment position="start">
                              <Iconify icon={formData.icon} width={18} />
                            </InputAdornment>
                          ) : null}
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="정렬 순서"
                type="number"
                fullWidth
                value={formData.sortOrder}
                onChange={(event) => onFormChange('sortOrder', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="부모 메뉴"
                fullWidth
                value={formData.parentId}
                onChange={(event) => onFormChange('parentId', event.target.value)}
              >
                <MenuItem value="">없음 (최상위)</MenuItem>
                {flatMenus.map((menu) => (
                  <MenuItem key={menu.id} value={menu.id}>
                    {menu.menuName} ({menu.menuKey})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="그룹"
                fullWidth
                value={formData.group}
                onChange={(event) => onFormChange('group', event.target.value)}
              />
            </Grid>
          </Grid>

          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              border: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="body2">활성화</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                생성 즉시 사이드바에 표시됩니다.
              </Typography>
            </Box>
            <Switch
              checked={formData.enabled}
              onChange={(event) => onFormChange('enabled', event.target.checked)}
            />
          </Box>

          <Alert severity="info">
            메뉴 생성 시 menuKey와 동일한 RBAC resourceKey가 자동으로 생성됩니다.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={onSubmit} disabled={!isValid || isLoading}>
          생성
        </Button>
      </DialogActions>
    </Dialog>
  );
});

MenuCreateModal.displayName = 'MenuCreateModal';
