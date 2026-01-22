// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { Iconify } from 'src/components/iconify';

import { ChatPanel } from './components/chat-panel';
import { useAiWorkspace } from './hooks/use-ai-workspace';
import { WorkspaceTabs } from './components/workspace-tabs';
import { StreamDebugPanel } from '../../components/dev/stream-debug-panel';
import { ContextualBridge } from '../../components/aura/contextual-bridge';
import { LiveExecutionLog } from '../../components/aura/live-execution-log';
import { CheckpointApproval } from '../../components/aura/checkpoint-approval';

// ----------------------------------------------------------------------

export default function Page() {
  const {
    scrollRef,
    messages,
    isStreaming,
    isThinking,
    pendingHitl,
    timelineSteps,
    actionExecutions,
    currentStepIndex,
    thoughtChains,
    planSteps,
    executionLogs,
    contextSnapshot,
    prompt,
    setPrompt,
    streamingText,
    activeTab,
    setActiveTab,
    handleSend,
    handleCancel,
    handleRetry,
    handleApproveHitl,
    handleRejectHitl,
    handleEditHitl,
    handleApprovePlanStep,
    handleSkipPlanStep,
    handleReorderPlanSteps,
    handleReturn,
    updatePlanStep,
  } = useAiWorkspace();

  const [mobileView, setMobileView] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const logOffset = logOpen ? 200 : 44;

  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isSmUp;
  const isTablet = isSmUp && !isMdUp;

  useEffect(() => {
    if (!isMdUp) {
      setContextOpen(false);
      setDebugOpen(false);
    }
  }, [isMdUp]);

  const showContextToggle = Boolean(contextSnapshot);
  const showDebugToggle = process.env.NODE_ENV !== 'production';
  const showContextSidebar = showContextToggle && contextOpen && isMdUp;
  const showContextDrawer = showContextToggle && contextOpen && !isMdUp;
  const showDebugSidebar = showDebugToggle && debugOpen && isMdUp;
  const showDebugDrawer = showDebugToggle && debugOpen && !isMdUp;
  const showRightSidebar = showContextSidebar || showDebugSidebar;
  const showChatPanel = isMdUp || isTablet || (isMobile && mobileView === 0);
  const showWorkspacePanel = isMdUp || isTablet || (isMobile && mobileView === 1);

  return (
    <>
      {pendingHitl && (
        <CheckpointApproval
          request={pendingHitl}
          onApprove={handleApproveHitl}
          onReject={handleRejectHitl}
          onEdit={handleEditHitl}
        />
      )}

      <Box
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          height: {
            xs: 'calc(100dvh - var(--layout-header-mobile-height))',
            md: 'calc(100dvh - var(--layout-header-desktop-height))',
          },
          '--ai-workspace-header-height': { xs: '56px', md: '64px' },
          bgcolor: 'background.default',
          position: 'relative',
          overflow: 'hidden',
          pr: { md: showRightSidebar ? '320px' : 0 },
          transition: 'padding-right 0.3s',
          pb: `${logOffset}px`,
        }}
      >
        {showContextSidebar && (
          <ContextualBridge snapshot={contextSnapshot} onClose={() => setContextOpen(false)} />
        )}

        {showDebugSidebar && <StreamDebugPanel variant="sidebar" onClose={() => setDebugOpen(false)} />}


        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              px: { xs: 2, md: 2.5 },
              py: 1.5,
              minHeight: 'var(--ai-workspace-header-height)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
              sx={{ width: '100%' }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:magic-stick-3-bold" width={20} />
                <Typography variant="h6">Aura AI Workspace</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
                {showContextToggle && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setContextOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          setDebugOpen(false);
                        }
                        return next;
                      });
                    }}
                    startIcon={<Iconify icon="solar:window-frame-bold" width={16} />}
                  >
                    컨텍스트
                  </Button>
                )}
                {showDebugToggle && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setDebugOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          setContextOpen(false);
                        }
                        return next;
                      });
                    }}
                    startIcon={<Iconify icon="solar:bug-bold" width={16} />}
                  >
                    SSE 디버그
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleReturn}
                  startIcon={<Iconify icon="solar:arrow-left-bold" width={16} />}
                >
                  돌아가기
                </Button>
              </Stack>
            </Stack>
          </Box>
          {isMobile && (
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tabs value={mobileView} onChange={(_, next) => setMobileView(next)} variant="fullWidth">
                <Tab
                  label="대화"
                  icon={<Iconify icon="solar:chat-round-line-duotone" width={16} />}
                  iconPosition="start"
                />
                <Tab
                  label="워크스페이스"
                  icon={<Iconify icon="solar:widget-bold" width={16} />}
                  iconPosition="start"
                />
              </Tabs>
            </Box>
          )}

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: isMdUp ? 'minmax(0, 0.42fr) minmax(0, 0.58fr)' : '1fr',
              gridTemplateRows: isMdUp ? '1fr' : isTablet ? 'minmax(0, 0.48fr) minmax(0, 0.52fr)' : '1fr',
            }}
          >
            {showChatPanel && (
              <Box
                sx={{
                  borderRight: isMdUp ? '1px solid' : 'none',
                  borderBottom: isTablet ? '1px solid' : 'none',
                  borderColor: 'divider',
                  minHeight: 0,
                  bgcolor: 'background.paper',
                }}
              >
                <ChatPanel
                  title="Aura AI Workspace"
                  pendingHitl={pendingHitl}
                  messages={messages}
                  isThinking={isThinking}
                  isStreaming={isStreaming}
                  streamingText={streamingText}
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  onSend={handleSend}
                  onReturn={handleReturn}
                  onRetry={handleRetry}
                  onCancel={handleCancel}
                  scrollRef={scrollRef}
                  showHeader={false}
                  showContextToggle={showContextToggle}
                  onToggleContext={() => {
                    setContextOpen((prev) => {
                      const next = !prev;
                      if (next) {
                        setDebugOpen(false);
                      }
                      return next;
                    });
                  }}
                />
              </Box>
            )}

            {showWorkspacePanel && (
              <Box sx={{ minHeight: 0, bgcolor: 'background.neutral' }}>
                <WorkspaceTabs
                  value={activeTab}
                  onChange={setActiveTab}
                  thoughtChains={thoughtChains}
                  timelineSteps={timelineSteps}
                  currentStepIndex={currentStepIndex}
                  planSteps={planSteps}
                  actionExecutions={actionExecutions}
                  messages={messages}
                  onReorderPlanSteps={handleReorderPlanSteps}
                  onUpdatePlanStep={updatePlanStep}
                  onApprovePlanStep={handleApprovePlanStep}
                  onSkipPlanStep={handleSkipPlanStep}
                  isCompact={!isMdUp}
                />
              </Box>
            )}
          </Box>
        </Box>

        <Drawer
          anchor="bottom"
          open={showContextDrawer}
          onClose={() => setContextOpen(false)}
          PaperProps={{
            sx: {
              height: { xs: '70dvh', sm: '60dvh' },
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflow: 'hidden',
            },
          }}
        >
          <ContextualBridge snapshot={contextSnapshot} onClose={() => setContextOpen(false)} variant="embedded" />
        </Drawer>

        <Drawer
          anchor="right"
          open={showDebugDrawer}
          onClose={() => setDebugOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: 360 },
              maxWidth: 420,
            },
          }}
        >
          <StreamDebugPanel variant="embedded" onClose={() => setDebugOpen(false)} />
        </Drawer>
      </Box>

      <LiveExecutionLog
        logs={executionLogs}
        isOpen={logOpen}
        onToggle={() => setLogOpen(!logOpen)}
        contextOpen={showRightSidebar}
      />

    </>
  );
}
