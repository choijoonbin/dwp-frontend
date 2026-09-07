import { useId, useState } from 'react';
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
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

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

type IntelligencePipelineKey =
  'consent' | 'recording' | 'encryption' | 'transcript' | 'model' | 'publication' | 'deletion';

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
  readinessTitle: string;
  readinessProgress: (ready: number, total: number) => string;
  pipelineTitle: string;
  pipelineDescription: string;
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
  pipeline: Record<IntelligencePipelineKey, IntelligenceLabel>;
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
  workFollowUpPromotion: FileCheck2,
  followUpReassignment: UserCheck,
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
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const pipeline = intelligencePipeline(readiness);
  const readySteps = pipeline.filter(({ signal }) => signal.state === 'READY').length;
  const overallSignal = aggregateReadiness(pipeline.map(({ signal }) => signal));

  return (
    <PageCanvas mode="workspace" topInset="compact">
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
        <Alert
          severity="info"
          icon={<ShieldCheck size={19} aria-hidden="true" />}
          sx={{
            '& .MuiAlert-message': {
              minWidth: 0,
              overflow: 'visible',
              overflowWrap: 'anywhere',
            },
          }}
        >
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

        {!compact && <RuntimeEvidencePanel readiness={readiness} labels={labels} />}

        <Box
          component="section"
          aria-labelledby={`${id}-readiness`}
          sx={(theme) => ({
            ...meetingSurface(theme, { tone: readinessTone(overallSignal.state) }),
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            p: { xs: 2, md: 2.5 },
            borderLeft: 4,
            borderLeftColor: STATE_PRESENTATION[overallSignal.state].tone,
          })}
        >
          <Box>
            <Typography
              id={`${id}-readiness`}
              component="h2"
              variant="h6"
              fontWeight="fontWeightBold"
            >
              {labels.readinessTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {labels.readinessProgress(readySteps, pipeline.length)}
            </Typography>
          </Box>
          <ReadinessChip signal={overallSignal} labels={labels} />
        </Box>

        <section aria-labelledby={`${id}-pipeline`}>
          <MeetingSectionHeading
            id={`${id}-pipeline`}
            title={labels.pipelineTitle}
            description={labels.pipelineDescription}
          />
          <Box
            component="ol"
            sx={(theme) => ({
              ...meetingSurface(theme),
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(7, minmax(0, 1fr))',
              },
              m: 0,
              p: 0,
              listStyle: 'none',
              overflow: 'hidden',
            })}
          >
            {pipeline.map(({ key, signal }, index) => (
              <Box
                key={key}
                component="li"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '32px minmax(0, 1fr) auto',
                    lg: 'minmax(0, 1fr) auto',
                  },
                  columnGap: { xs: 1, lg: 0.5 },
                  alignItems: 'start',
                  minWidth: 0,
                  p: { xs: 1.5, lg: 2 },
                  borderTop: { xs: index ? 1 : 0, sm: index > 1 ? 1 : 0, lg: 0 },
                  borderLeft: {
                    xs: 0,
                    sm: index % 2 ? 1 : 0,
                    lg: index ? 1 : 0,
                  },
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="fontWeightBold"
                  sx={{ gridColumn: { lg: 1 } }}
                >
                  {String(index + 1).padStart(2, '0')}
                </Typography>
                <Box sx={{ minWidth: 0, gridColumn: { xs: 2, lg: '1 / -1' } }}>
                  <Typography
                    component="h3"
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{ mt: { lg: 1.25 } }}
                  >
                    {labels.pipeline[key].label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.35 }}
                  >
                    {labels.pipeline[key].description}
                  </Typography>
                  {signal.reason && signal.state !== 'READY' && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 0.5,
                        color: STATE_PRESENTATION[signal.state].tone,
                        fontWeight: 'fontWeightMedium',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {labels.reason(signal.reason)}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ gridColumn: { xs: 3, lg: 2 }, gridRow: 1, justifySelf: 'end' }}>
                  <ReadinessChip signal={signal} labels={labels} />
                </Box>
              </Box>
            ))}
          </Box>
        </section>

        {!compact && <IntelligenceDetailSections id={id} readiness={readiness} labels={labels} />}

        <section aria-labelledby={`${id}-lifecycle`}>
          <MeetingSectionHeading
            id={`${id}-lifecycle`}
            title={labels.lifecycleTitle}
            description={labels.lifecycleDescription}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(300px, 5fr)' },
              gap: 1.5,
              alignItems: 'stretch',
            }}
          >
            <RetentionPanel readiness={readiness} labels={labels} />
            {!compact && <EvidenceControlList readiness={readiness} labels={labels} />}
          </Box>
        </section>

        {compact && (
          <Box
            component="details"
            data-testid="meeting-intelligence-mobile-details"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
            sx={(theme) => ({
              ...meetingSurface(theme, { elevated: false }),
              overflow: 'hidden',
              '&[open] > summary': { borderBottom: 1, borderColor: 'divider' },
            })}
          >
            <Box
              component="summary"
              sx={{
                minHeight: 48,
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                color: 'text.primary',
                '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
              }}
            >
              <Typography component="span" variant="subtitle2" fontWeight="fontWeightBold">
                {labels.runtimeEvidenceTitle}
              </Typography>
              <Typography component="span" variant="caption" color="text.secondary" display="block">
                {labels.dependenciesDescription}
              </Typography>
            </Box>
            <Stack gap={2} sx={{ p: 1.5 }}>
              <RuntimeEvidencePanel readiness={readiness} labels={labels} />
              <IntelligenceDetailSections
                id={`${id}-mobile`}
                readiness={readiness}
                labels={labels}
              />
              <EvidenceControlList readiness={readiness} labels={labels} />
            </Stack>
          </Box>
        )}
      </Stack>
    </PageCanvas>
  );
}

function IntelligenceDetailSections({
  id,
  readiness,
  labels,
}: {
  id: string;
  readiness: MeetingAdminIntelligenceReadiness;
  labels: MeetingAdminIntelligenceLabels;
}) {
  return (
    <>
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
    </>
  );
}

function EvidenceControlList({
  readiness,
  labels,
}: {
  readiness: MeetingAdminIntelligenceReadiness;
  labels: MeetingAdminIntelligenceLabels;
}) {
  return (
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
  );
}

function intelligencePipeline(readiness: MeetingAdminIntelligenceReadiness) {
  return [
    {
      key: 'consent' as const,
      signal: {
        state: 'NOT_VERIFIED' as const,
        reason: 'PER_MEETING_CONSENT_REQUIRED',
      },
    },
    {
      key: 'recording' as const,
      signal: aggregateReadiness([readiness.dependencies.provider, readiness.dependencies.egress]),
    },
    {
      key: 'encryption' as const,
      signal: aggregateReadiness([
        readiness.dependencies.kms,
        readiness.dependencies.storage,
        readiness.dependencies.audit,
      ]),
    },
    { key: 'transcript' as const, signal: readiness.dependencies.stt },
    {
      key: 'model' as const,
      signal: aggregateReadiness([readiness.dependencies.region, readiness.dependencies.llm]),
    },
    {
      key: 'publication' as const,
      signal: aggregateReadiness([
        readiness.governance.humanReview,
        readiness.governance.explicitPublish,
      ]),
    },
    {
      key: 'deletion' as const,
      signal: aggregateReadiness([
        readiness.governance.deletionEvidence,
        readiness.retention.signals.intelligenceReports,
        readiness.retention.signals.meetingRecords,
        readiness.retention.signals.artifacts,
        readiness.retention.signals.chat,
      ]),
    },
  ];
}

function aggregateReadiness(signals: readonly MeetingAdminReadinessSignal[]) {
  const priority: Record<MeetingAdminReadinessState, number> = {
    READY: 0,
    NOT_VERIFIED: 1,
    CONNECTION_REQUIRED: 2,
    BLOCKED: 3,
  };
  return signals.reduce<MeetingAdminReadinessSignal>(
    (current, signal) => (priority[signal.state] > priority[current.state] ? signal : current),
    { state: 'READY' }
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
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}
      >
        {retention.map(({ key, value, signal }, index) => (
          <Box
            key={key}
            role="listitem"
            sx={{
              minWidth: 0,
              p: { xs: 1.25, sm: 2 },
              borderTop: index > 1 ? 1 : 0,
              borderLeft: index % 2 ? 1 : 0,
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
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
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
