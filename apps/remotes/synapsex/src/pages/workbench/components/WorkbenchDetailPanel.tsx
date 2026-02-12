/**
 * Workbench Detail — 탭: 추론/이력/상세 내역
 * 추론: ThoughtChain | 이력: agent_case_action_history 타임라인 | 상세 내역: fi_doc_item 그리드
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useRef, useMemo, useState, useEffect } from 'react';
import { Iconify, varAlpha } from '@dwp-frontend/design-system';
import { useWorkbenchReactiveStore } from '@dwp-frontend/shared-utils';
import { useAuraStore } from '@dwp-frontend/shared-utils/aura/use-aura-store';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { WorkbenchThoughtChain } from './WorkbenchThoughtChain';
import { WorkbenchItemDetailGrid } from './WorkbenchItemDetailGrid';
import { WorkbenchActionHistoryTimeline } from './WorkbenchActionHistoryTimeline';

import type { FiDocItem, AiThought, ActionHistoryItem } from '../../cases/hooks/use-case-detail';

export type WorkbenchDetailPanelProps = {
  selectedCaseId?: string | null;
  /** AI 추론 과정 (BE: aiThoughts[] 또는 reasoning.thoughts[]) */
  aiThoughts?: AiThought[];
  /** 조치 이력 (BE: actionHistory[] 또는 agent_case_action_history[]) */
  actionHistory?: ActionHistoryItem[];
  /** fi_doc_item — 상세 내역 그리드 */
  fiDocItems?: FiDocItem[];
  targetBuzei?: string;
  itemsCurrency?: string;
  /** useCaseDetail 로딩 중 여부 */
  isLoading?: boolean;
  getGlassPanelSx: (theme: Theme) => Record<string, unknown>;
  sx?: SxProps<Theme>;
};

type DetailTab = 'inference' | 'history' | 'item-detail';

export const WorkbenchDetailPanel = ({
  selectedCaseId,
  aiThoughts = [],
  actionHistory = [],
  fiDocItems = [],
  targetBuzei,
  itemsCurrency,
  isLoading = false,
  getGlassPanelSx,
  sx,
}: WorkbenchDetailPanelProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const [detailTab, setDetailTab] = useState<DetailTab>('inference');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentThoughtStreamCaseId = useWorkbenchReactiveStore((s) => s.currentThoughtStreamCaseId);
  const thoughtChains = useAuraStore((s) => s.thoughtChains);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo(0, 0);
  }, [selectedCaseId]);

  /** THOUGHT_STREAM WebSocket으로 수신한 라이브 thought가 현재 상세 케이스와 일치하면 우선 표시 */
  const { displayThoughts, isStreamingThoughts } = useMemo(() => {
    const match = selectedCaseId != null && currentThoughtStreamCaseId === selectedCaseId && thoughtChains.length > 0;
    if (match) {
      const thoughts: AiThought[] = thoughtChains.map((chain, i) => ({
        id: chain.id,
        step: i + 1,
        type: chain.type,
        content: chain.content,
        timestamp: chain.timestamp?.toISOString?.(),
      }));
      return { displayThoughts: thoughts, isStreamingThoughts: true };
    }
    return { displayThoughts: aiThoughts, isStreamingThoughts: false };
  }, [aiThoughts, currentThoughtStreamCaseId, selectedCaseId, thoughtChains]);

  const showEmptyState = selectedCaseId == null;
  const showLoadingSkeleton = Boolean(selectedCaseId && isLoading);

  return (
    <Box
      sx={{
        ...getGlassPanelSx(theme),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        borderRadius: 0,
        ...sx,
      }}
    >
      <Box
        sx={{
          height: 'var(--workbench-panel-header-height, 56px)',
          minHeight: 'var(--workbench-panel-header-height, 56px)',
          pt: 0,
          px: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {t('workbench.detailTitle')}
        </Typography>
      </Box>

      {showEmptyState ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={2}
          sx={{
            flex: 1,
            minHeight: 0,
            p: 3,
            bgcolor: varAlpha(theme.vars.palette.background.defaultChannel, 0.4),
          }}
        >
          <Iconify
            icon="solar:cursor-square-bold"
            width={56}
            sx={{ color: 'text.disabled' }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 280 }}>
            {t('workbench.detailSelectCase')}
          </Typography>
        </Stack>
      ) : (
        <>
          <Tabs
            value={detailTab}
            onChange={(_, v: DetailTab) => setDetailTab(v)}
            variant="fullWidth"
            sx={{
              flexShrink: 0,
              minHeight: 40,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              '& .MuiTab-root': { minHeight: 40 },
            }}
          >
            <Tab
              value="inference"
              label={t('workbench.detailTabInference')}
              icon={<Iconify icon="solar:brain-bold-duotone" width={18} />}
              iconPosition="start"
            />
            <Tab
              value="history"
              label={t('workbench.detailTabHistory')}
              icon={<Iconify icon="solar:history-bold-duotone" width={18} />}
              iconPosition="start"
            />
            <Tab
              value="item-detail"
              label={t('workbench.detailTabItemDetail')}
              icon={<Iconify icon="solar:document-text-bold-duotone" width={18} />}
              iconPosition="start"
            />
          </Tabs>

          <Box
            ref={scrollContainerRef}
            sx={{
              flex: 1,
              overflow: 'auto',
              minHeight: 0,
              p: 2,
              bgcolor: varAlpha(theme.vars.palette.background.defaultChannel, 0.4),
            }}
          >
            {showLoadingSkeleton ? (
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Skeleton variant="rounded" height={80} animation="wave" />
                <Skeleton variant="rounded" height={80} animation="wave" />
                <Skeleton variant="rounded" height={80} animation="wave" />
                <Skeleton variant="rounded" height={120} animation="wave" />
              </Stack>
            ) : (
              <>
                {detailTab === 'inference' && (
                  <>
                    {displayThoughts.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                        {t('workbench.detailLoading', 'Loading AI thought chain for this case...')}
                      </Typography>
                    ) : (
                      <WorkbenchThoughtChain
                        thoughts={displayThoughts}
                        isStreamingLast={isStreamingThoughts}
                      />
                    )}
                  </>
                )}
                {detailTab === 'history' && (
                  <WorkbenchActionHistoryTimeline items={actionHistory} />
                )}
                {detailTab === 'item-detail' && (
                  <WorkbenchItemDetailGrid
                    items={fiDocItems}
                    currency={itemsCurrency}
                    targetBuzei={targetBuzei}
                  />
                )}
              </>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};
