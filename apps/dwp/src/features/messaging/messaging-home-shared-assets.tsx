import { useTranslation } from 'react-i18next';
import { ArrowUpRight, FileText, Link as LinkIcon, Paperclip } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import {
  ErrorState,
  GlyphSurface,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { messagingRelativeTime } from './messaging-components';
import { messagingVisualTokens } from './messaging-visual-model';

import type { MessagingSharedAsset } from '@dwp-frontend/shared-utils';

export function MessagingHomeSharedAssets({
  items,
  loading,
  error,
  onRetry,
}: {
  items: MessagingSharedAsset[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation('messaging');
  return (
    <Box
      component="section"
      aria-labelledby="messaging-home-shared-assets-title"
      data-testid="messaging-home-shared-assets"
      sx={{ minWidth: 0 }}
    >
      <Stack direction="row" gap={0.75} alignItems="center">
        <Paperclip size={16} aria-hidden="true" />
        <Typography
          id="messaging-home-shared-assets-title"
          component="h2"
          variant="subtitle1"
          fontWeight="fontWeightBold"
        >
          {t('home.sharedAssets.title')}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.35, mb: 1.2 }}
      >
        {t('home.sharedAssets.description')}
      </Typography>
      {loading ? (
        <LoadingState embedded label={t('home.sharedAssets.loading')} />
      ) : error ? (
        <ErrorState
          title={t('home.sharedAssets.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={onRetry}
          size="compact"
        />
      ) : items.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
            gap: 1,
          }}
        >
          {items.map((item) => {
            const Icon = item.kind === 'FILE' ? FileText : LinkIcon;
            return (
              <Box
                key={item.id}
                component={RouterLink}
                to={`/messages/inbox?conversation=${item.conversationId}`}
                aria-label={t('home.sharedAssets.openConversation', {
                  title: item.title,
                  conversation: item.conversationName,
                })}
                sx={(theme) => ({
                  minWidth: 0,
                  px: 1.25,
                  py: 1.4,
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr)',
                  gap: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: messagingVisualTokens.radius.surface,
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  textDecoration: 'none',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.035),
                  },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                  },
                })}
              >
                <GlyphSurface
                  size={30}
                  variant="soft"
                  tone={
                    item.kind === 'FILE'
                      ? messagingVisualTokens.tones.pinned
                      : messagingVisualTokens.tones.channel
                  }
                >
                  <Icon size={15} aria-hidden="true" />
                </GlyphSurface>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{
                      minHeight: 40,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ display: 'block', mt: 0.35 }}
                  >
                    {item.conversationName}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={0.5}
                  sx={{ gridColumn: '1 / -1', minWidth: 0 }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
                    {t(`home.sharedAssets.${item.kind}`)} ·{' '}
                    {messagingRelativeTime(item.sharedAt, i18n.resolvedLanguage ?? i18n.language)}
                  </Typography>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Stack>
              </Box>
            );
          })}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('home.sharedAssets.emptyTitle')}
          description={t('home.sharedAssets.emptyDescription')}
        />
      )}
    </Box>
  );
}
