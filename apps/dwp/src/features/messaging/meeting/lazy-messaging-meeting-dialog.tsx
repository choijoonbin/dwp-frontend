import { lazy } from 'react';

export const LazyMessagingMeetingDialog = lazy(() =>
  import('./messaging-meeting-dialog').then((module) => ({
    default: module.MessagingMeetingDialog,
  }))
);
