import { Bot, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { DwaionConversationMessage } from '@dwp-frontend/shared-utils';

import { isGroundedFallbackStatus } from './dwaion-workspace-model';

export function DwaionConversationTranscript({
  messages,
  excludedMessageIds = [],
}: {
  messages: DwaionConversationMessage[];
  excludedMessageIds?: string[];
}) {
  const { t } = useTranslation('work');
  const excluded = new Set(excludedMessageIds);
  const visible = messages.filter((message) => !excluded.has(message.messageId));
  if (!visible.length) return null;

  return (
    <Box component="section" aria-label={t('askPage.history.transcript')} sx={{ mb: 3 }}>
      <Stack spacing={1.25}>
        {visible.map((message) => {
          const assistant = message.role === 'ASSISTANT';
          const groundedFallback = assistant && isGroundedFallbackStatus(message.statusCode);
          const Icon = assistant ? Bot : UserRound;
          const content =
            assistant && message.statusCode && message.content === message.statusCode
              ? t('askPage.history.withheld')
              : message.content;
          return (
            <Box
              key={message.messageId}
              sx={{
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr)',
                gap: 1.25,
                px: { xs: 1.25, sm: 1.75 },
                py: 1.5,
                bgcolor: assistant ? 'background.paper' : 'action.hover',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  bgcolor: assistant ? 'primary.lighter' : 'action.selected',
                  color: assistant ? 'primary.main' : 'text.secondary',
                }}
              >
                <Icon size={17} aria-hidden="true" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {t(assistant ? 'askPage.history.assistant' : 'askPage.history.you')}
                  </Typography>
                  {groundedFallback && (
                    <Chip
                      size="small"
                      color="info"
                      variant="outlined"
                      label={t('askPage.fallback.state')}
                    />
                  )}
                </Stack>
                {groundedFallback && (
                  <Typography
                    component="p"
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {t('askPage.history.fallbackDescription')}
                  </Typography>
                )}
                <Typography sx={{ mt: 0.4, whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
                  {content}
                </Typography>
                {message.citations.length > 0 && (
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    {message.citations.map((citation) => (
                      <Chip
                        key={citation.sourceId}
                        size="small"
                        variant="outlined"
                        label={citation.title}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
