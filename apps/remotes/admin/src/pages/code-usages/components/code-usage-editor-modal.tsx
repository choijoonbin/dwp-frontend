// ----------------------------------------------------------------------

import type { CodeUsageSummary } from '@dwp-frontend/shared-utils';

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

type CodeUsageEditorModalProps = {
  open: boolean;
  onClose: () => void;
  usage: CodeUsageSummary | null;
  resourceKey: string;
  resourceKeyOptions: string[];
  codeGroupKeyOptions: string[];
  onSubmit: (formData: { resourceKey: string; codeGroupKey: string; enabled: boolean }) => void;
  isLoading: boolean;
};

export const CodeUsageEditorModal = memo(({
  open,
  onClose,
  usage,
  resourceKey,
  resourceKeyOptions,
  codeGroupKeyOptions,
  onSubmit,
  isLoading,
}: CodeUsageEditorModalProps) => {
  const [formData, setFormData] = useState({
    resourceKey: '',
    codeGroupKey: '',
    enabled: true,
  });

  useEffect(() => {
    if (usage) {
      setFormData({
        resourceKey: usage.resourceKey,
        codeGroupKey: usage.codeGroupKey,
        enabled: usage.enabled,
      });
    } else {
      setFormData({
        resourceKey: resourceKey || '',
        codeGroupKey: '',
        enabled: true,
      });
    }
  }, [usage, resourceKey]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{usage ? '코드 그룹 편집' : '코드 그룹 추가'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="Resource Key *"
            fullWidth
            value={formData.resourceKey}
            onChange={(e) => setFormData({ ...formData, resourceKey: e.target.value })}
            required
            disabled={!!usage || !!resourceKey}
            SelectProps={{ native: true }}
          >
            <option value="">선택하세요</option>
            {resourceKeyOptions.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </TextField>
          <TextField
            select
            label="Code Group Key *"
            fullWidth
            value={formData.codeGroupKey}
            onChange={(e) => setFormData({ ...formData, codeGroupKey: e.target.value })}
            required
            disabled={!!usage}
            SelectProps={{ native: true }}
          >
            <option value="">선택하세요</option>
            {codeGroupKeyOptions.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </TextField>
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
          disabled={!formData.resourceKey || !formData.codeGroupKey || isLoading}
        >
          {usage ? '저장' : '생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

CodeUsageEditorModal.displayName = 'CodeUsageEditorModal';
