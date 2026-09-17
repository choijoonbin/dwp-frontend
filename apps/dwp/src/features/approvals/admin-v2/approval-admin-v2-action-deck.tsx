import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  AdminV2GovernedAction,
  AdminV2InspectorPaper,
  AdminV2Section,
  AdminV2StatusPill,
} from './admin-v2-foundation';

import type { ReactNode } from 'react';
import type { AdminV2SourceState, AdminV2Status } from './admin-v2-types';

type AdminV2WorkspaceActionBase = Readonly<{
  id: string;
  label: string;
  description: string;
  ready: boolean;
  disabledReason?: string;
  status?: AdminV2Status;
  icon?: ReactNode;
  onAction: () => void;
}>;

export type AdminV2WorkspaceAction =
  | (AdminV2WorkspaceActionBase & Readonly<{ risk: 'READ' }>)
  | (AdminV2WorkspaceActionBase &
      Readonly<{
        risk: 'GOVERNED';
        mobileLabel: string;
        mobileReason: string;
      }>);

export type AdminV2WorkspaceActionDeck = Readonly<{
  id: string;
  title: string;
  description: string;
  actions: readonly AdminV2WorkspaceAction[];
}>;

export function ApprovalAdminV2ActionDeck({
  state,
  deck,
}: {
  state: AdminV2SourceState;
  deck: AdminV2WorkspaceActionDeck;
}) {
  const sourceReady = state === 'ready';

  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={deck.title}
        description={deck.description}
        labelledBy={`admin-v2-action-deck-${deck.id}`}
      >
        <Stack component="ul" divider={<Divider flexItem />} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {deck.actions.map((action) => {
            const disabled = !sourceReady || !action.ready;
            return (
              <Stack
                component="li"
                key={action.id}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                gap={1.25}
                sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5 }}
              >
                <Stack direction="row" gap={1.1} minWidth={0} flex={1} alignItems="flex-start">
                  <Box
                    aria-hidden="true"
                    sx={(theme) => ({
                      display: 'grid',
                      placeItems: 'center',
                      width: 30,
                      height: 30,
                      flex: '0 0 auto',
                      border: 1,
                      borderColor: action.risk === 'GOVERNED' ? 'primary.main' : 'divider',
                      borderRadius: `${Number(theme.shape.borderRadius)}px`,
                      color: action.risk === 'GOVERNED' ? 'primary.main' : 'text.secondary',
                      bgcolor: 'background.paper',
                    })}
                  >
                    {action.icon ??
                      (action.risk === 'GOVERNED' ? (
                        <ShieldCheck size={16} />
                      ) : (
                        <ArrowRight size={16} />
                      ))}
                  </Box>
                  <Box minWidth={0}>
                    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                      <Typography variant="subtitle2" fontWeight="fontWeightBold">
                        {action.label}
                      </Typography>
                      {action.status ? <AdminV2StatusPill status={action.status} /> : null}
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
                    >
                      {action.description}
                    </Typography>
                  </Box>
                </Stack>
                {action.risk === 'GOVERNED' ? (
                  <AdminV2GovernedAction
                    desktopLabel={action.label}
                    mobileLabel={action.mobileLabel}
                    mobileReason={action.mobileReason}
                    disabled={disabled}
                    disabledReason={action.disabledReason}
                    onAction={action.onAction}
                    icon={action.icon}
                  />
                ) : (
                  <Stack alignItems={{ xs: 'stretch', sm: 'flex-end' }} gap={0.4} flexShrink={0}>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={action.icon}
                      disabled={disabled}
                      onClick={action.onAction}
                    >
                      {action.label}
                    </ActionButton>
                    {disabled && action.disabledReason ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        textAlign={{ xs: 'start', sm: 'end' }}
                        sx={{ maxWidth: 300, overflowWrap: 'anywhere' }}
                      >
                        {action.disabledReason}
                      </Typography>
                    ) : null}
                  </Stack>
                )}
              </Stack>
            );
          })}
        </Stack>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}
