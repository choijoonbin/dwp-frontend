import { ChevronDown, Hash, MessageSquarePlus, Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';
import { getMessagingDisplayPreference } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { alpha, lighten } from '@mui/material/styles';

import { MessagingConversationListItem } from './messaging-components';
import { MESSAGING_DISPLAY_QUERY_KEY } from './messaging-display-model';
import { messagingVisualTokens } from './messaging-visual-model';
import {
  buildMessagingNavigatorSections,
  filterMessagingNavigator,
  type MessagingNavigatorFilter,
  type MessagingNavigatorSectionKey,
} from './messaging-navigator-model';

import type { MessagingConversation } from '@dwp-frontend/shared-utils';
import type { ChangeEvent, RefObject } from 'react';

type MessagingConversationListPaneProps = {
  conversations: MessagingConversation[];
  selectedId: string | null;
  search: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  loading: boolean;
  loadError: boolean;
  labels: {
    search: string;
    list: string;
    loadError: string;
    emptyTitle: string;
    emptyDescription: string;
    create: string;
    loadMore: string;
    loadingMore: string;
  };
  hasMore: boolean;
  loadingMore: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (conversation: MessagingConversation) => void;
  onCreate: () => void;
  onLoadMore: () => void;
};

const sectionIcons = {
  PINNED: Star,
  CHANNELS: Hash,
  DIRECT: MessageSquarePlus,
} satisfies Record<MessagingNavigatorSectionKey, typeof Star>;

const sectionTones = {
  PINNED: messagingVisualTokens.tones.pinned,
  CHANNELS: messagingVisualTokens.tones.channel,
  DIRECT: messagingVisualTokens.tones.direct,
} satisfies Record<MessagingNavigatorSectionKey, string>;

export function MessagingConversationListPane({
  conversations,
  selectedId,
  search,
  searchInputRef,
  loading,
  loadError,
  labels,
  hasMore,
  loadingMore,
  onSearchChange,
  onSelect,
  onCreate,
  onLoadMore,
}: MessagingConversationListPaneProps) {
  const { t } = useTranslation('messaging');
  const [filter, setFilter] = useState<MessagingNavigatorFilter>('ALL');
  const displayQuery = useQuery({
    queryKey: MESSAGING_DISPLAY_QUERY_KEY,
    queryFn: getMessagingDisplayPreference,
    staleTime: 60_000,
  });
  const sections = useMemo(
    () => buildMessagingNavigatorSections(filterMessagingNavigator(conversations, filter)),
    [conversations, filter]
  );
  return (
    <Box
      component="nav"
      aria-label={labels.list}
      data-testid="messaging-conversation-navigator"
      sx={(theme) => ({
        minWidth: 0,
        minHeight: 0,
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.025),
      })}
    >
      <Box
        sx={(theme) => ({
          px: 1.25,
          pt: 1.25,
          pb: 1,
          borderBottom: 1,
          borderColor: alpha(theme.palette.primary.main, 0.1),
          bgcolor: alpha(
            theme.palette.background.paper,
            theme.palette.mode === 'dark' ? 0.76 : 0.82
          ),
        })}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="subtitle2" fontWeight="fontWeightBold">
              {t('navigator.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('navigator.count', { count: conversations.length })}
            </Typography>
          </Box>
          <ActionIconButton label={labels.create} size="small" onClick={onCreate}>
            <Plus size={17} />
          </ActionIconButton>
        </Stack>
        <FormField
          fullWidth
          size="small"
          value={search}
          placeholder={labels.search}
          inputRef={searchInputRef}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} aria-hidden="true" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': labels.search },
          }}
        />
        <Tabs
          value={filter}
          onChange={(_, value: MessagingNavigatorFilter) => setFilter(value)}
          aria-label={t('navigator.filterLabel')}
          variant="fullWidth"
          sx={{
            mt: 1,
            minHeight: 32,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTab-root': {
              minWidth: 0,
              minHeight: 32,
              px: 0.6,
              py: 0.5,
              fontSize: 'caption.fontSize',
              borderRadius: messagingVisualTokens.radius.compact,
            },
            '& .MuiTab-root.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            },
          }}
        >
          {(['ALL', 'FAVORITES', 'UNREAD'] as const).map((value) => (
            <Tab key={value} value={value} label={t(`navigator.filters.${value}`)} />
          ))}
        </Tabs>
        {filter !== 'ALL' && hasMore && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
            {t('navigator.loadedOnly')}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          py: 0.5,
        }}
      >
        {loading ? (
          <Box sx={{ p: 1.5 }} aria-busy="true">
            {[0, 1, 2, 3, 4].map((item) => (
              <Skeleton key={item} variant="rounded" height={84} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : loadError ? (
          <Alert severity="error" sx={{ m: 1.5 }}>
            {labels.loadError}
          </Alert>
        ) : sections.length ? (
          sections.map((section) => {
            const Icon = sectionIcons[section.key];
            const tone = sectionTones[section.key];
            return (
              <Box
                component="section"
                key={section.key}
                aria-labelledby={`messaging-navigator-${section.key.toLowerCase()}`}
                sx={{ '& + &': { mt: 0.75 } }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.65}
                  sx={(theme) => ({
                    px: 1.5,
                    py: 0.65,
                    color: theme.palette.mode === 'dark' ? lighten(tone, 0.55) : tone,
                  })}
                >
                  <Icon size={13} color="currentColor" aria-hidden="true" />
                  <Typography
                    id={`messaging-navigator-${section.key.toLowerCase()}`}
                    variant="caption"
                    sx={{ color: 'inherit', textTransform: 'uppercase' }}
                    fontWeight="fontWeightBold"
                  >
                    {t(`navigator.sections.${section.key}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {section.conversations.length}
                  </Typography>
                </Stack>
                {section.conversations.map((conversation) => (
                  <MessagingConversationListItem
                    key={conversation.conversationId}
                    conversation={conversation}
                    selected={selectedId === conversation.conversationId}
                    compact
                    showPreview={displayQuery.data?.messagePreview ?? true}
                    onSelect={() => onSelect(conversation)}
                  />
                ))}
              </Box>
            );
          })
        ) : (
          <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center', p: 2 }}>
            <GuidedEmptyState
              kind={search || filter !== 'ALL' ? 'no-results' : 'empty'}
              title={filter !== 'ALL' ? t('navigator.filterEmpty') : labels.emptyTitle}
              description={
                filter !== 'ALL' ? t('navigator.filterEmptyDescription') : labels.emptyDescription
              }
            />
          </Box>
        )}
        {hasMore && !loading ? (
          <Box sx={{ p: 1 }}>
            <ActionButton
              fullWidth
              intent="quiet"
              size="small"
              startIcon={<ChevronDown size={15} />}
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore ? labels.loadingMore : labels.loadMore}
            </ActionButton>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
