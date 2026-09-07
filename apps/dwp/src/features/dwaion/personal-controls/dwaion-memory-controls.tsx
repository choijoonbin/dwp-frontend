import { useMemo, useState } from 'react';
import { Brain, Pencil, Plus, Trash2 } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  GuidedEmptyState,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import { DWAION_PERSONAL_CONTROLS_COPY_KO } from './dwaion-personal-controls-copy';
import { memoryDraftErrors } from './dwaion-personal-controls-model';

import type { DwaionPersonalControlsCopy } from './dwaion-personal-controls-copy';
import type {
  DwaionMemoryDraft,
  DwaionMemoryKind,
  DwaionMemoryRecord,
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
  onSave,
  onDelete,
  onStateChange,
  copy = DWAION_PERSONAL_CONTROLS_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  memories: readonly DwaionMemoryRecord[];
  busy?: boolean;
  canManage?: boolean;
  memoryEnabled?: boolean;
  onSave: (
    memoryId: string | null,
    expectedRevision: number | null,
    draft: DwaionMemoryDraft
  ) => void | Promise<void>;
  onDelete: (memoryId: string, expectedRevision: number) => void | Promise<void>;
  onStateChange: (
    memoryId: string,
    expectedRevision: number,
    state: Exclude<DwaionMemoryState, 'DELETED'>
  ) => void | Promise<void>;
  copy?: DwaionPersonalControlsCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const [editing, setEditing] = useState<DwaionMemoryRecord | 'new' | null>(null);
  const [deleting, setDeleting] = useState<DwaionMemoryRecord | null>(null);
  const [draft, setDraft] = useState<DwaionMemoryDraft>(EMPTY_DRAFT);
  const errors = useMemo(() => memoryDraftErrors(draft), [draft]);
  const canCreate = canManage && memoryEnabled;

  const openEditor = (memory: DwaionMemoryRecord | 'new') => {
    setEditing(memory);
    setDraft(memory === 'new' ? EMPTY_DRAFT : { kind: memory.kind, value: memory.value });
  };

  return (
    <Box component="section" aria-labelledby="dwaion-memory-title">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'flex-start' }}
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
          sx={{ minHeight: 44 }}
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
        <Box sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}>
          {memories.map((memory, index) => (
            <Box key={memory.memoryId}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                gap={2}
                sx={{ minHeight: 72, py: 1.25, px: { xs: 0, sm: 1 } }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                    <Typography
                      variant="body2"
                      fontWeight="fontWeightBold"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {memory.label}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={memory.state === 'ACTIVE' ? 'success' : 'default'}
                      label={copy.memoryStates[memory.state]}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.35, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                  >
                    {memory.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {copy.memorySource} {copy.separator} {formatTimestamp(memory.updatedAt)}{' '}
                    {copy.separator} {copy.revisionPrefix}
                    {memory.revision}
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.25} alignItems="center">
                  <Switch
                    size="small"
                    checked={memory.state === 'ACTIVE'}
                    disabled={!canManage || busy}
                    slotProps={{
                      input: {
                        'aria-label': `${memory.label}: ${copy.memoryStates[memory.state]}`,
                      },
                    }}
                    onChange={(_, enabled) =>
                      onStateChange(
                        memory.memoryId,
                        memory.revision,
                        enabled ? 'ACTIVE' : 'DISABLED'
                      )
                    }
                  />
                  <ActionIconButton
                    label={`${copy.editMemory}: ${memory.label}`}
                    tooltip={copy.editMemory}
                    disabled={!canManage || busy}
                    onClick={() => openEditor(memory)}
                    sx={{ width: 44, height: 44 }}
                  >
                    <Pencil size={17} aria-hidden="true" />
                  </ActionIconButton>
                  <ActionIconButton
                    label={`${copy.deleteMemory}: ${memory.label}`}
                    tooltip={copy.deleteMemory}
                    disabled={!canManage || busy}
                    onClick={() => setDeleting(memory)}
                    sx={{ width: 44, height: 44 }}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </ActionIconButton>
                </Stack>
              </Stack>
            </Box>
          ))}
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
