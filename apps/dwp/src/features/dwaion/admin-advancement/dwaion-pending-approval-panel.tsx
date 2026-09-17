import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { getDwaionGovernedCommands, type DwaionGovernedCommand } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';
import { DwaionAdminSection, DwaionFreshness } from './dwaion-admin-advancement-ui';
import { DwaionGovernedCommandDialog } from './dwaion-governed-command-dialog';

export function DwaionPendingApprovalPanel({ onChanged }: { onChanged: () => void }) {
  const copy = useDwaionAdminAdvancementCopy();
  const [selected, setSelected] = useState<DwaionGovernedCommand | null>(null);
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'control-plane', 'commands', 'AWAITING_APPROVAL'],
    queryFn: () => getDwaionGovernedCommands({ state: 'AWAITING_APPROVAL', limit: 20 }),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const reconcile = async () => {
    setSelected(null);
    await query.refetch();
    onChanged();
  };

  return (
    <>
      <DwaionAdminSection
        title={copy.models.approvalQueue}
        description={copy.models.approvalQueueDescription}
        actions={
          query.data ? (
            <DwaionFreshness
              generatedAt={query.data.generatedAt}
              fetching={query.isFetching}
              onRefresh={() => void query.refetch()}
            />
          ) : undefined
        }
      >
        {query.isLoading ? (
          <Stack direction="row" gap={1} alignItems="center" sx={{ p: 2 }}>
            <CircularProgress size={18} aria-label={copy.loading} />
            <Typography variant="body2" color="text.secondary">
              {copy.loading}
            </Typography>
          </Stack>
        ) : query.isError ? (
          <Stack spacing={1.25} sx={{ p: 2 }}>
            <InlineFeedback severity="error">{copy.command.queueUnavailable}</InlineFeedback>
            <Box>
              <ActionButton intent="secondary" onClick={() => void query.refetch()}>
                {copy.retry}
              </ActionButton>
            </Box>
          </Stack>
        ) : query.data?.commands.length ? (
          <Stack divider={<Divider flexItem />}>
            {query.data.commands.map((command) => (
              <ButtonBase
                key={command.commandId}
                onClick={() => setSelected(command)}
                aria-label={`${copy.models.reviewCommand}: ${command.kind} ${command.target.id}`}
                sx={{ width: 1, px: 2, py: 1.5, textAlign: 'left' }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  gap={1.25}
                  sx={{ width: 1, minWidth: 0 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <ShieldCheck size={16} aria-hidden="true" />
                      <Typography variant="subtitle2">{command.kind}</Typography>
                      <Chip size="small" color="warning" label={command.state} />
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                    >
                      {command.target.type}:{command.target.id} · {command.review.ticketRef}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {command.makerUserId ?? 'Unknown maker'} {copy.ui.common.versionSeparator}
                      {command.version}
                    </Typography>
                  </Box>
                  <ChevronRight size={18} aria-hidden="true" />
                </Stack>
              </ButtonBase>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {copy.models.approvalQueueEmpty}
          </Typography>
        )}
      </DwaionAdminSection>
      <DwaionGovernedCommandDialog
        intent={null}
        initialCommand={selected}
        onClose={() => void reconcile()}
        onCompleted={reconcile}
        onReconcile={reconcile}
      />
    </>
  );
}
