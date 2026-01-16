// ----------------------------------------------------------------------

import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { NX_API_URL , getTenantId , getAccessToken } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Slide from '@mui/material/Slide';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { usePageContext } from 'src/hooks/use-page-context';

import { useAuraStore, useAuraActions } from 'src/store/use-aura-store';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

// ----------------------------------------------------------------------

export const AuraMiniOverlay = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isOverlayOpen = useAuraStore((state) => state.isOverlayOpen);
  const messages = useAuraStore((state) => state.messages);
  const isStreaming = useAuraStore((state) => state.isStreaming);
  const isThinking = useAuraStore((state) => state.isThinking);
  const timelineSteps = useAuraStore((state) => state.timelineSteps);
  const currentStepIndex = useAuraStore((state) => state.currentStepIndex);
  const { closeOverlay, addMessage, setStreaming, setThinking, setReturnPath } = useAuraActions();

  const [prompt, setPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');

  const pageContext = usePageContext();

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

    try {
      const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          prompt: finalPrompt,
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
    // Capture context snapshot
    setContextSnapshot({
      url: window.location.href,
      title: document.title,
      metadata: {
        pathname: window.location.pathname,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    });
    // Delay navigation to allow expansion animation
    setTimeout(() => {
      navigate('/ai-workspace');
      setIsExpanding(false);
    }, 800);
  };

  if (!isOverlayOpen) return null;

  return (
    <Slide direction="left" in={isOverlayOpen} mountOnEnter unmountOnExit>
      <Paper
        elevation={24}
        sx={{
          position: 'fixed',
          top: 80,
          right: 24,
          width: 400,
          height: 'calc(100vh - 120px)',
          maxHeight: 700,
          zIndex: theme.zIndex.drawer + 150,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${theme.vars.palette.divider}`,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h6">Aura AI</Typography>
              {timelineSteps.length > 0 && currentStepIndex >= 0 && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  진행 중: {currentStepIndex + 1}/{timelineSteps.length} 단계
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => handleQuickAction('summary')}>
                요약
              </Button>
              <Button size="small" variant="outlined" onClick={() => handleQuickAction('recommend')}>
                추천
              </Button>
              <IconButton size="small" onClick={closeOverlay}>
                <Iconify icon="solar:close-circle-bold" />
              </IconButton>
            </Stack>
          </Stack>
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

        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${theme.vars.palette.divider}`,
            bgcolor: 'background.paper',
          }}
        >
          <Stack spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Aura에게 질문하세요..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => handleSend()} disabled={!prompt.trim() || isStreaming}>
                      <Iconify icon="solar:paper-plane-bold" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button fullWidth variant="outlined" size="small" onClick={handleExpand} startIcon={<Iconify icon="solar:maximize-bold" />}>
              확장하기
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Slide>
  );
};
