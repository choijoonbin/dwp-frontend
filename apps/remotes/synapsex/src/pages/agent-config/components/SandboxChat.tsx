/**
 * Deployment Sandbox — 테스트 채팅창
 * BE API에서 systemInstruction 포함 설정을 가져와 채팅 세션 초기화. POST /api/aura/test/stream
 * @see docs/reference/AGENT_STUDIO_CONTRACT_AND_BE_COLLABORATION.md
 */

import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useCallback } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import {
  getUserId,
  NX_API_URL,
  getTenantId,
  getAgentById,
  getAccessToken,
  getAgentContext,
  getAgentSessionId,
  buildStreamRequestHeaders,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

type SandboxChatProps = {
  selectedAgentId: string | null;
  /** BE에서 가져오기 전까지 또는 미선택 시 사용 */
  fallbackSystemPrompt: string;
  engineKey: string;
  temperature: number;
  onClose?: () => void;
};

export const SandboxChat = ({ selectedAgentId, fallbackSystemPrompt, engineKey, temperature, onClose }: SandboxChatProps) => {
  const { data: detailRes } = useQuery({
    queryKey: ['synapse', 'agents', 'detail', selectedAgentId ?? ''],
    queryFn: () => getAgentById(selectedAgentId!),
    enabled: !!selectedAgentId,
  });
  const detail = detailRes?.data;
  const systemPromptForSession = detail?.systemInstruction ?? detail?.systemPrompt ?? fallbackSystemPrompt;

  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setReply('');

    const tenantId = getTenantId();
    const token = getAccessToken();
    const agentId = getAgentSessionId();
    const userId = getUserId();
    const context = getAgentContext();
    const headers = buildStreamRequestHeaders({
      tenantId,
      token: token ?? undefined,
      contentType: 'application/json',
      agentId,
      userId: userId ?? undefined,
    });

    try {
      const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: message,
          system_prompt: systemPromptForSession,
          model: engineKey,
          temperature,
          context: { ...context, systemPrompt: systemPromptForSession },
          sandbox: true,
          temporary_session: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        setError(`HTTP ${response.status}`);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) {
        setError('No response body');
        return;
      }
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) text += parsed.content;
              if (parsed.text) text += parsed.text;
            } catch {
              if (data.length > 0) text += data;
            }
          }
        }
        setReply(text);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'Request failed');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, systemPromptForSession, engineKey, temperature]);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 0, sm: 24 },
        right: { xs: 0, sm: 24 },
        left: { xs: 0, sm: 'auto' },
        width: { xs: '100%', sm: 380 },
        maxHeight: { xs: '80vh', sm: 420 },
        bgcolor: 'background.paper',
        borderRadius: { xs: '16px 16px 0 0', sm: 2 },
        boxShadow: 4,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1300,
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">테스트 채팅 (미리보기)</Typography>
        {onClose && (
          <IconButton size="medium" onClick={onClose} aria-label="Close" sx={{ minWidth: 44, minHeight: 44 }}>
            <Iconify icon="solar:close-circle-bold" width={20} />
          </IconButton>
        )}
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, minHeight: 120 }}>
        {error && <Typography color="error" variant="body2">{error}</Typography>}
        {reply && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{reply}</Typography>}
        {loading && !reply && <Typography variant="body2" color="text.secondary">응답 대기 중...</Typography>}
      </Box>
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          id="sandbox-chat-input"
          name="sandboxChatMessage"
          inputProps={{ 'aria-label': '테스트 채팅 메시지' }}
          placeholder="메시지 입력 후 전송..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
          InputProps={{
            endAdornment: (
              <IconButton size="medium" onClick={send} disabled={loading || !input.trim()} sx={{ ml: 0.5, minWidth: 44, minHeight: 44 }}>
                <Iconify icon="solar:plain-2-bold" width={20} />
              </IconButton>
            ),
          }}
        />
      </Box>
    </Box>
  );
};
