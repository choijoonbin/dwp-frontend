import { useId } from 'react';
import {
  Bot,
  Captions,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  CloudUpload,
  Database,
  FileCheck2,
  Globe2,
  KeyRound,
  LockKeyhole,
  Radio,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { ActionButton, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip, { type ChipProps } from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  MEETING_ADMIN_INTELLIGENCE_CAPABILITIES,
  MEETING_ADMIN_INTELLIGENCE_DEPENDENCIES,
  MEETING_ADMIN_INTELLIGENCE_EVIDENCE_CONTROLS,
  MEETING_ADMIN_INTELLIGENCE_WORKFLOW_CONTROLS,
  type MeetingAdminIntelligenceCapabilityKey,
  type MeetingAdminIntelligenceDependencyKey,
  type MeetingAdminIntelligenceGovernanceKey,
  type MeetingAdminIntelligenceReadiness,
  type MeetingAdminReadinessSignal,
  type MeetingAdminReadinessState,
} from './meeting-admin-model';
import { MeetingPageHeading, MeetingSectionHeading } from './meeting-components';
import {
  meetingInsetSurface,
  meetingSurface,
  type MeetingSurfaceTone,
} from './meeting-visual-system';

type IntelligenceLabel = {
  label: string;
  description: string;
};

export type MeetingAdminIntelligenceLabels = {
  eyebrow: string;
  title: string;
  description: string;
  accessBoundary: string;
  runtimeEvidenceTitle: string;
  runtimeEvidence: {
    version: string;
    recordingPolicy: string;
    provider: string;
    model: string;
    region: string;
  };
  recordingPolicies: Record<'NEVER' | 'HOST_OPT_IN' | 'ADMIN_REQUIRED', string>;
  unavailable: string;
  capabilitiesTitle: string;
  capabilitiesDescription: string;
  dependenciesTitle: string;
  dependenciesDescription: string;
  workflowTitle: string;
  workflowDescription: string;
  lifecycleTitle: string;
  lifecycleDescription: string;
  retentionTitle: string;
  retentionDescription: string;
  observedAt: (value: string) => string;
  days: (value: number | null) => string;
  states: Record<MeetingAdminReadinessState, string>;
  reason: (value: string) => string;
  capabilities: Record<MeetingAdminIntelligenceCapabilityKey, IntelligenceLabel>;
  dependencies: Record<MeetingAdminIntelligenceDependencyKey, IntelligenceLabel>;
  governance: Record<MeetingAdminIntelligenceGovernanceKey, IntelligenceLabel>;
  retention: {
    meeting: IntelligenceLabel;
    artifact: IntelligenceLabel;
    chat: IntelligenceLabel;
    intelligence: IntelligenceLabel;
    worker: IntelligenceLabel;
  };
};

export type MeetingAdminIntelligenceSourceFailure = {
  key: 'policy' | 'readiness';
  message: string;
  retryLabel: string;
  onRetry: () => void;
};

export type MeetingAdminIntelligenceProps = {
  readiness: MeetingAdminIntelligenceReadiness;
  labels: MeetingAdminIntelligenceLabels;
  sourceFailures?: readonly MeetingAdminIntelligenceSourceFailure[];
};

const CAPABILITY_ICONS: Record<MeetingAdminIntelligenceCapabilityKey, LucideIcon> = {
  recording: Radio,
  transcript: Captions,
  aiNotes: Bot,
};

const DEPENDENCY_ICONS: Record<MeetingAdminIntelligenceDependencyKey, LucideIcon> = {
  provider: Server,
  region: Globe2,
  kms: KeyRound,
  audit: FileCheck2,
  egress: CloudUpload,
  storage: Database,
  stt: ScrollText,
  llm: Sparkles,
};

const GOVERNANCE_ICONS: Record<MeetingAdminIntelligenceGovernanceKey, LucideIcon> = {
  humanReview: UserCheck,
  explicitPublish: FileCheck2,
  adminContentAccess: LockKeyhole,
  legalHold: ShieldCheck,
  deletionEvidence: ScrollText,
};

const STATE_PRESENTATION: Record<
  MeetingAdminReadinessState,
  { color: ChipProps['color']; icon: LucideIcon; tone: string }
> = {
  READY: { color: 'success', icon: CheckCircle2, tone: 'success.main' },
  BLOCKED: { color: 'error', icon: XCircle, tone: 'error.main' },
  CONNECTION_REQUIRED: { color: 'warning', icon: CircleAlert, tone: 'warning.main' },
  NOT_VERIFIED: { color: 'default', icon: CircleHelp, tone: 'text.secondary' },
};

function readinessTone(state: MeetingAdminReadinessState): MeetingSurfaceTone {
  if (state === 'READY') return 'success';
  if (state === 'BLOCKED') return 'error';
  if (state === 'CONNECTION_REQUIRED') return 'warning';
  return 'neutral';
}

export function MeetingAdminIntelligence({
  readiness,
  labels,
  sourceFailures = [],
}: MeetingAdminIntelligenceProps) {
  const id = useId();

  return (
    <PageCanvas mode="focus">
      <MeetingPageHeading
        eyebrow={labels.eyebrow}
        title={labels.title}
        description={labels.description}
        actions={
          readiness.observedAt ? (
            <Typography component="time" dateTime={readiness.observedAt} variant="caption">
              {labels.observedAt(readiness.observedAt)}
            </Typography>
          ) : undefined
        }
      />

      <Stack gap={3}>
        <Alert severity="info" icon={<ShieldCheck size={19} aria-hidden="true" />}>
          {labels.accessBoundary}
        </Alert>

        {sourceFailures.map((failure) => (
          <Alert
            key={failure.key}
            severity="warning"
            action={
              <ActionButton intent="quiet" size="small" onClick={failure.onRetry}>
                {failure.retryLabel}
              </ActionButton>
            }
          >
            {failure.message}
          </Alert>
        ))}

        <RuntimeEvidencePanel readiness={readiness} labels={labels} />

        <section aria-labelledby={`${id}-capabilities`}>
          <MeetingSectionHeading
            id={`${id}-capabilities`}
            title={labels.capabilitiesTitle}
            description={labels.capabilitiesDescription}
          />
          <Box
            role="list"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            {MEETING_ADMIN_INTELLIGENCE_CAPABILITIES.map((key) => (
              <ReadinessCard
                key={key}
                icon={CAPABILITY_ICONS[key]}
                item={labels.capabilities[key]}
                signal={readiness.capabilities[key]}
                labels={labels}
              />
            ))}
          </Box>
        </section>

        <section aria-labelledby={`${id}-dependencies`}>
          <MeetingSectionHeading
            id={`${id}-dependencies`}
            title={labels.dependenciesTitle}
            description={labels.dependenciesDescription}
          />
          <Box
            role="list"
            sx={(theme) => ({
              ...meetingSurface(theme),
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
              p: 1,
            })}
          >
            {MEETING_ADMIN_INTELLIGENCE_DEPENDENCIES.map((key) => (
              <DependencyRow
                key={key}
                icon={DEPENDENCY_ICONS[key]}
                item={labels.dependencies[key]}
                signal={readiness.dependencies[key]}
                labels={labels}
              />
            ))}
          </Box>
        </section>

        <section aria-labelledby={`${id}-workflow`}>
          <MeetingSectionHeading
            id={`${id}-workflow`}
            title={labels.workflowTitle}
            description={labels.workflowDescription}
          />
          <Box
            role="list"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            {MEETING_ADMIN_INTELLIGENCE_WORKFLOW_CONTROLS.map((key) => (
              <ReadinessCard
                key={key}
                icon={GOVERNANCE_ICONS[key]}
                item={labels.governance[key]}
                signal={readiness.governance[key]}
                labels={labels}
                compact
              />
            ))}
          </Box>
        </section>

        <section aria-labelledby={`${id}-lifecycle`}>
          <MeetingSectionHeading
            id={`${id}-lifecycle`}
            title={labels.lifecycleTitle}
            description={labels.lifecycleDescription}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(300px, 0.6fr)' },
              gap: 1.5,
              alignItems: 'stretch',
            }}
          >
            <RetentionPanel readiness={readiness} labels={labels} />
            <Stack role="list" gap={1.5}>
              {MEETING_ADMIN_INTELLIGENCE_EVIDENCE_CONTROLS.map((key) => (
                <ReadinessCard
                  key={key}
                  icon={GOVERNANCE_ICONS[key]}
                  item={labels.governance[key]}
                  signal={readiness.governance[key]}
                  labels={labels}
                  compact
                />
              ))}
            </Stack>
          </Box>
        </section>
      </Stack>
    </PageCanvas>
  );
}

function ReadinessCard({
  icon: Icon,
  item,
  signal,
  labels,
  compact = false,
}: {
  icon: LucideIcon;
  item: IntelligenceLabel;
  signal: MeetingAdminReadinessSignal;
  labels: MeetingAdminIntelligenceLabels;
  compact?: boolean;
}) {
  const presentation = STATE_PRESENTATION[signal.state];
  return (
    <Box
      role="listitem"
      data-state={signal.state}
      sx={(theme) => ({
        ...meetingSurface(theme, {
          tone: readinessTone(signal.state),
          elevated: false,
        }),
        minWidth: 0,
        p: compact ? 2 : 2.25,
        borderTop: 3,
        borderTopColor: presentation.tone,
      })}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box
          sx={{
            display: 'grid',
            width: 36,
            height: 36,
            flex: '0 0 auto',
            placeItems: 'center',
            borderRadius: 2,
            bgcolor: 'action.hover',
            color: presentation.tone,
          }}
        >
          <Icon size={19} aria-hidden="true" />
        </Box>
        <ReadinessChip signal={signal} labels={labels} />
      </Stack>
      <Typography component="h3" variant="subtitle1" fontWeight={800} sx={{ mt: 1.5 }}>
        {item.label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {item.description}
      </Typography>
      {signal.reason && signal.state !== 'READY' && (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1.25, color: presentation.tone, fontWeight: 700 }}
        >
          {labels.reason(signal.reason)}
        </Typography>
      )}
    </Box>
  );
}

function DependencyRow({
  icon: Icon,
  item,
  signal,
  labels,
}: {
  icon: LucideIcon;
  item: IntelligenceLabel;
  signal: MeetingAdminReadinessSignal;
  labels: MeetingAdminIntelligenceLabels;
}) {
  const presentation = STATE_PRESENTATION[signal.state];
  return (
    <Stack
      role="listitem"
      direction="row"
      alignItems="flex-start"
      gap={1.25}
      data-state={signal.state}
      sx={(theme) => ({
        ...meetingInsetSurface(theme, readinessTone(signal.state)),
        minWidth: 0,
        p: 2,
      })}
    >
      <Box sx={{ color: presentation.tone, pt: 0.25 }}>
        <Icon size={18} aria-hidden="true" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
        >
          <Typography component="h3" variant="body2" fontWeight={800}>
            {item.label}
          </Typography>
          <ReadinessChip signal={signal} labels={labels} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
          {item.description}
        </Typography>
        {signal.reason && signal.state !== 'READY' && (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.5, color: presentation.tone, fontWeight: 700 }}
          >
            {labels.reason(signal.reason)}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function RetentionPanel({
  readiness,
  labels,
}: {
  readiness: MeetingAdminIntelligenceReadiness;
  labels: MeetingAdminIntelligenceLabels;
}) {
  const retention = [
    {
      key: 'meeting',
      value: readiness.retention.meetingDays,
      signal: readiness.retention.signals.meetingRecords,
    },
    {
      key: 'artifact',
      value: readiness.retention.artifactDays,
      signal: readiness.retention.signals.artifacts,
    },
    {
      key: 'chat',
      value: readiness.retention.chatDays,
      signal: readiness.retention.signals.chat,
    },
    {
      key: 'intelligence',
      value: readiness.retention.artifactDays,
      signal: readiness.retention.signals.intelligenceReports,
    },
  ] as const;
  return (
    <Box
      component="section"
      aria-label={labels.retentionTitle}
      sx={(theme) => ({ ...meetingSurface(theme), overflow: 'hidden' })}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography component="h3" variant="subtitle1" fontWeight={800}>
          {labels.retentionTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {labels.retentionDescription}
        </Typography>
      </Box>
      <Divider />
      <Box
        role="list"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {retention.map(({ key, value, signal }, index) => (
          <Box
            key={key}
            role="listitem"
            sx={{
              minWidth: 0,
              p: 2,
              borderTop: { xs: index ? 1 : 0, sm: index > 1 ? 1 : 0 },
              borderLeft: { sm: index % 2 ? 1 : 0 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
              <Typography variant="caption" color="text.secondary">
                {labels.retention[key].label}
              </Typography>
              <ReadinessChip signal={signal} labels={labels} />
            </Stack>
            <Typography component="p" variant="h6" fontWeight={850} sx={{ mt: 0.35 }}>
              {labels.days(value)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {labels.retention[key].description}
            </Typography>
            {signal.reason && signal.state !== 'READY' && (
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.75, color: 'text.secondary', fontWeight: 700 }}
              >
                {labels.reason(signal.reason)}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
      <Divider />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ p: 2 }}
      >
        <Box>
          <Typography variant="body2" fontWeight={800}>
            {labels.retention.worker.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {labels.retention.worker.description}
          </Typography>
        </Box>
        <ReadinessChip
          signal={
            readiness.retention.intelligenceWorkerReady == null
              ? { state: 'NOT_VERIFIED' }
              : readiness.retention.intelligenceWorkerReady
                ? { state: 'READY' }
                : { state: 'BLOCKED' }
          }
          labels={labels}
        />
      </Stack>
    </Box>
  );
}

function RuntimeEvidencePanel({
  readiness,
  labels,
}: {
  readiness: MeetingAdminIntelligenceReadiness;
  labels: MeetingAdminIntelligenceLabels;
}) {
  const values = [
    {
      key: 'version',
      label: labels.runtimeEvidence.version,
      value: readiness.readinessVersion,
    },
    {
      key: 'recordingPolicy',
      label: labels.runtimeEvidence.recordingPolicy,
      value: readiness.recordingPolicy
        ? labels.recordingPolicies[readiness.recordingPolicy]
        : undefined,
    },
    {
      key: 'provider',
      label: labels.runtimeEvidence.provider,
      value: readiness.providerCode,
    },
    { key: 'model', label: labels.runtimeEvidence.model, value: readiness.providerModel },
    { key: 'region', label: labels.runtimeEvidence.region, value: readiness.processingRegion },
  ];
  return (
    <Box
      component="section"
      aria-label={labels.runtimeEvidenceTitle}
      sx={(theme) => ({ ...meetingSurface(theme), overflow: 'hidden' })}
    >
      <Typography component="h2" variant="subtitle1" fontWeight={800} sx={{ px: 2, py: 1.5 }}>
        {labels.runtimeEvidenceTitle}
      </Typography>
      <Divider />
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          m: 0,
          p: 2,
        }}
      >
        {values.map((item) => (
          <Box key={item.key} component="div" sx={{ minWidth: 0 }}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {item.label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              fontWeight={750}
              sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
            >
              {item.value || labels.unavailable}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ReadinessChip({
  signal,
  labels,
}: {
  signal: MeetingAdminReadinessSignal;
  labels: MeetingAdminIntelligenceLabels;
}) {
  const presentation = STATE_PRESENTATION[signal.state];
  const StateIcon = presentation.icon;
  return (
    <Chip
      size="small"
      color={presentation.color}
      variant={signal.state === 'NOT_VERIFIED' ? 'outlined' : 'filled'}
      icon={<StateIcon size={14} aria-hidden="true" />}
      label={labels.states[signal.state]}
      aria-label={labels.states[signal.state]}
    />
  );
}
