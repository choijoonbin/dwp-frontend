import type { Theme, SxProps } from '@mui/material/styles';

import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AuditEvent } from '../../data/mock-data';

// ----------------------------------------------------------------------

const eventIcons: Record<
  AuditEvent['eventType'],
  string
> = {
  case_created: 'solar:document-text-bold-duotone',
  action_proposed: 'solar:bolt-bold-duotone',
  simulation_run: 'solar:play-circle-bold',
  approval_requested: 'solar:clock-circle-bold',
  action_approved: 'solar:check-circle-bold-duotone',
  action_rejected: 'solar:close-circle-bold',
  action_executed: 'solar:shield-check-bold-duotone',
  comment_added: 'solar:chat-round-dots-bold',
};

const actorIcons: Record<AuditEvent['actorType'], string> = {
  system: 'solar:shield-check-bold-duotone',
  user: 'solar:user-bold-duotone',
  agent: 'solar:bot-bold-duotone',
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export type TimelineProps = {
  events: AuditEvent[];
  compact?: boolean;
  sx?: SxProps<Theme>;
};

export const Timeline = ({ events, compact = false, sx }: TimelineProps) => (
  <Box sx={{ position: 'relative', pl: 3, ...sx }}>
    <Box
      sx={{
        position: 'absolute',
        left: 12,
        top: 0,
        bottom: 0,
        width: 1,
        bgcolor: 'divider',
      }}
    />
    <Stack spacing={compact ? 2 : 3}>
      {events.map((event) => {
        const eventIcon = eventIcons[event.eventType];
        const actorIcon = actorIcons[event.actorType];

        return (
          <Stack key={event.id} direction="row" spacing={1.5} sx={{ position: 'relative', zIndex: 1 }}>
            <Box
              sx={{
                width: compact ? 24 : 28,
                height: compact ? 24 : 28,
                borderRadius: '50%',
                border: 1,
                borderColor:
                  event.actorType === 'agent'
                    ? 'primary.main'
                    : event.actorType === 'user'
                      ? 'info.main'
                      : 'text.disabled',
                bgcolor:
                  event.actorType === 'agent'
                    ? 'primary.lighter'
                    : event.actorType === 'user'
                      ? 'info.lighter'
                      : 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Iconify
                icon={eventIcon}
                width={compact ? 12 : 14}
                sx={{
                  color:
                    event.actorType === 'agent'
                      ? 'primary.main'
                      : event.actorType === 'user'
                        ? 'info.main'
                        : 'text.secondary',
                }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, pb: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Iconify icon={actorIcon} width={12} sx={{ color: 'text.secondary' }} />
                  <Typography
                    variant={compact ? 'caption' : 'body2'}
                    sx={{ fontWeight: 600 }}
                  >
                    {event.actor}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(event.timestamp)}
                </Typography>
              </Stack>
              <Typography
                variant={compact ? 'caption' : 'body2'}
                color="text.secondary"
                sx={{ mt: 0.25, lineHeight: 1.6 }}
              >
                {event.description}
              </Typography>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  </Box>
);
