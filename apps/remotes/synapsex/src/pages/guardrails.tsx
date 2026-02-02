import type { SelectChangeEvent } from '@mui/material/Select';

import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

// ----------------------------------------------------------------------

type Severity = 'critical' | 'high' | 'medium' | 'low';

type Guardrail = {
  id: string;
  name: string;
  rule: string;
  thresholdLabel?: string;
  thresholdValue?: string;
  enabled: boolean;
  severity: Severity;
};

const severityMeta: Record<Severity, { icon: string; label: string; color: 'error' | 'warning' | 'info' | 'success' }> = {
  critical: { icon: 'solar:shield-cross-bold', label: 'Critical', color: 'error' },
  high: { icon: 'solar:shield-warning-bold', label: 'High', color: 'warning' },
  medium: { icon: 'solar:shield-check-bold', label: 'Medium', color: 'info' },
  low: { icon: 'solar:shield-check-bold', label: 'Low', color: 'success' },
};

const seedGuardrails: Guardrail[] = [
  {
    id: 'gr-1',
    name: 'CFO approval for large payments',
    rule: 'Never approve payments over 1,000,000 (base currency) without CFO signature',
    thresholdLabel: 'Amount',
    thresholdValue: '1,000,000',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'gr-2',
    name: 'Dual approval for reversals',
    rule: 'Require dual approval for any reversal action over 100,000',
    thresholdLabel: 'Amount',
    thresholdValue: '100,000',
    enabled: true,
    severity: 'high',
  },
  {
    id: 'gr-3',
    name: 'New vendor restriction',
    rule: 'Block automatic payments to vendors created within the last 7 days',
    thresholdLabel: 'Days',
    thresholdValue: '7',
    enabled: true,
    severity: 'high',
  },
  {
    id: 'gr-4',
    name: 'Bank change cooldown',
    rule: 'Require manual approval for payments within 72 hours of bank account change',
    thresholdLabel: 'Hours',
    thresholdValue: '72',
    enabled: true,
    severity: 'critical',
  },
];

// ----------------------------------------------------------------------

/** 조치 가드레일 */
export const GuardrailsPage = () => {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'all' | Severity>('all');
  const [items, setItems] = useState<Guardrail[]>(seedGuardrails);
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = useMemo(
    () =>
      items
        .filter((g) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return (
            g.name.toLowerCase().includes(q) ||
            g.rule.toLowerCase().includes(q) ||
            (g.thresholdValue || '').toLowerCase().includes(q)
          );
        })
        .filter((g) => (severity === 'all' ? true : g.severity === severity)),
    [items, query, severity]
  );

  const enabledCount = items.filter((g) => g.enabled).length;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:shield-check-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Guardrails
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Define non-negotiable rules the agent must obey. These rules gate automated actions across all
              tenants.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
            onClick={() => setDialogOpen(true)}
          >
            New Guardrail
          </Button>
        </Stack>

        {/* Stats */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Enabled guardrails
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Active protections enforced by the agent
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {enabledCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Critical rules
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Cannot be bypassed
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {items.filter((g) => g.severity === 'critical').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Common patterns
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Amount caps, bank-change cooldown, SoD
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  <Chip label="Amount cap" size="small" variant="outlined" />
                  <Chip label="Cooldown" size="small" variant="outlined" />
                  <Chip label="Dual approval" size="small" variant="outlined" />
                  <Chip label="New vendor" size="small" variant="outlined" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Guardrail List */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Iconify icon="solar:shield-warning-bold" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Guardrail Ruleset
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Toggle guardrails on/off, set severity, and review the exact constraint enforced.
            </Typography>

            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              alignItems={{ lg: 'center' }}
              spacing={2}
              sx={{ mb: 2.5 }}
            >
              <TextField
                size="small"
                placeholder="Search guardrails..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip icon={<Iconify icon="solar:filter-bold" width={14} />} label="Filter" size="small" variant="outlined" />
                <Select
                  size="small"
                  value={severity}
                  onChange={(e: SelectChangeEvent) => setSeverity(e.target.value as 'all' | Severity)}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="all">All severities</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </Stack>
            </Stack>

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
              {rows.map((g, index) => {
                const meta = severityMeta[g.severity];
                return (
                  <Box key={g.id}>
                    {index > 0 && <Divider />}
                    <Box sx={{ p: 2.5 }}>
                      <Stack
                        direction={{ xs: 'column', lg: 'row' }}
                        alignItems={{ lg: 'center' }}
                        spacing={2}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                            <Box>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {g.name}
                                </Typography>
                                <Label
                                  color={meta.color}
                                  startIcon={<Iconify icon={meta.icon} width={14} />}
                                >
                                  {meta.label}
                                </Label>
                                {!g.enabled && (
                                  <Chip label="disabled" size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                                )}
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {g.rule}
                              </Typography>
                              {(g.thresholdLabel || g.thresholdValue) && (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                  Threshold: <Box component="span" sx={{ color: 'text.primary' }}>{g.thresholdLabel}</Box> ={' '}
                                  <Box component="span" sx={{ color: 'text.primary' }}>{g.thresholdValue}</Box>
                                </Typography>
                              )}
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Switch
                                checked={g.enabled}
                                onChange={(e) =>
                                  setItems((prev) => prev.map((x) => (x.id === g.id ? { ...x, enabled: e.target.checked } : x)))
                                }
                                size="small"
                              />
                              <IconButton size="small">
                                <Iconify icon="solar:pen-bold" width={16} />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setItems((prev) => prev.filter((x) => x.id !== g.id))}
                              >
                                <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
              {rows.length === 0 && (
                <Box sx={{ p: 10, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No guardrails match the current filters.
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2.5 }} />

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                Showing {rows.length.toLocaleString()} rules
              </Typography>
              <Chip
                icon={<Iconify icon="solar:shield-check-bold" width={14} />}
                label="Enforced at action-time"
                size="small"
                variant="outlined"
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create guardrail</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            This is a UI prototype. In production, saving here would persist to policy / governance tables.
          </DialogContentText>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Name</FormLabel>
              <TextField size="small" placeholder="e.g., CFO approval for large payments" />
            </FormControl>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Rule statement</FormLabel>
              <TextField size="small" placeholder="Never approve payments over ..." />
            </FormControl>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Severity</FormLabel>
                  <Select size="small" defaultValue="high">
                    <MenuItem value="critical">Critical</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Threshold</FormLabel>
                  <TextField size="small" placeholder="e.g., 1,000,000" />
                </FormControl>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={() => setDialogOpen(false)} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
