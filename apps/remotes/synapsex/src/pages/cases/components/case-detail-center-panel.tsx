/**
 * Case Detail Center Panel — AI Analysis Tabs (Analysis, Agent Stream, Confidence, Similar, RAG, Action Proposals)
 */

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useStreamStore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { alpha, useTheme } from '@mui/material/styles';

import { CaseSimilarTab } from './case-similar-tab';
import { CaseAnalysisTab } from './case-analysis-tab';
import { CaseConfidenceTab } from './case-confidence-tab';
import { CaseRagEvidenceTab } from './case-rag-evidence-tab';
import { CaseAgentStreamPanel } from './case-agent-stream-panel';
import { CaseActionProposalsTab } from './case-action-proposals-tab';

import type { CaseDetailUi } from '../adapters/case-detail-adapter';
import type { FiDocItem, AiThought } from '../hooks/use-case-detail';

export type CaseDetailCenterPanelProps = {
  caseId: string | undefined;
  caseData: CaseDetailUi | null;
  centerTab: string;
  onCenterTabChange: (v: string) => void;
  latestRunId: string | null;
  streamStatus: string;
  stepProgress: { label?: string; detail?: string; percent?: number } | null;
  onStartAnalysis: () => void;
  onRetryStream: () => void;
  onCancel: () => void;
  fiDocItems?: FiDocItem[];
  targetBuzei?: string;
  /** evidenceMapJson 기반 위반 행 buzei 목록 — 좌측 전표 강조 */
  violationBuzeiList?: string[];
  /** evidenceMapJson 기반 chunkId — 우측 규정집 근거 하이라이트 */
  highlightChunkIds?: string[];
  /** evidenceMapJson.summary_verdict — 종합 판정 */
  summaryVerdict?: string;
  /** evidenceMapJson.key_grounds — 핵심 근거 */
  keyGrounds?: string[];
  aiThoughts?: AiThought[];
};

export const CaseDetailCenterPanel = ({
  caseId,
  caseData,
  centerTab,
  onCenterTabChange,
  latestRunId,
  streamStatus,
  stepProgress,
  onStartAnalysis,
  onRetryStream,
  onCancel,
  fiDocItems = [],
  targetBuzei,
  violationBuzeiList = [],
  highlightChunkIds = [],
  summaryVerdict,
  keyGrounds,
  aiThoughts = [],
}: CaseDetailCenterPanelProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const streamingThought = useStreamStore((state) => state.streamingThought);

  return (
    <Box
      sx={{
        flex: 1,
        flexShrink: { xs: 0, lg: 1 },
        minHeight: { xs: 320, lg: 0 },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
        <Tabs
          value={centerTab}
          onChange={(_, v) => onCenterTabChange(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minHeight: { xs: 40, lg: 48 } }}
        >
          <Tab
            icon={<Iconify icon="solar:brain-bold-duotone" width={18} />}
            iconPosition="start"
            label={t('caseDetail.aiAnalysis')}
            value="analysis"
          />
          <Tab
            icon={<Iconify icon="solar:play-circle-bold-duotone" width={18} />}
            iconPosition="start"
            label={t('caseDetail.agentStream')}
            value="agent-stream"
          />
          <Tab
            icon={<Iconify icon="solar:graph-up-bold-duotone" width={18} />}
            iconPosition="start"
            label={t('caseDetail.confidence')}
            value="confidence"
          />
          <Tab
            icon={<Iconify icon="solar:link-bold-duotone" width={18} />}
            iconPosition="start"
            label={t('caseDetail.similar')}
            value="similar"
          />
          <Tab
            icon={<Iconify icon="solar:shield-check-bold-duotone" width={18} />}
            iconPosition="start"
            label={t('caseDetail.rag')}
            value="policies"
          />
          <Tab
            icon={<Iconify icon="solar:shield-user-bold-duotone" width={18} />}
            iconPosition="start"
            label={t('caseDetail.actionProposals')}
            value="action-proposals"
          />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {centerTab === 'agent-stream' && caseId && (
          <CaseAgentStreamPanel
            caseId={caseId}
            events={[]}
            streamingText={stepProgress?.detail ?? ''}
            isThinking={streamStatus === 'connecting' || streamStatus === 'streaming'}
            isReconnecting={false}
            stepProgress={stepProgress}
            onStartAnalysis={onStartAnalysis}
            onRetry={onRetryStream}
            onCancel={onCancel}
            onOpenAnalysisTab={() => onCenterTabChange('analysis')}
          />
        )}

        {centerTab === 'analysis' && (
          <CaseAnalysisTab
            caseId={caseId}
            runId={latestRunId}
            enabled={centerTab === 'analysis'}
            tabKey="analysis"
            fallbackConfidence={caseData?.confidence}
            fallbackTitle={caseData?.title}
            fallbackAnomalyType={caseData?.anomalyType}
            fallbackSeverity={caseData?.severity}
            fiDocItems={fiDocItems}
            targetBuzei={targetBuzei}
            violationBuzeiList={violationBuzeiList}
            highlightChunkIds={highlightChunkIds}
            summaryVerdict={summaryVerdict}
            keyGrounds={keyGrounds}
            aiThoughts={aiThoughts}
            pendingThought={streamingThought}
          />
        )}

        {centerTab === 'confidence' && (
          <CaseConfidenceTab
            caseId={caseId}
            enabled={centerTab === 'confidence'}
            tabKey="confidence"
          />
        )}

        {centerTab === 'similar' && (
          <CaseSimilarTab
            caseId={caseId}
            enabled={centerTab === 'similar'}
            tabKey="similar"
          />
        )}

        {centerTab === 'policies' && (
          <CaseRagEvidenceTab
            caseId={caseId}
            enabled={centerTab === 'policies'}
            tabKey="policies"
          />
        )}

        {centerTab === 'action-proposals' && (
          <CaseActionProposalsTab
            caseId={caseId}
            runId={latestRunId}
            enabled={centerTab === 'action-proposals'}
            tabKey="action-proposals"
          />
        )}
      </Box>
    </Box>
  );
};
