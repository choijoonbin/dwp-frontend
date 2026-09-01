import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkCheck, CalendarDays, Clock3 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import { updateCommunicationReaderState, useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { storyDate } from './communication-feed-support';

import type { CommunicationItem } from '@dwp-frontend/shared-utils';

export function CommunicationStoryMeta({
  item,
  light = false,
}: {
  item: CommunicationItem;
  light?: boolean;
}) {
  const { t } = useTranslation('communications');
  const color = light ? 'rgba(255,255,255,0.78)' : 'text.secondary';
  return (
    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
      <Typography variant="caption" color={color} fontWeight={700}>
        {item.publisherName}
      </Typography>
      <Box aria-hidden="true" sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: color }} />
      <Stack direction="row" alignItems="center" gap={0.45} color={color}>
        <CalendarDays size={13} aria-hidden="true" />
        <Typography variant="caption" color="inherit">
          {storyDate(item.publishedAt)}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.45} color={color}>
        <Clock3 size={13} aria-hidden="true" />
        <Typography variant="caption" color="inherit">
          {t('story.readTime', { count: item.readingMinutes })}
        </Typography>
      </Stack>
    </Stack>
  );
}

export function CommunicationSaveButton({
  item,
  compact = false,
}: {
  item: CommunicationItem;
  compact?: boolean;
}) {
  const { t } = useTranslation('communications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const updateReaderState = useProductActionMutation(
    'route.communications.work.reader-state.action'
  );
  const mutation = useMutation({
    mutationFn: () =>
      updateReaderState((authority) =>
        updateCommunicationReaderState(
          item.communicationId,
          { saved: !item.readerState.saved },
          authority
        )
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communications'] }),
    onError: () => toast.error(t('story.saveError')),
  });
  const label = item.readerState.saved ? t('story.removeSaved') : t('story.save');

  if (compact) {
    return (
      <ActionIconButton
        label={label}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {item.readerState.saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </ActionIconButton>
    );
  }
  return (
    <ActionButton
      intent="secondary"
      startIcon={item.readerState.saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {item.readerState.saved ? t('story.saved') : t('story.save')}
    </ActionButton>
  );
}
