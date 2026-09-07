import { ArrowUpRight, MessageSquare, Trash2 } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionIconButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { DwaionConversationSummary } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function DwaionArchiveList({
  items,
  onDelete,
}: {
  items: DwaionConversationSummary[];
  onDelete: (item: DwaionConversationSummary) => void;
}) {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  return (
    <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {items.map((item) => (
        <Box
          component="li"
          key={item.conversationId}
          data-testid="dwaion-archive-row"
          sx={{
            display: 'flex',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            overflow: 'hidden',
            transition: (theme) =>
              theme.transitions.create('border-color', {
                duration: theme.transitions.duration.shorter,
              }),
            '&:hover, &:focus-within': { borderColor: 'primary.main' },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          <Box
            component={RouterLink}
            to={`/dwaion/conversations/${encodeURIComponent(item.conversationId)}`}
            sx={{
              minWidth: 0,
              flex: 1,
              color: 'text.primary',
              textDecoration: 'none',
              p: 2,
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -3,
              },
            }}
          >
            <Stack
              direction="row"
              flexWrap="wrap"
              gap={1}
              alignItems="center"
              sx={{ color: 'text.secondary' }}
            >
              <Typography component="time" dateTime={item.lastMessageAt} variant="caption">
                {formatDate(
                  item.lastMessageAt,
                  { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                  locale
                )}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <MessageSquare size={12} />
                {t('dwaionArchive.messageCount', { count: item.messageCount })}
              </Typography>
            </Stack>
            <Typography
              component="h2"
              variant="subtitle2"
              sx={{
                mt: 0.75,
                overflowWrap: 'anywhere',
                lineHeight: (theme) => theme.typography.body2.lineHeight,
              }}
            >
              {item.title}
            </Typography>
            <Typography
              variant="caption"
              color="primary.main"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}
            >
              {t('dwaionArchive.continue')}
              <ArrowUpRight size={14} />
            </Typography>
          </Box>
          <Box sx={{ p: 1, alignSelf: 'flex-start' }}>
            <ActionIconButton
              size="small"
              label={t('dwaionArchive.deleteNamed', { title: item.title })}
              onClick={() => onDelete(item)}
            >
              <Trash2 size={15} />
            </ActionIconButton>
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
