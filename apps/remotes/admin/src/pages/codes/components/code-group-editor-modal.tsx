// ----------------------------------------------------------------------

import type { CodeGroup } from '@dwp-frontend/shared-utils';

import { memo, useEffect, useState } from 'react';

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

// ----------------------------------------------------------------------

type CodeGroupEditorModalProps = {
  open: boolean;
  onClose: () => void;
  group: CodeGroup | null;
  onSubmit: (formData: {
    groupKey: string;
    groupName: string;
    description: string;
    tenantScope: 'COMMON' | 'TENANT';
    enabled: boolean;
  }) => void;
  isLoading: boolean;
};

export const CodeGroupEditorModal = memo(({ open, onClose, group, onSubmit, isLoading }: CodeGroupEditorModalProps) => {
  const [formData, setFormData] = useState({
    groupKey: '',
    groupName: '',
    description: '',
    tenantScope: 'COMMON' as 'COMMON' | 'TENANT',
    enabled: true,
  });

  useEffect(() => {
    if (group) {
      setFormData({
        groupKey: group.groupKey,
        groupName: group.groupName,
        description: group.description || '',
        tenantScope: group.tenantScope || 'COMMON',
        enabled: group.enabled,
      });
    } else {
      setFormData({
        groupKey: '',
        groupName: '',
        description: '',
        tenantScope: 'COMMON',
        enabled: true,
      });
    }
  }, [group]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{group ? '코드 그룹 편집' : '코드 그룹 추가'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="그룹 키 *"
            fullWidth
            value={formData.groupKey}
            onChange={(e) => setFormData({ ...formData, groupKey: e.target.value })}
            required
            disabled={!!group}
          />
          <TextField
            label="그룹명 *"
            fullWidth
            value={formData.groupName}
            onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
            required
          />
          <TextField
            select
            label="스코프 *"
            fullWidth
            value={formData.tenantScope}
            onChange={(e) => setFormData({ ...formData, tenantScope: e.target.value as 'COMMON' | 'TENANT' })}
            required
          >
            <MenuItem value="COMMON">공통</MenuItem>
            <MenuItem value="TENANT">테넌트</MenuItem>
          </TextField>
          <TextField
            label="설명"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <FormControlLabel
            control={
              <Switch checked={formData.enabled} onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })} />
            }
            label="활성화"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.groupKey || !formData.groupName || isLoading}
        >
          {group ? '저장' : '생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

CodeGroupEditorModal.displayName = 'CodeGroupEditorModal';
