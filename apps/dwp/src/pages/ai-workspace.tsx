// ----------------------------------------------------------------------

import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { NX_API_URL, getTenantId, getAccessToken } from '@dwp-frontend/shared-utils';

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
import { ResultViewer } from 'src/components/aura/result-viewer';
import { ReasoningTimeline } from 'src/components/aura/reasoning-timeline';
import { HitlApprovalDialog } from 'src/components/aura/hitl-approval-dialog';
import { ActionExecutionView } from 'src/components/aura/action-execution-view';

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

  const { addMessage, setStreaming, setThinking, setReturnPath, addTimelineStep, updateTimelineStep, addActionExecution, updateActionExecution, setPendingHitl, approveHitl, rejectHitl, setCurrentStepIndex } = useAuraActions();

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

    // Create initial plan steps
    const planSteps = [
      { title: '요청 분석', description: '사용자 요청을 분석하고 이해합니다.', status: 'processing' as const },
      { title: '계획 수립', description: '작업 단계를 계획합니다.', status: 'pending' as const },
      { title: '실행', description: '계획된 작업을 실행합니다.', status: 'pending' as const },
      { title: '결과 검증', description: '실행 결과를 검증합니다.', status: 'pending' as const },
    ];

    planSteps.forEach((step, index) => {
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
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const dataStr = trimmedLine.slice(6);
          if (dataStr === '[DONE]') break;

          try {
            const data = JSON.parse(dataStr);

            // Handle HITL request
            if (data.type === 'hitl' || data.type === 'approval_required') {
              setPendingHitl({
                id: `hitl-${Date.now()}`,
                stepId: timelineSteps[1]?.id || '',
                message: data.message || '이 작업을 실행하시겠습니까?',
                action: data.action || 'unknown',
                params: data.params || {},
                timestamp: new Date(),
              });
              continue;
            }

            // Handle tool execution
            if (data.type === 'tool_execution' || data.type === 'action') {
              const execId = addActionExecution({
                tool: data.tool || 'unknown',
                params: data.params || {},
                status: 'executing',
              });
              // Simulate completion after a delay
              setTimeout(() => {
                updateActionExecution(execId, {
                  status: 'completed',
                  result: data.result,
                });
              }, 1000);
            }

            if (data.type === 'thought' || data.type === 'thinking') {
              setThinking(true);
            } else if (data.content || data.message) {
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

  const handleApproveHitl = () => {
    if (pendingHitl) {
      approveHitl(pendingHitl.id);
      // Continue execution logic here
    }
  };

  const handleRejectHitl = () => {
    if (pendingHitl) {
      rejectHitl(pendingHitl.id);
      // Handle rejection logic here
    }
  };

  const handleReturn = () => {
    if (returnPath) {
      navigate(returnPath);
      setReturnPath(null);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      {pendingHitl && (
        <HitlApprovalDialog request={pendingHitl} onApprove={handleApproveHitl} onReject={handleRejectHitl} />
      )}

      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Left: Chat Panel */}
        <Box sx={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Aura AI Workspace</Typography>
            <Button variant="outlined" size="small" onClick={handleReturn} startIcon={<Iconify icon="solar:arrow-left-bold" />}>
              돌아가기
            </Button>
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
              <Tab label="계획 및 실행" />
              <Tab label="도구 실행 로그" />
              <Tab label="결과" />
            </Tabs>
          </Box>

          <Scrollbar sx={{ flex: 1 }}>
            <Box sx={{ p: 3 }}>
              {activeTab === 0 && (
                <ReasoningTimeline steps={timelineSteps} currentStepIndex={currentStepIndex} />
              )}
              {activeTab === 1 && <ActionExecutionView executions={actionExecutions} />}
              {activeTab === 2 && (
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
    </>
  );
}
