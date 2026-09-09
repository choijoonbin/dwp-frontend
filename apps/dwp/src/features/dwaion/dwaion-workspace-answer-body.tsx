import { foundationTokens } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function DwaionStructuredAnswerBody({
  answer,
  compact = true,
}: {
  answer: string;
  compact?: boolean;
}) {
  const blocks = answer
    .split(/\n+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <Stack spacing={1}>
      {blocks.map((block, index) => {
        const heading = /^\d+\.\s/.test(block) && !block.includes('\n');
        const warning = /추가 확인|확인.*필요|충돌|주의|보존 기한/.test(block);
        if (heading) {
          return (
            <Typography
              key={`${index}:${block}`}
              component="h3"
              variant={compact ? 'body2' : 'subtitle1'}
              fontWeight="fontWeightBold"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: index ? 0.75 : 0 }}
            >
              <Box
                component="span"
                aria-hidden="true"
                sx={{
                  width: 4,
                  height: 15,
                  borderRadius: foundationTokens.radius.surface + 'px',
                  bgcolor: warning ? 'warning.main' : 'primary.main',
                }}
              />
              {block}
            </Typography>
          );
        }
        return (
          <Box
            key={`${index}:${block}`}
            sx={{
              px: index === 0 ? 0 : 1.25,
              py: index === 0 ? 0 : 1.1,
              border: index === 0 ? 0 : 1,
              borderColor: warning ? 'warning.light' : 'divider',
              borderRadius: foundationTokens.radius.surface + 'px',
              bgcolor: index === 0 ? 'transparent' : warning ? 'warning.lighter' : 'action.hover',
            }}
          >
            <Typography
              component="p"
              variant={compact ? 'body2' : 'body1'}
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: compact ? 'body2.lineHeight' : 'body1.lineHeight',
              }}
            >
              {block}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
