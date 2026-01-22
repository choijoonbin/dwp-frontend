// ----------------------------------------------------------------------

import type { RefObject, KeyboardEvent } from 'react';
import type { HitlRequest, AgentMessage } from 'src/store/use-aura-store';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { ConfidenceScore } from '../../../components/aura/confidence-score';
import { StreamStatusBanner } from '../../../components/aura/stream-status-banner';

// ----------------------------------------------------------------------

type ChatPanelProps = {
  title: string;
  pendingHitl: HitlRequest | null;
  messages: AgentMessage[];
  isThinking: boolean;
  isStreaming: boolean;
  streamingText: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onReturn: () => void;
  onRetry: () => void;
  onCancel: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  showHeader?: boolean;
  showContextToggle: boolean;
  onToggleContext: () => void;
};

const getRoleLabel = (role: AgentMessage['role']) => {
  switch (role) {
    case 'assistant':
      return 'Aura';
    case 'thought':
      return '생각';
    case 'action':
      return '작업';
    default:
      return '사용자';
  }
};

export const ChatPanel = ({
  title,
  pendingHitl,
  messages,
  isThinking,
  isStreaming,
  streamingText,
  prompt,
  onPromptChange,
  onSend,
  onReturn,
  onRetry,
  onCancel,
  scrollRef,
  showHeader = true,
  showContextToggle,
  onToggleContext,
}: ChatPanelProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {showHeader && (
        <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                <Iconify icon="solar:magic-stick-3-bold" width={20} />
                <Typography variant="h6">{title}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                {showContextToggle && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={onToggleContext}
                    startIcon={<Iconify icon="solar:window-frame-bold" width={16} />}
                  >
                    컨텍스트
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onReturn}
                  startIcon={<Iconify icon="solar:arrow-left-bold" width={16} />}
                >
                  돌아가기
                </Button>
              </Stack>
            </Stack>
            {pendingHitl?.confidence !== undefined && (
              <ConfidenceScore confidence={pendingHitl.confidence} onRequestInfo={() => {}} />
            )}
            <StreamStatusBanner onRetry={onRetry} onCancel={onCancel} />
          </Stack>
        </Box>
      )}

      <Scrollbar
        sx={{
          flex: 1,
          minHeight: 0,
          '& .simplebar-wrapper': { height: '100%' },
          '& .simplebar-mask': { height: '100%' },
          '& .simplebar-offset': { height: '100%' },
          '& .simplebar-content-wrapper': { height: '100%', overflow: 'hidden auto !important' },
          '& .simplebar-content': { height: '100%', display: 'flex', flexDirection: 'column' },
        }}
      >
        <Box ref={scrollRef} sx={{ p: { xs: 2, md: 2.5 }, flexGrow: 1 }}>
          <Stack spacing={2}>
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <Stack
                  key={msg.id}
                  direction="row"
                  spacing={1.5}
                  justifyContent={isUser ? 'flex-end' : 'flex-start'}
                  alignItems="flex-start"
                  sx={{ minWidth: 0 }}
                >
                  {!isUser && (
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 3,
                      }}
                    >
                      <Iconify icon="solar:magic-stick-3-bold" width={16} />
                    </Box>
                  )}
                  <Box
                    sx={{
                      maxWidth: { xs: 'calc(100% - 48px)', md: '85%' },
                      minWidth: 0,
                    }}
                  >
                    <Box
                      sx={{
                        px: 2,
                        py: 1.5,
                        bgcolor: isUser ? 'primary.main' : 'background.neutral',
                        color: isUser ? 'primary.contrastText' : 'text.primary',
                        borderRadius: 2,
                        borderBottomRightRadius: isUser ? 0.75 : 2,
                        borderBottomLeftRadius: isUser ? 2 : 0.75,
                        boxShadow: isUser ? 6 : 'none',
                      }}
                    >
                      {!isUser && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          {getRoleLabel(msg.role)}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ mt: 0.75, color: isUser ? 'text.secondary' : 'text.secondary', display: 'block' }}
                    >
                      {formatTime(msg.timestamp)}
                    </Typography>
                  </Box>
                  {isUser && (
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        bgcolor: 'primary.lighter',
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}
                    >
                      U
                    </Box>
                  )}
                </Stack>
              );
            })}

            {(isThinking || streamingText) && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: 'background.neutral',
                    borderRadius: 2,
                    maxWidth: { xs: '100%', md: '85%' },
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
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
                </Box>
              </Box>
            )}
          </Stack>
        </Box>
      </Scrollbar>

      <Box
        sx={{
          p: { xs: 2, md: 2.5 },
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.neutral',
          minHeight: 80,
        }}
      >
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          InputProps={{
            endAdornment: (
              <IconButton onClick={onSend} disabled={!prompt.trim() || isStreaming}>
                <Iconify icon="solar:paper-plane-bold" />
              </IconButton>
            ),
          }}
        />
      </Box>
    </Box>
  );
};
