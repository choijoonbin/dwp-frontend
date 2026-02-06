import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { RagCitationList, StatsEvidenceCard } from '../../../components/evidence';

import type { LineageStep } from '../../../components/evidence/types';

// ----------------------------------------------------------------------

interface EvidencePanelProps {
  steps: LineageStep[];
  isMobile?: boolean;
}

export function EvidencePanel({ steps, isMobile = false }: EvidencePanelProps) {
  const { t } = useTranslation('common');
  const [tab, setTab] = useState(0);

  // Collect all RAG evidence and stats evidence from all steps
  const allRagEvidence = steps.flatMap((step) => step.ragEvidence || []);
  const allStatsEvidence = steps
    .filter((step) => step.statsEvidence)
    .map((step) => ({ step: step.name, stats: step.statsEvidence! }));

  const isEmpty = allRagEvidence.length === 0 && allStatsEvidence.length === 0;

  // Mobile: Tabs
  if (isMobile) {
    return (
      <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<Iconify icon="solar:book-bookmark-bold" width={18} />}
            iconPosition="start"
            label={t('lineage.evidence.citationsTab', { count: allRagEvidence.length })}
          />
          <Tab
            icon={<Iconify icon="solar:chart-2-bold" width={18} />}
            iconPosition="start"
            label={t('lineage.evidence.statsTab', { count: allStatsEvidence.length })}
          />
        </Tabs>
        <Box sx={{ maxHeight: 400, overflow: 'auto', p: 2 }}>
          {tab === 0 && (
            <RagCitationList
              citations={allRagEvidence}
              title=""
              maxItems={0}
              onOpenSource={(source) => {
                 
                console.log('Open source:', source);
              }}
            />
          )}
          {tab === 1 && (
            <Stack spacing={2}>
              {allStatsEvidence.length > 0 ? (
                allStatsEvidence.map((item, i) => (
                  <StatsEvidenceCard
                    key={i}
                    stats={item.stats}
                    title={item.step}
                    subtitle={t('lineage.evidence.amountSigma', {
                      value: Math.abs(item.stats.zScore).toFixed(1),
                    })}
                  />
                ))
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('lineage.evidence.noStats')}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    );
  }

  // Desktop: Sticky Panel
  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
      {isEmpty ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Iconify icon="solar:shield-check-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            {t('lineage.evidence.noData')}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* RAG Citations Section */}
          {allRagEvidence.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Iconify icon="solar:book-bookmark-bold-duotone" width={20} sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('lineage.evidence.policyCitations')}
                </Typography>
                <Chip label={allRagEvidence.length} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('lineage.evidence.policyCitationsDesc')}
              </Typography>
              <RagCitationList
                citations={allRagEvidence}
                title=""
                maxItems={5}
                onOpenSource={(source) => {
                   
                  console.log('Open source:', source);
                }}
              />
              {allRagEvidence.length > 5 && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button size="small" variant="text">
                    {t('lineage.evidence.viewAllCitations', { count: allRagEvidence.length })}
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Statistical Evidence Section */}
          {allStatsEvidence.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Iconify icon="solar:chart-2-bold" width={20} sx={{ color: 'warning.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('lineage.evidence.statisticalAnalysis')}
                </Typography>
              </Stack>
              <Stack spacing={2}>
                {allStatsEvidence.map((item, i) => (
                  <StatsEvidenceCard
                    key={i}
                    stats={item.stats}
                    title={item.step}
                    subtitle={t('lineage.evidence.amountSigma', {
                      value: Math.abs(item.stats.zScore).toFixed(1),
                    })}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}
