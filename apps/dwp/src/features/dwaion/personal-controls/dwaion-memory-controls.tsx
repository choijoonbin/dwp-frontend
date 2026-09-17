import { useMemo, useState } from 'react';
import { Brain, Plus } from 'lucide-react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  ActionButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  GuidedEmptyState,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import { DWAION_PERSONAL_CONTROLS_COPY_KO } from './dwaion-personal-controls-copy';
import { DwaionMemoryEvidenceExplorer } from './dwaion-memory-evidence';
import { memoryDraftErrors } from './dwaion-personal-controls-model';

import type { DwaionPersonalControlsCopy } from './dwaion-personal-controls-copy';
import type {
  DwaionMemoryDraft,
  DwaionMemoryEvidenceCapabilities,
  DwaionMemoryKind,
  DwaionMemoryRecord,
  DwaionMemoryScope,
  DwaionMemoryState,
} from './dwaion-personal-controls-model';

const MEMORY_KINDS: readonly DwaionMemoryKind[] = [
  'RESPONSE_LENGTH',
  'OUTPUT_FORMAT',
  'TONE',
  'WORKING_STYLE',
];
const EMPTY_DRAFT: DwaionMemoryDraft = { kind: 'TONE', value: '' };

export function DwaionMemoryControls({
  memories,
  busy = false,
  canManage = true,
  memoryEnabled = true,
  automaticMemoryInference = null,
  evidenceCapabilities = null,
  onSave,
  onDelete,
  onStateChange,
  onScopeChange,
  onExpiryChange,
  copy = DWAION_PERSONAL_CONTROLS_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  memories: readonly DwaionMemoryRecord[];
  busy?: boolean;
  canManage?: boolean;
  memoryEnabled?: boolean;
  automaticMemoryInference?: boolean | null;
  evidenceCapabilities?: DwaionMemoryEvidenceCapabilities | null;
  onSave: (
    memoryId: string | null,
    expectedRevision: number | null,
    draft: DwaionMemoryDraft
  ) => void | Promise<void>;
  onDelete: (memoryId: string, expectedRevision: number) => void | Promise<void>;
  onStateChange: (
    memoryId: string,
    expectedRevision: number,
    state: Extract<DwaionMemoryState, 'ACTIVE' | 'DISABLED'>
  ) => void | Promise<void>;
  onScopeChange: (
    memoryId: string,
    expectedRevision: number,
    scope: readonly DwaionMemoryScope[]
  ) => void | Promise<void>;
  onExpiryChange: (
    memoryId: string,
    expectedRevision: number,
    expiresAt: string | null
  ) => void | Promise<void>;
  copy?: DwaionPersonalControlsCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const [editing, setEditing] = useState<DwaionMemoryRecord | 'new' | null>(null);
  const [deleting, setDeleting] = useState<DwaionMemoryRecord | null>(null);
  const [scopeEditing, setScopeEditing] = useState<DwaionMemoryRecord | null>(null);
  const [scopeDraft, setScopeDraft] = useState<readonly DwaionMemoryScope[]>([]);
  const [expiryEditing, setExpiryEditing] = useState<DwaionMemoryRecord | null>(null);
  const [expiryDraft, setExpiryDraft] = useState('');
  const [clearExpiry, setClearExpiry] = useState(false);
  const [draft, setDraft] = useState<DwaionMemoryDraft>(EMPTY_DRAFT);
  const errors = useMemo(() => memoryDraftErrors(draft), [draft]);
  const canCreate = canManage && memoryEnabled;

  const openEditor = (memory: DwaionMemoryRecord | 'new') => {
    setEditing(memory);
    setDraft(memory === 'new' ? EMPTY_DRAFT : { kind: memory.kind, value: memory.value });
  };

  const openScopeEditor = (memory: DwaionMemoryRecord) => {
    setScopeEditing(memory);
    setScopeDraft(memory.scope);
  };

  const openExpiryEditor = (memory: DwaionMemoryRecord) => {
    setExpiryEditing(memory);
    setExpiryDraft(toLocalDateTime(memory.expiresAt));
    setClearExpiry(memory.expiresAt === null);
  };

  return (
    <Box component="section" aria-labelledby="dwaion-memory-title">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'flex-start' }}
        justifyContent="space-between"
        gap={2}
      >
        <Stack direction="row" gap={1} alignItems="flex-start">
          <Brain size={19} aria-hidden="true" />
          <Box>
            <Typography id="dwaion-memory-title" component="h2" variant="h6">
              {copy.memoryTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, maxWidth: 720 }}>
              {copy.memoryDescription}
            </Typography>
          </Box>
        </Stack>
        <ActionButton
          intent="secondary"
          startIcon={<Plus size={17} aria-hidden="true" />}
          disabled={!canCreate || busy}
          onClick={() => openEditor('new')}
          sx={{ minHeight: 44, flexShrink: 0, alignSelf: { xs: 'flex-start', md: 'auto' } }}
        >
          {copy.addMemory}
        </ActionButton>
      </Stack>

      <InlineFeedback severity="warning" sx={{ mt: 1.5 }}>
        {copy.sensitiveWarning}
      </InlineFeedback>

      {memories.length === 0 ? (
        <GuidedEmptyState
          kind="empty"
          title={copy.memoryEmpty}
          description={copy.memoryDescription}
          actionLabel={canCreate ? copy.addMemory : undefined}
          onAction={canCreate ? () => openEditor('new') : undefined}
          size="compact"
          announce={false}
        />
      ) : (
        <Box sx={{ mt: 1.5 }}>
          <DwaionMemoryEvidenceExplorer
            memories={memories}
            automaticMemoryInference={automaticMemoryInference}
            evidenceCapabilities={evidenceCapabilities}
            busy={busy}
            canManage={canManage}
            copy={copy}
            formatTimestamp={formatTimestamp}
            onEdit={openEditor}
            onStateChange={(memory) =>
              onStateChange(
                memory.memoryId,
                memory.revision,
                memory.state === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
              )
            }
            onScope={openScopeEditor}
            onExpiry={openExpiryEditor}
            onDelete={setDeleting}
          />
        </Box>
      )}

      <FormDialog
        open={Boolean(editing)}
        title={editing === 'new' ? copy.addMemory : copy.editMemory}
        description={copy.sensitiveWarning}
        cancelLabel={copy.cancel}
        submitLabel={copy.save}
        submittingLabel={copy.saving}
        busy={busy}
        submitDisabled={errors.length > 0}
        mobileFullScreen
        onClose={() => setEditing(null)}
        onSubmit={async () => {
          await onSave(
            editing === 'new' || !editing ? null : editing.memoryId,
            editing === 'new' || !editing ? null : editing.revision,
            draft
          );
          setEditing(null);
        }}
      >
        <Stack gap={2}>
          <SelectField
            label={copy.memoryKind}
            value={draft.kind}
            disabled={editing !== 'new'}
            options={MEMORY_KINDS.map((kind) => ({
              value: kind,
              label: copy.memoryKinds[kind],
            }))}
            onValueChange={(kind) => {
              if (kind) setDraft({ ...draft, kind });
            }}
          />
          <FormField
            label={copy.memoryValue}
            value={draft.value}
            multiline
            minRows={4}
            required
            errorMessage={errors.includes('VALUE_REQUIRED') ? copy.memoryDescription : undefined}
            onChange={(event) => setDraft({ ...draft, value: event.target.value })}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={Boolean(scopeEditing)}
        title={copy.scopeDialogTitle}
        description={copy.scopeDialogDescription}
        cancelLabel={copy.cancel}
        submitLabel={copy.save}
        submittingLabel={copy.saving}
        busy={busy}
        submitDisabled={scopeDraft.length === 0}
        mobileFullScreen
        onClose={() => setScopeEditing(null)}
        onSubmit={async () => {
          if (!scopeEditing || scopeDraft.length === 0) return;
          await onScopeChange(scopeEditing.memoryId, scopeEditing.revision, scopeDraft);
          setScopeEditing(null);
        }}
      >
        <Stack gap={0.5}>
          {scopeEditing?.scope.map((scope) => (
            <FormControlLabel
              key={scope}
              control={
                <Checkbox
                  checked={scopeDraft.includes(scope)}
                  onChange={(_, checked) =>
                    setScopeDraft((current) =>
                      checked ? [...current, scope] : current.filter((item) => item !== scope)
                    )
                  }
                />
              }
              label={copy.memoryScopes[scope]}
            />
          ))}
          {scopeDraft.length === 0 ? (
            <Typography role="alert" color="error.main" variant="caption">
              {copy.scopeRequired}
            </Typography>
          ) : null}
        </Stack>
      </FormDialog>

      <FormDialog
        open={Boolean(expiryEditing)}
        title={copy.expiryDialogTitle}
        description={copy.expiryDialogDescription}
        cancelLabel={copy.cancel}
        submitLabel={copy.save}
        submittingLabel={copy.saving}
        busy={busy}
        submitDisabled={!clearExpiry && !validFutureLocalDateTime(expiryDraft)}
        mobileFullScreen
        onClose={() => setExpiryEditing(null)}
        onSubmit={async () => {
          if (!expiryEditing) return;
          const expiresAt = clearExpiry ? null : new Date(expiryDraft).toISOString();
          await onExpiryChange(expiryEditing.memoryId, expiryEditing.revision, expiresAt);
          setExpiryEditing(null);
        }}
      >
        <Stack gap={1.5}>
          <FormControlLabel
            control={
              <Switch checked={clearExpiry} onChange={(_, checked) => setClearExpiry(checked)} />
            }
            label={copy.clearExpiry}
          />
          <FormField
            label={copy.expiryValue}
            type="datetime-local"
            value={expiryDraft}
            disabled={clearExpiry}
            required={!clearExpiry}
            onChange={(event) => setExpiryDraft(event.target.value)}
          />
        </Stack>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={copy.deleteTitle}
        description={copy.deleteDescription}
        cancelLabel={copy.cancel}
        confirmLabel={copy.deleteConfirm}
        busy={busy}
        intent="danger"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await onDelete(deleting.memoryId, deleting.revision);
          setDeleting(null);
        }}
      />
    </Box>
  );
}

function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function validFutureLocalDateTime(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
