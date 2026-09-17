import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import {
  cancelDwaionGovernedCommand,
  createDwaionGovernedCommand,
  decideDwaionGovernedCommand,
  getDwaionGovernedCommand,
  retryDwaionGovernedCommand,
  rollbackDwaionGovernedCommand,
  type DwaionGovernedCommand,
  type DwaionGovernedCommandKind,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';
import {
  DwaionCommandActions,
  DwaionCommandLifecycle,
  DwaionCommandReview,
  type DwaionCommandTransition,
} from './dwaion-governed-command-presentation';
import { useDwaionControlPlaneAuthority } from './use-dwaion-control-plane-authority';

export type DwaionCommandIntent = {
  title: string;
  description: string;
  kind: DwaionGovernedCommandKind;
  target: { type: string; id: string };
  expectedVersion: number;
  changes: Array<{ label: string; before: string; after: string }>;
  impacts: string[];
  recoveryPlan: string;
  payload?: Record<string, unknown>;
  destructive?: boolean;
};

export function DwaionGovernedCommandDialog({
  intent,
  onClose,
  onCompleted,
  onReconcile,
}: {
  intent: DwaionCommandIntent | null;
  onClose: () => void;
  onCompleted?: (command: DwaionGovernedCommand) => void | Promise<void>;
  onReconcile?: () => void | Promise<void>;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  const authority = useDwaionControlPlaneAuthority();
  const [reason, setReason] = useState('');
  const [ticketRef, setTicketRef] = useState('');
  const [evidence, setEvidence] = useState('');
  const [impactAcknowledged, setImpactAcknowledged] = useState(false);
  const [command, setCommand] = useState<DwaionGovernedCommand | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [createCommandId, setCreateCommandId] = useState<string | null>(null);
  const transitionAttemptIds = useRef(new Map<DwaionCommandTransition, string>());

  useEffect(() => {
    if (intent) {
      setCreateCommandId((current) => current ?? crypto.randomUUID());
      return;
    }
    setReason('');
    setTicketRef('');
    setEvidence('');
    setImpactAcknowledged(false);
    setCommand(null);
    setTransitionReason('');
    setCreateCommandId(null);
    transitionAttemptIds.current.clear();
  }, [intent]);

  const evidenceRefs = useMemo(
    () =>
      evidence
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [evidence]
  );

  const commandQuery = useQuery({
    queryKey: ['dwaion', 'admin', 'control-plane', 'command', command?.commandId],
    queryFn: () => getDwaionGovernedCommand(command!.commandId),
    enabled: Boolean(command),
    refetchInterval: (query) => {
      const state = query.state.data?.state ?? command?.state;
      return state === 'QUEUED' || state === 'RUNNING' || state === 'PARTIAL' ? 2_000 : false;
    },
  });

  useEffect(() => {
    if (!commandQuery.data) return;
    setCommand(commandQuery.data);
    if (commandQuery.data.state === 'SUCCEEDED' || commandQuery.data.state === 'ROLLED_BACK') {
      void onCompleted?.(commandQuery.data);
    }
  }, [commandQuery.data, onCompleted]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!intent) throw new Error('Command intent is missing.');
      const recoveryPlanHash = await sha256Hex(intent.recoveryPlan);
      return authority.execute((secure) =>
        createDwaionGovernedCommand(
          {
            commandId: createCommandId!,
            kind: intent.kind,
            target: intent.target,
            expectedVersion: intent.expectedVersion,
            reason: reason.trim(),
            ticketRef: ticketRef.trim(),
            evidenceRefs,
            impactAcknowledged: true,
            preflight: {
              changes: intent.changes.map((change) => ({
                field: change.label,
                before: change.before,
                after: change.after,
              })),
              impactScopes: intent.impacts,
              recoveryPlan: intent.recoveryPlan,
              recoveryPlanHash,
            },
            payload: intent.payload ?? {},
          },
          secure
        )
      );
    },
    onSuccess: (next) => {
      setCommand(next);
      setTransitionReason('');
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (transition: DwaionCommandTransition) => {
      if (!command) throw new Error('Command is missing.');
      const expectedVersion = command.version;
      let transitionCommandId = transitionAttemptIds.current.get(transition);
      if (!transitionCommandId) {
        transitionCommandId = crypto.randomUUID();
        transitionAttemptIds.current.set(transition, transitionCommandId);
      }
      return authority.execute((secure) => {
        if (transition === 'approve' || transition === 'reject') {
          return decideDwaionGovernedCommand(
            command.commandId,
            {
              commandId: transitionCommandId!,
              decision: transition === 'approve' ? 'APPROVE' : 'REJECT',
              expectedVersion,
              reason: transitionReason.trim(),
              evidenceRefs,
            },
            secure
          );
        }
        if (transition === 'cancel') {
          return cancelDwaionGovernedCommand(
            command.commandId,
            { commandId: transitionCommandId!, expectedVersion, reason: transitionReason.trim() },
            secure
          );
        }
        const request = {
          commandId: transitionCommandId!,
          expectedVersion,
          reason: transitionReason.trim(),
          evidenceRefs,
        };
        return transition === 'retry'
          ? retryDwaionGovernedCommand(command.commandId, request, secure)
          : rollbackDwaionGovernedCommand(command.commandId, request, secure);
      });
    },
    onSuccess: (next) => {
      transitionAttemptIds.current.clear();
      setCommand(next);
      setTransitionReason('');
    },
  });

  const busy = createMutation.isPending || transitionMutation.isPending;
  const createDisabled =
    !authority.available ||
    !createCommandId ||
    reason.trim().length < 10 ||
    ticketRef.trim().length < 3 ||
    !impactAcknowledged;
  const transitionDisabled = !authority.available || transitionReason.trim().length < 10;
  const visibleCommand = commandQuery.data ?? command;

  return (
    <Dialog
      open={Boolean(intent)}
      fullWidth
      maxWidth="md"
      aria-labelledby="dwaion-command-dialog-title"
      onClose={busy ? undefined : onClose}
      data-testid="dwaion-governed-command-dialog"
    >
      <DialogTitle id="dwaion-command-dialog-title">
        {intent?.title ?? copy.command.title}
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
        {!command ? (
          <Stack spacing={2.25}>
            <Typography variant="body2" color="text.secondary">
              {intent?.description ?? copy.command.description}
            </Typography>
            {!authority.available && !authority.loading && (
              <InlineFeedback severity="error">{copy.command.authorityUnavailable}</InlineFeedback>
            )}
            <DwaionCommandReview intent={intent} />
            <FormField
              required
              multiline
              minRows={3}
              label={copy.command.reason}
              supportingText={copy.command.reasonHelp}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <FormField
              required
              label={copy.command.ticket}
              value={ticketRef}
              onChange={(event) => setTicketRef(event.target.value)}
            />
            <FormField
              label={copy.command.evidence}
              supportingText={copy.command.evidenceHelp}
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={impactAcknowledged}
                  onChange={(event) => setImpactAcknowledged(event.target.checked)}
                />
              }
              label={copy.command.acknowledgement}
            />
            {createMutation.isError && (
              <Alert severity="error">
                {isConflictError(createMutation.error)
                  ? copy.command.conflict
                  : copy.command.failed}
                {isConflictError(createMutation.error) && onReconcile && (
                  <Box sx={{ mt: 1 }}>
                    <ActionButton
                      intent="secondary"
                      onClick={() =>
                        void Promise.resolve(onReconcile())
                          .then(() => {
                            createMutation.reset();
                            setCreateCommandId(crypto.randomUUID());
                            onClose();
                          })
                          .catch(() => undefined)
                      }
                    >
                      {copy.command.reconcile}
                    </ActionButton>
                  </Box>
                )}
              </Alert>
            )}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <DwaionCommandLifecycle
              command={visibleCommand!}
              transitionReason={transitionReason}
              onTransitionReason={setTransitionReason}
              refreshing={commandQuery.isFetching}
              onRefresh={() => void commandQuery.refetch()}
            />
            {commandQuery.isError && (
              <Alert severity="error">{copy.command.statusFailed}</Alert>
            )}
            {transitionMutation.isError && (
              <Alert severity="error">
                {isConflictError(transitionMutation.error)
                  ? copy.command.transitionConflict
                  : copy.command.failed}
                {isConflictError(transitionMutation.error) && (
                  <Box sx={{ mt: 1 }}>
                    <ActionButton
                      intent="secondary"
                      onClick={() => {
                        transitionMutation.reset();
                        transitionAttemptIds.current.clear();
                        void commandQuery.refetch();
                      }}
                    >
                      {copy.command.refreshStatus}
                    </ActionButton>
                  </Box>
                )}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
        <ActionButton intent="quiet" disabled={busy} onClick={onClose}>
          {copy.command.cancel}
        </ActionButton>
        {!command ? (
          <ActionButton
            intent={intent?.destructive ? 'danger' : 'primary'}
            loading={createMutation.isPending}
            loadingLabel={copy.command.submitting}
            disabled={createDisabled}
            onClick={() => createMutation.mutate()}
          >
            {copy.command.submit}
          </ActionButton>
        ) : (
          <DwaionCommandActions
            command={visibleCommand!}
            busy={busy}
            disabled={transitionDisabled}
            onTransition={(transition) => transitionMutation.mutate(transition)}
          />
        )}
      </DialogActions>
    </Dialog>
  );
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isConflictError(error: unknown) {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? (error as { status?: unknown }).status : undefined;
  return status === 409 || status === 412;
}
