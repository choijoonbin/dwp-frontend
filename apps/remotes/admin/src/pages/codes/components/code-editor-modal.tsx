// ----------------------------------------------------------------------

import type { Code } from '@dwp-frontend/shared-utils';

import { memo, useState, useEffect } from 'react';

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

type CodeEditorModalProps = {
  open: boolean;
  onClose: () => void;
  code: Code | null;
  groupKey: string;
  onSubmit: (formData: {
    codeKey: string;
    codeName: string;
    codeValue: string;
    description: string;
    sortOrder: string;
    tenantScope: 'COMMON' | 'TENANT';
    enabled: boolean;
  }) => void;
  isLoading: boolean;
};

export const CodeEditorModal = memo(({ open, onClose, code, groupKey, onSubmit, isLoading }: CodeEditorModalProps) => {
  const [formData, setFormData] = useState({
    codeKey: '',
    codeName: '',
    codeValue: '',
    description: '',
    sortOrder: '',
    tenantScope: 'COMMON' as 'COMMON' | 'TENANT',
    enabled: true,
  });

  useEffect(() => {
    if (code) {
      setFormData({
        codeKey: code.codeKey,
        codeName: code.codeName,
        codeValue: code.codeValue || '',
        description: code.description || '',
        sortOrder: code.sortOrder?.toString() || '',
        tenantScope: code.tenantScope || 'COMMON',
        enabled: code.enabled,
      });
    } else {
      setFormData({
        codeKey: '',
        codeName: '',
        codeValue: '',
        description: '',
        sortOrder: '',
        tenantScope: 'COMMON',
        enabled: true,
      });
    }
  }, [code]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{code ? '코드 편집' : '코드 추가'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="코드 키 *"
            fullWidth
            value={formData.codeKey}
            onChange={(e) => setFormData({ ...formData, codeKey: e.target.value })}
            required
            disabled={!!code}
          />
          <TextField
            label="코드명 *"
            fullWidth
            value={formData.codeName}
            onChange={(e) => setFormData({ ...formData, codeName: e.target.value })}
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
            label="코드 값"
            fullWidth
            value={formData.codeValue}
            onChange={(e) => setFormData({ ...formData, codeValue: e.target.value })}
          />
          <TextField
            label="설명"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            label="정렬 순서"
            type="number"
            fullWidth
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
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
          disabled={!formData.codeKey || !formData.codeName || isLoading}
        >
          {code ? '저장' : '생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

CodeEditorModal.displayName = 'CodeEditorModal';
