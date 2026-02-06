import { useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { formatKeyName, formatDateTime } from '../utils';
import { RagCitationList, StatsEvidenceCard } from '../../../components/evidence';

import type { LineageStep } from '../../../components/evidence/types';

// ----------------------------------------------------------------------

interface StepDetailDrawerProps {
  step: LineageStep | null;
  open: boolean;
  onClose: () => void;
}

export function StepDetailDrawer({ step, open, onClose }: StepDetailDrawerProps) {
  const { t } = useTranslation('common');
  const [tab, setTab] = useState(0);

  if (!step) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 600 }, bgcolor: 'background.default' },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                {step.name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Label color="success" variant="soft">
                  {step.status}
                </Label>
                <Chip label={step.system} size="small" variant="outlined" />
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(step.timestamp)}
                </Typography>
              </Stack>
            </Box>
            <IconButton onClick={onClose} size="small">
              <Iconify icon="solar:close-circle-bold" width={24} />
            </IconButton>
          </Stack>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
            <Tab icon={<Iconify icon="solar:widget-bold" width={18} />} iconPosition="start" label={t('lineage.stepDrawer.metadata')} />
            <Tab icon={<Iconify icon="solar:code-bold" width={18} />} iconPosition="start" label={t('lineage.stepDrawer.rawJson')} />
            <Tab icon={<Iconify icon="solar:shield-check-bold" width={18} />} iconPosition="start" label={t('lineage.stepDrawer.evidence')} />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {/* Metadata Tab */}
          {tab === 0 && (
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('lineage.stepDrawer.stepDetails')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: 2,
                }}
              >
                {Object.entries(step.details).map(([key, value]) => (
                  <Box
                    key={key}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      border: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', textTransform: 'capitalize', display: 'block' }}
                    >
                      {formatKeyName(key)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500, mt: 0.5 }}>
                      {String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Stack>
          )}

          {/* Raw JSON Tab */}
          {tab === 1 && (
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('lineage.stepDrawer.rawEventData')}
                </Typography>
                <Button
                  size="small"
                  startIcon={<Iconify icon="solar:copy-bold" width={14} />}
                  onClick={() => {
                    if (step.rawJson) {
                      navigator.clipboard.writeText(step.rawJson);
                    }
                  }}
                >
                  {t('lineage.stepDrawer.copy')}
                </Button>
              </Stack>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: 600,
                }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {step.rawJson || t('lineage.stepDrawer.noRawData')}
                </pre>
              </Box>
            </Stack>
          )}

          {/* Evidence Tab */}
          {tab === 2 && (
            <Stack spacing={3}>
              {/* RAG Citations */}
              {step.ragEvidence && step.ragEvidence.length > 0 && (
                <Box>
                  <RagCitationList
                    citations={step.ragEvidence}
                    title={t('lineage.evidence.policyCitations')}
                    maxItems={0}
                    onOpenSource={(source) => {
                       
                      console.log('Open source:', source);
                    }}
                  />
                </Box>
              )}

              {/* Statistical Evidence */}
              {step.statsEvidence && (
                <Box>
                  <StatsEvidenceCard
                    stats={step.statsEvidence}
                    subtitle={t('lineage.evidence.amountSigma', {
                      value: Math.abs(step.statsEvidence.zScore).toFixed(1),
                    })}
                  />
                </Box>
              )}

              {/* Empty State */}
              {!step.ragEvidence && !step.statsEvidence && (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <Iconify
                    icon="solar:document-text-bold-duotone"
                    width={48}
                    sx={{ color: 'text.disabled', mb: 2 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {t('lineage.evidence.noDataForStep')}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Box>

        {/* Footer */}
        <Divider />
        <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            {t('lineage.stepDrawer.footer', { stepId: step.id, system: step.system })}
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
