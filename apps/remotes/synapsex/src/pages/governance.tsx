import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

import { SeverityBadge } from '../components/finance/severity-badge';

// ----------------------------------------------------------------------

const autonomyLevels = [
  {
    level: 1,
    name: 'Human Only',
    description: 'AI provides analysis only. All actions require human initiation.',
    icon: 'solar:user-bold',
    color: 'default',
  },
  {
    level: 2,
    name: 'AI Assists',
    description: 'AI suggests actions. Human must review and manually execute.',
    icon: 'solar:widget-bold',
    color: 'info',
  },
  {
    level: 3,
    name: 'AI Proposes',
    description: 'AI proposes actions with full detail. Human approves with one click.',
    icon: 'solar:cpu-bold',
    color: 'primary',
  },
  {
    level: 4,
    name: 'AI Auto + Review',
    description: 'AI executes low-risk actions automatically. High-risk requires approval.',
    icon: 'solar:cpu-bolt-bold',
    color: 'warning',
  },
  {
    level: 5,
    name: 'Fully Autonomous',
    description: 'AI executes all actions within guardrails without human intervention.',
    icon: 'solar:cpu-bolt-bold',
    color: 'success',
  },
];

const initialAnomalySettings = [
  {
    type: 'duplicate_invoice',
    label: 'Duplicate Invoice',
    autonomyLevel: 3,
    riskWeight: 'high',
    enabled: true,
  },
  {
    type: 'bank_change',
    label: 'Bank Account Change',
    autonomyLevel: 2,
    riskWeight: 'critical',
    enabled: true,
  },
  {
    type: 'policy_violation',
    label: 'Policy Violation',
    autonomyLevel: 3,
    riskWeight: 'high',
    enabled: true,
  },
  {
    type: 'integrity_mismatch',
    label: 'Data Integrity Mismatch',
    autonomyLevel: 4,
    riskWeight: 'medium',
    enabled: true,
  },
  {
    type: 'amount_variance',
    label: 'Amount Variance',
    autonomyLevel: 3,
    riskWeight: 'high',
    enabled: true,
  },
  {
    type: 'timing_anomaly',
    label: 'Timing Anomaly',
    autonomyLevel: 4,
    riskWeight: 'low',
    enabled: true,
  },
];

const initialGuardrails = [
  {
    id: 'gr-1',
    name: 'CFO Approval for Large Payments',
    rule: 'Never approve payments over $1,000,000 without CFO signature',
    threshold: 1000000,
    enabled: true,
    severity: 'critical' as const,
  },
  {
    id: 'gr-2',
    name: 'Dual Approval Requirement',
    rule: 'Require dual approval for any reversal action over $100,000',
    threshold: 100000,
    enabled: true,
    severity: 'high' as const,
  },
  {
    id: 'gr-3',
    name: 'New Vendor Restriction',
    rule: 'Block automatic payments to vendors created within last 7 days',
    threshold: 7,
    enabled: true,
    severity: 'high' as const,
  },
  {
    id: 'gr-4',
    name: 'Bank Change Cooldown',
    rule: 'Require manual approval for payments after bank account change within 72 hours',
    threshold: 72,
    enabled: true,
    severity: 'critical' as const,
  },
  {
    id: 'gr-5',
    name: 'Daily Limit per Vendor',
    rule: 'AI cannot approve more than $500,000 total to any single vendor per day',
    threshold: 500000,
    enabled: false,
    severity: 'medium' as const,
  },
];

// ----------------------------------------------------------------------

export const GovernancePage = () => {
  const { t } = useTranslation('common');
  const [globalAutonomyLevel, setGlobalAutonomyLevel] = useState(3);
  const [anomalySettings, setAnomalySettings] = useState(initialAnomalySettings);
  const [guardrails, setGuardrails] = useState(initialGuardrails);
  const [hasChanges, setHasChanges] = useState(false);
  const [newGuardrailOpen, setNewGuardrailOpen] = useState(false);

  const updateAnomalyLevel = (type: string, level: number) => {
    setAnomalySettings((prev) => prev.map((a) => (a.type === type ? { ...a, autonomyLevel: level } : a)));
    setHasChanges(true);
  };

  const toggleAnomalyEnabled = (type: string) => {
    setAnomalySettings((prev) => prev.map((a) => (a.type === type ? { ...a, enabled: !a.enabled } : a)));
    setHasChanges(true);
  };

  const toggleGuardrail = (id: string) => {
    setGuardrails((prev) => prev.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g)));
    setHasChanges(true);
  };

  const removeGuardrail = (id: string) => {
    setGuardrails((prev) => prev.filter((g) => g.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => {
    setAnomalySettings(initialAnomalySettings);
    setGuardrails(initialGuardrails);
    setGlobalAutonomyLevel(3);
    setHasChanges(false);
  };

  const currentLevelConfig = autonomyLevels.find((l) => l.level === globalAutonomyLevel) || autonomyLevels[2];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Page Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, py: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:shield-check-bold" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" fontWeight={600}>
                {t('governance.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('governance.subtitle')}
            </Typography>
          </Box>
          {hasChanges && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:refresh-bold" />}
                onClick={handleReset}
              >
                {t('governance.reset')}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<Iconify icon="solar:check-circle-bold" />}
              >
                {t('governance.saveChanges')}
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Left: Autonomy Levels */}
        <Box
          sx={{
            width: { xs: '100%', lg: '50%' },
            borderRight: { lg: 1 },
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:settings-bold" width={16} sx={{ color: 'text.primary' }} />
              <Typography variant="subtitle2" color="text.primary">{t('governance.autonomyConfig')}</Typography>
            </Stack>
          </Box>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
            <Stack spacing={3}>
              {/* Global Autonomy Level */}
              <Card sx={{ bgcolor: 'primary.lighter', border: 1, borderColor: 'primary.light' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Iconify icon="solar:settings-bold" width={16} sx={{ color: 'text.primary' }} />
                      <Typography variant="subtitle2" color="text.primary">{t('governance.globalDefaultLabel')}</Typography>
                    </Stack>
                    <Chip
                      icon={<Iconify icon={currentLevelConfig.icon} width={14} />}
                      label={`${t('governance.level')} ${globalAutonomyLevel}`}
                      size="small"
                      color={currentLevelConfig.color as any}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    {t('governance.globalDefaultSliderHint')}
                  </Typography>
                  <Box sx={{ px: 1 }}>
                    <Slider
                      value={globalAutonomyLevel}
                      onChange={(_, v) => {
                        setGlobalAutonomyLevel(v as number);
                        setHasChanges(true);
                      }}
                      min={1}
                      max={5}
                      step={1}
                      marks
                      valueLabelDisplay="auto"
                    />
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.primary">
                        {t('governance.humanOnly')}
                      </Typography>
                      <Typography variant="caption" color="text.primary">
                        {t('governance.fullyAuto')}
                      </Typography>
                    </Stack>
                  </Box>
                  <Card
                    sx={{
                      mt: 2,
                      bgcolor: `${currentLevelConfig.color}.lighter`,
                      border: 1,
                      borderColor: `${currentLevelConfig.color}.light`,
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Iconify icon={currentLevelConfig.icon} width={16} sx={{ color: 'text.primary' }} />
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {t(`governance.autonomyLevels.level${currentLevelConfig.level}.name`)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t(`governance.autonomyLevels.level${currentLevelConfig.level}.description`)}
                      </Typography>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              {/* Autonomy Level Reference */}
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <Iconify icon="solar:info-circle-bold" width={16} sx={{ color: 'text.primary' }} />
                    <Typography variant="subtitle2" color="text.primary">{t('governance.autonomyReference')}</Typography>
                  </Stack>
                  <Stack spacing={1}>
                    {autonomyLevels.map((level) => (
                      <Box
                        key={level.level}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor:
                            globalAutonomyLevel === level.level ? 'primary.lighter' : 'background.neutral',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: `${level.color}.lighter`,
                            color: `${level.color}.main`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Iconify icon={level.icon} width={16} sx={{ color: 'inherit' }} />
                        </Box>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="body2" fontWeight={600} color="text.primary">
                            {t('governance.level')} {level.level}: {t(`governance.autonomyLevels.level${level.level}.name`)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {t(`governance.autonomyLevels.level${level.level}.description`)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Per-Anomaly Settings */}
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Iconify icon="solar:danger-triangle-bold" width={16} sx={{ color: 'text.primary' }} />
                    <Typography variant="subtitle2" color="text.primary">{t('governance.perAnomalySettings')}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    {t('governance.perAnomalyDesc')}
                  </Typography>
                  <Stack spacing={1.5}>
                    {anomalySettings.map((setting) => (
                      <Card
                        key={setting.type}
                        sx={{
                          bgcolor: setting.enabled ? 'background.paper' : 'background.neutral',
                          opacity: setting.enabled ? 1 : 0.6,
                          border: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Switch
                                checked={setting.enabled}
                                onChange={() => toggleAnomalyEnabled(setting.type)}
                                size="small"
                              />
                              <Typography variant="body2" fontWeight={600}>
                                {t(`governance.anomalyTypes.${setting.type}`)}
                              </Typography>
                            </Stack>
                            <SeverityBadge
                              severity={setting.riskWeight as 'critical' | 'high' | 'medium' | 'low'}
                              size="sm"
                            />
                          </Stack>
                          {setting.enabled && (
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                                {t('governance.level')}:
                              </Typography>
                              <Box sx={{ flexGrow: 1 }}>
                                <Slider
                                  value={setting.autonomyLevel}
                                  onChange={(_, v) => updateAnomalyLevel(setting.type, v as number)}
                                  min={1}
                                  max={5}
                                  step={1}
                                  marks
                                  size="small"
                                />
                              </Box>
                              <Chip label={`${t('governance.level')} ${setting.autonomyLevel}`} size="small" sx={{ minWidth: 80 }} />
                            </Stack>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Box>

        {/* Right: Guardrails */}
        <Box
          sx={{
            width: { xs: '100%', lg: '50%' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Iconify icon="solar:lock-bold" width={16} sx={{ color: 'text.primary' }} />
                <Typography variant="subtitle2" color="text.primary">{t('governance.guardrailConfig')}</Typography>
              </Stack>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:add-circle-bold" />}
                onClick={() => setNewGuardrailOpen(true)}
              >
                {t('governance.addGuardrailButton')}
              </Button>
            </Stack>
          </Box>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
            <Stack spacing={2}>
              {/* Info Card */}
              <Card sx={{ bgcolor: 'error.lighter', border: 1, borderColor: 'error.light' }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1.5}>
                    <Iconify icon="solar:shield-warning-bold" width={20} sx={{ color: 'error.main', flexShrink: 0 }} />
                    <Box>
                      <Typography variant="body2" fontWeight={600} color="error.main">
                        {t('governance.strictGuardrails')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('governance.strictGuardrailsDesc')}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Guardrails List */}
              {guardrails.map((guardrail) => (
                <Card
                  key={guardrail.id}
                  sx={{
                    bgcolor: guardrail.enabled
                      ? guardrail.severity === 'critical'
                        ? 'error.lighter'
                        : 'background.paper'
                      : 'background.neutral',
                    border: 1,
                    borderColor: guardrail.enabled && guardrail.severity === 'critical' ? 'error.light' : 'divider',
                    opacity: guardrail.enabled ? 1 : 0.6,
                  }}
                >
                  <CardContent>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                      <Stack direction="row" spacing={1.5} sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            bgcolor: guardrail.enabled
                              ? guardrail.severity === 'critical'
                                ? 'error.lighter'
                                : 'warning.lighter'
                              : 'background.neutral',
                            color: guardrail.enabled
                              ? guardrail.severity === 'critical'
                                ? 'error.main'
                                : 'warning.main'
                              : 'text.disabled',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Iconify icon="solar:lock-bold" width={20} />
                        </Box>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{ mb: 0.5, minWidth: 0 }}
                          >
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {guardrail.name}
                            </Typography>
                            <Box component="span" sx={{ flexShrink: 0 }}>
                              <SeverityBadge severity={guardrail.severity} size="sm" />
                            </Box>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {guardrail.rule}
                          </Typography>
                          {guardrail.threshold > 0 && (
                            <Chip
                              label={`Threshold: ${guardrail.threshold.toLocaleString()}`}
                              size="small"
                              sx={{ mt: 1, height: 20, fontSize: 10 }}
                            />
                          )}
                        </Box>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Switch
                          checked={guardrail.enabled}
                          onChange={() => toggleGuardrail(guardrail.id)}
                          size="small"
                        />
                        <Tooltip title="Remove guardrail">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeGuardrail(guardrail.id)}
                          >
                            <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}

              {/* Summary Stats */}
              <Card sx={{ bgcolor: 'background.neutral' }}>
                <CardContent>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, textAlign: 'center' }}>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>
                        {guardrails.filter((g) => g.enabled).length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Active Guardrails
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700} color="error.main">
                        {guardrails.filter((g) => g.enabled && g.severity === 'critical').length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Critical Rules
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {guardrails.filter((g) => !g.enabled).length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Disabled
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Add Guardrail Dialog */}
      <Dialog open={newGuardrailOpen} onClose={() => setNewGuardrailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Guardrail</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Define a strict rule that the AI can never bypass
          </DialogContentText>
          <Stack spacing={2}>
            <TextField fullWidth label="Guardrail Name" placeholder="e.g., Weekend Payment Restriction" />
            <TextField fullWidth label="Rule Description" placeholder="e.g., Never approve payments on weekends" />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <TextField fullWidth type="number" label="Threshold Value" placeholder="0" />
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select defaultValue="high" label="Severity">
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setNewGuardrailOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setGuardrails((prev) => [
                ...prev,
                {
                  id: `gr-${Date.now()}`,
                  name: 'New Guardrail',
                  rule: 'Custom rule description',
                  threshold: 0,
                  enabled: true,
                  severity: 'high' as const,
                },
              ]);
              setHasChanges(true);
              setNewGuardrailOpen(false);
            }}
          >
            Add Guardrail
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
