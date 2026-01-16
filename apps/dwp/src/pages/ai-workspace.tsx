// ----------------------------------------------------------------------

import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { NX_API_URL, getTenantId, getAccessToken, rejectHitlRequest, approveHitlRequest } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { usePageContext } from 'src/hooks/use-page-context';

import { useAuraStore, useAuraActions } from 'src/store/use-aura-store';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { ResultViewer } from '../components/aura/result-viewer';
import { ThoughtChainUI } from '../components/aura/thought-chain-ui';
import { ConfidenceScore } from '../components/aura/confidence-score';
import { ContextualBridge } from '../components/aura/contextual-bridge';
import { DynamicPlanBoard } from '../components/aura/dynamic-plan-board';
import { LiveExecutionLog } from '../components/aura/live-execution-log';
import { ReasoningTimeline } from '../components/aura/reasoning-timeline';
import { CheckpointApproval } from '../components/aura/checkpoint-approval';
import { ActionExecutionView } from '../components/aura/action-execution-view';

// ----------------------------------------------------------------------

export default function Page() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messages = useAuraStore((state) => state.messages);
  const isStreaming = useAuraStore((state) => state.isStreaming);
  const isThinking = useAuraStore((state) => state.isThinking);
  const returnPath = useAuraStore((state) => state.returnPath);
  const timelineSteps = useAuraStore((state) => state.timelineSteps);
  const actionExecutions = useAuraStore((state) => state.actionExecutions);
  const pendingHitl = useAuraStore((state) => state.pendingHitl);
  const currentStepIndex = useAuraStore((state) => state.currentStepIndex);
  const thoughtChains = useAuraStore((state) => state.thoughtChains);
  const planSteps = useAuraStore((state) => state.planSteps);
  const executionLogs = useAuraStore((state) => state.executionLogs);
  const contextSnapshot = useAuraStore((state) => state.contextSnapshot);

  const {
    addMessage,
    setStreaming,
    setThinking,
    setReturnPath,
    addTimelineStep,
    updateTimelineStep,
    addActionExecution,
    updateActionExecution,
    setPendingHitl,
    approveHitl,
    rejectHitl,
    setCurrentStepIndex,
    addThoughtChain,
    addPlanStep,
    updatePlanStep,
    reorderPlanSteps,
    addExecutionLog,
    updateHitlEditableContent,
  } = useAuraActions();

  const [prompt, setPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const pageContext = usePageContext();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, timelineSteps]);

  const handleSend = async () => {
    if (!prompt.trim() || isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStreamingText('');
    setStreaming(true);
    setThinking(true);

    addMessage({
      role: 'user',
      content: prompt,
    });

    // Create initial plan steps for DynamicPlanBoard
    const newPlanSteps = [
      { title: '요청 분석', description: '사용자 요청을 분석하고 이해합니다.', order: 0, canSkip: false, status: 'executing' as const, confidence: 0.9 },
      { title: '계획 수립', description: '작업 단계를 계획합니다.', order: 1, canSkip: false, status: 'pending' as const, confidence: 0.85 },
      { title: '실행', description: '계획된 작업을 실행합니다.', order: 2, canSkip: true, status: 'pending' as const, confidence: 0.8 },
      { title: '결과 검증', description: '실행 결과를 검증합니다.', order: 3, canSkip: false, status: 'pending' as const, confidence: 0.9 },
    ];

    newPlanSteps.forEach((step) => {
      addPlanStep(step);
    });

    // Create timeline steps for ReasoningTimeline
    const timelineStepsData = [
      { title: '요청 분석', description: '사용자 요청을 분석하고 이해합니다.', status: 'processing' as const },
      { title: '계획 수립', description: '작업 단계를 계획합니다.', status: 'pending' as const },
      { title: '실행', description: '계획된 작업을 실행합니다.', status: 'pending' as const },
      { title: '결과 검증', description: '실행 결과를 검증합니다.', status: 'pending' as const },
    ];

    timelineStepsData.forEach((step, index) => {
      addTimelineStep(step);
      if (index === 0) {
        setCurrentStepIndex(0);
      }
    });

    const token = getAccessToken();
    const tenantId = getTenantId();

    try {
      const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          prompt,
          context: pageContext,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      if (!reader) throw new Error('No reader available');

      // Update first step to completed
      if (timelineSteps.length > 0) {
        updateTimelineStep(timelineSteps[0].id, { status: 'completed' });
        setCurrentStepIndex(1);
        updateTimelineStep(timelineSteps[1].id, { status: 'processing' });
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Handle SSE event format: "event: {type}" or "data: {json}"
          if (trimmedLine.startsWith('event: ')) {
            // Event type is stored for next data line
            continue;
          }
          
          if (!trimmedLine.startsWith('data: ')) continue;

          const dataStr = trimmedLine.slice(6);
          if (dataStr === '[DONE]') break;

          try {
            const data = JSON.parse(dataStr);

            // Handle different event types from backend
            // Backend sends: { type: 'thought', data: {...} } or { type: 'hitl', data: {...} }
            const eventType = data.type;
            const eventData = data.data || data;

            // Handle thought chain
            if (eventType === 'thought' || eventType === 'thinking') {
              setThinking(true);
              addThoughtChain({
                type: eventData.thoughtType || 'analysis',
                content: eventData.content || eventData.message || '사고 중...',
                sources: eventData.sources,
              });
              addExecutionLog({
                type: 'info',
                content: `[사고] ${eventData.content || eventData.message || '처리 중...'}`,
              });
            }

            // Handle plan step
            if (eventType === 'plan_step') {
              addPlanStep({
                title: eventData.title || '계획 단계',
                description: eventData.description || '',
                order: eventData.order || planSteps.length,
                canSkip: eventData.canSkip || false,
                status: 'pending',
                confidence: eventData.confidence,
              });
            }

            // Handle HITL request
            if (eventType === 'hitl' || eventType === 'approval_required') {
              const requestId = eventData.requestId || `hitl-${Date.now()}`;
              setPendingHitl({
                id: requestId,
                stepId: timelineSteps[currentStepIndex]?.id || '',
                message: eventData.message || '이 작업을 실행하시겠습니까?',
                action: eventData.actionType || eventData.action || 'unknown',
                params: eventData.params || {},
                timestamp: new Date(),
                confidence: eventData.confidence,
                editableContent: eventData.editableContent || eventData.message,
              });
              addExecutionLog({
                type: 'info',
                content: '[승인 대기] 사용자 승인이 필요한 작업이 있습니다.',
              });
              setStreaming(false);
              setThinking(false);
              break; // Stop streaming for approval
            }

            // Handle tool execution
            if (eventType === 'tool_execution' || eventType === 'action') {
              const tool = eventData.tool || 'unknown';
              const execId = addActionExecution({
                tool,
                params: eventData.params || {},
                status: 'executing',
              });
              addExecutionLog({
                type: 'command',
                content: `실행: ${tool} ${JSON.stringify(eventData.params || {})}`,
              });
              
              // Update execution status based on backend response
              if (eventData.status === 'completed') {
                updateActionExecution(execId, {
                  status: 'completed',
                  result: eventData.result,
                });
                addExecutionLog({
                  type: 'success',
                  content: `완료: ${tool}`,
                });
              } else if (eventData.status === 'failed') {
                updateActionExecution(execId, {
                  status: 'failed',
                  error: eventData.error,
                });
                addExecutionLog({
                  type: 'error',
                  content: `실패: ${tool} - ${eventData.error}`,
                });
              }
            }

            // Handle content/message
            if (eventType === 'content' || eventType === 'message') {
              setThinking(false);
              accumulatedText += eventData.content || eventData.message || '';
              setStreamingText(accumulatedText);
            } else if (!eventType && (data.content || data.message)) {
              // Fallback for non-typed events
              setThinking(false);
              accumulatedText += data.content || data.message || '';
              setStreamingText(accumulatedText);
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }

      // Complete remaining steps
      if (timelineSteps.length > 1) {
        updateTimelineStep(timelineSteps[1].id, { status: 'completed' });
        setCurrentStepIndex(2);
        updateTimelineStep(timelineSteps[2].id, { status: 'completed' });
        setCurrentStepIndex(3);
        updateTimelineStep(timelineSteps[3].id, { status: 'completed' });
      }

      if (accumulatedText) {
        addMessage({
          role: 'assistant',
          content: accumulatedText,
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addMessage({
          role: 'assistant',
          content: `오류가 발생했습니다: ${err.message}`,
        });
        if (timelineSteps.length > 0) {
          updateTimelineStep(timelineSteps[currentStepIndex]?.id || timelineSteps[0].id, { status: 'failed' });
        }
      }
    } finally {
      setStreaming(false);
      setThinking(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }

    setPrompt('');
  };

  const handleApproveHitl = async (editedContent?: string) => {
    if (!pendingHitl) return;

    try {
      if (editedContent) {
        updateHitlEditableContent(pendingHitl.id, editedContent);
      }

      // Extract requestId from pendingHitl (backend format)
      const requestId = pendingHitl.id.startsWith('hitl-') ? pendingHitl.id.replace('hitl-', '') : pendingHitl.id;
      
      await approveHitlRequest(requestId);
      
      // Clear HITL and resume streaming
      setPendingHitl(null);
      setStreaming(true);
      setThinking(true);
      
      // Note: Backend should continue the stream after approval
      // If needed, re-initiate the stream here
    } catch (error: any) {
      console.error('HITL approval failed:', error);
      addMessage({
        role: 'assistant',
        content: `승인 처리 중 오류가 발생했습니다: ${error.message}`,
      });
    }
  };

  const handleRejectHitl = async () => {
    if (!pendingHitl) return;

    try {
      const requestId = pendingHitl.id.startsWith('hitl-') ? pendingHitl.id.replace('hitl-', '') : pendingHitl.id;
      
      await rejectHitlRequest(requestId, '사용자가 작업을 거부했습니다.');
      
      setPendingHitl(null);
      addMessage({
        role: 'assistant',
        content: '작업이 거부되었습니다.',
      });
      
      if (timelineSteps.length > 0 && currentStepIndex >= 0) {
        updateTimelineStep(timelineSteps[currentStepIndex].id, { status: 'failed' });
      }
      
      setStreaming(false);
      setThinking(false);
    } catch (error: any) {
      console.error('HITL rejection failed:', error);
      addMessage({
        role: 'assistant',
        content: `거절 처리 중 오류가 발생했습니다: ${error.message}`,
      });
    }
  };

  const handleEditHitl = (content: string) => {
    if (pendingHitl) {
      updateHitlEditableContent(pendingHitl.id, content);
    }
  };

  const handleApprovePlanStep = (id: string) => {
    updatePlanStep(id, { status: 'approved' });
  };

  const handleSkipPlanStep = (id: string) => {
    updatePlanStep(id, { status: 'skipped' });
  };

  const handleReorderPlanSteps = (stepIds: string[]) => {
    reorderPlanSteps(stepIds);
  };

  const handleReturn = () => {
    if (returnPath) {
      navigate(returnPath);
      setReturnPath(null);
    } else {
      navigate('/');
    }
  };

  const [logOpen, setLogOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);

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

      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {contextSnapshot && contextOpen && (
          <ContextualBridge snapshot={contextSnapshot} onClose={() => setContextOpen(false)} />
        )}

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            marginRight: contextSnapshot && contextOpen ? '320px' : 0,
            transition: 'margin-right 0.3s',
          }}
        >
          {/* Left: Chat Panel */}
          <Box sx={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Aura AI Workspace</Typography>
              <Button variant="outlined" size="small" onClick={handleReturn} startIcon={<Iconify icon="solar:arrow-left-bold" />}>
                돌아가기
              </Button>
            </Stack>
            {pendingHitl?.confidence !== undefined && (
              <ConfidenceScore confidence={pendingHitl.confidence} onRequestInfo={() => {}} />
            )}
          </Box>

          <Scrollbar sx={{ flex: 1 }}>
            <Box ref={scrollRef} sx={{ p: 2 }}>
              <Stack spacing={2}>
                {messages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Card
                      sx={{
                        maxWidth: '80%',
                        p: 1.5,
                        bgcolor: msg.role === 'user' ? 'primary.main' : 'background.neutral',
                        color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </Typography>
                    </Card>
                  </Box>
                ))}

                {(isThinking || streamingText) && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Card sx={{ p: 1.5, bgcolor: 'background.neutral' }}>
                      {isThinking && !streamingText && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CircularProgress size={16} />
                          <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                            생각 중...
                          </Typography>
                        </Stack>
                      )}
                      {streamingText && (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {streamingText}
                        </Typography>
                      )}
                    </Card>
                  </Box>
                )}
              </Stack>
            </Box>
          </Scrollbar>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              placeholder="Aura에게 질문하세요..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={handleSend} disabled={!prompt.trim() || isStreaming}>
                    <Iconify icon="solar:paper-plane-bold" />
                  </IconButton>
                ),
              }}
            />
          </Box>
        </Box>

          {/* Right: Timeline & Execution Panel */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.neutral' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                <Tab label="사고 과정" />
                <Tab label="작업 계획" />
                <Tab label="실행 로그" />
                <Tab label="결과" />
              </Tabs>
            </Box>

            <Scrollbar sx={{ flex: 1 }}>
              <Box sx={{ p: 3 }}>
                {activeTab === 0 && (
                  <Stack spacing={3}>
                    {thoughtChains.length > 0 && (
                      <Box>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                          사고 체인
                        </Typography>
                        <ThoughtChainUI thoughts={thoughtChains} />
                      </Box>
                    )}
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        실행 타임라인
                      </Typography>
                      <ReasoningTimeline steps={timelineSteps} currentStepIndex={currentStepIndex} />
                    </Box>
                  </Stack>
                )}
                {activeTab === 1 && (
                  <DynamicPlanBoard
                    steps={planSteps}
                    onReorder={handleReorderPlanSteps}
                    onUpdate={updatePlanStep}
                    onApprove={handleApprovePlanStep}
                    onSkip={handleSkipPlanStep}
                  />
                )}
                {activeTab === 2 && (
                  <Stack spacing={2}>
                    <ActionExecutionView executions={actionExecutions} />
                    {actionExecutions.length === 0 && (
                      <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          실행 로그가 없습니다.
                        </Typography>
                      </Paper>
                    )}
                  </Stack>
                )}
                {activeTab === 3 && (
                  <Stack spacing={2}>
                    {messages
                      .filter((msg) => msg.role === 'assistant' && msg.metadata?.result)
                      .map((msg) => (
                        <ResultViewer key={msg.id} result={msg.metadata?.result} />
                      ))}
                    {messages.filter((msg) => msg.role === 'assistant' && msg.metadata?.result).length === 0 && (
                      <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          결과가 여기에 표시됩니다.
                        </Typography>
                      </Paper>
                    )}
                  </Stack>
                )}
              </Box>
            </Scrollbar>
          </Box>
        </Box>
      </Box>

      <LiveExecutionLog
        logs={executionLogs}
        isOpen={logOpen}
        onToggle={() => setLogOpen(!logOpen)}
        contextOpen={contextSnapshot !== null && contextOpen}
      />
    </>
  );
}
