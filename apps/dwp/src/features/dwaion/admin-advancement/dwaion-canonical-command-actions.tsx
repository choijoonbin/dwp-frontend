import { useState, type ReactNode } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { DwaionAdminSection } from './dwaion-admin-advancement-ui';
import {
  DwaionGovernedCommandDialog,
  type DwaionCommandIntent,
} from './dwaion-governed-command-dialog';
import { DwaionCommandCapabilityButton } from './dwaion-command-capability-button';

export type DwaionCanonicalCommandAction = DwaionCommandIntent & {
  label: string;
  icon?: ReactNode;
};

export function DwaionCanonicalCommandActions({
  title,
  description,
  actions,
  disabled,
  onRefresh,
}: {
  title: string;
  description: string;
  actions: DwaionCanonicalCommandAction[];
  disabled: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [intent, setIntent] = useState<DwaionCommandIntent | null>(null);
  if (actions.length === 0) return null;
  return (
    <>
      <DwaionAdminSection title={title} description={description}>
        <Box sx={{ px: { xs: 1.75, md: 2.25 }, py: 2 }}>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {actions.map((action) => (
              <DwaionCommandCapabilityButton
                key={`${action.kind}-${action.target.id}-${action.label}`}
                commandKind={action.kind}
                intent={action.destructive ? 'danger' : 'secondary'}
                startIcon={action.icon}
                disabled={disabled}
                onClick={() => setIntent(action)}
              >
                {action.label}
              </DwaionCommandCapabilityButton>
            ))}
          </Stack>
        </Box>
      </DwaionAdminSection>
      <DwaionGovernedCommandDialog
        intent={intent}
        onClose={() => setIntent(null)}
        onReconcile={onRefresh}
        onCompleted={async () => {
          setIntent(null);
          await onRefresh();
        }}
      />
    </>
  );
}
