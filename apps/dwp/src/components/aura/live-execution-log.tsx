// ----------------------------------------------------------------------

import type { ExecutionLog } from 'src/store/use-aura-store';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type LiveExecutionLogProps = {
  logs: ExecutionLog[];
  isOpen?: boolean;
  onToggle?: () => void;
};

export const LiveExecutionLog = ({ logs, isOpen = true, onToggle, contextOpen = false }: LiveExecutionLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: ExecutionLog['type']) => {
    switch (type) {
      case 'command':
        return '#4caf50';
      case 'api':
        return '#2196f3';
      case 'info':
        return '#9e9e9e';
      case 'error':
        return '#f44336';
      case 'success':
        return '#4caf50';
      default:
        return '#ffffff';
    }
  };

  const getLogPrefix = (type: ExecutionLog['type']) => {
    switch (type) {
      case 'command':
        return '$';
      case 'api':
        return '→';
      case 'info':
        return 'ℹ';
      case 'error':
        return '✗';
      case 'success':
        return '✓';
      default:
        return '•';
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: contextOpen ? '320px' : 0,
        right: 0,
        maxHeight: 200,
        bgcolor: 'grey.900',
        color: 'grey.100',
        borderTop: '1px solid',
        borderColor: 'grey.700',
        zIndex: 1300,
        transition: 'left 0.3s',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'grey.700',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify icon="solar:terminal-bold" width={16} sx={{ color: 'grey.400' }} />
          <Typography variant="caption" sx={{ color: 'grey.400', fontFamily: 'monospace' }}>
            실행 로그 ({logs.length})
          </Typography>
        </Stack>
        {onToggle && (
          <IconButton size="small" onClick={onToggle} sx={{ color: 'grey.400' }}>
            <Iconify icon={isOpen ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-up-bold'} width={16} />
          </IconButton>
        )}
      </Box>
      <Collapse in={isOpen}>
        <Box
          ref={scrollRef}
          sx={{
            p: 1.5,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            maxHeight: 150,
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: 6,
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'grey.700',
              borderRadius: 1,
            },
          }}
        >
          <AnimatePresence>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    mb: 0.5,
                    color: getLogColor(log.type),
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      color: 'grey.500',
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      minWidth: 60,
                    }}
                  >
                    {log.timestamp.toLocaleTimeString()}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      color: getLogColor(log.type),
                      fontFamily: 'monospace',
                      minWidth: 20,
                    }}
                  >
                    {getLogPrefix(log.type)}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      color: getLogColor(log.type),
                      fontFamily: 'monospace',
                      flex: 1,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {log.content}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length === 0 && (
            <Typography variant="caption" sx={{ color: 'grey.500', fontStyle: 'italic' }}>
              실행 로그가 없습니다.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
