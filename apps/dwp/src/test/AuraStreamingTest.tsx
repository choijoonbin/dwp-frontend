// ----------------------------------------------------------------------

import { useState, useRef, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { NX_API_URL } from '@dwp-frontend/shared-utils';
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
  const [authStatus, setAuthStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [tools, setTools] = useState<string[]>([]);
  const [responseMetadata, setResponseMetadata] = useState<Record<string, any>>({});

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, isThinking, tools]);

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
    setAuthStatus('idle');
    setTools([]);
    setResponseMetadata({});

    const token = getAccessToken();
    const tenantId = getTenantId();

    if (!token) {
      setError('토큰이 없습니다. 먼저 로그인해주세요.');
      setIsLoading(false);
      setIsThinking(false);
      return;
    }

    try {
      const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          Authorization: `Bearer ${token}`,
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
        if (response.status === 401) {
          setAuthStatus('failed');
          setError(`인증 실패 (HTTP ${response.status}): 토큰이 유효하지 않습니다.`);
        } else {
          setError(`HTTP ${response.status}: ${response.statusText}`);
        }
        setIsLoading(false);
        setIsThinking(false);
        return;
      }

      // 인증 성공 표시
      setAuthStatus('success');

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

            // 도구 목록 처리
            if (data.type === 'tools' && Array.isArray(data.tools)) {
              setTools(data.tools);
              console.log('Available tools:', data.tools);
            }

            // 메타데이터 처리
            if (data.metadata) {
              setResponseMetadata((prev) => ({ ...prev, ...data.metadata }));
            }

            // 생각 중 상태
            if (data.type === 'thought' || data.type === 'thinking') {
              setIsThinking(true);
              if (data.content) {
                console.log('Thinking:', data.content);
              }
            }

            // 실제 답변 내용
            if (data.type === 'content' || data.type === 'message' || data.content) {
              setIsThinking(false);
              const content = data.content || data.message || '';
              accumulatedText += content;
              setStreamingText(accumulatedText);
            }

            // 기타 타입 로깅
            if (data.type && !['thought', 'thinking', 'content', 'message', 'tools'].includes(data.type)) {
              console.log('Received data type:', data.type, data);
            }
          } catch (e) {
            console.error('Error parsing SSE data chunk:', e, dataStr);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Streaming request failed');
        setAuthStatus('failed');
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
    setAuthStatus('idle');
    setTools([]);
    setResponseMetadata({});
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
          <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
            {tokenInfo}
          </Typography>
          {authStatus === 'success' && (
            <Alert severity="success" sx={{ mt: 1 }}>
              ✅ 인증 성공 - 요청이 정상적으로 처리되었습니다.
            </Alert>
          )}
          {authStatus === 'failed' && (
            <Alert severity="error" sx={{ mt: 1 }}>
              ❌ 인증 실패 - 토큰을 확인해주세요.
            </Alert>
          )}
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

        {tools.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              사용 가능한 도구 목록 ({tools.length}개)
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {tools.map((tool, index) => (
                <Chip key={index} label={tool} size="small" variant="outlined" />
              ))}
            </Stack>
            <List dense sx={{ mt: 1, bgcolor: 'background.neutral', borderRadius: 1 }}>
              {tools.map((tool, index) => (
                <ListItem key={index}>
                  <ListItemText primary={tool} primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }} />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {(streamingText || isThinking || error) && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              스트리밍 응답
            </Typography>
            <Scrollbar sx={{ maxHeight: 400, minHeight: 200 }}>
              <Box ref={scrollRef} sx={{ p: 1 }}>
                <Stack spacing={2}>
                  {isThinking && !streamingText && (
                    <Alert severity="info" icon={<CircularProgress size={16} />}>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        생각 중... Aura가 답변을 준비하고 있습니다.
                      </Typography>
                    </Alert>
                  )}

                  {streamingText && (
                    <Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {streamingText}
                      </Typography>
                    </Box>
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

        {Object.keys(responseMetadata).length > 0 && (
          <Card sx={{ p: 2, bgcolor: 'background.neutral' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              응답 메타데이터
            </Typography>
            <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(responseMetadata, null, 2)}</pre>
            </Box>
          </Card>
        )}

        <Card sx={{ p: 2, bgcolor: 'background.neutral' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            테스트 엔드포인트
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            POST {NX_API_URL}/api/aura/test/stream
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
            Headers: X-Tenant-ID, Authorization (Bearer token from localStorage)
          </Typography>
        </Card>
      </Stack>
    </Box>
  );
};
