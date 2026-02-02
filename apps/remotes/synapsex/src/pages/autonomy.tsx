import type { SelectChangeEvent } from '@mui/material/Select';

import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { SYNAPSE_ROUTES } from '../routes';

// ----------------------------------------------------------------------

type AutonomyLevel = 1 | 3 | 5;

const anomalyTypes = [
  { key: 'duplicate_invoice', label: 'Duplicate Invoice' },
  { key: 'policy_violation', label: 'Policy Violation' },
  { key: 'bank_change', label: 'Bank Change Risk' },
  { key: 'late_payment', label: 'AR Late Payment' },
] as const;

const levelLabel = (level: AutonomyLevel): { label: string; icon: string; color: 'error' | 'warning' | 'success' } => {
  if (level === 1) return { label: 'Human Only', icon: 'solar:shield-cross-bold', color: 'error' };
  if (level === 3) return { label: 'AI Proposes + Human Approves', icon: 'solar:shield-warning-bold', color: 'warning' };
  return { label: 'Fully Autonomous', icon: 'solar:shield-check-bold', color: 'success' };
};

// ----------------------------------------------------------------------

/** 자율 운영 센터 (간편 설정) */
export const AutonomyPage = () => {
  const [scope, setScope] = useState('tenant');
  const [currency, setCurrency] = useState('USD');
  const [globalLevel, setGlobalLevel] = useState<AutonomyLevel>(3);
  const [override, setOverride] = useState<Record<string, AutonomyLevel>>({
    duplicate_invoice: 3,
    policy_violation: 1,
    bank_change: 1,
    late_payment: 3,
  });
  const [simulationRequired, setSimulationRequired] = useState(true);

  const globalMeta = useMemo(() => levelLabel(globalLevel), [globalLevel]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Autonomy Level
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Control how far the agent can go without human approval. Use this page for fast tuning; the full
              governance workspace lives in{' '}
              <Link
                to={SYNAPSE_ROUTES.GOVERNANCE}
                style={{ textDecoration: 'underline', textUnderlineOffset: 4 }}
              >
                Governance & Configuration
              </Link>
              .
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              icon={<Iconify icon="solar:magic-stick-3-bold" width={14} />}
              label="Guardrails enforced"
              size="small"
              variant="outlined"
            />
            <Button
              component={Link}
              to={SYNAPSE_ROUTES.GOVERNANCE}
              variant="outlined"
              size="small"
              endIcon={<Iconify icon="solar:arrow-right-up-linear" width={16} />}
              sx={{ bgcolor: 'transparent' }}
            >
              Open Governance
            </Button>
          </Stack>
        </Stack>

        {/* Scope & Defaults */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Iconify icon="solar:tuning-2-bold" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Scope & Defaults
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Apply defaults at tenant/company/currency scope and override per anomaly type.
            </Typography>

            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Scope
                </Typography>
                <Select fullWidth size="small" value={scope} onChange={(e: SelectChangeEvent) => setScope(e.target.value)}>
                  <MenuItem value="tenant">Tenant-wide</MenuItem>
                  <MenuItem value="company">Company code</MenuItem>
                  <MenuItem value="currency">Currency</MenuItem>
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Currency (optional)
                </Typography>
                <Select fullWidth size="small" value={currency} onChange={(e: SelectChangeEvent) => setCurrency(e.target.value)}>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="KRW">KRW</MenuItem>
                  <MenuItem value="JPY">JPY</MenuItem>
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Simulation Required
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2">Pre-execution simulation</Typography>
                  <Switch
                    checked={simulationRequired}
                    onChange={(e) => setSimulationRequired(e.target.checked)}
                    size="small"
                  />
                </Box>
              </Grid>
            </Grid>

            <Divider />

            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Box sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Default autonomy
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Used when no override exists.
                      </Typography>
                    </Box>
                    <Label
                      color={globalMeta.color}
                      startIcon={<Iconify icon={globalMeta.icon} width={14} />}
                    >
                      {globalMeta.label}
                    </Label>
                  </Stack>
                  <Slider
                    value={globalLevel}
                    onChange={(_, v) => setGlobalLevel(v as AutonomyLevel)}
                    min={1}
                    max={5}
                    step={2}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 3, label: '3' },
                      { value: 5, label: '5' },
                    ]}
                    valueLabelDisplay="off"
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Box sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Override coverage
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    How many anomaly types explicitly override the default.
                  </Typography>
                  <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {Object.keys(override).length}/{anomalyTypes.length}
                    </Typography>
                    <Chip
                      icon={<Iconify icon="solar:magic-stick-3-bold" width={14} />}
                      label="Policy-driven"
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Per anomaly-type autonomy
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Enterprise pattern: strict for money movement, flexible for notifications.
                </Typography>
              </Box>
              <Button variant="outlined" size="small" sx={{ bgcolor: 'transparent' }}>
                Reset to defaults
              </Button>
            </Stack>

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
              {anomalyTypes.map((t, index) => {
                const level = override[t.key] ?? globalLevel;
                const meta = levelLabel(level);
                return (
                  <Box key={t.key}>
                    {index > 0 && <Divider />}
                    <Box sx={{ p: 2.5 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {t.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Autonomy for this detection category
                          </Typography>
                        </Box>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Select
                            size="small"
                            value={String(level)}
                            onChange={(e: SelectChangeEvent) =>
                              setOverride((prev) => ({ ...prev, [t.key]: Number(e.target.value) as AutonomyLevel }))
                            }
                            sx={{ minWidth: 260 }}
                          >
                            <MenuItem value="1">Level 1 — Human Only</MenuItem>
                            <MenuItem value="3">Level 3 — AI Proposes + Approves</MenuItem>
                            <MenuItem value="5">Level 5 — Fully Autonomous</MenuItem>
                          </Select>
                          <Label color={meta.color} startIcon={<Iconify icon={meta.icon} width={14} />}>
                            {meta.label}
                          </Label>
                        </Stack>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Where this is enforced
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              In production, the autonomy level is evaluated at action-time in the backend before any SAP workflow
              call.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use this screen for rapid tuning with stakeholders. The authoritative policy is still stored in the
              Policy Profiles and Guardrails modules.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
