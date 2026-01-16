// ----------------------------------------------------------------------

import { useState, useRef, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { getAccessToken } from '@dwp-frontend/shared-utils';
import { getTenantId } from '@dwp-frontend/shared-utils';
import { Scrollbar } from 'src/components/scrollbar';

// ----------------------------------------------------------------------

export const AuraStreamingTest = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [prompt, setPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<string>('');

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, isThinking]);

  // Check token on mount
  useEffect(() => {
    const token = getAccessToken();
    const tenantId = getTenantId();
    setTokenInfo(
      token
        ? `✅ Token: ${token.substring(0, 20)}... (Tenant: ${tenantId})`
        : '⚠️ No token found in localStorage'
    );
  }, []);

  const handleTestStream = async () => {
    if (!prompt.trim() || isLoading) return;

    // Abort previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStreamingText('');
    setIsLoading(true);
    setIsThinking(true);
    setError(null);

    const token = getAccessToken();
    const tenantId = getTenantId();

    try {
      const response = await fetch('http://localhost:8080/api/aura/test/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          prompt,
          context: {
            activeApp: 'test',
            path: '/aura-test',
            timestamp: new Date().toISOString(),
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      if (!reader) {
        throw new Error('No reader available');
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

            if (data.type === 'thought') {
              setIsThinking(true);
            } else if (data.content) {
              setIsThinking(false);
              accumulatedText += data.content;
              setStreamingText(accumulatedText);
            }
          } catch (e) {
            console.error('Error parsing SSE data chunk:', e, dataStr);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Streaming request failed');
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleClear = () => {
    handleStop();
    setStreamingText('');
    setError(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>
            Aura Streaming Test
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Gateway를 통한 SSE 스트리밍 연동 테스트
          </Typography>
        </Box>

        <Card sx={{ p: 2, bgcolor: 'background.neutral' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            인증 정보
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {tokenInfo}
          </Typography>
        </Card>

        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="테스트 프롬프트"
              placeholder="Aura에게 질문을 입력하세요..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleTestStream()}
              multiline
              rows={3}
            />

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={handleTestStream}
                disabled={isLoading || !prompt.trim()}
                startIcon={isLoading ? <CircularProgress size={16} /> : null}
              >
                {isLoading ? '스트리밍 중...' : '스트리밍 테스트 시작'}
              </Button>
              {isLoading && (
                <Button variant="outlined" color="error" onClick={handleStop}>
                  중단
                </Button>
              )}
              <Button variant="outlined" onClick={handleClear}>
                초기화
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {(streamingText || isThinking || error) && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              스트리밍 응답
            </Typography>
            <Scrollbar sx={{ maxHeight: 400, minHeight: 200 }}>
              <Box ref={scrollRef} sx={{ p: 1 }}>
                <Stack spacing={2}>
                  {isThinking && !streamingText && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                        생각 중...
                      </Typography>
                    </Box>
                  )}

                  {streamingText && (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {streamingText}
                    </Typography>
                  )}

                  {error && (
                    <Alert severity="error">
                      <Typography variant="body2">{error}</Typography>
                    </Alert>
                  )}
                </Stack>
              </Box>
            </Scrollbar>
          </Paper>
        )}

        <Card sx={{ p: 2, bgcolor: 'background.neutral' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            테스트 엔드포인트
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            POST http://localhost:8080/api/aura/test/stream
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
            Headers: X-Tenant-ID, Authorization (Bearer token from localStorage)
          </Typography>
        </Card>
      </Stack>
    </Box>
  );
};
