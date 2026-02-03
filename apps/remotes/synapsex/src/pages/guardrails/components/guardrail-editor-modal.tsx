/**
 * Guardrail editor — JSON rule builder with presets
 */

import type { FormEvent } from 'react';
import type { GuardrailListDto, GuardrailUpsertRequest } from '@dwp-frontend/shared-utils';

import { useState, useCallback } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import DialogContentText from '@mui/material/DialogContentText';

const PRESETS: { name: string; ruleJson: Record<string, unknown> }[] = [
  {
    name: 'Amount cap (1M)',
    ruleJson: {
      caseTypes: ['PAYMENT', 'REVERSAL'],
      actionTypes: ['EXECUTE', 'APPROVE'],
      maxAmount: 1_000_000,
      requiredApprovalLevel: 'CFO',
      block: false,
    },
  },
  {
    name: 'Dual approval for reversals',
    ruleJson: {
      caseTypes: ['REVERSAL'],
      actionTypes: ['EXECUTE'],
      maxAmount: 100_000,
      requiredApprovalLevel: 'DUAL',
      block: false,
    },
  },
  {
    name: 'New vendor restriction',
    ruleJson: {
      caseTypes: ['PAYMENT'],
      vendorCreatedWithinDays: 7,
      block: true,
    },
  },
  {
    name: 'Bank change cooldown',
    ruleJson: {
      caseTypes: ['PAYMENT'],
      bankChangeWithinHours: 72,
      requiredApprovalLevel: 'MANUAL',
      block: false,
    },
  },
];

const SCOPES = [
  { value: 'TENANT', label: 'Tenant' },
  { value: 'GLOBAL', label: 'Global' },
  { value: 'COMPANY', label: 'Company' },
];

type GuardrailEditorModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: GuardrailUpsertRequest) => void;
  isLoading?: boolean;
  initial?: GuardrailListDto | null;
};

export const GuardrailEditorModal = ({
  open,
  onClose,
  onSubmit,
  isLoading,
  initial,
}: GuardrailEditorModalProps) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [scope, setScope] = useState(initial?.scope ?? 'TENANT');
  const [ruleJsonStr, setRuleJsonStr] = useState(() => {
    try {
      return initial?.ruleJson
        ? JSON.stringify(initial.ruleJson as Record<string, unknown>, null, 2)
        : '{}';
    } catch {
      return '{}';
    }
  });
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const applyPreset = useCallback((preset: (typeof PRESETS)[0]) => {
    setRuleJsonStr(JSON.stringify(preset.ruleJson, null, 2));
    setJsonError(null);
  }, []);

  const validateAndSubmit = (e: FormEvent) => {
    e.preventDefault();
    let ruleJson: unknown = {};
    try {
      ruleJson = JSON.parse(ruleJsonStr || '{}');
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
      return;
    }
    setJsonError(null);
    onSubmit({
      name: name.trim(),
      scope,
      ruleJson: ruleJson as Record<string, unknown>,
      isEnabled,
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setName(initial?.name ?? '');
      setScope(initial?.scope ?? 'TENANT');
      setRuleJsonStr(
        initial?.ruleJson ? JSON.stringify(initial.ruleJson as Record<string, unknown>, null, 2) : '{}'
      );
      setIsEnabled(initial?.isEnabled ?? true);
      setJsonError(null);
    }
  };

  return (
    <>
      <DialogTitle>{initial ? 'Edit Guardrail' : 'New Guardrail'}</DialogTitle>
      <form onSubmit={validateAndSubmit}>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Define non-negotiable rules the agent must obey. Use presets or edit the JSON directly.
          </DialogContentText>
          <Stack spacing={2.5}>
            <TextField
              size="small"
              fullWidth
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CFO approval for large payments"
              required
            />
            <FormControl fullWidth>
              <InputLabel id="guardrail-scope-label">Scope</InputLabel>
              <Select
                size="small"
                labelId="guardrail-scope-label"
                label="Scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                {SCOPES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} size="small" />}
              label="Enabled"
            />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Rule JSON
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {PRESETS.map((p) => (
                    <Button
                      key={p.name}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', minWidth: 'auto', py: 0.25 }}
                      onClick={() => applyPreset(p)}
                    >
                      {p.name}
                    </Button>
                  ))}
                </Stack>
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={6}
                maxRows={12}
                value={ruleJsonStr}
                onChange={(e) => {
                  setRuleJsonStr(e.target.value);
                  setJsonError(null);
                }}
                error={Boolean(jsonError)}
                helperText={jsonError}
                sx={{
                  '& textarea': { fontFamily: 'monospace', fontSize: '0.8rem' },
                }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!name.trim() || isLoading}
            startIcon={<Iconify icon="solar:check-circle-bold" width={18} />}
          >
            {initial ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </>
  );
};
