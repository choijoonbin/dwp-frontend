/**
 * Batch Commander — 우측 패널 4탭 구조
 * BE 구조화 DTO: reasoningProcess | logicCheckpoints | evidenceLinks | finalReport 직접 바인딩
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { useState, useCallback } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { PanelHeader } from './PanelHeader';
import { WorkbenchStreamPanel } from './WorkbenchStreamPanel';

import type { FiDocItem } from '../../cases/hooks/use-case-detail';
import type { LogicCheckpointItem, EvidenceLinkItem, FinalReportItem } from '../../cases/hooks/use-case-detail';

export type WorkbenchRightPanelProps = {
  getGlassPanelSx: (theme: Theme) => Record<string, unknown>;
  selectedCaseId: string | null;
  /** Aura 브리핑 인사이트 — [사고 과정] 탭 최상단 '에이전트 총평' 섹션에 강조 표시 */
  briefingInsight?: string;
  /** [사고 과정] BE reasoningProcess — 정제된 추론 문장 배열 */
  reasoningProcess?: string[];
  /** [검토 로직] BE logicCheckpoints */
  logicCheckpoints?: LogicCheckpointItem[];
  /** [증거 맵] BE evidenceLinks — itemIdx 클릭 시 그리드 해당 행으로 스크롤 */
  evidenceLinks?: EvidenceLinkItem[];
  /** [분석 리포트] BE finalReport */
  finalReport?: FinalReportItem | null;
  fiDocItems?: FiDocItem[];
  onRequestExplanation?: (caseId: string) => void;
  /** evidenceLinks 카드 클릭 시 itemIdx(0-based) 전달 → 중앙 그리드 해당 data-row-id로 Smooth Scroll */
  onEvidenceCardClickByItemIdx?: (itemIdx: number) => void;
  explanationLoading?: boolean;
  orbVariant?: 'thinking' | 'risk';
  sx?: SxProps<Theme>;
};

type RightTab = 'thought' | 'review' | 'evidence' | 'report';

/** 우측 패널 기본 활성 탭: 사고 과정(reasoning-process) — Aura 브리핑이 먼저 보이도록 */
const DEFAULT_RIGHT_TAB: RightTab = 'thought';

export const WorkbenchRightPanel = ({
  getGlassPanelSx,
  selectedCaseId,
  briefingInsight,
  reasoningProcess = [],
  logicCheckpoints = [],
  evidenceLinks = [],
  finalReport = null,
  fiDocItems = [],
  onRequestExplanation,
  onEvidenceCardClickByItemIdx,
  explanationLoading = false,
  orbVariant = 'thinking',
  sx,
}: WorkbenchRightPanelProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const [tab, setTab] = useState<RightTab>(DEFAULT_RIGHT_TAB);

  const handleRequestExplanation = useCallback(() => {
    if (selectedCaseId && onRequestExplanation) onRequestExplanation(selectedCaseId);
  }, [selectedCaseId, onRequestExplanation]);

  const reportSummary = finalReport?.summary ?? finalReport?.verdict ?? '';
  const showClarificationButton = Boolean(finalReport?.requestClarificationEnabled !== false && reportSummary);

  return (
    <Box
      sx={{
        ...getGlassPanelSx(theme),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 0,
        borderLeft: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        ...sx,
      }}
    >
      <PanelHeader
        sx={{
          height: 56,
          minHeight: 56,
          width: '100%',
          overflow: 'hidden',
          px: 0,
          '& .MuiTabs-root': { height: 56, minHeight: 56, flex: 1, width: '100%', minWidth: 0 },
          '& .MuiTabs-flexContainer': { height: 56, width: '100%', justifyContent: 'stretch' },
          '& .MuiTab-root': {
            height: 56,
            minHeight: 56,
            flex: '1 1 0%',
            minWidth: 0,
            maxWidth: 'none',
            py: 0,
            px: 0.25,
            whiteSpace: 'normal',
            lineHeight: 1.2,
            fontSize: '0.75rem',
            textTransform: 'none',
            '& .MuiTab-iconWrapper': { marginRight: 0.25 },
          },
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v: RightTab) => setTab(v)}
          variant="fullWidth"
          sx={{
            height: 56,
            minHeight: 56,
            width: '100%',
            borderBottom: 0,
            bgcolor: 'transparent',
            '& .MuiTabs-indicator': { display: 'block' },
            '& .MuiTabs-flexContainer': { gap: 0, height: 56 },
            '& .MuiTab-root': { height: 56, minHeight: 56 },
          }}
        >
          <Tab value="thought" label={t('workbench.rightTabThoughtProcess')} icon={<Iconify icon="solar:chat-round-dots-bold" width={16} />} iconPosition="start" />
          <Tab value="review" label={t('workbench.rightTabReviewLogic')} icon={<Iconify icon="solar:document-text-bold-duotone" width={16} />} iconPosition="start" />
          <Tab value="evidence" label={t('workbench.rightTabEvidenceMap')} icon={<Iconify icon="solar:map-point-bold-duotone" width={16} />} iconPosition="start" />
          <Tab value="report" label={t('workbench.rightTabAnalysisReport')} icon={<Iconify icon="solar:clipboard-check-bold-duotone" width={16} />} iconPosition="start" />
        </Tabs>
      </PanelHeader>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'thought' && (
          <>
            {reasoningProcess.length > 0 || briefingInsight ? (
              <Box sx={{ flex: 1, overflow: 'auto', p: 2, backgroundImage: `radial-gradient(circle at 1px 1px, ${theme.palette.divider} 1px, transparent 0)`, backgroundSize: '12px 12px' }}>
                <Stack spacing={2}>
                  {briefingInsight ? (
                    <Card
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        borderColor: alpha(theme.palette.primary.main, 0.35),
                        borderWidth: 1,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Iconify icon="solar:chat-round-dots-bold-duotone" width={20} sx={{ color: 'primary.main' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.dark' }}>
                          {t('workbench.agentSummaryLabel')}
                        </Typography>
                      </Stack>
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontWeight: 500 }}>
                        {briefingInsight}
                      </Typography>
                    </Card>
                  ) : null}
                  {reasoningProcess.length > 0 ? (
                    <>
                      {reasoningProcess.map((line, i) => (
                        <Typography key={i} variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{line}</Typography>
                      ))}
                    </>
                  ) : null}
                </Stack>
              </Box>
            ) : (
              <WorkbenchStreamPanel
                getGlassPanelSx={() => ({})}
                orbVariant={orbVariant}
                selectedCaseId={selectedCaseId}
                sx={{ flex: 1, border: 0, boxShadow: 'none' }}
              />
            )}
          </>
        )}
        {tab === 'review' && (
          <Box sx={{ p: 2, overflow: 'auto' }}>
            {logicCheckpoints.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                {t('workbench.reviewLogicEmpty')}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {logicCheckpoints.map((item, i) => (
                  <Card key={i} variant="outlined" sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                      {item.clause}
                      {item.description && ` — ${item.description}`}
                      {' — ['}{item.status === 'violation' ? t('workbench.reviewViolation') : t('workbench.reviewCompliant')}]
                    </Typography>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>
        )}
        {tab === 'evidence' && (
          <Box sx={{ p: 2, overflow: 'auto' }}>
            {evidenceLinks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                {t('workbench.evidenceMapEmpty')}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {evidenceLinks.map((link, i) => {
                  const buzei = fiDocItems[link.itemIdx]?.buzei ?? String(link.itemIdx + 1).padStart(3, '0');
                  return (
                    <Card
                      key={i}
                      variant="outlined"
                      onClick={() => onEvidenceCardClickByItemIdx?.(link.itemIdx)}
                      sx={{
                        p: 1.5,
                        bgcolor: alpha(theme.palette.error.main, 0.06),
                        borderColor: 'error.main',
                        cursor: onEvidenceCardClickByItemIdx ? 'pointer' : undefined,
                        '&:hover': onEvidenceCardClickByItemIdx ? { bgcolor: alpha(theme.palette.error.main, 0.12) } : undefined,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">{t('workbench.itemDetail.buzei')}</Typography>
                      <Typography variant="body2" fontWeight={600}>{buzei}</Typography>
                      {link.reason && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{link.reason}</Typography>}
                      {link.severity && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{link.severity}</Typography>}
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}
        {tab === 'report' && (
          <Box sx={{ p: 2, overflow: 'auto' }}>
            {reportSummary ? (
              <Stack spacing={2}>
                <Card sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{reportSummary}</Typography>
                </Card>
                {showClarificationButton && (
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={explanationLoading || !selectedCaseId}
                    onClick={handleRequestExplanation}
                    startIcon={<Iconify icon="solar:letter-bold-duotone" width={18} />}
                  >
                    {explanationLoading ? t('caseDetail.explanationRequestSending') : t('caseDetail.requestExplanation')}
                  </Button>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                {t('workbench.detailLoading')}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};
