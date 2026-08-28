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
import { PageCanvas } from '@dwp-frontend/design-system';

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
  type MeetingAdminReadinessReason,
  type MeetingAdminReadinessSignal,
  type MeetingAdminReadinessState,
} from './meeting-admin-model';
import { MeetingPageHeading, MeetingSectionHeading } from './meeting-components';

type IntelligenceLabel = {
  label: string;
  description: string;
};

export type MeetingAdminIntelligenceLabels = {
  eyebrow: string;
  title: string;
  description: string;
  accessBoundary: string;
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
  days: (value: number) => string;
  states: Record<MeetingAdminReadinessState, string>;
  reasons: Record<MeetingAdminReadinessReason, string>;
  capabilities: Record<MeetingAdminIntelligenceCapabilityKey, IntelligenceLabel>;
  dependencies: Record<MeetingAdminIntelligenceDependencyKey, IntelligenceLabel>;
  governance: Record<MeetingAdminIntelligenceGovernanceKey, IntelligenceLabel>;
  retention: {
    meeting: IntelligenceLabel;
    artifact: IntelligenceLabel;
    chat: IntelligenceLabel;
  };
};

export type MeetingAdminIntelligenceProps = {
  readiness: MeetingAdminIntelligenceReadiness;
  labels: MeetingAdminIntelligenceLabels;
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

export function MeetingAdminIntelligence({ readiness, labels }: MeetingAdminIntelligenceProps) {
  const id = useId();

  return (
    <PageCanvas>
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
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
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
      sx={{
        minWidth: 0,
        p: compact ? 2 : 2.25,
        border: 1,
        borderColor: 'divider',
        borderTop: 3,
        borderTopColor: presentation.tone,
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box
          sx={{
            display: 'grid',
            width: 36,
            height: 36,
            flex: '0 0 auto',
            placeItems: 'center',
            borderRadius: 1,
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
          {labels.reasons[signal.reason]}
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
      sx={{
        minWidth: 0,
        p: 2,
        borderBottom: 1,
        borderRight: { sm: 1 },
        borderColor: 'divider',
      }}
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
            {labels.reasons[signal.reason]}
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
    { key: 'meeting', value: readiness.retention.meetingDays },
    { key: 'artifact', value: readiness.retention.artifactDays },
    { key: 'chat', value: readiness.retention.chatDays },
  ] as const;
  return (
    <Box
      component="section"
      aria-label={labels.retentionTitle}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
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
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {retention.map(({ key, value }, index) => (
          <Box
            key={key}
            role="listitem"
            sx={{
              minWidth: 0,
              p: 2,
              borderTop: { xs: index ? 1 : 0, sm: 0 },
              borderLeft: { sm: index ? 1 : 0 },
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {labels.retention[key].label}
            </Typography>
            <Typography component="p" variant="h6" fontWeight={850} sx={{ mt: 0.35 }}>
              {labels.days(value)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {labels.retention[key].description}
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
