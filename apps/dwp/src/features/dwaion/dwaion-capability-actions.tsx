import { LockKeyhole } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton } from '@dwp-frontend/design-system';

export type DwaionCapabilityAction = Readonly<{
  key: string;
  label: string;
  capability: string;
  reason: string;
  available?: boolean;
  onClick?: () => void;
}>;

export function DwaionCapabilityActions({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: readonly DwaionCapabilityAction[];
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      data-testid="dwaion-capability-actions"
      sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
    >
      <Stack direction="row" gap={0.75} alignItems="center">
        <LockKeyhole size={16} aria-hidden="true" />
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
        {description}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 0.75,
          mt: 1,
        }}
      >
        {actions.map((action) => {
          const enabled = Boolean(action.available && action.onClick);
          return (
            <Box key={action.key} sx={{ minWidth: 0 }}>
              <ActionButton
                intent="quiet"
                fullWidth
                disabled={!enabled}
                onClick={enabled ? action.onClick : undefined}
                title={!enabled ? action.reason : undefined}
                sx={{ minHeight: 44, justifyContent: 'flex-start' }}
              >
                {action.label}
              </ActionButton>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', px: 1, mt: 0.25, overflowWrap: 'anywhere' }}
              >
                {action.capability} · {action.reason}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
