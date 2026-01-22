// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { memo, useMemo } from 'react';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { MENU_ICON_OPTIONS } from './menu-icon-options';
import { flattenMenuTree } from '../adapters/menu-adapter';

import type { MenuFormState } from '../types';

// ----------------------------------------------------------------------

type MenuDetailFormProps = {
  menu: AdminMenuNode;
  menusTree: AdminMenuNode[];
  formData: MenuFormState;
  validationErrors: Record<string, string>;
  onFormChange: <K extends keyof MenuFormState>(field: K, value: MenuFormState[K]) => void;
  onCreateChild: (menu: AdminMenuNode) => void;
  onDelete: () => void;
};

export const MenuDetailForm = memo(({
  menu,
  menusTree,
  formData,
  validationErrors,
  onFormChange,
  onCreateChild,
  onDelete,
}: MenuDetailFormProps) => {
  const flatMenus = useMemo(() => flattenMenuTree(menusTree, menu.id), [menusTree, menu.id]);
  const hasChildren = !!menu.children?.length;

  return (
    <Stack spacing={4} sx={{ maxWidth: 720 }}>
      <Stack spacing={2}>
        <SectionHeader title="기본 정보" />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="메뉴 이름 *"
              fullWidth
              value={formData.menuName}
              onChange={(event) => onFormChange('menuName', event.target.value)}
              required
              error={!!validationErrors.menuName}
              helperText={validationErrors.menuName}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="메뉴 키"
              fullWidth
              value={formData.menuKey}
              disabled
              helperText="메뉴 키는 수정할 수 없습니다."
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              select
              label="상위 메뉴"
              fullWidth
              value={formData.parentId}
              onChange={(event) => onFormChange('parentId', event.target.value)}
            >
              <MenuItem value="">없음 (최상위)</MenuItem>
              {flatMenus.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.menuName} ({item.menuKey})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Stack>

      <Stack spacing={2}>
        <SectionHeader title="내비게이션" />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="라우트 경로"
              fullWidth
              value={formData.path}
              onChange={(event) => onFormChange('path', event.target.value)}
              placeholder="/admin/example"
              helperText="비워두면 폴더로 동작합니다."
            />
          </Grid>
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
                  helperText="Iconify 아이콘 이름을 입력하세요."
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
              label="그룹"
              fullWidth
              value={formData.group}
              onChange={(event) => onFormChange('group', event.target.value)}
              placeholder="MANAGEMENT"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="정렬 순서"
              type="number"
              fullWidth
              value={formData.sortOrder}
              onChange={(event) => onFormChange('sortOrder', event.target.value)}
              helperText="숫자가 작을수록 위에 표시됩니다."
            />
          </Grid>
        </Grid>
      </Stack>

      <Stack spacing={2}>
        <SectionHeader title="상태" />
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
            <Typography variant="body2">메뉴 활성화</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              비활성화하면 사이드바에서 숨겨집니다.
            </Typography>
          </Box>
          <Switch
            checked={formData.enabled}
            onChange={(event) => onFormChange('enabled', event.target.checked)}
          />
        </Box>
      </Stack>

      <Stack spacing={2}>
        <SectionHeader title="작업" />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <PermissionGate resource="menu.admin.menus" permission="CREATE">
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:add-circle-bold" width={16} />}
              onClick={() => onCreateChild(menu)}
            >
              하위 메뉴 추가
            </Button>
          </PermissionGate>
          <PermissionGate resource="menu.admin.menus" permission="DELETE">
            <Tooltip
              title={hasChildren ? '하위 메뉴가 있어 삭제할 수 없습니다.' : ''}
              disableHoverListener={!hasChildren}
            >
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Iconify icon="solar:trash-bin-trash-bold" width={16} />}
                  onClick={onDelete}
                  disabled={hasChildren}
                >
                  삭제
                </Button>
              </span>
            </Tooltip>
          </PermissionGate>
        </Stack>
        {hasChildren && (
          <Alert severity="warning" sx={{ maxWidth: 520 }}>
            하위 메뉴가 있는 경우 삭제할 수 없습니다. 먼저 하위 메뉴를 이동하거나 삭제해주세요.
          </Alert>
        )}
      </Stack>
    </Stack>
  );
});

MenuDetailForm.displayName = 'MenuDetailForm';

type SectionHeaderProps = {
  title: string;
};

const SectionHeader = ({ title }: SectionHeaderProps) => (
  <Stack direction="row" alignItems="center" spacing={2}>
    <Typography variant="subtitle2">{title}</Typography>
    <Divider sx={{ flex: 1 }} />
  </Stack>
);
