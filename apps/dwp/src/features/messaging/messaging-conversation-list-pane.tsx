import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { FormField, GuidedEmptyState } from '@dwp-frontend/design-system';
import { getMessagingDisplayPreference } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';

import { MessagingConversationListItem } from './messaging-components';
import { MESSAGING_DISPLAY_QUERY_KEY } from './messaging-display-model';

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
  };
  onSearchChange: (value: string) => void;
  onSelect: (conversation: MessagingConversation) => void;
};

export function MessagingConversationListPane({
  conversations,
  selectedId,
  search,
  searchInputRef,
  loading,
  loadError,
  labels,
  onSearchChange,
  onSelect,
}: MessagingConversationListPaneProps) {
  const displayQuery = useQuery({
    queryKey: MESSAGING_DISPLAY_QUERY_KEY,
    queryFn: getMessagingDisplayPreference,
    staleTime: 60_000,
  });
  return (
    <Box
      component="nav"
      aria-label={labels.list}
      sx={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
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
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
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
        ) : conversations.length ? (
          conversations.map((conversation) => (
            <MessagingConversationListItem
              key={conversation.conversationId}
              conversation={conversation}
              selected={selectedId === conversation.conversationId}
              showPreview={displayQuery.data?.messagePreview ?? true}
              onSelect={() => onSelect(conversation)}
            />
          ))
        ) : (
          <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center', p: 2 }}>
            <GuidedEmptyState
              kind={search ? 'no-results' : 'empty'}
              title={labels.emptyTitle}
              description={labels.emptyDescription}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
