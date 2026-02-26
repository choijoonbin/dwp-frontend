import type { Theme, SxProps } from '@mui/material/styles';

import { useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, varAlpha } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';

import { PanelHeader } from '../../workbench/components/PanelHeader';
import { StatusBadge } from '../../../components/finance/status-badge';
import { WorkbenchThoughtChain } from '../../workbench/components/WorkbenchThoughtChain';
import { WorkbenchItemDetailGrid } from '../../workbench/components/WorkbenchItemDetailGrid';
import { WorkbenchActionHistoryTimeline } from '../../workbench/components/WorkbenchActionHistoryTimeline';

import type {
  FiDocItem,
  AiThought,
  FinalReportItem,
  EvidenceLinkItem,
  ActionHistoryItem,
  LogicCheckpointItem,
} from '../../cases/hooks/use-case-detail';

type NewCaseTab = 'thought' | 'review' | 'evidence' | 'report';

export type WorkbenchNewCasePanelProps = {
  selectedCaseId?: string | null;
  title?: string;
  caseNumber?: string;
  caseStatus?: string;
  briefingInsight?: string;
  reasoningProcess?: string[];
  logicCheckpoints?: LogicCheckpointItem[];
  evidenceLinks?: EvidenceLinkItem[];
  finalReport?: FinalReportItem | null;
  aiThoughts?: AiThought[];
  actionHistory?: ActionHistoryItem[];
  fiDocItems?: FiDocItem[];
  targetBuzei?: string;
  itemsCurrency?: string;
  isLoading?: boolean;
  explanationLoading?: boolean;
  onRequestExplanation?: () => void;
  getGlassPanelSx: (theme: Theme) => Record<string, unknown>;
  sx?: SxProps<Theme>;
};

export function WorkbenchNewCasePanel({
  selectedCaseId,
  title,
  caseNumber,
  caseStatus,
  briefingInsight,
  reasoningProcess = [],
  logicCheckpoints = [],
  evidenceLinks = [],
  finalReport = null,
  aiThoughts = [],
  actionHistory = [],
  fiDocItems = [],
  targetBuzei,
  itemsCurrency,
  isLoading = false,
  explanationLoading = false,
  onRequestExplanation,
  getGlassPanelSx,
  sx,
}: WorkbenchNewCasePanelProps) {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const [tab, setTab] = useState<NewCaseTab>('thought');
  const [scrollToBuzei, setScrollToBuzei] = useState<string | null>(null);
  const firstClause = logicCheckpoints[0]?.clause?.trim();
  const contextSummary = firstClause || briefingInsight || title || t('workbench.detailHint');

  if (!selectedCaseId) {
    return (
      <Box
        sx={{
          ...getGlassPanelSx(theme),
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...sx,
        }}
      >
        <PanelHeader title={t('workbench.detailTitle')} />
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={2}
          sx={{
            flex: 1,
            p: 3,
            bgcolor: varAlpha(theme.vars.palette.background.defaultChannel, 0.35),
          }}
        >
          <Iconify icon="solar:cursor-square-bold" width={52} sx={{ color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            {t('workbench.detailSelectCase')}
          </Typography>
        </Stack>
      </Box>
    );
  }

  const reportSummary = finalReport?.summary ?? finalReport?.verdict ?? '';

  return (
    <Box
      sx={{
        ...getGlassPanelSx(theme),
        minHeight: 0,
        height: '100%',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...sx,
      }}
    >
      <PanelHeader title={t('workbench.detailTitle')}>
        {caseStatus ? <StatusBadge status={caseStatus} size="sm" showIcon /> : null}
      </PanelHeader>

      <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="body2" noWrap>
          <Box component="span" sx={{ fontWeight: 700 }}>
            {caseNumber ?? selectedCaseId}
          </Box>
          <Box component="span" sx={{ color: 'text.secondary', mx: 1 }}>
            ·
          </Box>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {contextSummary}
          </Box>
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value: NewCaseTab) => setTab(value)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          minHeight: 44,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTabs-scroller': {
            overflowX: 'auto !important',
            overflowY: 'hidden !important',
          },
          '& .MuiTab-root': {
            minHeight: 44,
            minWidth: 108,
            fontSize: '0.8rem',
            textTransform: 'none',
            whiteSpace: 'nowrap',
          },
        }}
      >
        <Tab value="thought" label={t('workbench.rightTabThoughtProcess')} />
        <Tab value="review" label={t('workbench.rightTabReviewLogic')} />
        <Tab value="evidence" label={t('workbench.rightTabEvidenceMap')} />
        <Tab value="report" label={t('workbench.rightTabAnalysisReport')} />
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary">
            {t('workbench.detailLoading', 'Loading AI thought chain for this case...')}
          </Typography>
        ) : null}

        {!isLoading && tab === 'thought' && (
          <Stack spacing={2}>
            {briefingInsight ? (
              <Alert severity="info">{briefingInsight}</Alert>
            ) : null}
            {aiThoughts.length > 0 ? (
              <WorkbenchThoughtChain thoughts={aiThoughts} />
            ) : reasoningProcess.length > 0 ? (
              reasoningProcess.map((line, idx) => (
                <Typography key={`${idx}-${line}`} variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {line}
                </Typography>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('workbench.detailHint')}
              </Typography>
            )}
          </Stack>
        )}

        {!isLoading && tab === 'review' && (
          <Stack spacing={1}>
            {logicCheckpoints.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('workbench.reviewLogicEmpty')}
              </Typography>
            ) : (
              logicCheckpoints.map((item, idx) => (
                <Card key={`${item.clause}-${idx}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {item.clause}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {item.description || '-'}
                  </Typography>
                  <Chip
                    size="small"
                    sx={{ mt: 1 }}
                    color={item.status === 'violation' ? 'error' : 'success'}
                    label={item.status === 'violation' ? t('workbench.reviewViolation') : t('workbench.reviewCompliant')}
                  />
                </Card>
              ))
            )}
          </Stack>
        )}

        {!isLoading && tab === 'evidence' && (
          <Stack spacing={2}>
            <Stack spacing={1}>
              {evidenceLinks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('workbench.evidenceMapEmpty')}
                </Typography>
              ) : (
                evidenceLinks.map((link, idx) => {
                  const buzei = fiDocItems[link.itemIdx]?.buzei ?? String(link.itemIdx + 1).padStart(3, '0');
                  return (
                    <Card
                      key={`ev-${idx}`}
                      variant="outlined"
                      onClick={() => setScrollToBuzei(buzei)}
                      sx={{
                        p: 1.25,
                        cursor: 'pointer',
                        borderColor: 'error.main',
                        bgcolor: alpha(theme.palette.error.main, 0.05),
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {t('workbench.itemDetail.buzei')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {buzei}
                      </Typography>
                      {link.reason ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {link.reason}
                        </Typography>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </Stack>
            <Divider />
            <WorkbenchItemDetailGrid
              items={fiDocItems}
              currency={itemsCurrency}
              targetBuzei={targetBuzei}
              scrollToBuzei={scrollToBuzei}
              onClearScrollToBuzei={() => setScrollToBuzei(null)}
            />
          </Stack>
        )}

        {!isLoading && tab === 'report' && (
          <Stack spacing={2}>
            {reportSummary ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {reportSummary}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('workbench.detailLoading')}
              </Typography>
            )}

            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:letter-bold-duotone" width={18} />}
              disabled={!selectedCaseId || explanationLoading}
              onClick={onRequestExplanation}
            >
              {explanationLoading ? t('caseDetail.explanationRequestSending') : t('caseDetail.requestExplanation')}
            </Button>

            <Divider />
            <WorkbenchActionHistoryTimeline items={actionHistory} />
          </Stack>
        )}
      </Box>
    </Box>
  );
}
