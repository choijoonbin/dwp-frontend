import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  ActionButton,
  DateTimePickerField,
  FormDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  PerformanceCycleDraft,
  PerformanceCycleDraftValidation,
  PerformanceStageInput,
} from '../model/performance-cycle-command';
import type {
  PerformanceCycleDetail,
  PerformancePopulationPreview,
} from '../model/performance-cycle-contract';
import type { PerformanceCycleCopy } from '../model/performance-cycle-copy';

type DraftField = Exclude<keyof PerformanceCycleDraft, 'cycleId' | 'expectedRevision' | 'stages'>;

function setDraftField(
  current: PerformanceCycleDraft | null,
  field: DraftField,
  value: string
): PerformanceCycleDraft | null {
  return current ? Object.freeze({ ...current, [field]: value }) : current;
}

function replaceStage(
  current: PerformanceCycleDraft | null,
  index: number,
  update: Partial<PerformanceStageInput>
): PerformanceCycleDraft | null {
  if (!current || !current.stages[index]) return current;
  return Object.freeze({
    ...current,
    stages: Object.freeze(
      current.stages.map((stage, position) =>
        position === index ? Object.freeze({ ...stage, ...update }) : stage
      )
    ),
  });
}

function addStage(current: PerformanceCycleDraft | null): PerformanceCycleDraft | null {
  if (!current) return current;
  return Object.freeze({
    ...current,
    stages: Object.freeze([
      ...current.stages,
      Object.freeze({
        stageKey: '',
        stageType: '',
        sequenceNo: current.stages.length + 1,
        opensAt: current.effectiveFrom,
        closesAt: current.effectiveTo,
        required: true,
        stageConfig: Object.freeze({}),
      }),
    ]),
  });
}

function removeStage(
  current: PerformanceCycleDraft | null,
  index: number
): PerformanceCycleDraft | null {
  if (!current) return current;
  return Object.freeze({
    ...current,
    stages: Object.freeze(
      current.stages
        .filter((_, position) => position !== index)
        .map((stage, position) => Object.freeze({ ...stage, sequenceNo: position + 1 }))
    ),
  });
}

export function PerformanceCycleDraftDialog({
  copy,
  draft,
  validation,
  busy,
  conflict,
  setDraft,
  onClose,
  onSubmit,
  onLoadLatest,
}: {
  copy: PerformanceCycleCopy;
  draft: PerformanceCycleDraft | null;
  validation: PerformanceCycleDraftValidation | null;
  busy: boolean;
  conflict: boolean;
  setDraft: React.Dispatch<React.SetStateAction<PerformanceCycleDraft | null>>;
  onClose: () => void;
  onSubmit: () => void;
  onLoadLatest: () => void;
}) {
  const creating = !draft?.cycleId;
  return (
    <FormDialog
      open={Boolean(draft)}
      title={creating ? copy.createDraft : copy.edit}
      description={!creating && draft ? draft.cycleKey : undefined}
      cancelLabel={copy.cancel}
      submitLabel={creating ? copy.createDraft : copy.save}
      submittingLabel={creating ? copy.createDraft : copy.save}
      busy={busy}
      submitDisabled={validation !== 'READY'}
      secondaryActions={
        conflict ? (
          <ActionButton
            size="small"
            intent="secondary"
            startIcon={<RefreshCw size={14} aria-hidden="true" />}
            onClick={onLoadLatest}
          >
            {copy.loadLatest}
          </ActionButton>
        ) : undefined
      }
      onClose={onClose}
      onSubmit={onSubmit}
      maxWidth="md"
      mobileFullScreen
    >
      {draft && (
        <Stack gap={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <FormField
              required
              disabled={!creating}
              label={copy.cycleKey}
              value={draft.cycleKey}
              inputProps={{ maxLength: 100 }}
              onChange={(event) =>
                setDraft((current) => setDraftField(current, 'cycleKey', event.target.value))
              }
            />
            <FormField
              required
              label={copy.displayName}
              value={draft.displayName}
              inputProps={{ maxLength: 240 }}
              onChange={(event) =>
                setDraft((current) => setDraftField(current, 'displayName', event.target.value))
              }
            />
            <FormField
              required
              label={copy.retentionPolicy}
              value={draft.retentionPolicyId}
              onChange={(event) =>
                setDraft((current) =>
                  setDraftField(current, 'retentionPolicyId', event.target.value)
                )
              }
            />
            <FormField
              required
              label={copy.policyVersion}
              value={draft.policyVersionId}
              onChange={(event) =>
                setDraft((current) => setDraftField(current, 'policyVersionId', event.target.value))
              }
            />
            <FormField
              required
              label={copy.populationRule}
              value={draft.populationRuleVersionId}
              onChange={(event) =>
                setDraft((current) =>
                  setDraftField(current, 'populationRuleVersionId', event.target.value)
                )
              }
            />
            <FormField
              required
              label={copy.timezone}
              value={draft.timezoneId}
              inputProps={{ maxLength: 80 }}
              onChange={(event) =>
                setDraft((current) => setDraftField(current, 'timezoneId', event.target.value))
              }
            />
            <DateTimePickerField
              required
              label={copy.effectiveFrom}
              value={draft.effectiveFrom || null}
              onValueChange={(value) =>
                setDraft((current) => setDraftField(current, 'effectiveFrom', value ?? ''))
              }
            />
            <DateTimePickerField
              label={copy.effectiveTo}
              value={draft.effectiveTo || null}
              onValueChange={(value) =>
                setDraft((current) => setDraftField(current, 'effectiveTo', value ?? ''))
              }
            />
          </Box>

          <Divider />
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography component="h3" variant="subtitle1">
              {copy.stages}
            </Typography>
            <ActionButton
              size="small"
              intent="secondary"
              startIcon={<Plus size={14} aria-hidden="true" />}
              onClick={() => setDraft(addStage)}
            >
              {copy.addStage}
            </ActionButton>
          </Stack>
          {draft.stages.map((stage, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
              <Stack gap={1.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Typography component="h4" variant="subtitle2">
                    {copy.stages} {index + 1}
                  </Typography>
                  <ActionButton
                    size="small"
                    intent="quiet"
                    aria-label={`${copy.removeStage} ${index + 1}`}
                    startIcon={<Trash2 size={14} aria-hidden="true" />}
                    onClick={() => setDraft((current) => removeStage(current, index))}
                  >
                    {copy.removeStage}
                  </ActionButton>
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <FormField
                    required
                    label={copy.stageKey}
                    value={stage.stageKey}
                    inputProps={{ maxLength: 80 }}
                    onChange={(event) =>
                      setDraft((current) =>
                        replaceStage(current, index, { stageKey: event.target.value })
                      )
                    }
                  />
                  <FormField
                    required
                    label={copy.stageType}
                    value={stage.stageType}
                    inputProps={{ maxLength: 32 }}
                    onChange={(event) =>
                      setDraft((current) =>
                        replaceStage(current, index, { stageType: event.target.value })
                      )
                    }
                  />
                  <DateTimePickerField
                    required
                    label={copy.opensAt}
                    value={stage.opensAt || null}
                    onValueChange={(value) =>
                      setDraft((current) => replaceStage(current, index, { opensAt: value ?? '' }))
                    }
                  />
                  <DateTimePickerField
                    required
                    label={copy.closesAt}
                    value={stage.closesAt || null}
                    onValueChange={(value) =>
                      setDraft((current) => replaceStage(current, index, { closesAt: value ?? '' }))
                    }
                  />
                </Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={stage.required}
                      onChange={(event) =>
                        setDraft((current) =>
                          replaceStage(current, index, { required: event.target.checked })
                        )
                      }
                    />
                  }
                  label={copy.required}
                />
              </Stack>
            </Paper>
          ))}
          {validation && validation !== 'READY' && (
            <InlineFeedback severity="info">{copy.invalidDraft}</InlineFeedback>
          )}
        </Stack>
      )}
    </FormDialog>
  );
}

export function PerformancePreviewDialog({
  copy,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  copy: PerformanceCycleCopy;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (asOf: string) => void;
}) {
  const [asOf, setAsOf] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setAsOf(null);
  }, [open]);
  return (
    <FormDialog
      open={open}
      title={copy.preview}
      description={copy.participantPreviewDescription}
      cancelLabel={copy.cancel}
      submitLabel={copy.generatePreview}
      submittingLabel={copy.generatePreview}
      busy={busy}
      submitDisabled={!asOf}
      onClose={onClose}
      onSubmit={() => {
        if (asOf) onSubmit(asOf);
      }}
      mobileFullScreen
    >
      <DateTimePickerField required label={copy.asOf} value={asOf} onValueChange={setAsOf} />
    </FormDialog>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PerformancePublishDialog({
  copy,
  open,
  busy,
  detail,
  preview,
  onClose,
  onSubmit,
}: {
  copy: PerformanceCycleCopy;
  open: boolean;
  busy: boolean;
  detail: PerformanceCycleDetail | null;
  preview: PerformancePopulationPreview | null;
  onClose: () => void;
  onSubmit: (publicationApprovalRef: string, reason: string) => void;
}) {
  const [approvalRef, setApprovalRef] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!open) {
      setApprovalRef('');
      setReason('');
    }
  }, [open]);
  const valid =
    UUID.test(approvalRef.trim()) && reason.trim().length >= 10 && reason.trim().length <= 500;
  return (
    <FormDialog
      open={open}
      title={copy.publishTitle}
      description={copy.publishDescription}
      cancelLabel={copy.cancel}
      submitLabel={copy.publish}
      submittingLabel={copy.publish}
      submitIntent="primary"
      busy={busy}
      submitDisabled={!valid || !detail || !preview}
      onClose={onClose}
      onSubmit={() => onSubmit(approvalRef.trim(), reason.trim())}
      mobileFullScreen
    >
      <Stack gap={2}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography component="h3" variant="subtitle2">
            {copy.publishImpact}
          </Typography>
          <Box component="ul" sx={{ my: 1, pl: 2.5 }}>
            <Typography component="li" variant="body2">
              {detail?.displayName} · {copy.version} {detail?.version.versionNo}
            </Typography>
            <Typography component="li" variant="body2">
              {copy.participantCount}: {preview?.participantCount ?? '—'} · {copy.snapshotRevision}:{' '}
              {preview?.workforceSnapshotRevision ?? '—'}
            </Typography>
            <Typography component="li" variant="body2">
              {copy.publisher}: {copy.publish}
            </Typography>
          </Box>
        </Paper>
        <FormField
          required
          label={copy.approvalRef}
          supportingText={copy.approvalHelp}
          value={approvalRef}
          onChange={(event) => setApprovalRef(event.target.value)}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={copy.reason}
          supportingText={copy.reasonRequired}
          value={reason}
          inputProps={{ minLength: 10, maxLength: 500 }}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
