import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import { dwaionMemoryFilterCounts, filterDwaionMemories } from './dwaion-personal-controls-model';
import { MemoryDetail } from './dwaion-memory-detail';

import type { DwaionPersonalControlsCopy } from './dwaion-personal-controls-copy';
import type {
  DwaionMemoryEvidenceCapabilities,
  DwaionMemoryEvidenceCapability,
  DwaionMemoryFilter,
  DwaionMemoryRecord,
} from './dwaion-personal-controls-model';

const MEMORY_FILTERS: readonly DwaionMemoryFilter[] = ['ALL', 'MANUAL', 'AI_APPROVED', 'EXPIRING'];

export function DwaionMemoryEvidenceExplorer({
  memories,
  automaticMemoryInference,
  evidenceCapabilities,
  busy,
  canManage,
  copy,
  formatTimestamp,
  onEdit,
  onStateChange,
  onScope,
  onExpiry,
  onDelete,
}: {
  memories: readonly DwaionMemoryRecord[];
  automaticMemoryInference: boolean | null;
  evidenceCapabilities: DwaionMemoryEvidenceCapabilities | null;
  busy: boolean;
  canManage: boolean;
  copy: DwaionPersonalControlsCopy;
  formatTimestamp: (value: string) => string;
  onEdit: (memory: DwaionMemoryRecord) => void;
  onStateChange: (memory: DwaionMemoryRecord) => void | Promise<void>;
  onScope: (memory: DwaionMemoryRecord) => void;
  onExpiry: (memory: DwaionMemoryRecord) => void;
  onDelete: (memory: DwaionMemoryRecord) => void;
}) {
  const [filter, setFilter] = useState<DwaionMemoryFilter>('ALL');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(
    memories[0]?.memoryId ?? null
  );
  const [referenceTime] = useState(() => Date.now());
  const filterCounts = useMemo(
    () => dwaionMemoryFilterCounts(memories, referenceTime),
    [memories, referenceTime]
  );
  const filteredMemories = useMemo(
    () => filterDwaionMemories(memories, filter, referenceTime),
    [filter, memories, referenceTime]
  );
  const selectedMemory =
    filteredMemories.find((memory) => memory.memoryId === selectedMemoryId) ??
    filteredMemories[0] ??
    null;

  useEffect(() => {
    if (selectedMemory?.memoryId !== selectedMemoryId) {
      setSelectedMemoryId(selectedMemory?.memoryId ?? null);
    }
  }, [selectedMemory?.memoryId, selectedMemoryId]);

  const aiCapability = evidenceCapabilities?.aiDerivedMemory ?? null;
  const emptyMessage =
    filter === 'AI_APPROVED'
      ? capabilityReason(
          aiCapability,
          automaticMemoryInference === false
            ? copy.automaticInferenceBlocked
            : copy.automaticInferenceUnknown
        )
      : filter === 'EXPIRING'
        ? copy.expiringMemoryEmpty
        : copy.memoryEmpty;

  return (
    <Stack gap={1.5}>
      <MemoryFilterBar filter={filter} counts={filterCounts} copy={copy} onChange={setFilter} />
      {filteredMemories.length === 0 ? (
        <InlineFeedback severity="info" icon={<ShieldAlert size={18} />}>
          {emptyMessage}
        </InlineFeedback>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(230px, .75fr) minmax(0, 1.25fr)',
            },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <MemoryList
            memories={filteredMemories}
            selectedMemoryId={selectedMemory?.memoryId ?? null}
            copy={copy}
            formatTimestamp={formatTimestamp}
            onSelect={setSelectedMemoryId}
          />
          {selectedMemory ? (
            <MemoryDetail
              memory={selectedMemory}
              evidenceCapabilities={evidenceCapabilities}
              copy={copy}
              busy={busy}
              canManage={canManage}
              formatTimestamp={formatTimestamp}
              onEdit={() => onEdit(selectedMemory)}
              onStateChange={() => onStateChange(selectedMemory)}
              onScope={() => onScope(selectedMemory)}
              onExpiry={() => onExpiry(selectedMemory)}
              onDelete={() => onDelete(selectedMemory)}
            />
          ) : null}
        </Box>
      )}
    </Stack>
  );
}

function MemoryFilterBar({
  filter,
  counts,
  copy,
  onChange,
}: {
  filter: DwaionMemoryFilter;
  counts: Record<DwaionMemoryFilter, number>;
  copy: DwaionPersonalControlsCopy;
  onChange: (filter: DwaionMemoryFilter) => void;
}) {
  return (
    <Stack
      role="tablist"
      aria-label={copy.memoryFiltersLabel}
      direction="row"
      gap={0.75}
      useFlexGap
      flexWrap="wrap"
      sx={{ p: 0.75, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
    >
      {MEMORY_FILTERS.map((value) => (
        <ActionButton
          key={value}
          role="tab"
          aria-selected={filter === value}
          intent={filter === value ? 'primary' : 'quiet'}
          onClick={() => onChange(value)}
          sx={{ minHeight: 44 }}
        >
          {copy.memoryFilters[value]} {counts[value]}
        </ActionButton>
      ))}
    </Stack>
  );
}

function MemoryList({
  memories,
  selectedMemoryId,
  copy,
  formatTimestamp,
  onSelect,
}: {
  memories: readonly DwaionMemoryRecord[];
  selectedMemoryId: string | null;
  copy: DwaionPersonalControlsCopy;
  formatTimestamp: (value: string) => string;
  onSelect: (memoryId: string) => void;
}) {
  return (
    <Stack component="section" aria-label={copy.memoryTitle} gap={0.75}>
      {memories.map((memory) => {
        const selected = memory.memoryId === selectedMemoryId;
        return (
          <ButtonBase
            key={memory.memoryId}
            aria-pressed={selected}
            aria-label={`${copy.selectMemory}: ${memory.label}`}
            onClick={() => onSelect(memory.memoryId)}
            sx={{
              display: 'block',
              width: '100%',
              minHeight: 96,
              p: 1.25,
              textAlign: 'left',
              border: 1,
              borderColor: selected ? 'primary.main' : 'divider',
              borderRadius: 1.5,
              bgcolor: selected ? 'primary.50' : 'background.paper',
              '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
            }}
          >
            <Stack direction="row" justifyContent="space-between" gap={0.75}>
              <Typography variant="caption" color="primary.main" fontWeight={800}>
                {memory.memoryId}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={memory.state === 'ACTIVE' ? 'success' : 'default'}
                label={copy.memoryStates[memory.state]}
              />
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
              {memory.label}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {memory.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.manualMemory} {copy.separator} {formatTimestamp(memory.updatedAt)}
            </Typography>
          </ButtonBase>
        );
      })}
    </Stack>
  );
}

function capabilityReason(
  capability: DwaionMemoryEvidenceCapability | null,
  fallback: string
): string {
  return capability?.recoveryHint ?? capability?.reasonCode ?? fallback;
}
