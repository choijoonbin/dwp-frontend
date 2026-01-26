// ----------------------------------------------------------------------

import { useNavigate } from 'react-router-dom';
import { useRef, useMemo, useState, useEffect } from 'react';
import { useAuraStore, useAuraActions } from '@dwp-frontend/shared-utils/aura/use-aura-store';
import {
  getUserId,
  postEvent,
  NX_API_URL,
  getTenantId,
  getAccessToken,
  useStreamStore,
  getAgentContext,
  getAgentSessionId,
  rejectHitlRequest,
  approveHitlRequest,
} from '@dwp-frontend/shared-utils';

import { createAiWorkspaceMockData } from '../data/mock';

// ----------------------------------------------------------------------

export const useAiWorkspace = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const storeMessages = useAuraStore((state) => state.messages);
  const isStreaming = useAuraStore((state) => state.isStreaming);
  const isThinking = useAuraStore((state) => state.isThinking);
  const returnPath = useAuraStore((state) => state.returnPath);
  const storeTimelineSteps = useAuraStore((state) => state.timelineSteps);
  const storeActionExecutions = useAuraStore((state) => state.actionExecutions);
  const pendingHitl = useAuraStore((state) => state.pendingHitl);
  const currentStepIndex = useAuraStore((state) => state.currentStepIndex);
  const storeThoughtChains = useAuraStore((state) => state.thoughtChains);
  const storePlanSteps = useAuraStore((state) => state.planSteps);
  const storeExecutionLogs = useAuraStore((state) => state.executionLogs);
  const storeContextSnapshot = useAuraStore((state) => state.contextSnapshot);

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
  const [lastResultMetadata, setLastResultMetadata] = useState<any>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');

  const setStatus = useStreamStore((state) => state.setStatus);
  const setError = useStreamStore((state) => state.setError);
  const setDebug = useStreamStore((state) => state.setDebug);
  const addEventType = useStreamStore((state) => state.addEventType);
  const resetStore = useStreamStore((state) => state.reset);

  // TODO: Remove mock fallback once AI Workspace APIs are fully wired.
  const mockData = useMemo(createAiWorkspaceMockData, []);
  const useMockData =
    storeMessages.length === 0 &&
    storeThoughtChains.length === 0 &&
    storePlanSteps.length === 0 &&
    storeTimelineSteps.length === 0 &&
    storeActionExecutions.length === 0 &&
    storeExecutionLogs.length === 0;

  const displayMessages = storeMessages.length > 0 ? storeMessages : useMockData ? mockData.messages : [];
  const displayThoughtChains = storeThoughtChains.length > 0 ? storeThoughtChains : useMockData ? mockData.thoughtChains : [];
  const displayPlanSteps = storePlanSteps.length > 0 ? storePlanSteps : useMockData ? mockData.planSteps : [];
  const displayTimelineSteps =
    storeTimelineSteps.length > 0 ? storeTimelineSteps : useMockData ? mockData.timelineSteps : [];
  const displayActionExecutions =
    storeActionExecutions.length > 0 ? storeActionExecutions : useMockData ? mockData.actionExecutions : [];
  const displayExecutionLogs =
    storeExecutionLogs.length > 0 ? storeExecutionLogs : useMockData ? mockData.executionLogs : [];
  const displayContextSnapshot = storeContextSnapshot ?? mockData.contextSnapshot;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [storeMessages, streamingText, storeTimelineSteps]);

  const handleSend = async () => {
    if (!prompt.trim() || isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStreamingText('');
    setStreaming(true);
    setThinking(true);

    setLastPrompt(prompt);

    const endpoint = '/api/aura/test/stream';
    setStatus('CONNECTING');
    setDebug({
      endpoint,
      retryCount: 0,
      startedAt: new Date(),
    });

    postEvent({
      eventType: 'execute',
      resourceKey: 'menu.ai.workspace',
      action: 'execute_ai',
      label: 'AI Workspace 실행',
      metadata: {
        promptLength: prompt.length,
        timestamp: new Date().toISOString(),
      },
    }).catch((error) => {
      console.debug('[Event Tracking] Failed to post execute_ai event:', error);
    });

    addMessage({
      role: 'user',
      content: prompt,
    });

    const newPlanSteps = [
      {
        title: '요청 분석',
        description: '사용자 요청을 분석하고 이해합니다.',
        order: 0,
        canSkip: false,
        status: 'executing' as const,
        confidence: 0.9,
      },
      {
        title: '계획 수립',
        description: '작업 단계를 계획합니다.',
        order: 1,
        canSkip: false,
        status: 'pending' as const,
        confidence: 0.85,
      },
      {
        title: '실행',
        description: '계획된 작업을 실행합니다.',
        order: 2,
        canSkip: true,
        status: 'pending' as const,
        confidence: 0.8,
      },
      {
        title: '결과 검증',
        description: '실행 결과를 검증합니다.',
        order: 3,
        canSkip: false,
        status: 'pending' as const,
        confidence: 0.9,
      },
    ];

    newPlanSteps.forEach((step) => {
      addPlanStep(step);
    });

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
    const userId = getUserId();
    const agentId = getAgentSessionId();
    const agentContext = getAgentContext();

    const requestPayload = {
      prompt,
      context: agentContext,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[Aura SSE Request]', {
        endpoint: `${NX_API_URL}/api/aura/test/stream`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          Authorization: token ? 'Bearer ***' : 'none',
          'X-User-ID': userId || 'none',
          'X-Agent-ID': agentId,
        },
        payload: requestPayload,
        contextCheck: {
          hasPathname: 'pathname' in agentContext,
          hasActiveApp: 'activeApp' in agentContext,
          pathname: agentContext.pathname,
          activeApp: agentContext.activeApp,
        },
      });
    }

    try {
      const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-Tenant-ID': tenantId,
          'X-Agent-ID': agentId,
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(userId && { 'X-User-ID': userId }),
        },
        body: JSON.stringify(requestPayload),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';

      resetStore();
      setStatus('STREAMING');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;

          const dataStr = line.replace('data:', '').trim();
          if (!dataStr) continue;

          if (dataStr === '[DONE]') {
            setStatus('COMPLETED');
            break;
          }

          try {
            const data = JSON.parse(dataStr);
            const eventType = data.event || data.type;
            const eventData = data.data || data;

            if (eventType) {
              addEventType(eventType);
            }

            if (eventType === 'error') {
              setStatus('ERROR');
              setError(eventData.message || 'Stream error');
              continue;
            }

            if (eventType === 'stream_status') {
              setStatus(eventData.status);
              continue;
            }

            if (eventType === 'hitl_request') {
              setPendingHitl({
                id: `hitl-${eventData.id}`,
                stepId: eventData.stepId,
                message: eventData.message,
                action: eventData.action,
                params: eventData.params,
                timestamp: new Date(),
                confidence: eventData.confidence,
              });
              setThinking(false);
              setStreaming(false);
              continue;
            }

            if (eventType === 'thought_chain') {
              addThoughtChain({
                type: eventData.type,
                content: eventData.content,
                sources: eventData.sources,
              });
              continue;
            }

            if (eventType === 'action_execution') {
              const execId = addActionExecution({
                tool: eventData.tool,
                params: eventData.params,
                status: eventData.status,
              });
              addExecutionLog({
                type: 'info',
                content: `실행 시작: ${eventData.tool}`,
              });

              if (eventData.status === 'completed') {
                updateActionExecution(execId, {
                  status: 'completed',
                  result: eventData.result,
                });
                addExecutionLog({
                  type: 'success',
                  content: `완료: ${eventData.tool}`,
                });
              } else if (eventData.status === 'failed') {
                updateActionExecution(execId, {
                  status: 'failed',
                  error: eventData.error,
                });
                addExecutionLog({
                  type: 'error',
                  content: `실패: ${eventData.tool} - ${eventData.error}`,
                });
              }
            }

            if (eventType === 'content' || eventType === 'message') {
              setThinking(false);
              accumulatedText += eventData.content || eventData.message || '';
              setStreamingText(accumulatedText);

              if (eventData.metadata?.result) {
                setLastResultMetadata(eventData.metadata.result);
              }
            } else if (!eventType && (data.content || data.message)) {
              setThinking(false);
              accumulatedText += data.content || data.message || '';
              setStreamingText(accumulatedText);
            }

            if (eventType === 'plan_step_update') {
              updatePlanStep(eventData.id, {
                status: eventData.status,
                description: eventData.description,
                confidence: eventData.confidence,
              });
            }

            if (eventType === 'timeline_step_update') {
              updateTimelineStep(eventData.id, {
                status: eventData.status,
                title: eventData.title,
                description: eventData.description,
              });
            }
          } catch (err) {
            console.error('Parse error:', err);
          }
        }
      }

      if (storeTimelineSteps.length > 1) {
        updateTimelineStep(storeTimelineSteps[1].id, { status: 'completed' });
        setCurrentStepIndex(2);
        updateTimelineStep(storeTimelineSteps[2].id, { status: 'completed' });
        setCurrentStepIndex(3);
        updateTimelineStep(storeTimelineSteps[3].id, { status: 'completed' });
      }

      if (accumulatedText) {
        addMessage({
          role: 'assistant',
          content: accumulatedText,
          metadata: lastResultMetadata ? { result: lastResultMetadata } : undefined,
        });
        setLastResultMetadata(null);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('ABORTED');
      } else {
        setStatus('ERROR');
        setError(err.message || 'Stream error');
        addMessage({
          role: 'assistant',
          content: `오류가 발생했습니다: ${err.message}`,
        });
        if (storeTimelineSteps.length > 0) {
          updateTimelineStep(
            storeTimelineSteps[currentStepIndex]?.id || storeTimelineSteps[0].id,
            { status: 'failed' }
          );
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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('ABORTED');
      setStreaming(false);
      setThinking(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }
    setPrompt('');
  };

  const handleRetry = () => {
    if (lastPrompt) {
      setPrompt(lastPrompt);
      setTimeout(() => {
        handleSend();
      }, 0);
    }
  };

  const handleApproveHitl = async (editedContent?: string) => {
    if (!pendingHitl) return;

    try {
      if (editedContent) {
        updateHitlEditableContent(pendingHitl.id, editedContent);
      }

      const requestId = pendingHitl.id.startsWith('hitl-')
        ? pendingHitl.id.replace('hitl-', '')
        : pendingHitl.id;

      await approveHitlRequest(requestId);

      setPendingHitl(null);
      setStreaming(true);
      setThinking(true);
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
      const requestId = pendingHitl.id.startsWith('hitl-')
        ? pendingHitl.id.replace('hitl-', '')
        : pendingHitl.id;

      await rejectHitlRequest(requestId, '사용자가 작업을 거부했습니다.');

      setPendingHitl(null);
      addMessage({
        role: 'assistant',
        content: '작업이 거부되었습니다.',
      });

      if (storeTimelineSteps.length > 0 && currentStepIndex >= 0) {
        updateTimelineStep(storeTimelineSteps[currentStepIndex].id, { status: 'failed' });
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

  return {
    scrollRef,
    messages: displayMessages,
    isStreaming,
    isThinking,
    pendingHitl,
    timelineSteps: displayTimelineSteps,
    actionExecutions: displayActionExecutions,
    currentStepIndex,
    thoughtChains: displayThoughtChains,
    planSteps: displayPlanSteps,
    executionLogs: displayExecutionLogs,
    contextSnapshot: displayContextSnapshot,
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
  };
};
