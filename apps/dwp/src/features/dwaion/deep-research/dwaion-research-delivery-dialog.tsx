import { useEffect, useMemo, useState } from 'react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { deepResearchCopy } from './dwaion-deep-research-copy';

import type { DwaionResearchDeliveryType } from '@dwp-frontend/shared-utils';

export type DwaionResearchDeliveryParameters = Record<string, unknown>;

type ConfigurableDeliveryType = Extract<DwaionResearchDeliveryType, 'HANDOFF' | 'SHARE'>;

export function DwaionResearchDeliveryDialog({
  open,
  type,
  locale,
  runId,
  suggestedTitle,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  type: ConfigurableDeliveryType | null;
  locale: 'ko' | 'en';
  runId: string;
  suggestedTitle: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (type: ConfigurableDeliveryType, parameters: DwaionResearchDeliveryParameters) => void;
}) {
  const copy = deepResearchCopy(locale).deliveryDialog;
  const [approvalTarget, setApprovalTarget] = useState('');
  const [requestTitle, setRequestTitle] = useState(suggestedTitle);
  const [requestReason, setRequestReason] = useState('');
  const [recipients, setRecipients] = useState('');
  const [teamId, setTeamId] = useState('');
  const [permission, setPermission] = useState<'VIEW' | 'COMMENT'>('VIEW');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApprovalTarget('');
    setRequestTitle(suggestedTitle);
    setRequestReason('');
    setRecipients('');
    setTeamId('');
    setPermission('VIEW');
    setExpiresAt(defaultExpiry());
    setSubmitted(false);
  }, [open, suggestedTitle, type]);

  const recipientIds = useMemo(
    () =>
      Array.from(
        new Set(
          recipients
            .split(/[,\n]/)
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ),
    [recipients]
  );
  const validExpiry = useMemo(() => {
    const value = new Date(expiresAt).getTime();
    const now = Date.now();
    return Number.isFinite(value) && value > now + 5 * 60_000 && value <= now + 90 * 86_400_000;
  }, [expiresAt]);
  const valid =
    type === 'HANDOFF'
      ? approvalTarget.trim().length >= 2 &&
        requestTitle.trim().length >= 2 &&
        requestReason.trim().length >= 10
      : type === 'SHARE'
        ? (recipientIds.length > 0 || teamId.trim().length >= 2) && validExpiry
        : false;

  const submit = () => {
    setSubmitted(true);
    if (!type || !valid) return;
    if (type === 'HANDOFF') {
      onSubmit(type, {
        approvalTarget: approvalTarget.trim(),
        requestTitle: requestTitle.trim(),
        requestReason: requestReason.trim(),
        requestMetadata: { source: 'DEEP_RESEARCH', researchRunId: runId },
      });
      return;
    }
    onSubmit(type, {
      recipientIds,
      ...(teamId.trim() ? { teamId: teamId.trim() } : {}),
      permission,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="dwaion-research-delivery-dialog-title"
    >
      <DialogTitle id="dwaion-research-delivery-dialog-title">
        {type === 'HANDOFF' ? copy.handoffTitle : copy.shareTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Stack gap={2} sx={{ pt: 0.5 }}>
          <Typography color="text.secondary">{copy.providerReceiptHelp}</Typography>
          {type === 'HANDOFF' ? (
            <>
              <TextField
                label={copy.approvalTarget}
                value={approvalTarget}
                onChange={(event) => setApprovalTarget(event.target.value)}
                required
                autoFocus
                inputProps={{ maxLength: 160 }}
              />
              <TextField
                label={copy.requestTitle}
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                required
                inputProps={{ maxLength: 240 }}
              />
              <TextField
                label={copy.requestReason}
                value={requestReason}
                onChange={(event) => setRequestReason(event.target.value)}
                required
                multiline
                minRows={3}
                inputProps={{ maxLength: 1_000 }}
                helperText={copy.requestMetadataHelp}
              />
            </>
          ) : (
            <>
              <TextField
                label={copy.recipients}
                value={recipients}
                onChange={(event) => setRecipients(event.target.value)}
                autoFocus
                multiline
                minRows={2}
                helperText={copy.recipientsHelp}
              />
              <TextField
                label={copy.teamId}
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                inputProps={{ maxLength: 160 }}
              />
              <TextField
                select
                label={copy.permission}
                value={permission}
                onChange={(event) => setPermission(event.target.value as 'VIEW' | 'COMMENT')}
                required
              >
                <MenuItem value="VIEW">{copy.permissionView}</MenuItem>
                <MenuItem value="COMMENT">{copy.permissionComment}</MenuItem>
              </TextField>
              <TextField
                label={copy.expiresAt}
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                required
                InputLabelProps={{ shrink: true }}
                helperText={copy.expiryHelp}
              />
            </>
          )}
          {submitted && !valid ? (
            <InlineFeedback severity="error">{copy.validationError}</InlineFeedback>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <ActionButton intent="quiet" disabled={busy} onClick={onClose}>
          {copy.cancel}
        </ActionButton>
        <ActionButton intent="primary" loading={busy} onClick={submit}>
          {type === 'HANDOFF' ? copy.submitHandoff : copy.submitShare}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}

function defaultExpiry(): string {
  const date = new Date(Date.now() + 7 * 86_400_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
