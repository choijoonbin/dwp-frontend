// ----------------------------------------------------------------------

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import { Iconify } from 'src/components/iconify';
import { useAgentStream, type AgentMessage } from '@dwp-frontend/shared-utils';
import { Scrollbar } from 'src/components/scrollbar';

// ----------------------------------------------------------------------

export const AuraBar = () => {
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [prompt, setPrompt] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  
  const { stream, streamingText, isThinking, isLoading, error } = useAgentStream();

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, isThinking]);

  const handleSend = () => {
    if (!prompt.trim() || isLoading) return;

    // Abort previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage: AgentMessage = { role: 'user', content: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setIsExpanded(true);
    
    stream({ 
      prompt,
      abortController: abortControllerRef.current,
      options: {
        onSuccess: (fullText) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: fullText }]);
          abortControllerRef.current = null;
        },
        onError: () => {
          abortControllerRef.current = null;
        }
      }
    });
    
    setPrompt('');
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleToggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  const handleClear = () => {
    handleStop();
    setMessages([]);
    setIsExpanded(false);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: theme.zIndex.drawer + 100,
        width: '100%',
        maxWidth: isExpanded ? 700 : 600,
        px: 2,
        transition: theme.transitions.create(['max-width']),
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
          boxShadow: (theme) => theme.customShadows.z20,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Collapse in={isExpanded}>
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, px: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}>
                  <Iconify icon="solar:magic-stick-bold-duotone" width={16} />
                </Avatar>
                <Typography variant="subtitle2">Aura 에이전트</Typography>
                {isLoading && (
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                    • Streaming...
                  </Typography>
                )}
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" onClick={handleClear} title="대화 초기화">
                  <Iconify icon="solar:trash-bin-minimalistic-bold" width={18} />
                </IconButton>
                <IconButton size="small" onClick={handleToggleExpand}>
                  <Iconify icon="solar:alt-arrow-down-bold" width={18} />
                </IconButton>
              </Stack>
            </Stack>

            <Scrollbar sx={{ maxHeight: 400, minHeight: 100 }}>
              <Box ref={scrollRef} sx={{ px: 0.5 }}>
                <Stack spacing={2}>
                  {messages.map((msg, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '85%',
                          p: 1.5,
                          borderRadius: 1.5,
                          typography: 'body2',
                          whiteSpace: 'pre-wrap',
                          ...(msg.role === 'user'
                            ? { bgcolor: 'primary.main', color: 'primary.contrastText' }
                            : { bgcolor: 'background.neutral' }),
                        }}
                      >
                        {msg.content}
                      </Box>
                    </Box>
                  ))}

                  {(isThinking || streamingText) && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <Box sx={{ maxWidth: '85%', p: 1.5, borderRadius: 1.5, bgcolor: 'background.neutral' }}>
                        {isThinking && !streamingText && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={16} color="inherit" />
                            <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
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

                  {error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
                    </Alert>
                  )}
                </Stack>
              </Box>
            </Scrollbar>
          </Box>
        </Collapse>

        <TextField
          fullWidth
          placeholder="Aura에게 무엇이든 물어보세요..."
          value={prompt}
          autoComplete="off"
          onClick={() => !isExpanded && setIsExpanded(true)}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="solar:user-bold" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {isLoading ? (
                  <IconButton color="error" onClick={handleStop} title="중단">
                    <Iconify icon="solar:stop-circle-bold" />
                  </IconButton>
                ) : (
                  <IconButton color="primary" onClick={handleSend} disabled={!prompt.trim()}>
                    <Iconify icon="solar:paper-plane-bold" />
                  </IconButton>
                )}
              </InputAdornment>
            ),
            sx: {
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              bgcolor: 'background.neutral',
              borderRadius: 1.5,
            },
          }}
        />
      </Paper>
    </Box>
  );
};
