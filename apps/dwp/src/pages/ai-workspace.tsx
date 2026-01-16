// ----------------------------------------------------------------------

import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { NX_API_URL , getTenantId , getAccessToken } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Timeline from '@mui/lab/Timeline';
import Button from '@mui/material/Button';
import TimelineDot from '@mui/lab/TimelineDot';
import TextField from '@mui/material/TextField';
import TimelineItem from '@mui/lab/TimelineItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import CircularProgress from '@mui/material/CircularProgress';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';

import { usePageContext } from 'src/hooks/use-page-context';

import { useAuraStore, useAuraActions } from 'src/store/use-aura-store';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

// ----------------------------------------------------------------------

export default function Page() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messages = useAuraStore((state) => state.messages);
  const isStreaming = useAuraStore((state) => state.isStreaming);
  const isThinking = useAuraStore((state) => state.isThinking);
  const returnPath = useAuraStore((state) => state.returnPath);
  const { addMessage, setStreaming, setThinking, setReturnPath } = useAuraActions();

  const [prompt, setPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [timelineItems, setTimelineItems] = useState<
    Array<{ type: 'plan' | 'action' | 'result'; content: string; timestamp: Date }>
  >([]);

  const pageContext = usePageContext();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, timelineItems]);

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

    // Add plan to timeline
    setTimelineItems((prev) => [
      ...prev,
      { type: 'plan', content: `사용자 요청: ${prompt}`, timestamp: new Date() },
    ]);

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
              if (data.content) {
                setTimelineItems((prev) => [
                  ...prev,
                  { type: 'action', content: `추론: ${data.content}`, timestamp: new Date() },
                ]);
              }
            } else if (data.type === 'action') {
              setTimelineItems((prev) => [
                ...prev,
                { type: 'action', content: data.content || data.message, timestamp: new Date() },
              ]);
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
        setTimelineItems((prev) => [
          ...prev,
          { type: 'result', content: accumulatedText, timestamp: new Date() },
        ]);
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

  const handleReturn = () => {
    if (returnPath) {
      navigate(returnPath);
      setReturnPath(null);
    } else {
      navigate('/');
    }
  };

  return (
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

      {/* Right: Timeline Panel */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.neutral' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">에이전트 사고 흐름</Typography>
        </Box>

        <Scrollbar sx={{ flex: 1 }}>
          <Box sx={{ p: 3 }}>
            {timelineItems.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  대화를 시작하면 에이전트의 사고 과정이 여기에 표시됩니다.
                </Typography>
              </Paper>
            ) : (
              <Timeline>
                {timelineItems.map((item, index) => (
                  <TimelineItem key={index}>
                    <TimelineOppositeContent sx={{ flex: 0.2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.timestamp.toLocaleTimeString()}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot
                        color={
                          item.type === 'plan'
                            ? 'primary'
                            : item.type === 'action'
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {item.type === 'plan' ? (
                          <Iconify icon="solar:document-text-bold" width={16} />
                        ) : item.type === 'action' ? (
                          <Iconify icon="solar:settings-bold" width={16} />
                        ) : (
                          <Iconify icon="solar:check-circle-bold" width={16} />
                        )}
                      </TimelineDot>
                      {index < timelineItems.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Paper sx={{ p: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <Chip
                            label={item.type === 'plan' ? '계획' : item.type === 'action' ? '실행' : '결과'}
                            size="small"
                            color={item.type === 'plan' ? 'primary' : item.type === 'action' ? 'warning' : 'success'}
                          />
                        </Stack>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {item.content}
                        </Typography>
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            )}
          </Box>
        </Scrollbar>
      </Box>
    </Box>
  );
}
