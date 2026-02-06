// ----------------------------------------------------------------------

import type { CodeGroup, CodeUsageSummary } from '@dwp-frontend/shared-utils';

import { memo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import type { ResourceOption } from './resource-menu-list';

// ----------------------------------------------------------------------

type CodeUsageEditorModalProps = {
  open: boolean;
  onClose: () => void;
  usage: CodeUsageSummary | null;
  resourceKey: string;
  resourceKeyOptions: string[];
  resourceOptions?: ResourceOption[];
  resourceName?: string;
  codeGroups: CodeGroup[];
  usagesByResource: Map<string, CodeUsageSummary[]>;
  onSubmit: (formData: { resourceKey: string; codeGroupKey: string; enabled: boolean }) => void;
  isLoading: boolean;
};

export const CodeUsageEditorModal = memo(({
  open,
  onClose,
  usage,
  resourceKey,
  resourceKeyOptions,
  resourceOptions = [],
  resourceName,
  codeGroups,
  usagesByResource,
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

  // Available groups: not yet mapped to the target resource (from form or prop)
  const targetResourceKey = formData.resourceKey || resourceKey;
  const existingGroupKeys = targetResourceKey
    ? (usagesByResource.get(targetResourceKey) || []).map((u) => u.codeGroupKey)
    : [];
  const availableGroups = codeGroups.filter((g) => !existingGroupKeys.includes(g.groupKey));
  const selectedGroup = (usage ? codeGroups : availableGroups).find((g) => g.groupKey === formData.codeGroupKey);
  const displayResourceName =
    resourceName || resourceOptions.find((r) => r.resourceKey === targetResourceKey)?.resourceName || targetResourceKey;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{usage ? '코드 그룹 편집' : '코드 그룹 추가'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {!usage && !resourceKey && (
            <FormControl fullWidth size="medium">
              <InputLabel id="cu-resource-label">리소스 *</InputLabel>
              <Select
                labelId="cu-resource-label"
                label="리소스 *"
                value={formData.resourceKey}
                onChange={(e) => setFormData({ ...formData, resourceKey: e.target.value })}
              >
                <MenuItem value="">선택하세요</MenuItem>
                {resourceOptions.length > 0
                  ? resourceOptions.map((r) => (
                      <MenuItem key={r.resourceKey} value={r.resourceKey}>
                        {r.resourceName} ({r.resourceKey})
                      </MenuItem>
                    ))
                  : resourceKeyOptions.map((key) => (
                      <MenuItem key={key} value={key}>
                        {key}
                      </MenuItem>
                    ))}
              </Select>
            </FormControl>
          )}

          {!usage && targetResourceKey && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <strong>{displayResourceName}</strong>에서 사용할 코드 그룹을 선택하세요.
            </Typography>
          )}

          <FormControl fullWidth size="medium">
            <InputLabel id="cu-group-label">코드 그룹 *</InputLabel>
            <Select
              labelId="cu-group-label"
              label="코드 그룹 *"
              value={formData.codeGroupKey}
              onChange={(e) => setFormData({ ...formData, codeGroupKey: e.target.value })}
              disabled={!!usage}
            >
              <MenuItem value="">그룹 선택</MenuItem>
              {(usage ? codeGroups : availableGroups).map((group) => (
                <MenuItem key={group.id} value={group.groupKey}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: 1 }}>
                    <span>{group.groupName}</span>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', ml: 1 }}>
                      {group.groupKey}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {!usage && formData.codeGroupKey && selectedGroup && (
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  선택된 그룹:
                </Typography>
                <Chip label={`${selectedGroup.groupName} (${selectedGroup.groupKey})`} size="small" />
              </Stack>
            </Box>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
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
          {usage ? '저장' : '추가'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

CodeUsageEditorModal.displayName = 'CodeUsageEditorModal';
