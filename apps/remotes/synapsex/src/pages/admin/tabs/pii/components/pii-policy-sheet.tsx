import { useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import {
  showToast,
  type PiiPolicyItem,
  type PiiFieldCatalogItem,
  usePutPiiPoliciesBulkMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Drawer from '@mui/material/Drawer';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

const HANDLING_OPTIONS: { value: PiiPolicyItem['handling']; label: string }[] = [
  { value: 'ALLOW', label: 'Allow' },
  { value: 'MASK', label: 'Mask' },
  { value: 'HASH_ONLY', label: 'Hash only' },
  { value: 'ENCRYPT', label: 'Encrypt' },
  { value: 'FORBID', label: 'Forbid' },
];

type PiiPolicySheetProps = {
  open: boolean;
  onClose: () => void;
  field: PiiFieldCatalogItem | null;
  policy: PiiPolicyItem | null | undefined;
  profileId: string;
  existingPolicies: PiiPolicyItem[];
  onSaved: () => void;
};

export const PiiPolicySheet = ({
  open,
  onClose,
  field,
  policy,
  profileId,
  existingPolicies,
  onSaved,
}: PiiPolicySheetProps) => {
  const [handling, setHandling] = useState<PiiPolicyItem['handling']>('MASK');
  const [showLastN, setShowLastN] = useState<string>('');
  const [pattern, setPattern] = useState<string>('');

  const bulkMutation = usePutPiiPoliciesBulkMutation();

  useEffect(() => {
    if (field && policy) {
      setHandling(policy.handling);
      setShowLastN(String(policy.maskConfig?.showLastN ?? ''));
      setPattern(policy.maskConfig?.pattern ?? '');
    } else if (field) {
      setHandling('MASK');
      setShowLastN('');
      setPattern('');
    }
  }, [field, policy]);

  const handleSave = async () => {
    if (!field || !profileId) return;

    const maskConfig =
      handling === 'MASK' && (showLastN || pattern)
        ? {
            showLastN: showLastN ? parseInt(showLastN, 10) : undefined,
            pattern: pattern || undefined,
          }
        : undefined;

    const updatedPolicy: PiiPolicyItem = {
      fieldKey: field.fieldKey,
      handling,
      maskConfig,
      hashAlgorithm: handling === 'HASH_ONLY' ? 'SHA256' : undefined,
    };

    const otherPolicies = existingPolicies.filter((p) => p.fieldKey !== field.fieldKey);
    const newPolicies = [...otherPolicies, updatedPolicy];

    bulkMutation.mutate(
      { profileId, policies: newPolicies },
      {
        onSuccess: () => {
          showToast('Saved. Changes are recorded in Audit.');
          onSaved();
          onClose();
        },
        onError: (err) => {
          showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
          onSaved();
        },
      }
    );
  };

  if (!field) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 } },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {field.label}
          </Typography>
          <Button size="small" onClick={onClose} startIcon={<Iconify icon="solar:close-circle-linear" width={18} />}>
            Close
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {field.description}
        </Typography>

        <Stack spacing={2} sx={{ flex: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Handling</InputLabel>
            <Select
              value={handling}
              label="Handling"
              onChange={(e) => setHandling(e.target.value as PiiPolicyItem['handling'])}
              disabled={bulkMutation.isPending}
            >
              {HANDLING_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {handling === 'MASK' && (
            <>
              <TextField
                size="small"
                label="Show last N digits"
                type="number"
                value={showLastN}
                onChange={(e) => setShowLastN(e.target.value)}
                placeholder="e.g. 4"
                disabled={bulkMutation.isPending}
              />
              <TextField
                size="small"
                label="Pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. ****7890"
                disabled={bulkMutation.isPending}
              />
            </>
          )}

          {handling === 'HASH_ONLY' && (
            <Typography variant="caption" color="text.secondary">
              Algorithm: SHA256 (configurable in Phase2)
            </Typography>
          )}

          {handling === 'ENCRYPT' && (
            <Typography variant="caption" color="text.secondary">
              Key provider from data protection settings
            </Typography>
          )}
        </Stack>

        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleSave}
            disabled={bulkMutation.isPending}
          >
            {bulkMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};
