// ----------------------------------------------------------------------

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

type ResultViewerProps = {
  result: {
    type: 'diff' | 'preview' | 'checklist' | 'text';
    content: any;
    title?: string;
  };
};

export const ResultViewer = ({ result }: ResultViewerProps) => {
  if (result.type === 'diff') {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          {result.title || '코드 변경사항'}
        </Typography>
        <Box
          sx={{
            borderRadius: 1,
            overflow: 'hidden',
            '& pre': {
              margin: 0,
              borderRadius: 0,
            },
          }}
        >
          <SyntaxHighlighter language="diff" style={vscDarkPlus}>
            {typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}
          </SyntaxHighlighter>
        </Box>
      </Paper>
    );
  }

  if (result.type === 'preview') {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          {result.title || '문서 프리뷰'}
        </Typography>
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.neutral',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {typeof result.content === 'string' ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {result.content}
            </Typography>
          ) : (
            <pre style={{ margin: 0, fontSize: '0.875rem' }}>{JSON.stringify(result.content, null, 2)}</pre>
          )}
        </Box>
      </Paper>
    );
  }

  if (result.type === 'checklist') {
    const items = Array.isArray(result.content) ? result.content : [];
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          {result.title || '체크리스트'}
        </Typography>
        <Stack spacing={1}>
          {items.map((item: string | { label: string; checked?: boolean }, index: number) => {
            const label = typeof item === 'string' ? item : item.label;
            const checked = typeof item === 'object' ? item.checked || false : false;
            return (
              <FormControlLabel
                key={index}
                control={<Checkbox checked={checked} disabled />}
                label={<Typography variant="body2">{label}</Typography>}
              />
            );
          })}
        </Stack>
      </Paper>
    );
  }

  // Default: text
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        {result.title || '결과'}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}
      </Typography>
    </Paper>
  );
};
