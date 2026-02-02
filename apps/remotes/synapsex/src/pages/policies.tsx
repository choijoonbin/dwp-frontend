
import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import TableRow from '@mui/material/TableRow';
import FormLabel from '@mui/material/FormLabel';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import DialogContentText from '@mui/material/DialogContentText';

import { mockPolicies, mockCompanyCodes } from '../data/mock-data';

// ----------------------------------------------------------------------

type PolicyProfile = {
  id: string;
  name: string;
  scope: string;
  strictness: 'pilot' | 'standard' | 'strict';
  duplicateWindowDays: number;
  duplicateAmountTolerancePct: number;
  requireAttachmentOver: number;
  autoBlockSeverity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
};

const seedProfiles: PolicyProfile[] = [
  {
    id: 'pp-1',
    name: 'Global Standard',
    scope: 'All tenants · Multi-company · Multi-currency',
    strictness: 'standard',
    duplicateWindowDays: 30,
    duplicateAmountTolerancePct: 1,
    requireAttachmentOver: 500000,
    autoBlockSeverity: 'critical',
    enabled: true,
  },
  {
    id: 'pp-2',
    name: 'Pilot (Low-risk Auto)',
    scope: 'Tenant 200000 · Company 1000',
    strictness: 'pilot',
    duplicateWindowDays: 14,
    duplicateAmountTolerancePct: 2,
    requireAttachmentOver: 1000000,
    autoBlockSeverity: 'high',
    enabled: true,
  },
  {
    id: 'pp-3',
    name: 'Strict Audit Mode',
    scope: 'Tenant 400000 · Company 2000',
    strictness: 'strict',
    duplicateWindowDays: 60,
    duplicateAmountTolerancePct: 0,
    requireAttachmentOver: 300000,
    autoBlockSeverity: 'high',
    enabled: false,
  },
];

const strictnessLabel = (v: PolicyProfile['strictness']): { label: string; color: 'default' | 'primary' | 'warning' } => {
  const map = {
    pilot: { label: 'Pilot', color: 'default' as const },
    standard: { label: 'Standard', color: 'primary' as const },
    strict: { label: 'Strict', color: 'warning' as const },
  };
  return map[v];
};

// ----------------------------------------------------------------------

/** 정책 프로파일 */
export const PoliciesPage = () => {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<PolicyProfile[]>(seedProfiles);
  const [selected, setSelected] = useState<PolicyProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const rows = useMemo(
    () =>
      profiles
        .filter((p) => {
          if (!query) return true;
          const q = query.toLowerCase();
          return p.name.toLowerCase().includes(q) || p.scope.toLowerCase().includes(q);
        })
        .sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1)),
    [profiles, query]
  );

  const linkedPolicies = useMemo(() => mockPolicies.slice(0, 6), []);

  const handleEditClick = (p: PolicyProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(p);
    setEditDialogOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:tuning-2-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Policy Profiles
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Configure tenant/company/currency-aware detection rules and compliance thresholds.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:copy-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              Clone Profile
            </Button>
            <Button variant="contained" size="small" startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}>
              New Profile
            </Button>
          </Stack>
        </Stack>

        {/* Main Grid */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Profiles
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Define &ldquo;what counts as duplicate&rdquo;, approval thresholds, and auto-block rules.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      placeholder="Search profiles…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      sx={{ width: 240 }}
                      InputProps={{
                        startAdornment: (
                          <Iconify icon="solar:magnifer-linear" width={16} sx={{ mr: 1, color: 'text.secondary' }} />
                        ),
                      }}
                    />
                    <IconButton size="small">
                      <Iconify icon="solar:filter-bold" width={16} />
                    </IconButton>
                  </Stack>
                </Stack>

                <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Profile</TableCell>
                        <TableCell>Scope</TableCell>
                        <TableCell sx={{ width: 120 }}>Strictness</TableCell>
                        <TableCell sx={{ width: 120 }}>Enabled</TableCell>
                        <TableCell sx={{ width: 110 }} align="right">
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((p) => {
                        const strictMeta = strictnessLabel(p.strictness);
                        return (
                          <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {p.name}
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                  <Iconify icon="solar:copy-bold" width={14} sx={{ color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {p.duplicateWindowDays}d
                                  </Typography>
                                </Stack>
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                  <Iconify icon="solar:clock-circle-bold" width={14} sx={{ color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    ±{p.duplicateAmountTolerancePct}%
                                  </Typography>
                                </Stack>
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                  <Iconify icon="solar:wallet-money-bold" width={14} sx={{ color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {p.requireAttachmentOver.toLocaleString()}
                                  </Typography>
                                </Stack>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {p.scope}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Label color={strictMeta.color} sx={{ fontSize: '0.75rem' }}>
                                {strictMeta.label}
                              </Label>
                            </TableCell>
                            <TableCell>
                              {p.enabled ? (
                                <Label color="success" sx={{ fontSize: '0.75rem' }}>
                                  Active
                                </Label>
                              ) : (
                                <Label color="default" sx={{ fontSize: '0.75rem' }}>
                                  Disabled
                                </Label>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" onClick={(e) => handleEditClick(p, e)}>
                                <Iconify icon="solar:pen-bold" width={16} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                            <Typography variant="body2" color="text.secondary">
                              No profiles match the current search.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Linked Compliance Docs
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  RAG source-of-truth documents powering policy citations.
                </Typography>
                <Stack spacing={2}>
                  {linkedPolicies.map((p) => (
                    <Box key={p.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {p.title}
                        </Typography>
                        <Chip label={`v${p.version}`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        {p.category} · updated {p.updatedAt}
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'action.hover' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Duplicate invoice definition
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Configure key combination and tolerance to match customer policy. (UI for future config table)
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Enterprise Defaults */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
              Enterprise defaults
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
              These apply when no tenant/company profile override is present.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Duplicate window
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    30 days
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Amount tolerance
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    ±1%
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Default company codes
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {mockCompanyCodes.length}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {selected && (
          <Typography variant="caption" color="text.secondary">
            Selected: <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{selected.name}</Box>
          </Typography>
        )}
      </Stack>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>Edit Policy Profile</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 3 }}>
                Mock editor for enterprise policy settings (UI-only).
              </DialogContentText>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Profile Name</FormLabel>
                    <TextField size="small" defaultValue={selected.name} />
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Scope</FormLabel>
                    <TextField size="small" defaultValue={selected.scope} />
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <FormLabel sx={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Iconify icon="solar:copy-bold" width={16} />
                        Duplicate invoice window (days)
                      </FormLabel>
                      <Chip label={`${selected.duplicateWindowDays} days`} size="small" variant="outlined" />
                    </Stack>
                    <Slider defaultValue={selected.duplicateWindowDays} min={1} max={120} step={1} marks />
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <FormLabel sx={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Iconify icon="solar:clock-circle-bold" width={16} />
                        Amount tolerance (%)
                      </FormLabel>
                      <Chip label={`±${selected.duplicateAmountTolerancePct}%`} size="small" variant="outlined" />
                    </Stack>
                    <Slider defaultValue={selected.duplicateAmountTolerancePct} min={0} max={5} step={0.5} marks />
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <FormLabel sx={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Iconify icon="solar:wallet-money-bold" width={16} />
                        Attachment required above
                      </FormLabel>
                      <Chip
                        label={selected.requireAttachmentOver.toLocaleString()}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Slider
                      defaultValue={selected.requireAttachmentOver}
                      min={100000}
                      max={3000000}
                      step={50000}
                      marks
                    />
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                          <Iconify
                            icon={
                              selected.autoBlockSeverity === 'critical'
                                ? 'solar:shield-warning-bold'
                                : 'solar:shield-check-bold'
                            }
                            width={16}
                            sx={{
                              color:
                                selected.autoBlockSeverity === 'critical' ? 'error.main' : 'primary.main',
                            }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Auto-block threshold
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Auto-execute payment block for cases ≥ configured severity.
                        </Typography>
                      </Box>
                      <Label color="error" sx={{ textTransform: 'uppercase' }}>
                        {selected.autoBlockSeverity}
                      </Label>
                    </Stack>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Enabled
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          When disabled, profile is not applied to scoring.
                        </Typography>
                      </Box>
                      <Switch defaultChecked={selected.enabled} size="small" />
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditDialogOpen(false)} sx={{ color: 'text.secondary' }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setProfiles((prev) => prev.map((x) => (x.id === selected.id ? { ...x, enabled: true } : x)));
                  setEditDialogOpen(false);
                }}
                variant="contained"
              >
                Save (Mock)
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
