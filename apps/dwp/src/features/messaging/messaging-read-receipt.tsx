import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCheck, EyeOff, RefreshCw } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ContentDialog,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system';
import { getMessagingMessageReadReceipt } from '@dwp-frontend/shared-utils';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { messagingInitials } from './messaging-components';
import { messagingReceiptState } from './messaging-read-receipt-model';
import { messagingVisualTone } from './messaging-visual-model';

import type { MessagingMessage, MessagingReadReceipt } from '@dwp-frontend/shared-utils';

export function MessagingReadReceiptButton({
  message,
  receipt,
}: {
  message: MessagingMessage;
  receipt?: MessagingReadReceipt;
}) {
  const { t } = useTranslation('messaging');
  const [open, setOpen] = useState(false);
  const state = messagingReceiptState(receipt);
  const label =
    state === 'READ'
      ? t('receipts.readCount', { count: receipt!.readCount })
      : t(`receipts.summary.${state}`);
  return (
    <>
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={
          state === 'READ' ? (
            <CheckCheck size={14} />
          ) : state === 'UNAVAILABLE' ? (
            <EyeOff size={14} />
          ) : (
            <Check size={14} />
          )
        }
        aria-label={t('receipts.open', { status: label })}
        onClick={() => setOpen(true)}
        sx={{
          minHeight: 28,
          px: 0.5,
          py: 0,
          fontSize: 'caption.fontSize',
          color: state === 'READ' ? 'primary.main' : 'text.secondary',
        }}
      >
        {label}
      </ActionButton>
      {open ? (
        <MessagingReadReceiptDialog message={message} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function MessagingReadReceiptDialog({
  message,
  onClose,
}: {
  message: MessagingMessage;
  onClose: () => void;
}) {
  const { t } = useTranslation('messaging');
  const fullScreen = useMediaQuery('(max-width: 599px)');
  const query = useQuery({
    queryKey: ['messaging', 'read-receipts', message.conversationId, 'message', message.messageId],
    queryFn: () => getMessagingMessageReadReceipt(message.conversationId, message.messageId),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15_000,
    retry: 1,
  });
  return (
    <ContentDialog
      open
      title={t('receipts.title')}
      description={t('receipts.description')}
      closeLabel={t('actions.close')}
      onClose={onClose}
      maxWidth="xs"
      fullScreen={fullScreen}
      titleStart={<CheckCheck size={20} />}
    >
      <Stack spacing={1.5}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {message.body || t('receipts.attachmentMessage')}
        </Typography>
        {query.isPending ? (
          <LoadingState label={t('receipts.loading')} />
        ) : query.isError || !query.data ? (
          <ErrorState
            title={t('receipts.loadError')}
            retryLabel={t('privacy.retry')}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
            size="compact"
          />
        ) : (
          <>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography component="p" variant="subtitle2">
                {t('receipts.readCount', { count: query.data.readCount })}
              </Typography>
              <ActionIconButton
                label={t('actions.refresh')}
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCw size={16} />
              </ActionIconButton>
            </Stack>
            <Stack
              component="ul"
              spacing={0}
              divider={<Divider component="li" aria-hidden="true" />}
              sx={{ m: 0, p: 0, listStyle: 'none' }}
            >
              {query.data.recipients.map((recipient) => {
                const tone = messagingVisualTone(recipient.userId);
                return (
                  <Stack
                    component="li"
                    key={recipient.userId}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ py: 1 }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: 'caption.fontSize',
                        bgcolor: tone.surface,
                        color: tone.foreground,
                      }}
                    >
                      {messagingInitials(recipient.displayName)}
                    </Avatar>
                    <Typography
                      variant="body2"
                      sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
                    >
                      {recipient.displayName}
                    </Typography>
                    <Box
                      sx={{
                        color: recipient.status === 'READ' ? 'primary.main' : 'text.secondary',
                        flexShrink: 0,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        {recipient.status === 'READ' ? (
                          <CheckCheck size={14} />
                        ) : recipient.status === 'UNAVAILABLE' ? (
                          <EyeOff size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                        <Typography variant="caption">
                          {t(`receipts.recipient.${recipient.status}`)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
            {query.data.recipients.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('receipts.empty')}
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {t('receipts.privacyNote')}
            </Typography>
          </>
        )}
      </Stack>
    </ContentDialog>
  );
}
