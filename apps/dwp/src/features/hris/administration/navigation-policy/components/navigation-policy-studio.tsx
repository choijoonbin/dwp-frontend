import { useEffect, useMemo, useState } from 'react';
import { InlineFeedback } from '@dwp-frontend/design-system';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { NavigationPolicyEditor } from './navigation-policy-editor';
import { navigationPolicyCopy } from '../model/navigation-policy-copy';
import {
  createNavigationPolicyDraft,
  navigationPolicyActions,
  validateNavigationPolicyDraft,
} from '../model/navigation-policy-model';

import type {
  NavigationPolicyAction,
  NavigationPolicyCommandOwner,
  NavigationPolicyCommandReceipt,
  NavigationPolicyDraft,
  NavigationPolicyLifecycle,
  NavigationPolicyViewState,
  NavigationPolicyWorkspace,
} from '../model/navigation-policy-model';

export type NavigationPolicyStudioProps = Readonly<{
  state: NavigationPolicyViewState;
  workspace?: NavigationPolicyWorkspace;
  locale?: string;
  commandOwner?: NavigationPolicyCommandOwner;
  onRefresh(): void;
  onCommandCommitted?(receipt: NavigationPolicyCommandReceipt): void | Promise<void>;
}>;

export function NavigationPolicyStudio({
  state,
  workspace,
  locale,
  commandOwner,
  onRefresh,
  onCommandCommitted,
}: NavigationPolicyStudioProps) {
  const copy = navigationPolicyCopy(locale);
  const sourceDraft = useMemo(() => editableDraft(workspace), [workspace]);
  const [draft, setDraft] = useState(sourceDraft);
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState('');
  const [restoreTargetRevisionId, setRestoreTargetRevisionId] = useState('');
  const [command, setCommand] = useState<{
    state: 'IDLE' | 'RUNNING' | 'SUCCEEDED' | 'ERROR';
    action?: NavigationPolicyAction;
    receipt?: NavigationPolicyCommandReceipt;
    message?: string;
  }>({ state: 'IDLE' });

  useEffect(() => {
    setDraft(sourceDraft);
    setDirty(false);
    setReason('');
    setRestoreTargetRevisionId(workspace?.restorableRevisions?.[0]?.revisionId ?? '');
    setCommand({ state: 'IDLE' });
  }, [sourceDraft, workspace?.restorableRevisions]);

  if (state === 'LOADING') {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight={320} gap={2} role="status">
        <CircularProgress size={28} />
        <Typography>{copy.loadingTitle}</Typography>
      </Stack>
    );
  }
  if (state === 'DENIED') {
    return (
      <InlineFeedback severity="error" title={copy.deniedTitle}>
        {copy.deniedDescription}
      </InlineFeedback>
    );
  }
  if (state === 'ERROR' || state === 'UNAVAILABLE' || !workspace || !draft) {
    return (
      <InlineFeedback severity="error" title={copy.unavailableTitle}>
        No policy command was submitted. Retry after the owner projection becomes available.
      </InlineFeedback>
    );
  }

  const tenantBaseline = workspace.tenantBaseline;
  const validationIssues = validateNavigationPolicyDraft(draft, tenantBaseline);
  const lifecycle = lifecycleFor(workspace);
  const lifecycleActions = workspace.draft
    ? navigationPolicyActions(lifecycle)
    : workspace.activeRevision
      ? navigationPolicyActions(workspace.activeRevision.status)
      : (['CREATE_DRAFT'] as const);
  const actions = lifecycleActions.filter(
    (action) => action !== 'RESTORE' || Boolean(restoreTargetRevisionId)
  );
  const restoreTarget = workspace.restorableRevisions?.find(
    (revision) => revision.revisionId === restoreTargetRevisionId
  );
  const evidenceUnsafe = state === 'STALE' || state === 'PARTIAL';
  const enabledCount = draft.groups.reduce(
    (count, group) => count + group.nodes.filter((node) => group.enabled && node.enabled).length,
    0
  );
  const execute = async (action: NavigationPolicyAction) => {
    if (!commandOwner || command.state === 'RUNNING' || evidenceUnsafe) return;
    if (action === 'VALIDATE' && dirty) {
      setCommand({
        state: 'ERROR',
        action,
        message: 'Save the draft before validating its immutable server revision.',
      });
      return;
    }
    if (action === 'VALIDATE' && validationIssues.length > 0) {
      setCommand({
        state: 'ERROR',
        action,
        message: 'Resolve every local catalog and restrictive-overlay issue before validation.',
      });
      return;
    }
    if (isHighRiskAction(action) && reason.trim().length < 12) {
      setCommand({
        state: 'ERROR',
        action,
        message: 'Provide a meaningful justification of at least 12 characters.',
      });
      return;
    }
    setCommand({ state: 'RUNNING', action });
    try {
      const receipt = await commandOwner.execute({
        action,
        draft,
        revisionId:
          action === 'RESTORE'
            ? restoreTarget?.revisionId
            : (workspace.draft?.revisionId ?? workspace.activeRevision?.revisionId),
        expectedVersion:
          workspace.draft?.objectVersion ?? workspace.activeRevision?.objectVersion ?? 0,
        ...(action === 'RESTORE' && restoreTarget
          ? {
              targetRevisionId: restoreTarget.revisionId,
              targetDigest: restoreTarget.digest,
            }
          : {}),
        ...(isHighRiskAction(action) ? { reason: reason.trim() } : {}),
      });
      if (receipt.commandType !== action || receipt.status !== 'SUCCEEDED') {
        throw new Error('The immutable command receipt does not match the requested action.');
      }
      await onCommandCommitted?.(receipt);
      setCommand({ state: 'SUCCEEDED', action, receipt: Object.freeze({ ...receipt }) });
      setDirty(false);
    } catch (error) {
      setCommand({ state: 'ERROR', action, message: commandError(error) });
    }
  };

  return (
    <Stack gap={2} minWidth={0} data-testid="navigation-policy-studio" data-policy-state={state}>
      {state === 'EMPTY' ? (
        <InlineFeedback severity="info" title={copy.emptyTitle}>
          Start with the complete canonical catalog. Publishing remains unavailable until validation
          and independent approval are complete.
        </InlineFeedback>
      ) : null}
      {state === 'STALE' ? (
        <InlineFeedback severity="warning" title={copy.staleTitle}>
          Refresh the owner projection before editing or making a lifecycle decision.
        </InlineFeedback>
      ) : null}
      {state === 'PARTIAL' ? (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          The visible evidence is read-only. Refresh before creating or advancing a revision.
        </InlineFeedback>
      ) : null}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        gap={1.5}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        justifyContent="space-between"
      >
        <Stack gap={0.5} minWidth={0}>
          <Typography component="h1" variant="h5" sx={{ wordBreak: 'keep-all' }}>
            {copy.title}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
            {copy.description}
          </Typography>
        </Stack>
        <Button variant="outlined" onClick={onRefresh} sx={{ flexShrink: 0 }}>
          {copy.refresh}
        </Button>
      </Stack>

      <Stack direction="row" gap={1} flexWrap="wrap" aria-label="Policy evidence summary">
        <Chip
          color={workspace.queryState.freshness === 'CURRENT' ? 'success' : 'warning'}
          label={`Evidence: ${workspace.queryState.freshness}`}
        />
        <Chip
          variant="outlined"
          label={`${copy.scope}: ${
            workspace.scope.scopeKind === 'TENANT' ? copy.tenant : copy.legalEntity
          } · ${workspace.scope.displayName}`}
        />
        <Chip variant="outlined" label={`${copy.lifecycle}: ${lifecycle}`} />
        <Chip variant="outlined" label={`${enabledCount}/17 nodes enabled`} />
        {dirty ? <Chip color="warning" label="Unsaved draft" /> : null}
      </Stack>

      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2.5}>
          <Stack gap={0.5} flex={1} minWidth={0}>
            <Typography component="h2" variant="subtitle1" fontWeight={700}>
              {copy.impactTitle}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {copy.impactDescription}
            </Typography>
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              Effective = canonical IA ∩ installed configuration ∩ tenant baseline ∩ legal overlay ∩
              PAGE authority
            </Typography>
          </Stack>
          <Stack gap={0.5} flex={1} minWidth={0}>
            <Typography component="h2" variant="subtitle1" fontWeight={700}>
              {copy.recoveryTitle}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {copy.recoveryDescription}
            </Typography>
            <Typography variant="caption">
              Approve, publish, and restore require step-up and an actor other than the author.
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {validationIssues.length > 0 ? (
        <InlineFeedback severity="warning" title={`${validationIssues.length} validation issue(s)`}>
          {validationIssues.map((issue) => issue.message).join(' ')}
        </InlineFeedback>
      ) : null}
      {!commandOwner ? (
        <InlineFeedback severity="warning" title="Governed commands unavailable">
          {copy.commandUnavailable}
        </InlineFeedback>
      ) : null}
      {command.state === 'RUNNING' ? (
        <InlineFeedback severity="info" title={`${command.action} in progress`}>
          Waiting for the immutable owner receipt. Repeated clicks are suppressed.
        </InlineFeedback>
      ) : null}
      {command.state === 'SUCCEEDED' && command.receipt ? (
        <InlineFeedback severity="success" title={`${command.action} completed`}>
          Receipt {command.receipt.receiptId} · revision {command.receipt.revision} · object version{' '}
          {command.receipt.objectVersion}
        </InlineFeedback>
      ) : null}
      {command.state === 'ERROR' ? (
        <InlineFeedback severity="error" title={`${command.action ?? 'Command'} failed`}>
          {command.message}
        </InlineFeedback>
      ) : null}

      <NavigationPolicyEditor
        draft={draft}
        tenantBaseline={tenantBaseline}
        disabled={evidenceUnsafe || command.state === 'RUNNING' || lifecycle !== 'DRAFT'}
        copy={copy}
        onChange={(next) => {
          setDraft(Object.freeze(next));
          setDirty(true);
          setCommand({ state: 'IDLE' });
        }}
      />

      {lifecycle === 'PUBLISHED' && (workspace.restorableRevisions?.length ?? 0) > 0 ? (
        <FormControl size="small" sx={{ width: { xs: '100%', sm: 360 } }}>
          <InputLabel id="restore-policy-revision-label">Restore target</InputLabel>
          <Select
            labelId="restore-policy-revision-label"
            label="Restore target"
            value={restoreTargetRevisionId}
            disabled={evidenceUnsafe || command.state === 'RUNNING'}
            onChange={(event) => setRestoreTargetRevisionId(event.target.value)}
          >
            {workspace.restorableRevisions?.map((revision) => (
              <MenuItem key={revision.revisionId} value={revision.revisionId}>
                Revision {revision.revision} · {revision.digest.slice(0, 12)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}

      {actions.some(isHighRiskAction) ? (
        <TextField
          label="Decision justification"
          value={reason}
          required
          multiline
          minRows={2}
          inputProps={{ minLength: 12, maxLength: 500 }}
          helperText="Required for approve, publish, and restore. Stored with the immutable audit receipt."
          disabled={evidenceUnsafe || command.state === 'RUNNING'}
          onChange={(event) => {
            setReason(event.target.value);
            setCommand({ state: 'IDLE' });
          }}
        />
      ) : null}

      <Stack
        component="section"
        aria-label="Navigation policy lifecycle actions"
        direction={{ xs: 'column', sm: 'row' }}
        gap={1}
        justifyContent="flex-end"
      >
        {actions.map((action) => (
          <Button
            key={action}
            variant={primaryAction(action) ? 'contained' : 'outlined'}
            disabled={
              !commandOwner ||
              evidenceUnsafe ||
              command.state === 'RUNNING' ||
              (action === 'SAVE_DRAFT' && !dirty) ||
              (action === 'VALIDATE' && (dirty || validationIssues.length > 0)) ||
              (isHighRiskAction(action) && reason.trim().length < 12)
            }
            onClick={() => void execute(action)}
          >
            {action.replaceAll('_', ' ')}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

function editableDraft(workspace?: NavigationPolicyWorkspace): NavigationPolicyDraft | undefined {
  if (!workspace) return undefined;
  if (workspace.draft) return workspace.draft;
  if (!workspace.activeRevision) {
    return createNavigationPolicyDraft({
      scopeKind: workspace.scope.scopeKind,
      scopePublicId: workspace.scope.scopePublicId,
      tenantBaseline: workspace.tenantBaseline,
    });
  }
  const revision = workspace.activeRevision;
  return Object.freeze({
    policyId: revision.policyId,
    revisionId: revision.revisionId,
    revision: revision.revision,
    objectVersion: revision.objectVersion,
    status: 'APPROVED',
    scopeKind: revision.scopeKind,
    scopePublicId: revision.scopePublicId,
    legalEntityPublicId: revision.legalEntityPublicId,
    rolloutMode: revision.rolloutMode,
    workbenchId: revision.workbenchId,
    groups: revision.groups,
  });
}

function lifecycleFor(workspace: NavigationPolicyWorkspace): NavigationPolicyLifecycle {
  return workspace.draft?.status ?? workspace.activeRevision?.status ?? 'DRAFT';
}

function primaryAction(action: NavigationPolicyAction) {
  return ['CREATE_DRAFT', 'VALIDATE', 'SUBMIT', 'APPROVE', 'PUBLISH'].includes(action);
}

function isHighRiskAction(action: NavigationPolicyAction) {
  return action === 'APPROVE' || action === 'PUBLISH' || action === 'RESTORE';
}

function commandError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'The owner rejected the command. Refresh the policy evidence before retrying.';
}
