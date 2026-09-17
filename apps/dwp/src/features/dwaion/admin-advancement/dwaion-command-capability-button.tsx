import type { ComponentProps } from 'react';
import { ActionButton } from '@dwp-frontend/design-system';
import type { DwaionGovernedCommandKind } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { useDwaionCommandCapabilities } from './use-dwaion-command-capabilities';

type Props = Omit<ComponentProps<typeof ActionButton>, 'disabled' | 'title'> & {
  commandKind: DwaionGovernedCommandKind;
  disabled?: boolean;
};

export function DwaionCommandCapabilityButton({ commandKind, disabled = false, ...props }: Props) {
  const commandCapabilities = useDwaionCommandCapabilities();
  const gate = commandCapabilities.gate(commandKind, disabled);
  return (
    <Box
      component="span"
      title={gate.title}
      sx={{ display: 'inline-flex', '& > button': { flex: 1 } }}
    >
      <ActionButton {...props} disabled={gate.disabled} />
    </Box>
  );
}
