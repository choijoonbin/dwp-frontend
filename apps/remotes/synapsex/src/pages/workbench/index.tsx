/**
 * 통합 워크벤치 — Master-Detail (상태 기반, 페이지 전환 없음)
 *
 * 레이아웃: 반응형 3열(Desktop 300 | flex | 350) / 단일열+탭(Tablet·Mobile).
 * 좌측 WorkbenchQueuePanel에서 케이스 클릭 시 setSelectedCaseId(id)만 호출하며,
 * 우측 WorkbenchDetailPanel이 같은 화면에서 상세 데이터를 표시(선택 전 Empty State).
 * URL: /synapse/workbench. Toolbar: [지식/정책 관리] → Dialog (페이지 이동 없음).
 * Theme: Glassmorphism (Light 0.7, Dark 0.8), 다크 모드 SK Red Glow.
 */

import type { Theme } from '@mui/material/styles';

import { useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, varAlpha } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';

import { RagPage } from '../rag';
import { PoliciesPage } from '../policies';
import { useCaseDetail } from '../cases/hooks/use-case-detail';
import { WorkbenchQueuePanel } from './components/WorkbenchQueuePanel';
import { WorkbenchDetailPanel } from './components/WorkbenchDetailPanel';
import { WorkbenchStreamPanel } from './components/WorkbenchStreamPanel';

// ----------------------------------------------------------------------
// Glass panel (Light: 0.7, Dark: 0.8 + SK Red Glow)
// ----------------------------------------------------------------------

/** theme.palette.mode 분기, 다크 모드에서 error.mainChannel(SK Red 계열) Glow */
const getGlassPanelSx = (theme: Theme): Record<string, unknown> => {
  const isDark = theme.palette.mode === 'dark';
  const alpha = isDark ? 0.8 : 0.7;
  return {
    backgroundColor: varAlpha(theme.vars.palette.background.paperChannel, alpha),
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    ...(isDark && {
      boxShadow: `0 0 24px ${varAlpha(theme.vars.palette.error.mainChannel, 0.15)}`,
    }),
  };
};

// ----------------------------------------------------------------------
// Workbench page
// ----------------------------------------------------------------------

type WorkbenchTab = 'queue' | 'detail' | 'stream';

export const WorkbenchPage = () => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileTab, setMobileTab] = useState<WorkbenchTab>('detail');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [knowledgePolicyModalOpen, setKnowledgePolicyModalOpen] = useState(false);
  const [knowledgePolicyTab, setKnowledgePolicyTab] = useState<'rag' | 'policies'>('rag');

  /** 통합 데이터 바인딩: useCaseDetail 하나로 모든 데이터 관리 */
  const { fiDocItems, targetBuzei, itemsCurrency, actionHistory, aiThoughts, isLoading: detailLoading } =
    useCaseDetail(selectedCaseId ?? undefined);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* 상단: 타이틀 "통합 워크벤치" 한 번만 노출 + [지식/정책 관리] 버튼 */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{
          flexShrink: 0,
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t('menu.workbench')}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Iconify icon="solar:book-2-bold" width={18} />}
          onClick={() => {
            setKnowledgePolicyTab('rag');
            setKnowledgePolicyModalOpen(true);
          }}
        >
          {t('workbench.tools.knowledgePolicy')}
        </Button>
      </Stack>

      {/* Tablet/Mobile: Tabs (375px 검증 — sx only) */}
      <Tabs
        value={mobileTab}
        onChange={(_, v: WorkbenchTab) => setMobileTab(v)}
        sx={{
          flexShrink: 0,
          minHeight: 40,
          borderBottom: 1,
          borderColor: 'divider',
          display: { xs: 'flex', md: 'none' },
          px: 1,
        }}
      >
        <Tab
          value="queue"
          icon={<Iconify width={18} icon="solar:clipboard-list-bold" />}
          iconPosition="start"
          label={t('workbench.tabQueue')}
        />
        <Tab
          value="detail"
          icon={<Iconify width={18} icon="solar:document-text-bold" />}
          iconPosition="start"
          label={t('workbench.tabDetail')}
        />
        <Tab
          value="stream"
          icon={<Iconify width={18} icon="solar:chat-round-dots-bold" />}
          iconPosition="start"
          label={t('workbench.tabStream')}
        />
      </Tabs>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          minHeight: 0,
          overflow: 'hidden',
          '--workbench-panel-header-height': '56px',
        }}
      >
        {/* Left: 300px — Queue */}
        <Box
          sx={{
            width: 300,
            flexShrink: 0,
            minHeight: 0,
            display: { xs: mobileTab === 'queue' ? 'flex' : 'none', md: 'block' },
            flexDirection: 'column',
          }}
        >
          <WorkbenchQueuePanel
            selectedCaseId={selectedCaseId}
            onSelectCase={setSelectedCaseId}
            getGlassPanelSx={getGlassPanelSx}
            sx={{ flex: 1, minHeight: 0 }}
          />
        </Box>

        {/* Center: flex:1 — Detail + ThoughtChain */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: { xs: mobileTab === 'detail' ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
          }}
        >
          <WorkbenchDetailPanel
            actionHistory={actionHistory}
            aiThoughts={aiThoughts}
            fiDocItems={fiDocItems}
            getGlassPanelSx={getGlassPanelSx}
            isLoading={detailLoading}
            itemsCurrency={itemsCurrency}
            selectedCaseId={selectedCaseId}
            targetBuzei={targetBuzei}
            sx={{ flex: 1, minHeight: 0 }}
          />
        </Box>

        {/* Right: 350px — Stream */}
        <Box
          sx={{
            width: 350,
            flexShrink: 0,
            minHeight: 0,
            display: { xs: mobileTab === 'stream' ? 'flex' : 'none', md: 'block' },
            flexDirection: 'column',
          }}
        >
          <WorkbenchStreamPanel getGlassPanelSx={getGlassPanelSx} sx={{ flex: 1, minHeight: 0 }} />
        </Box>
      </Box>

      {/* Functional Bridge: 지식/정책 관리 Dialog (RagView·PolicyView 탭, 페이지 이동 없음) */}
      <Dialog
        open={knowledgePolicyModalOpen}
        onClose={() => setKnowledgePolicyModalOpen(false)}
        fullScreen={isMobile}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {t('workbench.tools.knowledgePolicy')}
          <IconButton
            aria-label="close"
            onClick={() => setKnowledgePolicyModalOpen(false)}
            size="small"
          >
            <Iconify icon="solar:close-circle-bold" width={24} />
          </IconButton>
        </DialogTitle>
        <Tabs
          value={knowledgePolicyTab}
          onChange={(_, v: 'rag' | 'policies') => setKnowledgePolicyTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab value="rag" label={t('workbench.tools.rag')} />
          <Tab value="policies" label={t('workbench.tools.policies')} />
        </Tabs>
        <DialogContent dividers sx={{ p: 0, overflow: 'auto' }}>
          {knowledgePolicyTab === 'rag' && <RagPage />}
          {knowledgePolicyTab === 'policies' && <PoliciesPage />}
        </DialogContent>
      </Dialog>
    </Box>
  );
};
