// ----------------------------------------------------------------------

import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import { Iconify } from 'src/components/iconify';
import { useAgentStream } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

export const AuraBar = () => {
  const theme = useTheme();
  const [prompt, setPrompt] = useState('');
  const { stream, streamingText, isThinking, isLoading } = useAgentStream();

  const handleSend = () => {
    if (!prompt.trim()) return;
    stream({ prompt });
    setPrompt('');
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
        maxWidth: 600,
        px: 2,
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
        }}
      >
        <Stack spacing={1}>
          {(isThinking || streamingText) && (
            <Box
              sx={{
                px: 1.5,
                py: 1,
                maxHeight: 200,
                overflowY: 'auto',
                bgcolor: 'background.neutral',
                borderRadius: 1,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Iconify
                  icon="solar:magic-stick-bold-duotone"
                  sx={{ color: 'primary.main', mt: 0.5 }}
                />
                <Box>
                  {isThinking && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                      Aura가 생각 중입니다...
                    </Typography>
                  )}
                  {streamingText && (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {streamingText}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          )}

          <TextField
            fullWidth
            placeholder="Aura에게 무엇이든 물어보세요..."
            value={prompt}
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
                  <IconButton color="primary" onClick={handleSend} disabled={isLoading || !prompt.trim()}>
                    {isLoading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      <Iconify icon="solar:paper-plane-bold" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                bgcolor: 'background.neutral',
                borderRadius: 1.5,
              },
            }}
          />
        </Stack>
      </Paper>
    </Box>
  );
};
