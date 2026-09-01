import { Suspense } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { LazyMessagingMeetingDialog } from './meeting';

import type { MessagingMeetingLabels } from './meeting/messaging-meeting-dialog';

type MessagingMeetingHostProps = {
  open: boolean;
  conversationId: string;
  conversationName: string;
  displayName: string;
  currentUserId: number;
  canModerateConversation: boolean;
  labels: MessagingMeetingLabels;
  onClose: () => void;
};

export function MessagingMeetingHost({
  open,
  conversationId,
  conversationName,
  displayName,
  currentUserId,
  canModerateConversation,
  labels,
  onClose,
}: MessagingMeetingHostProps) {
  return (
    <Suspense
      fallback={
        open ? (
          <Box
            role="status"
            aria-label={labels.loading}
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 1400,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <CircularProgress size={32} aria-hidden="true" />
          </Box>
        ) : null
      }
    >
      <LazyMessagingMeetingDialog
        open={open}
        conversationId={conversationId}
        conversationName={conversationName}
        displayName={displayName}
        currentUserId={currentUserId}
        canModerateConversation={canModerateConversation}
        labels={labels}
        onClose={onClose}
      />
    </Suspense>
  );
}
