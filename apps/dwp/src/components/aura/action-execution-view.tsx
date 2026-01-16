// ----------------------------------------------------------------------


import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type ActionExecutionViewProps = {
  executions: Array<{
    id: string;
    tool: string;
    params: Record<string, any>;
    timestamp: Date;
    status: 'executing' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }>;
};

export const ActionExecutionView = ({ executions }: ActionExecutionViewProps) => {
  const theme = useTheme();

  if (executions.length === 0) return null;

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'grey.900',
        color: 'grey.100',
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        borderRadius: 1,
        maxHeight: 300,
        overflow: 'auto',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'grey.300' }}>
        도구 실행 로그
      </Typography>
      <Stack spacing={1.5}>
        {executions.map((exec) => (
          <Box key={exec.id} sx={{ borderLeft: `3px solid ${exec.status === 'completed' ? '#4caf50' : exec.status === 'failed' ? '#f44336' : '#ff9800'}` }}>
            <Box sx={{ pl: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: exec.status === 'completed' ? '#4caf50' : exec.status === 'failed' ? '#f44336' : '#ff9800',
                    fontWeight: 'bold',
                  }}
                >
                  [{exec.status.toUpperCase()}]
                </Typography>
                <Typography variant="caption" sx={{ color: 'grey.400' }}>
                  {exec.tool}
                </Typography>
                <Typography variant="caption" sx={{ color: 'grey.500', ml: 'auto' }}>
                  {exec.timestamp.toLocaleTimeString()}
                </Typography>
              </Stack>
              <Box sx={{ pl: 1, color: 'grey.300' }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                  Parameters:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1,
                    bgcolor: 'rgba(0,0,0,0.3)',
                    borderRadius: 0.5,
                    fontSize: '0.75rem',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(exec.params, null, 2)}
                </Box>
              </Box>
              {exec.result && (
                <Box sx={{ pl: 1, mt: 1, color: 'grey.300' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    Result:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1,
                      bgcolor: 'rgba(76, 175, 80, 0.1)',
                      borderRadius: 0.5,
                      fontSize: '0.75rem',
                      overflow: 'auto',
                    }}
                  >
                    {typeof exec.result === 'string' ? exec.result : JSON.stringify(exec.result, null, 2)}
                  </Box>
                </Box>
              )}
              {exec.error && (
                <Box sx={{ pl: 1, mt: 1, color: '#f44336' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    Error:
                  </Typography>
                  <Typography variant="caption">{exec.error}</Typography>
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};
