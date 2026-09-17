import {
  Activity,
  CalendarClock,
  Database,
  Filter,
  PauseCircle,
  Pencil,
  PlayCircle,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton } from '@dwp-frontend/design-system';

import type { DwaionPersonalControlsCopy } from './dwaion-personal-controls-copy';
import type {
  DwaionMemoryEvidenceCapabilities,
  DwaionMemoryEvidenceCapability,
  DwaionMemoryRecord,
} from './dwaion-personal-controls-model';

export function MemoryDetail({
  memory,
  evidenceCapabilities,
  copy,
  busy,
  canManage,
  formatTimestamp,
  onEdit,
  onStateChange,
  onScope,
  onExpiry,
  onDelete,
}: {
  memory: DwaionMemoryRecord;
  evidenceCapabilities: DwaionMemoryEvidenceCapabilities | null;
  copy: DwaionPersonalControlsCopy;
  busy: boolean;
  canManage: boolean;
  formatTimestamp: (value: string) => string;
  onEdit: () => void;
  onStateChange: () => void | Promise<void>;
  onScope: () => void;
  onExpiry: () => void;
  onDelete: () => void;
}) {
  const mutable = canManage && !busy && memory.state !== 'EXPIRED';
  const canChangeState = mutable && ['ACTIVE', 'DISABLED'].includes(memory.state);
  const manualCapability = evidenceCapabilities?.manualProvenance ?? null;
  return (
    <Box
      component="article"
      aria-labelledby="dwaion-selected-memory-title"
      data-testid="dwaion-selected-memory-detail"
      sx={{ p: { xs: 1.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
    >
      <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main">
            {copy.memoryDetailTitle}
          </Typography>
          <Typography id="dwaion-selected-memory-title" component="h3" variant="h6">
            {memory.label}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.5} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            color={capabilityReady(manualCapability) ? 'primary' : 'default'}
            label={copy.manualMemory}
          />
          <Chip
            size="small"
            variant="outlined"
            color={memory.state === 'ACTIVE' ? 'success' : 'default'}
            label={copy.memoryStates[memory.state]}
          />
        </Stack>
      </Stack>

      <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {memory.value}
      </Typography>

      <Box sx={{ mt: 1.5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography component="h4" variant="subtitle2">
          {copy.memoryProvenanceTitle}
        </Typography>
        {!capabilityReady(manualCapability) ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {capabilityReason(manualCapability, copy.governedUnavailable)}
          </Typography>
        ) : null}
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
            m: 0,
            mt: 1,
          }}
        >
          <EvidenceTerm label={copy.memoryOrigin} value={memory.origin} />
          <EvidenceTerm label={copy.memorySourceType} value={memory.sourceType} />
          <EvidenceTerm label={copy.memoryId} value={memory.memoryId} />
          <EvidenceTerm label={copy.createdAt} value={formatTimestamp(memory.createdAt)} />
          <EvidenceTerm label={copy.updatedAt} value={formatTimestamp(memory.updatedAt)} />
          <EvidenceTerm
            label={copy.memoryRevision}
            value={`${copy.revisionPrefix}${memory.revision}`}
          />
          <EvidenceTerm
            label={copy.expiresAt}
            value={memory.expiresAt ? formatTimestamp(memory.expiresAt) : copy.neverExpires}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {copy.memoryScope}
        </Typography>
        <Stack direction="row" gap={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
          {memory.scope.map((scope) => (
            <Chip key={scope} size="small" variant="outlined" label={copy.memoryScopes[scope]} />
          ))}
        </Stack>
      </Box>

      <MemoryActions
        memory={memory}
        copy={copy}
        canManage={canManage}
        busy={busy}
        mutable={mutable}
        canChangeState={canChangeState}
        onEdit={onEdit}
        onStateChange={onStateChange}
        onScope={onScope}
        onExpiry={onExpiry}
        onDelete={onDelete}
      />

      <Divider sx={{ my: 2 }} />
      <Typography component="h4" variant="subtitle1" fontWeight={800}>
        {copy.memoryGovernanceEvidenceTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {copy.memoryGovernanceEvidenceDescription}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
          mt: 1.25,
        }}
      >
        <FactVectorEvidence memory={memory} capabilities={evidenceCapabilities} copy={copy} />
        <UsageEvidence
          memory={memory}
          capabilities={evidenceCapabilities}
          copy={copy}
          formatTimestamp={formatTimestamp}
        />
        <KmsEvidence memory={memory} capabilities={evidenceCapabilities} copy={copy} />
      </Box>
    </Box>
  );
}

function MemoryActions({
  memory,
  copy,
  canManage,
  busy,
  mutable,
  canChangeState,
  onEdit,
  onStateChange,
  onScope,
  onExpiry,
  onDelete,
}: {
  memory: DwaionMemoryRecord;
  copy: DwaionPersonalControlsCopy;
  canManage: boolean;
  busy: boolean;
  mutable: boolean;
  canChangeState: boolean;
  onEdit: () => void;
  onStateChange: () => void | Promise<void>;
  onScope: () => void;
  onExpiry: () => void;
  onDelete: () => void;
}) {
  return (
    <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
      <ActionButton
        intent="secondary"
        startIcon={<Pencil size={16} aria-hidden="true" />}
        disabled={!mutable}
        onClick={onEdit}
        sx={{ minHeight: 44 }}
      >
        {copy.editMemory}
      </ActionButton>
      <ActionButton
        intent="secondary"
        startIcon={
          memory.state === 'ACTIVE' ? (
            <PauseCircle size={16} aria-hidden="true" />
          ) : (
            <PlayCircle size={16} aria-hidden="true" />
          )
        }
        disabled={!canChangeState}
        onClick={() => void onStateChange()}
        sx={{ minHeight: 44 }}
      >
        {memory.state === 'ACTIVE' ? copy.pauseMemory : copy.resumeMemory}
      </ActionButton>
      <ActionButton
        intent="quiet"
        startIcon={<Filter size={16} aria-hidden="true" />}
        disabled={!mutable}
        onClick={onScope}
        sx={{ minHeight: 44 }}
      >
        {copy.narrowMemoryScope}
      </ActionButton>
      <ActionButton
        intent="quiet"
        startIcon={<CalendarClock size={16} aria-hidden="true" />}
        disabled={!mutable}
        onClick={onExpiry}
        sx={{ minHeight: 44 }}
      >
        {copy.resetMemoryExpiry}
      </ActionButton>
      <ActionButton
        intent="danger"
        startIcon={<Trash2 size={16} aria-hidden="true" />}
        disabled={!canManage || busy}
        onClick={onDelete}
        sx={{ minHeight: 44 }}
      >
        {copy.deleteMemory}
      </ActionButton>
    </Stack>
  );
}

function FactVectorEvidence({
  memory,
  capabilities,
  copy,
}: {
  memory: DwaionMemoryRecord;
  capabilities: DwaionMemoryEvidenceCapabilities | null;
  copy: DwaionPersonalControlsCopy;
}) {
  const confidenceCapability = capabilities?.confidenceScoring ?? null;
  const factCapability = capabilities?.factVector ?? null;
  return (
    <EvidenceCard icon={<Database size={17} />} title={copy.factVectorTitle}>
      {capabilityReady(confidenceCapability) && memory.confidence !== null ? (
        <EvidenceTerm
          label={copy.confidenceLabel}
          value={`${Math.round(memory.confidence * 100)}%`}
        />
      ) : (
        <UnavailableLine
          badge={copy.governedUnavailable}
          description={capabilityReason(confidenceCapability, copy.factVectorUnavailable)}
        />
      )}
      {capabilityReady(factCapability) ? (
        memory.factVector.length ? (
          <Stack component="ul" gap={0.5} sx={{ pl: 2.25, my: 0.75 }}>
            {memory.factVector.map((fact) => (
              <Typography component="li" variant="caption" key={fact}>
                {fact}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {copy.factVectorEmpty}
          </Typography>
        )
      ) : (
        <UnavailableLine
          badge={copy.governedUnavailable}
          description={capabilityReason(factCapability, copy.factVectorUnavailable)}
        />
      )}
    </EvidenceCard>
  );
}

function UsageEvidence({
  memory,
  capabilities,
  copy,
  formatTimestamp,
}: {
  memory: DwaionMemoryRecord;
  capabilities: DwaionMemoryEvidenceCapabilities | null;
  copy: DwaionPersonalControlsCopy;
  formatTimestamp: (value: string) => string;
}) {
  const metricsCapability = capabilities?.usageMetrics ?? null;
  const trailCapability = capabilities?.usageTrail ?? null;
  return (
    <EvidenceCard icon={<Activity size={17} />} title={copy.usageEvidenceTitle}>
      {capabilityReady(metricsCapability) ? (
        <Stack component="dl" gap={0.75} sx={{ m: 0 }}>
          <EvidenceTerm label={copy.useCount} value={String(memory.useCount)} />
          <EvidenceTerm
            label={copy.lastUsedAt}
            value={memory.lastUsedAt ? formatTimestamp(memory.lastUsedAt) : copy.neverUsed}
          />
        </Stack>
      ) : (
        <UnavailableLine
          badge={copy.governedUnavailable}
          description={capabilityReason(metricsCapability, copy.usageEvidenceUnavailable)}
        />
      )}
      {!capabilityReady(trailCapability) ? (
        <UnavailableLine
          badge={copy.governedUnavailable}
          description={capabilityReason(trailCapability, copy.usageEvidenceUnavailable)}
        />
      ) : null}
    </EvidenceCard>
  );
}

function KmsEvidence({
  memory,
  capabilities,
  copy,
}: {
  memory: DwaionMemoryRecord;
  capabilities: DwaionMemoryEvidenceCapabilities | null;
  copy: DwaionPersonalControlsCopy;
}) {
  const capability = capabilities?.kmsBinding ?? null;
  const complete = Boolean(
    memory.encryptionProvider &&
    memory.encryptionKeyVersion &&
    memory.encryptionKeyReferenceFingerprint
  );
  return (
    <EvidenceCard icon={<ShieldAlert size={17} />} title={copy.kmsEvidenceTitle}>
      {capabilityReady(capability) && complete ? (
        <Stack component="dl" gap={0.75} sx={{ m: 0 }}>
          <EvidenceTerm label={copy.encryptionProvider} value={memory.encryptionProvider!} />
          <EvidenceTerm label={copy.encryptionKeyVersion} value={memory.encryptionKeyVersion!} />
          <EvidenceTerm
            label={copy.encryptionFingerprint}
            value={memory.encryptionKeyReferenceFingerprint!}
          />
        </Stack>
      ) : (
        <UnavailableLine
          badge={copy.governedUnavailable}
          description={
            capabilityReady(capability)
              ? copy.evidenceValueMissing
              : capabilityReason(capability, copy.kmsEvidenceUnavailable)
          }
        />
      )}
    </EvidenceCard>
  );
}

function EvidenceCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 0 }}>
      <Stack direction="row" alignItems="flex-start" gap={0.75} sx={{ mb: 1 }}>
        <Box sx={{ color: 'text.secondary', pt: 0.2 }}>{icon}</Box>
        <Typography component="h5" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
      </Stack>
      <Stack gap={0.75}>{children}</Stack>
    </Box>
  );
}

function UnavailableLine({ badge, description }: { badge: string; description: string }) {
  return (
    <Box>
      <Chip size="small" variant="outlined" label={badge} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {description}
      </Typography>
    </Box>
  );
}

function EvidenceTerm({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight={700}
        sx={{ m: 0, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function capabilityReady(capability: DwaionMemoryEvidenceCapability | null): boolean {
  return Boolean(capability?.available && capability.configured);
}

function capabilityReason(
  capability: DwaionMemoryEvidenceCapability | null,
  fallback: string
): string {
  return capability?.recoveryHint ?? capability?.reasonCode ?? fallback;
}
