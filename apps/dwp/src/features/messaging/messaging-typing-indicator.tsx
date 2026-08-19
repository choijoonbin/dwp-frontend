import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function MessagingTypingIndicator({ names }: { names: string[] }) {
  const { t } = useTranslation('messaging');
  const label =
    names.length === 1
      ? t('conversation.typing.one', { name: names[0] })
      : names.length === 2
        ? t('conversation.typing.two', { first: names[0], second: names[1] })
        : names.length > 2
          ? t('conversation.typing.many', { name: names[0], count: names.length - 1 })
          : '';

  return (
    <Stack
      direction="row"
      spacing={0.8}
      alignItems="center"
      role="status"
      aria-live="polite"
      sx={{ minHeight: 22, mb: 0.5, px: 0.25 }}
    >
      {names.length ? (
        <>
          <Stack direction="row" spacing={0.3} aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <Box
                key={index}
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  animation: 'messagingTypingDot 1.2s ease-in-out infinite',
                  animationDelay: `${index * 120}ms`,
                  '@keyframes messagingTypingDot': {
                    '0%, 60%, 100%': { opacity: 0.35, transform: 'translateY(0)' },
                    '30%': { opacity: 1, transform: 'translateY(-2px)' },
                  },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
        </>
      ) : null}
    </Stack>
  );
}
