import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';

// ----------------------------------------------------------------------

const models = [
  { key: 'gpt-4o', label: 'GPT-4o' },
  { key: 'gpt-4.1', label: 'GPT-4.1' },
  { key: 'claude-3.5', label: 'Claude 3.5' },
  { key: 'azure-openai', label: 'Azure OpenAI (Enterprise)' },
];

const toolToggles = [
  { key: 'sap_hold_payment', label: 'SAP: Set Payment Block' },
  { key: 'sap_release_payment', label: 'SAP: Release Payment Block' },
  { key: 'sap_reverse_doc', label: 'SAP: Reversal / Credit Memo' },
  { key: 'notify_email', label: 'Notify: Email' },
  { key: 'notify_slack', label: 'Notify: Slack / Teams' },
  { key: 'create_case', label: 'Ops: Create Case' },
];

const promptTemplates = [
  {
    name: 'case_triage_v1',
    purpose: 'Convert raw signals into an explainable case summary with citations',
    updatedAt: '2026-02-01T08:40:00Z',
  },
  {
    name: 'action_planner_v1',
    purpose: 'Generate safe, guardrail-aware action proposals',
    updatedAt: '2026-02-01T08:45:00Z',
  },
  {
    name: 'reconciliation_explainer_v1',
    purpose: 'Write audit-ready reconciliation narratives',
    updatedAt: '2026-02-01T08:52:00Z',
  },
];

// ----------------------------------------------------------------------

export const AgentConfigPage = () => {
  const { t } = useTranslation('common');
  const [model, setModel] = useState(models[0].key);
  const [temperature, setTemperature] = useState('0.2');
  const [maxTokens, setMaxTokens] = useState('2048');
  const [tools, setTools] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(toolToggles.map((item) => [item.key, item.key !== 'sap_reverse_doc']))
  );

  const [selectedTemplate, setSelectedTemplate] = useState(promptTemplates[0].name);
  const [tabValue, setTabValue] = useState(0);

  const template = useMemo(
    () => promptTemplates.find((p) => p.name === selectedTemplate) ?? promptTemplates[0],
    [selectedTemplate]
  );

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Page Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:robot-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('agentConfig.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('agentConfig.subtitle')}
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Iconify icon="solar:diskette-bold" width={18} />}>
            {t('agentConfig.saveDraft')}
          </Button>
        </Stack>

        {/* Tabs */}
        <Card variant="outlined">
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab
              icon={<Iconify icon="solar:magic-stick-bold-duotone" width={18} />}
              iconPosition="start"
              label={t('agentConfig.model')}
              sx={{ minHeight: 64 }}
            />
            <Tab
              icon={<Iconify icon="solar:document-text-bold-duotone" width={18} />}
              iconPosition="start"
              label={t('agentConfig.prompts')}
              sx={{ minHeight: 64 }}
            />
            <Tab
              icon={<Iconify icon="solar:wrench-bold-duotone" width={18} />}
              iconPosition="start"
              label={t('agentConfig.tools')}
              sx={{ minHeight: 64 }}
            />
          </Tabs>

          {/* Model Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 3 }}>
              <Stack spacing={3} direction={{ xs: 'column', lg: 'row' }} sx={{ alignItems: 'stretch' }}>
                <Card variant="outlined" sx={{ flex: { lg: '2 1 0%' } }}>
                  <CardHeader
                    title={t('agentConfig.modelSettings')}
                    subheader={t('agentConfig.modelSettingsDesc')}
                  />
                  <CardContent>
                    <Stack spacing={3}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <FormControl fullWidth>
                          <InputLabel>{t('agentConfig.providerModel')}</InputLabel>
                          <Select value={model} onChange={(e) => setModel(e.target.value)} label={t('agentConfig.providerModel')}>
                            {models.map((m) => (
                              <MenuItem key={m.key} value={m.key}>
                                {m.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label={t('agentConfig.temperature')}
                          value={temperature}
                          onChange={(e) => setTemperature(e.target.value)}
                          fullWidth
                        />
                        <TextField
                          label={t('agentConfig.maxTokens')}
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(e.target.value)}
                          fullWidth
                        />
                      </Stack>

                      <Divider />

                      <Box>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t('agentConfig.runtimeGuardrails')}
                          </Typography>
                          <Chip
                            icon={<Iconify icon="solar:git-branch-bold" width={16} />}
                            label={t('agentConfig.versioned')}
                            variant="outlined"
                            size="small"
                          />
                        </Stack>
                        <Box component="ul" sx={{ m: 0, pl: 3, '& li': { mb: 0.5 } }}>
                          <Typography component="li" variant="body2" color="text.secondary">
                            {t('agentConfig.runtimeGuardrail1')}
                          </Typography>
                          <Typography component="li" variant="body2" color="text.secondary">
                            {t('agentConfig.runtimeGuardrail2')}
                          </Typography>
                          <Typography component="li" variant="body2" color="text.secondary">
                            {t('agentConfig.runtimeGuardrail3')}
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ flex: { lg: '1 1 0%' } }}>
                  <CardHeader title={t('agentConfig.deployHistory')} subheader={t('agentConfig.deployHistoryDesc')} />
                  <CardContent>
                    <Stack spacing={2}>
                      {['v1.0.0', 'v1.0.1', 'v1.1.0'].map((v, idx) => (
                        <Box
                          key={v}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: idx === 0 ? 'success.lighter' : 'background.paper',
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {v}
                            </Typography>
                            <Chip
                              label={idx === 0 ? t('agentConfig.active') : t('agentConfig.archived')}
                              color={idx === 0 ? 'success' : 'default'}
                              variant="outlined"
                              size="small"
                            />
                          </Stack>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Iconify icon="solar:history-bold" width={14} sx={{ color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {idx === 0 ? t('agentConfig.deployedAgo') : t('agentConfig.deployedLastWeek')}
                            </Typography>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Box>
          </TabPanel>

          {/* Prompts Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 3 }}>
              <Stack spacing={3} direction={{ xs: 'column', lg: 'row' }} sx={{ alignItems: 'stretch' }}>
                <Card variant="outlined" sx={{ flex: { lg: '1 1 0%' } }}>
                  <CardHeader title={t('agentConfig.promptTemplates')} subheader={t('agentConfig.promptTemplatesDesc')} />
                  <CardContent>
                    <Stack spacing={1.5}>
                      {promptTemplates.map((p) => (
                        <Button
                          key={p.name}
                          onClick={() => setSelectedTemplate(p.name)}
                          variant={selectedTemplate === p.name ? 'contained' : 'outlined'}
                          sx={{
                            p: 1.5,
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            alignItems: 'flex-start',
                            textTransform: 'none',
                            bgcolor: selectedTemplate === p.name ? 'primary.lighter' : 'transparent',
                            borderColor: selectedTemplate === p.name ? 'primary.main' : 'divider',
                            '&:hover': {
                              bgcolor: selectedTemplate === p.name ? 'primary.lighter' : 'action.hover',
                            },
                          }}
                        >
                          <Box sx={{ width: '100%' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {p.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {t(`agentConfig.promptPurposes.${p.name}`)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: '0.7rem' }}>
                              Updated {new Date(p.updatedAt).toLocaleString()}
                            </Typography>
                          </Box>
                        </Button>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ flex: { lg: '2 1 0%' } }}>
                  <CardHeader
                    title={t('agentConfig.editTemplate', { name: template.name })}
                    subheader={t(`agentConfig.promptPurposes.${template.name}`)}
                  />
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="caption" color="text.secondary">
                        {t('agentConfig.template')}
                      </Typography>
                      <TextField
                        multiline
                        rows={14}
                        defaultValue={`SYSTEM: You are a safe enterprise finance agent.\n\nINPUT: {case_json} {rag_snippets}\n\nTASK: Produce (1) summary, (2) evidence table, (3) proposed actions with guardrail checks.\n\nOUTPUT JSON: {summary, evidence[], actions[], citations[]}`}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                          },
                        }}
                      />
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Chip
                          icon={<Iconify icon="solar:document-text-bold" width={14} />}
                          label={t('agentConfig.explainable')}
                          variant="outlined"
                          size="small"
                        />
                        <Stack direction="row" spacing={1}>
                          <Button variant="outlined">{t('agentConfig.runDryTest')}</Button>
                          <Button variant="contained">{t('agentConfig.saveTemplate')}</Button>
                        </Stack>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Box>
          </TabPanel>

          {/* Tools Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 3 }}>
              <Card variant="outlined">
                <CardHeader
                  title={t('agentConfig.toolPermissions')}
                  subheader={t('agentConfig.toolPermissionsDesc')}
                />
                <CardContent>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                        gap: 2,
                      }}
                    >
                      {toolToggles.map((tool) => (
<Box
                        key={tool.key}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {t(`agentConfig.toolLabels.${tool.key}`)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('agentConfig.loggedReconcilable')}
                            </Typography>
                          </Box>
                          <Switch
                            checked={!!tools[tool.key]}
                            onChange={(e) => setTools((prev) => ({ ...prev, [tool.key]: e.target.checked }))}
                          />
                        </Box>
                      ))}
                    </Box>

                    <Divider />

                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {t('agentConfig.sodTip')}
                      </Typography>
                      <Chip
                        icon={<Iconify icon="solar:wrench-bold" width={14} />}
                        label={t('agentConfig.guardrailAware')}
                        variant="outlined"
                        size="small"
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </TabPanel>
        </Card>
      </Stack>
    </Box>
  );
};

// TabPanel helper component
function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ width: '100%' }}>
      {value === index && children}
    </Box>
  );
}
