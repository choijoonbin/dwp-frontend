// ----------------------------------------------------------------------

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserId, NX_API_URL, getTenantId, getAccessToken, getAgentContext } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import InputAdornment from '@mui/material/InputAdornment';

import { usePageContext } from 'src/hooks/use-page-context';

import { useAuraStore, useAuraActions } from 'src/store/use-aura-store';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

// ----------------------------------------------------------------------

export const AuraMiniOverlay = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // 현재 테마 모드 확인 (light/dark)
  const isDarkMode = theme.palette.mode === 'dark';

  // Header 배경 색상 (preset에 따라 동적)
  const headerBgStart = isDarkMode
    ? alpha(theme.palette.primary.darker, 0.15)
    : theme.palette.primary.lighter || '#EEF4FF';
  const headerBgEnd = isDarkMode
    ? alpha(theme.palette.primary.dark, 0.1)
    : theme.palette.grey[50] || '#F8FAFC';

  // Header 텍스트 색상
  const headerTextColor = isDarkMode ? theme.palette.common.white : '#1F2937';

  // 메시지 영역 배경 (preset에 따라 동적)
  const messageBgColor = isDarkMode ? theme.palette.grey[900] : '#F8FAFB';

  // Bottom 영역 배경 (preset에 따라 동적) - Header와 유사한 톤 유지
  const bottomBgStart = isDarkMode
    ? alpha(theme.palette.primary.darker, 0.12)
    : alpha(theme.palette.primary.lighter || '#D0ECFE', 0.3);
  const bottomBgEnd = isDarkMode
    ? theme.palette.grey[900]
    : theme.palette.grey[50] || '#F8FAFC';

  // 입력 필드 배경
  const inputBgColor = isDarkMode ? theme.palette.grey[800] : theme.palette.common.white;
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isOverlayOpen = useAuraStore((state) => state.isOverlayOpen);
  const messages = useAuraStore((state) => state.messages);
  const isStreaming = useAuraStore((state) => state.isStreaming);
  const isThinking = useAuraStore((state) => state.isThinking);
  const timelineSteps = useAuraStore((state) => state.timelineSteps);
  const currentStepIndex = useAuraStore((state) => state.currentStepIndex);
  const pendingHitl = useAuraStore((state) => state.pendingHitl);
  const {
    closeOverlay,
    addMessage,
    setStreaming,
    setThinking,
    setReturnPath,
    setIsExpanding,
    setContextSnapshot,
    addTimelineStep,
    addActionExecution,
    setPendingHitl,
  } = useAuraActions();

  const [prompt, setPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');

  const pageContext = usePageContext();

  // AI 작동 여부 체크 (애니메이션 트리거용)
  const isAiActive = isThinking || isStreaming;

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, isThinking]);

  const handleSend = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim() || isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStreamingText('');
    setStreaming(true);
    setThinking(true);

    addMessage({
      role: 'user',
      content: finalPrompt,
    });

      const token = getAccessToken();
      const tenantId = getTenantId();
      const userId = getUserId();

      // getAgentContext를 사용하여 명세에 맞는 context 생성
      const agentContext = getAgentContext();

      // 디버깅: 요청 정보 로깅
      const requestPayload = {
        prompt: finalPrompt,
        context: agentContext,
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('[Aura SSE Request]', {
          endpoint: `${NX_API_URL}/api/aura/test/stream`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId,
            'Authorization': token ? 'Bearer ***' : 'none',
            'X-User-ID': userId || 'none',
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
            'Accept': 'text/event-stream', 
            'X-Tenant-ID': tenantId,
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(userId && { 'X-User-ID': userId }),
          },
          body: JSON.stringify(requestPayload),
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith('event: ')) {
            continue;
          }
          
          if (!trimmedLine.startsWith('data: ')) continue;

          const dataStr = trimmedLine.slice(6);
          if (dataStr === '[DONE]') break;

          try {
            const data = JSON.parse(dataStr);

            const eventType = data.type;
            const eventData = data.data || data;

            if (eventType === 'thought' || eventType === 'thinking') {
              setThinking(true);
            } else if (eventType === 'plan_step') {
              addTimelineStep({
                title: eventData.title || '계획 단계',
                description: eventData.description || '',
                status: 'processing',
              });
            } else if (eventType === 'tool_execution' || eventType === 'action') {
              addActionExecution({
                tool: eventData.tool || 'unknown',
                params: eventData.params || {},
                status: 'executing',
              });
            } else if (eventType === 'hitl' || eventType === 'approval_required') {
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
              setStreaming(false);
              setThinking(false);
              break; 
            } else if (eventType === 'content' || eventType === 'message') {
              setThinking(false);
              accumulatedText += eventData.content || eventData.message || '';
              setStreamingText(accumulatedText);
            } else if (!eventType && (data.content || data.message)) {
              setThinking(false);
              accumulatedText += data.content || data.message || '';
              setStreamingText(accumulatedText);
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
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
      }
    } finally {
      setStreaming(false);
      setThinking(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }

    setPrompt('');
  };

  const handleQuickAction = (action: 'summary' | 'recommend') => {
    const prompts = {
      summary: `현재 화면(${pageContext.title})을 요약해주세요.`,
      recommend: `현재 화면(${pageContext.title})에서 다음에 할 수 있는 행동을 추천해주세요.`,
    };
    handleSend(prompts[action]);
  };

  const handleExpand = () => {
    setReturnPath(window.location.pathname);
    setIsExpanding(true);
    setContextSnapshot({
      url: window.location.href,
      title: document.title,
      metadata: {
        pathname: window.location.pathname,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    });
    closeOverlay();
    setTimeout(() => {
      navigate('/ai-workspace');
      setIsExpanding(false);
    }, 300); 
  };

  const borderSize = isAiActive ? (isDarkMode ? 3 : 4) : (isDarkMode ? 2 : 5);
  const glowBlue = isDarkMode ? 0.22 : 0.18;
  const glowPurple = isDarkMode ? 0.16 : 0.12;
  const outline = isDarkMode ? 0.12 : 0.10;
  const depth = isDarkMode ? 0.38 : 0.20;
  
  if (!isOverlayOpen || location.pathname === '/ai-workspace') return null;

  return (
    <AnimatePresence>
      {isOverlayOpen && (
        <motion.div
          initial={{ opacity: 0, x: 400, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 400, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            duration: 0.3,
          }}
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            width: 400,
            height: 'calc(100vh - 120px)',
            maxHeight: 700,
            zIndex: theme.zIndex.drawer + 150,
          }}
        >
          

<Paper
  elevation={0}
  sx={{
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: messageBgColor,
    border: `${borderSize}px solid transparent`,
    
    // ✅ AI 활성 상태에 따른 동적 배경 (고정 그라데이션 대신 조건부 애니메이션 적용 가능성 확보)
    backgroundImage: isAiActive 
    ? `linear-gradient(${messageBgColor}, ${messageBgColor}), 
       conic-gradient(from 0deg, ${theme.palette.primary.main}, ${theme.palette.secondary?.main || theme.palette.primary.light}, ${theme.palette.primary.main})`
    : `linear-gradient(${messageBgColor}, ${messageBgColor}),
       linear-gradient(135deg,
         ${alpha(theme.palette.primary.main, 1)} 0%,
         ${alpha(theme.palette.secondary?.main || theme.palette.primary.light, 0.95)} 55%,
         ${alpha(theme.palette.primary.dark, 0.95)} 100%
       )`,
    backgroundOrigin: 'padding-box, border-box',
    backgroundClip: 'padding-box, border-box',

    boxShadow: `
      0 14px 42px rgba(0,0,0,${depth}),
      0 0 0 5px rgba(100,149,237,${outline}),
      0 0 ${isAiActive ? '30px' : '22px'} rgba(100,149,237,${glowBlue}),
      0 0 ${isAiActive ? '80px' : '64px'} rgba(147,51,234,${glowPurple})
    `,
    transition: 'box-shadow 0.3s ease, border-width 0.3s ease',

    '&::after': {
      content: '""',
      position: 'absolute',
      inset: borderSize,
      borderRadius: 'inherit',
      pointerEvents: 'none',
      boxShadow: `inset 0 1px 0 ${alpha('#FFFFFF', isDarkMode ? 0.05 : 0.16)}`,
    },
  }}
>
  {/* ✅ AI가 답변 중일 때 회전하는 테두리 효과 전용 레이어 */}
  {isAiActive && (
    <motion.div
      style={{
        position: 'absolute',
        inset: -borderSize,
        borderRadius: 'inherit',
        zIndex: 0,
        background: `conic-gradient(from 0deg, transparent, ${alpha(theme.palette.primary.main, 0.8)}, transparent)`,
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
    />
  )}

  {/* 컨텐츠 보호 레이어 (회전하는 테두리가 컨텐츠 위로 올라오지 않게 함) */}
  <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: messageBgColor }}>
        <Box
          sx={{
            p: 2,
            background: `linear-gradient(180deg, ${headerBgStart} 0%, ${headerBgEnd} 100%)`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${alpha(isDarkMode ? theme.palette.grey[700] : theme.palette.grey[300], 0.6)}`,
            boxShadow: isDarkMode
              ? `0 1px 4px ${alpha(theme.palette.common.black, 0.3)}`
              : `0 1px 4px ${alpha(theme.palette.common.black, 0.06)}`,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 500, color: headerTextColor }}>
                    Aura
                  </Typography>
                  {isAiActive && (
                    <motion.div
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontStyle: 'italic',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <motion.span
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          생각 중...
                        </motion.span>
                      </Typography>
                    </motion.div>
                  )}
                </Stack>
                {pendingHitl && (
                  <Typography variant="caption" sx={{ color: 'warning.main', mt: 0.5, display: 'block' }}>
                    승인이 필요해요
                  </Typography>
                )}
              </Box>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  display: 'flex',
                  bgcolor: isDarkMode
                    ? alpha(theme.palette.grey[800], 0.6)
                    : alpha(theme.palette.common.white, 0.6),
                  borderRadius: 1.5,
                  p: 0.25,
                  gap: 0.25,
                  border: `1px solid ${alpha(isDarkMode ? theme.palette.grey[700] : theme.palette.grey[300], 0.4)}`,
                }}
              >
                <Button
                  size="small"
                  onClick={() => handleQuickAction('summary')}
                  sx={{
                    minWidth: 48,
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: isDarkMode ? theme.palette.common.white : '#334155',
                    bgcolor: isDarkMode
                      ? alpha(theme.palette.grey[700], 0.8)
                      : alpha(theme.palette.common.white, 0.8),
                    boxShadow: isDarkMode
                      ? `0 1px 2px ${alpha(theme.palette.common.black, 0.3)}`
                      : `0 1px 2px ${alpha(theme.palette.common.black, 0.04)}`,
                    border: 'none',
                    '&:hover': {
                      bgcolor: isDarkMode
                        ? alpha(theme.palette.grey[700], 0.9)
                        : alpha(theme.palette.common.white, 0.9),
                    },
                    transition: 'all 0.15s ease',
                  }}
                >
                  요약
                </Button>
                <Button
                  size="small"
                  onClick={() => handleQuickAction('recommend')}
                  sx={{
                    minWidth: 48,
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    color: isDarkMode ? theme.palette.grey[400] : '#64748B',
                    bgcolor: 'transparent',
                    border: 'none',
                    '&:hover': {
                      bgcolor: isDarkMode
                        ? alpha(theme.palette.grey[700], 0.5)
                        : alpha(theme.palette.common.white, 0.5),
                    },
                    transition: 'all 0.15s ease',
                  }}
                >
                  추천
                </Button>
              </Box>
              <IconButton
                size="small"
                onClick={closeOverlay}
                sx={{ color: isDarkMode ? theme.palette.grey[400] : '#64748B' }}
              >
                <Iconify icon="solar:close-circle-bold" />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        <Scrollbar sx={{ flex: 1 }}>
            <Box
              ref={scrollRef}
              sx={{
                p: 2,
                bgcolor: messageBgColor,
              }}
            >
            <Stack spacing={2}>
              {messages.length === 0 && !isThinking && !streamingText && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 4,
                    px: 2,
                    gap: 2,
                  }}
                >
                  <Iconify icon="solar:chat-round-dots-bold" width={32} sx={{ color: 'text.disabled', opacity: 0.5 }} />
                  <Stack spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      sx={{
                        color: isDarkMode ? theme.palette.grey[300] : theme.palette.grey[700],
                        textAlign: 'center',
                        fontWeight: 400,
                      }}
                    >
                      이 화면 요약해줘
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: isDarkMode ? theme.palette.grey[300] : theme.palette.grey[700],
                        textAlign: 'center',
                        fontWeight: 400,
                      }}
                    >
                      다음으로 할 일 추천해줘
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: isDarkMode ? theme.palette.grey[300] : theme.palette.grey[700],
                        textAlign: 'center',
                        fontWeight: 400,
                      }}
                    >
                      선택한 항목 설명해줘
                    </Typography>
                  </Stack>
                </Box>
              )}
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
                      p: 1.75,
                      bgcolor: msg.role === 'user'
                        ? theme.palette.grey[700]
                        : theme.palette.grey[50],
                      color: msg.role === 'user' ? theme.palette.common.white : theme.palette.grey[800],
                      boxShadow: 'none',
                      border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                      transition: 'none',
                      borderRadius: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        color: 'inherit',
                        lineHeight: 1.65,
                        fontSize: '0.875rem',
                        fontWeight: 400,
                      }}
                    >
                      {msg.content}
                    </Typography>
                  </Card>
                </Box>
              ))}

              {(isThinking || streamingText) && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Card
                    sx={{
                      p: 1.75,
                      bgcolor: theme.palette.grey[50],
                      boxShadow: 'none',
                      border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                      borderRadius: 2,
                    }}
                  >
                    {isThinking && !streamingText && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        >
                          <Iconify icon="solar:loading-bold" width={16} sx={{ color: 'text.secondary' }} />
                        </motion.div>
                        <Typography
                          variant="body2"
                          sx={{
                            fontStyle: 'italic',
                            color: theme.palette.grey[600],
                            lineHeight: 1.65,
                          }}
                        >
                          잠시만요, 정리하고 있어요
                        </Typography>
                      </Stack>
                    )}
                    {streamingText && (
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          color: theme.palette.grey[800],
                          lineHeight: 1.65,
                          fontSize: '0.875rem',
                          fontWeight: 400,
                        }}
                      >
                        {streamingText}
                      </Typography>
                    )}
                  </Card>
                </Box>
              )}
            </Stack>
          </Box>
        </Scrollbar>

        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${alpha(isDarkMode ? theme.palette.grey[700] : theme.palette.grey[300], 0.6)}`,
            background: `linear-gradient(180deg, ${bottomBgStart} 0%, ${bottomBgEnd} 100%)`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: isDarkMode
              ? `0 -1px 4px ${alpha(theme.palette.common.black, 0.3)}`
              : `0 -1px 4px ${alpha(theme.palette.common.black, 0.06)}`,
            borderRadius: '0 0 12px 12px',
          }}
        >
          <Stack spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              placeholder="이 화면에서 필요한 도움을 요청해 보세요"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: inputBgColor,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: 'none',
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  transition: 'all 0.2s ease',
                  color: theme.palette.text.primary,
                  '&:hover': {
                    bgcolor: inputBgColor,
                    borderColor: alpha(theme.palette.divider, 0.2),
                  },
                  '&.Mui-focused': {
                    bgcolor: inputBgColor,
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.05)}`,
                  },
                  '& input': {
                    color: theme.palette.text.primary,
                    '&::placeholder': {
                      color: theme.palette.text.secondary,
                      opacity: 0.6,
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: theme.palette.text.primary,
                  },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => handleSend()}
                      disabled={!prompt.trim() || isStreaming}
                      sx={{
                        bgcolor: prompt.trim() && !isStreaming ? theme.palette.primary.main : 'transparent',
                        color: prompt.trim() && !isStreaming ? theme.palette.primary.contrastText : 'text.secondary',
                        '&:hover': {
                          bgcolor: prompt.trim() && !isStreaming ? theme.palette.primary.dark : alpha(theme.palette.action.hover, 0.1),
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Iconify icon="solar:paper-plane-bold" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Box
              onClick={handleExpand}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                py: 0.75,
                cursor: 'pointer',
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.text.primary,
                },
                transition: 'color 0.2s ease',
              }}
            >
              <Iconify icon="solar:maximize-bold" width={14} />
              <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'inherit' }}>
                확장하여 계속 작업하기
              </Typography>
            </Box>
          </Stack>
        </Box>
    </Box>
  </Paper>
        </motion.div>
      )}
    </AnimatePresence>
  );
};