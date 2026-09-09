import { useTranslation } from 'react-i18next';
import { Bell, Mail, MessageSquareText, MonitorSmartphone, Smartphone } from 'lucide-react';
import type {
  NotificationTemplateContent,
  NotificationTemplateVariant,
} from '@dwp-frontend/shared-utils/api/notification-api';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function channelPreviewIcon(channel: NotificationTemplateVariant['channel']) {
  if (channel === 'EMAIL') return Mail;
  if (channel === 'WEB_PUSH') return MonitorSmartphone;
  if (channel === 'MOBILE_PUSH') return Smartphone;
  if (channel === 'TEAMS' || channel === 'SLACK') return MessageSquareText;
  return Bell;
}

export function NotificationChannelTemplatePreview({
  variant,
  content,
  label,
}: {
  variant: NotificationTemplateVariant;
  content: NotificationTemplateContent;
  label: string;
}) {
  const { t } = useTranslation('notifications');
  const PreviewIcon = channelPreviewIcon(variant.channel);
  const compactPush = variant.channel === 'WEB_PUSH' || variant.channel === 'MOBILE_PUSH';
  const conversation = variant.channel === 'TEAMS' || variant.channel === 'SLACK';
  return (
    <Box component="section" aria-label={label} sx={{ borderBlock: 1, borderColor: 'divider' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1 }}>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Chip size="small" variant="outlined" label={t(`channels.${variant.channel}`)} />
      </Stack>
      <Box
        data-testid="notification-template-channel-preview"
        data-channel={variant.channel}
        sx={{
          my: 1,
          p: compactPush ? 1.5 : 2,
          maxWidth: compactPush ? 440 : 'none',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 'shape.borderRadius',
          bgcolor: conversation ? 'action.hover' : 'background.paper',
          boxShadow: compactPush ? 1 : 0,
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'shape.borderRadius',
            bgcolor: 'primary.50',
            color: 'primary.main',
          }}
        >
          <PreviewIcon size={19} />
        </Box>
        <Box minWidth={0}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              {variant.appName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {variant.locale}
            </Typography>
          </Stack>
          <Typography variant="subtitle1" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
            {content.title || t('admin.templates.emptyContent')}
          </Typography>
          {content.preview && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {content.preview}
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
            {content.body || t('admin.templates.emptyContent')}
          </Typography>
          {content.actionLabel && (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 32,
                mt: 1,
                px: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 'shape.borderRadius',
                bgcolor: 'action.hover',
              }}
            >
              <Typography component="span" variant="button">
                {content.actionLabel}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
