import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Database,
  Download,
  FileCheck2,
  FolderKanban,
  FolderPlus,
  ListChecks,
  LockKeyhole,
  MessageSquarePlus,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
  UserRoundCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addAuditCaseNote,
  createAuditCase,
  createAuditCaseTask,
  ensureAuditCaseClosureReport,
  getAuditCaseClosureReport,
  getAuditCaseWorkspace,
  getAuditFindingContext,
  listAuditCases,
  listAuditFindings,
  updateAuditCase,
  updateAuditCaseTask,
  updateAuditFinding,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { ActionButton } from '@dwp-frontend/design-system';

import { alpha } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { severityColor } from './audit-ui';

import type {
  AuditCase,
  AuditCaseActivity,
  AuditCaseClosureReport,
  AuditCaseEntity,
  AuditCaseTask,
  AuditCaseWorkspace,
  AuditEvent,
  AuditFinding,
  AuditFindingContext,
} from '@dwp-frontend/shared-utils';

type View = 'findings' | 'cases';

function downloadClosureReport(report: AuditCaseClosureReport) {
  const content = JSON.stringify(
    {
      reportId: report.reportId,
      caseId: report.caseId,
      caseNumber: report.caseNumber,
      reportVersion: report.reportVersion,
      contentSha256: report.contentSha256,
      generatedBy: report.generatedBy,
      generatedAt: report.generatedAt,
      report: report.report,
    },
    null,
    2
  );
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dwp-audit-case-${report.caseNumber}-closure-v${report.reportVersion}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const FINDING_STATES: AuditFinding['status'][] = [
  'OPEN',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'RESOLVED',
  'DISMISSED',
];
const CASE_STATES: AuditCase['status'][] = [
  'OPEN',
  'INVESTIGATING',
  'CONTAINED',
  'RESOLVED',
  'CLOSED',
];
const PRIORITIES: AuditCase['severity'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function QueueMetric({
  label,
  value,
  detail,
  tone = 'primary',
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'primary' | 'warning' | 'error';
}) {
  return (
    <Box sx={{ minWidth: 0, px: 2, py: 1.5, borderRight: { sm: 1 }, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="baseline" gap={1}>
        <Typography component="p" variant="h5" color={`${tone}.main`} fontWeight={760}>
          {formatNumber(value)}
        </Typography>
        <Typography variant="caption" fontWeight={700} color="text.primary">
          {label}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: typeof Activity;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={2}
      sx={{ mb: 1.5 }}
    >
      <Stack direction="row" alignItems="center" gap={1.1} minWidth={0}>
        <Box
          sx={(theme) => ({
            display: 'grid',
            placeItems: 'center',
            width: 30,
            height: 30,
            flex: '0 0 auto',
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            color: 'primary.main',
          })}
        >
          <Icon size={16} strokeWidth={1.8} />
        </Box>
        <Box minWidth={0}>
          <Typography component="h3" variant="subtitle2">
            {title}
          </Typography>
          {detail && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {detail}
            </Typography>
          )}
        </Box>
      </Stack>
      {action}
    </Stack>
  );
}

function FindingQueueItem({
  item,
  selected,
  onSelect,
}: {
  item: AuditFinding;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={(theme) => ({
        width: '100%',
        minHeight: 108,
        p: 1.5,
        border: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        borderLeft: `3px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.07) : 'transparent',
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, selected ? 0.09 : 0.035) },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      })}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Chip
            size="small"
            variant="outlined"
            color={severityColor(item.severity)}
            label={t(`auditControl.severity.${item.severity}`)}
          />
          <Typography variant="caption" fontWeight={750} color="text.secondary">
            {item.riskScore}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {formatDate(item.lastSeenAt, { timeStyle: 'short' })}
        </Typography>
      </Stack>
      <Typography component="p" variant="subtitle2" noWrap sx={{ mt: 1 }}>
        {item.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ mt: 0.25 }}>
        {item.actorId || t('auditControl.investigations.unknownActor')} → {item.targetId || '—'}
      </Typography>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ mt: 1 }}
      >
        <Typography variant="caption" color="text.secondary" noWrap>
          {item.sourceService}
        </Typography>
        <Chip size="small" label={t(`auditControl.findingStatus.${item.status}`)} />
      </Stack>
    </Box>
  );
}

function CaseQueueItem({
  item,
  selected,
  onSelect,
}: {
  item: AuditCase;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('admin');
  const slaColor =
    item.slaState === 'BREACHED' ? 'error' : item.slaState === 'AT_RISK' ? 'warning' : 'success';
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={(theme) => ({
        width: '100%',
        minHeight: 116,
        p: 1.5,
        border: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        borderLeft: `3px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.07) : 'transparent',
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, selected ? 0.09 : 0.035) },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      })}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="primary.main" fontWeight={800}>
          #{item.caseNumber}
        </Typography>
        <Chip
          size="small"
          color={slaColor}
          variant="outlined"
          label={t(`auditControl.sla.${item.slaState}`)}
        />
      </Stack>
      <Typography component="p" variant="subtitle2" sx={{ mt: 1 }}>
        {item.title}
      </Typography>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.75 }}>
        <Chip
          size="small"
          variant="outlined"
          color={severityColor(item.severity)}
          label={t(`auditControl.severity.${item.severity}`)}
        />
        <Typography variant="caption" color="text.secondary" noWrap>
          {item.ownerActorId || t('auditControl.investigations.unassigned')}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
        {t('auditControl.investigations.evidenceCount', {
          events: item.linkedEvents,
          findings: item.linkedFindings,
        })}
      </Typography>
    </Box>
  );
}

function EntityNode({ entity }: { entity: AuditCaseEntity }) {
  const { t } = useTranslation('admin');
  const Icon =
    entity.entityType === 'USER' ? UserRound : entity.entityType === 'SERVICE' ? Database : Network;
  return (
    <Box
      sx={(theme) => ({
        minWidth: 148,
        maxWidth: 210,
        p: 1.4,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.88),
      })}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: 'action.selected', color: 'text.secondary' }}>
          <Icon size={15} />
        </Avatar>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary">
            {t(`auditControl.entity.relationship.${entity.relationship}`)}
          </Typography>
          <Typography variant="body2" fontWeight={700} noWrap>
            {entity.displayName || entity.entityId}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function EventTimeline({ events, limit = 8 }: { events: AuditEvent[]; limit?: number }) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const sorted = [...events]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, limit);
  if (!sorted.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('auditControl.investigations.noEvidence')}
      </Typography>
    );
  }
  return (
    <Stack component="ol" gap={0} sx={{ p: 0, m: 0, listStyle: 'none' }}>
      {sorted.map((event, index) => (
        <Stack
          component="li"
          key={event.eventId}
          direction="row"
          gap={1.5}
          sx={{ position: 'relative', minHeight: 64, pb: index === sorted.length - 1 ? 0 : 1.5 }}
        >
          <Box sx={{ width: 18, position: 'relative', flex: '0 0 auto' }}>
            {index < sorted.length - 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: 15,
                  bottom: -4,
                  width: 1,
                  bgcolor: 'divider',
                }}
              />
            )}
            <Box
              sx={(theme) => ({
                position: 'absolute',
                top: 6,
                left: 3,
                width: 11,
                height: 11,
                borderRadius: '50%',
                bgcolor:
                  event.riskScore >= 70 ? theme.palette.error.main : theme.palette.primary.main,
                boxShadow: `0 0 0 4px ${alpha(
                  event.riskScore >= 70 ? theme.palette.error.main : theme.palette.primary.main,
                  0.12
                )}`,
              })}
            />
          </Box>
          <Box minWidth={0} flex={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={0.5}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {display('auditActions', event.action)}
              </Typography>
              <Typography variant="caption" color="text.secondary" flex="0 0 auto">
                {formatDate(event.occurredAt, { dateStyle: 'short', timeStyle: 'short' })}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {event.actorDisplayName || event.actorPrincipal || event.actorId || event.actorType} →{' '}
              {event.targetDisplayName || event.targetId} · {event.sourceService}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

function ActivityTimeline({ activities }: { activities: AuditCaseActivity[] }) {
  const { t } = useTranslation('admin');
  if (!activities.length) {
    return (
      <Typography color="text.secondary">{t('auditControl.investigations.noActivity')}</Typography>
    );
  }
  return (
    <Stack gap={1.75}>
      {activities.slice(0, 12).map((activity) => {
        const isNote = activity.activityType === 'NOTE_ADDED';
        return (
          <Stack key={activity.activityId} direction="row" gap={1.5}>
            <Avatar
              sx={{
                width: 30,
                height: 30,
                bgcolor: isNote ? 'primary.main' : 'action.selected',
                color: isNote ? 'primary.contrastText' : 'text.secondary',
              }}
            >
              {isNote ? <MessageSquarePlus size={14} /> : <Activity size={14} />}
            </Avatar>
            <Box minWidth={0} flex={1}>
              <Typography variant="body2" fontWeight={isNote ? 600 : 700}>
                {isNote ? activity.message : t(`auditControl.activity.${activity.activityType}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activity.actorId} ·{' '}
                {formatDate(activity.occurredAt, { dateStyle: 'short', timeStyle: 'short' })}
              </Typography>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}

function FindingDossier({ context }: { context: AuditFindingContext }) {
  const { t } = useTranslation('admin');
  const finding = context.finding;
  const primary = context.primaryEvent;
  const timeline = primary ? [primary, ...context.relatedEvents] : context.relatedEvents;
  return (
    <Box>
      <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Chip
            size="small"
            color={severityColor(finding.severity)}
            label={t(`auditControl.severity.${finding.severity}`)}
          />
          <Chip size="small" variant="outlined" label={finding.ruleKey} />
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.investigations.occurrences', { count: finding.occurrenceCount })}
          </Typography>
        </Stack>
        <Typography component="h2" variant="h5" sx={{ mt: 1.25 }}>
          {finding.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 780 }}>
          {finding.description}
        </Typography>
      </Box>

      <Box
        sx={(theme) => ({
          px: { xs: 2, lg: 2.5 },
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.warning.main, 0.045),
        })}
      >
        <Stack direction="row" gap={1.5} alignItems="flex-start">
          <Sparkles size={18} color="currentColor" />
          <Box>
            <Typography component="h3" variant="subtitle2">
              {t('auditControl.investigations.whyItMatters')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {t('auditControl.investigations.riskNarrative', {
                score: finding.riskScore,
                actor:
                  primary?.actorDisplayName || primary?.actorPrincipal || finding.actorId || '—',
                target: primary?.targetDisplayName || finding.targetId || '—',
                related: context.relatedEvents.length,
              })}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <SectionHeading
          icon={Network}
          title={t('auditControl.investigations.entityPath')}
          detail={t('auditControl.investigations.entityPathHint')}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}>
          <Box sx={{ flex: 1, p: 1.5, border: 1, borderColor: 'divider' }}>
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.investigations.actor')}
            </Typography>
            <Typography variant="body2" fontWeight={700} noWrap>
              {primary?.actorDisplayName || primary?.actorPrincipal || finding.actorId || '—'}
            </Typography>
          </Box>
          <ArrowRight size={18} />
          <Box sx={{ flex: 1, p: 1.5, border: 1, borderColor: 'divider' }}>
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.investigations.activity')}
            </Typography>
            <Typography variant="body2" fontWeight={700} noWrap>
              {primary?.action || finding.ruleKey}
            </Typography>
          </Box>
          <ArrowRight size={18} />
          <Box sx={{ flex: 1, p: 1.5, border: 1, borderColor: 'divider' }}>
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.investigations.target')}
            </Typography>
            <Typography variant="body2" fontWeight={700} noWrap>
              {primary?.targetDisplayName || finding.targetId || '—'}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <SectionHeading
          icon={Activity}
          title={t('auditControl.investigations.signalTimeline')}
          detail={t('auditControl.investigations.signalTimelineHint', { count: timeline.length })}
        />
        <EventTimeline events={timeline} />
      </Box>

      {primary && (
        <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5 }}>
          <SectionHeading
            icon={FileCheck2}
            title={t('auditControl.investigations.primaryEvidence')}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            {[
              [t('auditControl.detail.eventId'), primary.eventId],
              [t('auditControl.detail.correlation'), primary.correlationId || '—'],
              [
                t('auditControl.events.columns.outcome'),
                t(`auditControl.outcome.${primary.outcome}`),
              ],
              [t('auditControl.detail.retention'), primary.retentionClass],
            ].map(([label, value]) => (
              <Box key={label} sx={{ px: 1.5, py: 1.25, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography
                  variant="body2"
                  fontFamily={label.includes('ID') ? 'monospace' : undefined}
                  noWrap
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function CaseDossier({ workspace }: { workspace: AuditCaseWorkspace }) {
  const { t } = useTranslation('admin');
  const item = workspace.auditCase;
  return (
    <Box>
      <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography variant="caption" color="primary.main" fontWeight={800}>
            {t('auditControl.investigations.caseNumberValue', { number: item.caseNumber })}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={severityColor(item.severity)}
            label={t(`auditControl.severity.${item.severity}`)}
          />
          <Chip size="small" label={t(`auditControl.caseStatus.${item.status}`)} />
          <Chip
            size="small"
            variant="outlined"
            color={
              item.slaState === 'BREACHED'
                ? 'error'
                : item.slaState === 'AT_RISK'
                  ? 'warning'
                  : 'success'
            }
            label={t(`auditControl.sla.${item.slaState}`)}
          />
        </Stack>
        <Typography component="h2" variant="h5" sx={{ mt: 1.25 }}>
          {item.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {item.description || t('auditControl.investigations.noDescription')}
        </Typography>
      </Box>

      <Box
        aria-label={t('auditControl.investigations.caseMetrics')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {[
          [t('auditControl.investigations.risk'), workspace.summary.maxRiskScore],
          [t('auditControl.investigations.evidence'), workspace.summary.evidenceCount],
          [t('auditControl.investigations.entities'), workspace.summary.entityCount],
          [t('auditControl.investigations.openTasks'), workspace.summary.openTasks],
        ].map(([label, value]) => (
          <Box key={label} sx={{ p: 1.75, borderRight: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="p" variant="h6" fontWeight={760}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <SectionHeading
          icon={Network}
          title={t('auditControl.investigations.scopeMap')}
          detail={t('auditControl.investigations.scopeMapHint')}
        />
        {workspace.entities.length ? (
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            {workspace.entities.map((entity, index) => (
              <Stack
                key={`${entity.entityType}-${entity.entityId}`}
                direction="row"
                alignItems="center"
                gap={1}
              >
                {index > 0 && <ChevronRight size={16} color="currentColor" />}
                <EntityNode entity={entity} />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('auditControl.investigations.noEntities')}
          </Typography>
        )}
      </Box>

      <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <SectionHeading
          icon={FileCheck2}
          title={t('auditControl.investigations.evidenceTimeline')}
          detail={t('auditControl.investigations.evidenceTimelineHint', {
            events: workspace.evidence.length,
            findings: workspace.findings.length,
          })}
        />
        <EventTimeline events={workspace.evidence} />
      </Box>

      <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5 }}>
        <SectionHeading
          icon={Activity}
          title={t('auditControl.investigations.activityTimeline')}
          detail={t('auditControl.investigations.activityTimelineHint')}
        />
        <ActivityTimeline activities={workspace.activities} />
      </Box>
    </Box>
  );
}

function FindingActionRail({
  context,
  cases,
  onSaved,
}: {
  context: AuditFindingContext;
  cases: AuditCase[];
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const finding = context.finding;
  const [status, setStatus] = useState<AuditFinding['status']>(finding.status);
  const [caseId, setCaseId] = useState(finding.caseId ?? '');
  const [assignedTo, setAssignedTo] = useState(finding.assignedTo ?? '');
  const [resolution, setResolution] = useState(finding.resolution ?? '');
  const linkedCaseClosed = cases.some(
    (item) => item.caseId === finding.caseId && item.status === 'CLOSED'
  );

  useEffect(() => {
    setStatus(finding.status);
    setCaseId(finding.caseId ?? '');
    setAssignedTo(finding.assignedTo ?? '');
    setResolution(finding.resolution ?? '');
  }, [finding]);

  const mutation = useMutation({
    mutationFn: () =>
      updateAuditFinding(finding.findingId, {
        status,
        assignedTo: assignedTo || undefined,
        caseId: caseId || undefined,
        resolution: resolution || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('auditControl.investigations.findingUpdated'));
      await onSaved();
    },
    onError: () => toast.error(t('common.operationError')),
  });

  return (
    <Box sx={{ p: 2, position: { xl: 'sticky' }, top: { xl: 0 } }}>
      <SectionHeading
        icon={UserRoundCheck}
        title={t('auditControl.investigations.triageDecision')}
      />
      <Stack gap={1.5}>
        {linkedCaseClosed && (
          <Stack
            direction="row"
            gap={1}
            sx={(theme) => ({
              p: 1.25,
              border: '1px solid',
              borderColor: alpha(theme.palette.info.main, 0.35),
              borderRadius: 1,
              bgcolor: alpha(theme.palette.info.main, 0.06),
            })}
          >
            <LockKeyhole size={16} style={{ flex: '0 0 auto', marginTop: 2 }} />
            <Typography variant="caption" color="text.secondary">
              {t('auditControl.investigations.closedCaseImmutable')}
            </Typography>
          </Stack>
        )}
        <TextField
          select
          size="small"
          label={t('auditControl.investigations.status')}
          value={status}
          disabled={linkedCaseClosed}
          onChange={(event) => setStatus(event.target.value as AuditFinding['status'])}
        >
          {FINDING_STATES.map((item) => (
            <MenuItem key={item} value={item}>
              {t(`auditControl.findingStatus.${item}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label={t('auditControl.investigations.owner')}
          value={assignedTo}
          disabled={linkedCaseClosed}
          onChange={(event) => setAssignedTo(event.target.value)}
          placeholder={t('auditControl.investigations.unassigned')}
        />
        <Button
          size="small"
          variant="text"
          sx={{ alignSelf: 'flex-start' }}
          disabled={linkedCaseClosed}
          onClick={() => setAssignedTo(auth.user?.userId ? String(auth.user.userId) : '')}
        >
          {t('auditControl.investigations.assignToMe')}
        </Button>
        <TextField
          select
          size="small"
          label={t('auditControl.investigations.linkCase')}
          value={caseId}
          disabled={linkedCaseClosed}
          onChange={(event) => setCaseId(event.target.value)}
        >
          <MenuItem value="">{t('auditControl.investigations.noCase')}</MenuItem>
          {cases.map((item) => (
            <MenuItem key={item.caseId} value={item.caseId} disabled={item.status === 'CLOSED'}>
              #{item.caseNumber} {item.title}
              {item.status === 'CLOSED' ? ` · ${t('auditControl.caseStatus.CLOSED')}` : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          multiline
          minRows={3}
          label={t('auditControl.investigations.assessment')}
          value={resolution}
          disabled={linkedCaseClosed}
          onChange={(event) => setResolution(event.target.value)}
        />
        <Button
          variant="contained"
          startIcon={<Check size={17} />}
          disabled={linkedCaseClosed || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t('auditControl.investigations.saveDecision')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<Search size={17} />}
          onClick={() =>
            navigate(
              `/admin/governance/audit-events?query=${encodeURIComponent(
                context.primaryEvent?.correlationId || finding.eventId || finding.ruleKey
              )}`
            )
          }
        >
          {t('auditControl.investigations.openEvidence')}
        </Button>
      </Stack>

      <Divider sx={{ my: 2.5 }} />
      <SectionHeading
        icon={ListChecks}
        title={t('auditControl.investigations.recommendedActions')}
      />
      <Stack gap={1.25}>
        {['validateIdentity', 'confirmBusinessContext', 'preserveEvidence'].map((key) => (
          <Stack key={key} direction="row" alignItems="flex-start" gap={1}>
            <Circle size={14} style={{ marginTop: 3 }} />
            <Typography variant="body2" color="text.secondary">
              {t(`auditControl.investigations.recommendations.${key}`)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function CaseActionRail({
  workspace,
  onSaved,
}: {
  workspace: AuditCaseWorkspace;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const item = workspace.auditCase;
  const caseClosed = item.status === 'CLOSED';
  const [status, setStatus] = useState<AuditCase['status']>(item.status);
  const [owner, setOwner] = useState(item.ownerActorId ?? '');
  const [resolution, setResolution] = useState(item.resolution ?? '');
  const [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<AuditCaseTask['priority']>('MEDIUM');

  useEffect(() => {
    setStatus(item.status);
    setOwner(item.ownerActorId ?? '');
    setResolution(item.resolution ?? '');
  }, [item]);

  const closureReportQuery = useQuery({
    queryKey: ['audit-control', 'case-closure-report', item.caseId],
    queryFn: () => getAuditCaseClosureReport(item.caseId),
    enabled: item.status === 'CLOSED',
    retry: false,
  });
  const closureReportMutation = useMutation({
    mutationFn: () => ensureAuditCaseClosureReport(item.caseId),
    onSuccess: (report) => {
      queryClient.setQueryData(['audit-control', 'case-closure-report', item.caseId], report);
      toast.success(t('auditControl.investigations.closureReportGenerated'));
      downloadClosureReport(report);
    },
    onError: () => toast.error(t('common.operationError')),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateAuditCase(item.caseId, {
        title: item.title,
        description: item.description ?? undefined,
        severity: item.severity,
        status,
        ownerActorId: owner || undefined,
        resolution: resolution || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('auditControl.investigations.caseUpdated'));
      await onSaved();
      await queryClient.invalidateQueries({
        queryKey: ['audit-control', 'case-closure-report', item.caseId],
      });
    },
    onError: () => toast.error(t('common.operationError')),
  });
  const noteMutation = useMutation({
    mutationFn: () => addAuditCaseNote(item.caseId, note),
    onSuccess: async () => {
      setNote('');
      toast.success(t('auditControl.investigations.noteAdded'));
      await onSaved();
    },
    onError: () => toast.error(t('common.operationError')),
  });
  const taskMutation = useMutation({
    mutationFn: () =>
      createAuditCaseTask(item.caseId, {
        title: taskTitle,
        priority: taskPriority,
        ownerActorId: owner || (auth.user?.userId ? String(auth.user.userId) : undefined),
      }),
    onSuccess: async () => {
      setTaskTitle('');
      toast.success(t('auditControl.investigations.taskAdded'));
      await onSaved();
    },
    onError: () => toast.error(t('common.operationError')),
  });
  const taskStatusMutation = useMutation({
    mutationFn: (task: AuditCaseTask) =>
      updateAuditCaseTask(item.caseId, task.taskId, {
        status: task.status === 'DONE' ? 'OPEN' : 'DONE',
      }),
    onSuccess: onSaved,
    onError: () => toast.error(t('common.operationError')),
  });

  return (
    <Box sx={{ p: 2, position: { xl: 'sticky' }, top: { xl: 0 } }}>
      <SectionHeading icon={FolderKanban} title={t('auditControl.investigations.caseControl')} />
      <Stack gap={1.5}>
        {caseClosed && (
          <Stack
            direction="row"
            gap={1}
            sx={(theme) => ({
              p: 1.25,
              border: '1px solid',
              borderColor: alpha(theme.palette.info.main, 0.35),
              borderRadius: 1,
              bgcolor: alpha(theme.palette.info.main, 0.06),
            })}
          >
            <LockKeyhole size={16} style={{ flex: '0 0 auto', marginTop: 2 }} />
            <Typography variant="caption" color="text.secondary">
              {t('auditControl.investigations.closedCaseImmutable')}
            </Typography>
          </Stack>
        )}
        <TextField
          select
          size="small"
          label={t('auditControl.investigations.status')}
          value={status}
          disabled={caseClosed}
          onChange={(event) => setStatus(event.target.value as AuditCase['status'])}
        >
          {CASE_STATES.map((state) => (
            <MenuItem key={state} value={state}>
              {t(`auditControl.caseStatus.${state}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label={t('auditControl.investigations.owner')}
          value={owner}
          disabled={caseClosed}
          onChange={(event) => setOwner(event.target.value)}
        />
        <TextField
          multiline
          minRows={3}
          label={t('auditControl.investigations.resolution')}
          value={resolution}
          disabled={caseClosed}
          onChange={(event) => setResolution(event.target.value)}
        />
        <Button
          variant="contained"
          startIcon={<Check size={17} />}
          disabled={
            caseClosed ||
            updateMutation.isPending ||
            (status === 'CLOSED' && (!resolution.trim() || workspace.summary.openTasks > 0))
          }
          onClick={() => updateMutation.mutate()}
        >
          {t('auditControl.investigations.updateCase')}
        </Button>
        {status === 'CLOSED' && !resolution.trim() && (
          <Typography variant="caption" color="error.main">
            {t('auditControl.investigations.closureResolutionRequired')}
          </Typography>
        )}
        {status === 'CLOSED' && workspace.summary.openTasks > 0 && (
          <Typography variant="caption" color="error.main">
            {t('auditControl.investigations.closureTasksRequired', {
              count: workspace.summary.openTasks,
            })}
          </Typography>
        )}
      </Stack>

      {item.status === 'CLOSED' && (
        <>
          <Divider sx={{ my: 2.5 }} />
          <SectionHeading
            icon={FileCheck2}
            title={t('auditControl.investigations.closureReport')}
            detail={
              closureReportQuery.data
                ? t('auditControl.investigations.closureReportVersion', {
                    version: closureReportQuery.data.reportVersion,
                  })
                : t('auditControl.investigations.closureReportDescription')
            }
          />
          {closureReportQuery.data ? (
            <Stack gap={1}>
              <Typography variant="caption" color="text.secondary">
                {t('auditControl.investigations.closureReportGeneratedAt', {
                  date: formatDate(closureReportQuery.data.generatedAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                title={closureReportQuery.data.contentSha256}
                sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
              >
                {t('auditControl.investigations.closureReportHash', {
                  hash: closureReportQuery.data.contentSha256,
                })}
              </Typography>
              <ActionButton
                intent="secondary"
                startIcon={<Download size={17} />}
                onClick={() => downloadClosureReport(closureReportQuery.data!)}
              >
                {t('auditControl.investigations.downloadClosureReport')}
              </ActionButton>
            </Stack>
          ) : (
            <ActionButton
              intent="secondary"
              startIcon={<FileCheck2 size={17} />}
              loading={closureReportQuery.isLoading || closureReportMutation.isPending}
              loadingLabel={t('auditControl.investigations.generateClosureReport')}
              onClick={() => closureReportMutation.mutate()}
            >
              {t('auditControl.investigations.generateClosureReport')}
            </ActionButton>
          )}
        </>
      )}

      <Divider sx={{ my: 2.5 }} />
      <SectionHeading
        icon={ListChecks}
        title={t('auditControl.investigations.tasks')}
        detail={t('auditControl.investigations.taskProgress', {
          done: workspace.tasks.filter((task) => task.status === 'DONE').length,
          total: workspace.tasks.length,
        })}
      />
      <LinearProgress
        variant="determinate"
        value={
          workspace.tasks.length
            ? (workspace.tasks.filter((task) => task.status === 'DONE').length /
                workspace.tasks.length) *
              100
            : 0
        }
        aria-label={t('auditControl.investigations.tasks')}
        sx={{ mb: 1.5 }}
      />
      <Stack gap={0.75}>
        {workspace.tasks.map((task) => (
          <Stack key={task.taskId} direction="row" alignItems="flex-start" gap={0.5}>
            <Checkbox
              size="small"
              checked={task.status === 'DONE'}
              disabled={caseClosed || taskStatusMutation.isPending}
              onChange={() => taskStatusMutation.mutate(task)}
              inputProps={{
                'aria-label': `${t('auditControl.investigations.completeTask')}: ${task.title}`,
              }}
            />
            <Box sx={{ pt: 0.75, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ textDecoration: task.status === 'DONE' ? 'line-through' : 'none' }}
              >
                {task.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`auditControl.severity.${task.priority}`)}
              </Typography>
            </Box>
          </Stack>
        ))}
        {!workspace.tasks.length && (
          <Typography variant="body2" color="text.secondary">
            {t('auditControl.investigations.noTasks')}
          </Typography>
        )}
      </Stack>
      <Stack gap={1} sx={{ mt: 1.5 }}>
        <TextField
          size="small"
          label={t('auditControl.investigations.taskTitle')}
          value={taskTitle}
          disabled={caseClosed}
          onChange={(event) => setTaskTitle(event.target.value)}
        />
        <TextField
          select
          size="small"
          label={t('auditControl.investigations.priority')}
          value={taskPriority}
          disabled={caseClosed}
          onChange={(event) => setTaskPriority(event.target.value as AuditCaseTask['priority'])}
        >
          {PRIORITIES.map((priority) => (
            <MenuItem key={priority} value={priority}>
              {t(`auditControl.severity.${priority}`)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          size="small"
          variant="outlined"
          disabled={caseClosed || !taskTitle.trim() || taskMutation.isPending}
          onClick={() => taskMutation.mutate()}
        >
          {t('auditControl.investigations.addTask')}
        </Button>
      </Stack>

      <Divider sx={{ my: 2.5 }} />
      <SectionHeading
        icon={MessageSquarePlus}
        title={t('auditControl.investigations.investigatorNote')}
      />
      <TextField
        fullWidth
        multiline
        minRows={3}
        placeholder={t('auditControl.investigations.notePlaceholder')}
        value={note}
        disabled={caseClosed}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        fullWidth
        variant="outlined"
        sx={{ mt: 1 }}
        disabled={caseClosed || !note.trim() || noteMutation.isPending}
        onClick={() => noteMutation.mutate()}
      >
        {t('auditControl.investigations.addNote')}
      </Button>
    </Box>
  );
}

export function AuditInvestigations() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get('view') === 'cases' ? 'cases' : 'findings';
  const selectedFindingId = searchParams.get('finding') ?? '';
  const selectedCaseId = searchParams.get('case') ?? '';
  const setView = useCallback(
    (nextView: View) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nextView === 'findings') next.delete('view');
          else next.set('view', nextView);
          if (nextView === 'findings') next.delete('case');
          else next.delete('finding');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const setSelectedFindingId = useCallback(
    (findingId: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (findingId) next.set('finding', findingId);
          else next.delete('finding');
          next.delete('case');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const setSelectedCaseId = useCallback(
    (caseId: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (caseId) next.set('case', caseId);
          else next.delete('case');
          next.set('view', 'cases');
          next.delete('finding');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [caseSeverity, setCaseSeverity] = useState<AuditCase['severity']>('MEDIUM');
  const [linkNewCase, setLinkNewCase] = useState(true);

  const findingsQuery = useQuery({
    queryKey: ['audit-control', 'findings', status],
    queryFn: () => listAuditFindings(status),
  });
  const casesQuery = useQuery({ queryKey: ['audit-control', 'cases'], queryFn: listAuditCases });
  const findingContextQuery = useQuery({
    queryKey: ['audit-control', 'finding-context', selectedFindingId],
    queryFn: () => getAuditFindingContext(selectedFindingId),
    enabled: Boolean(selectedFindingId && view === 'findings'),
  });
  const caseWorkspaceQuery = useQuery({
    queryKey: ['audit-control', 'case-workspace', selectedCaseId],
    queryFn: () => getAuditCaseWorkspace(selectedCaseId),
    enabled: Boolean(selectedCaseId && view === 'cases'),
  });

  const findings = useMemo(() => findingsQuery.data ?? [], [findingsQuery.data]);
  const cases = useMemo(() => casesQuery.data ?? [], [casesQuery.data]);
  const filteredFindings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? findings.filter((item) =>
          [item.title, item.ruleKey, item.actorId, item.targetId, item.sourceService]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        )
      : findings;
  }, [findings, search]);
  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? cases.filter((item) =>
          [item.title, item.description, item.ownerActorId, item.caseNumber]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        )
      : cases;
  }, [cases, search]);

  useEffect(() => {
    if (view === 'findings' && filteredFindings.length) {
      if (!filteredFindings.some((item) => item.findingId === selectedFindingId)) {
        setSelectedFindingId(filteredFindings[0].findingId);
      }
    }
  }, [filteredFindings, selectedFindingId, setSelectedFindingId, view]);
  useEffect(() => {
    if (view === 'cases' && filteredCases.length) {
      if (!filteredCases.some((item) => item.caseId === selectedCaseId)) {
        setSelectedCaseId(filteredCases[0].caseId);
      }
    }
  }, [filteredCases, selectedCaseId, setSelectedCaseId, view]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'findings'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'finding-context'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'cases'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'case-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'overview'] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await createAuditCase({
        title: caseTitle,
        description: caseDescription || undefined,
        severity: caseSeverity,
        ownerActorId: auth.user?.userId ? String(auth.user.userId) : undefined,
      });
      if (linkNewCase && selectedFindingId) {
        const selected = findings.find((item) => item.findingId === selectedFindingId);
        if (selected) {
          await updateAuditFinding(selected.findingId, {
            status: 'INVESTIGATING',
            assignedTo: auth.user?.userId ? String(auth.user.userId) : undefined,
            caseId: created.caseId,
            resolution: selected.resolution ?? undefined,
          });
        }
      }
      return created;
    },
    onSuccess: async (created) => {
      setCreateOpen(false);
      setCaseTitle('');
      setCaseDescription('');
      await refresh();
      queryClient.setQueryData<AuditCase[]>(['audit-control', 'cases'], (current = []) => [
        created,
        ...current.filter((item) => item.caseId !== created.caseId),
      ]);
      setSelectedCaseId(created.caseId);
      toast.success(t('auditControl.investigations.caseCreated'));
    },
    onError: () => toast.error(t('common.operationError')),
  });

  if (findingsQuery.isLoading || casesQuery.isLoading) {
    return <AdminPanelLoading label={t('auditControl.loading')} />;
  }
  if (findingsQuery.isError || casesQuery.isError) {
    return <AdminPanelError message={t('auditControl.loadError')} />;
  }

  const criticalCount = findings.filter((item) => item.severity === 'CRITICAL').length;
  const unassignedCount = findings.filter((item) => !item.assignedTo).length;
  const breachCount = cases.filter((item) => item.slaState === 'BREACHED').length;

  return (
    <Box
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        alignItems={{ lg: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 2, py: 1.5 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1.25}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value: View | null) => value && setView(value)}
            aria-label={t('auditControl.investigations.views')}
          >
            <ToggleButton value="findings">
              <ShieldAlert size={16} />
              {t('auditControl.investigations.analysisQueue')}
              <Chip size="small" label={findings.length} sx={{ ml: 0.75 }} />
            </ToggleButton>
            <ToggleButton value="cases">
              <FolderKanban size={16} />
              {t('auditControl.investigations.caseWorkspace')}
              <Chip size="small" label={cases.length} sx={{ ml: 0.75 }} />
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('auditControl.investigations.searchQueue')}
            sx={{ width: { xs: '100%', sm: 280 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>
        <Stack direction="row" justifyContent="flex-end" gap={1}>
          {view === 'findings' && (
            <TextField
              select
              size="small"
              label={t('auditControl.investigations.status')}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              sx={{ minWidth: 150 }}
            >
              {['ALL', ...FINDING_STATES].map((item) => (
                <MenuItem key={item} value={item}>
                  {t(`auditControl.findingStatus.${item}`)}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Tooltip title={t('common.actions.refresh')}>
            <IconButton aria-label={t('common.actions.refresh')} onClick={() => void refresh()}>
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<FolderPlus size={17} />}
            onClick={() => {
              const selected = findings.find((item) => item.findingId === selectedFindingId);
              setCaseTitle(selected?.title ?? '');
              setCaseDescription(selected?.description ?? '');
              setCaseSeverity(selected?.severity ?? 'MEDIUM');
              setLinkNewCase(view === 'findings');
              setCreateOpen(true);
            }}
          >
            {t('auditControl.investigations.newCase')}
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <QueueMetric
          label={t('auditControl.investigations.queueOpen')}
          value={findings.filter((item) => !['RESOLVED', 'DISMISSED'].includes(item.status)).length}
          detail={t('auditControl.investigations.queueOpenHint')}
        />
        <QueueMetric
          label={t('auditControl.investigations.queueCritical')}
          value={criticalCount}
          detail={t('auditControl.investigations.queueCriticalHint')}
          tone="error"
        />
        <QueueMetric
          label={t('auditControl.investigations.queueUnassigned')}
          value={unassignedCount}
          detail={t('auditControl.investigations.queueUnassignedHint')}
          tone="warning"
        />
        <QueueMetric
          label={t('auditControl.investigations.queueBreached')}
          value={breachCount}
          detail={t('auditControl.investigations.queueBreachedHint')}
          tone="error"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: '320px minmax(0, 1fr)',
            xl: '340px minmax(0, 1fr) 310px',
          },
          minHeight: 720,
        }}
      >
        <Box sx={{ borderRight: { md: 1 }, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 1.75, height: 48, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography component="h2" variant="subtitle2">
              {view === 'findings'
                ? t('auditControl.investigations.priorityQueue')
                : t('auditControl.investigations.activeCases')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {view === 'findings' ? filteredFindings.length : filteredCases.length}
            </Typography>
          </Stack>
          <Box sx={{ maxHeight: { md: 920 }, overflowY: { md: 'auto' } }}>
            {view === 'findings'
              ? filteredFindings.map((item) => (
                  <FindingQueueItem
                    key={item.findingId}
                    item={item}
                    selected={item.findingId === selectedFindingId}
                    onSelect={() => setSelectedFindingId(item.findingId)}
                  />
                ))
              : filteredCases.map((item) => (
                  <CaseQueueItem
                    key={item.caseId}
                    item={item}
                    selected={item.caseId === selectedCaseId}
                    onSelect={() => setSelectedCaseId(item.caseId)}
                  />
                ))}
            {((view === 'findings' && !filteredFindings.length) ||
              (view === 'cases' && !filteredCases.length)) && (
              <Stack alignItems="center" gap={1} sx={{ p: 4, color: 'text.secondary' }}>
                <CheckCircle2 size={24} />
                <Typography variant="body2" textAlign="center">
                  {t('auditControl.investigations.noQueueResults')}
                </Typography>
              </Stack>
            )}
          </Box>
        </Box>

        <Box sx={{ minWidth: 0, borderRight: { xl: 1 }, borderColor: 'divider' }}>
          {view === 'findings' && findingContextQuery.isLoading && (
            <AdminPanelLoading label={t('auditControl.investigations.loadingContext')} />
          )}
          {view === 'findings' && findingContextQuery.isError && (
            <AdminPanelError message={t('auditControl.investigations.contextError')} />
          )}
          {view === 'findings' && findingContextQuery.data && (
            <FindingDossier context={findingContextQuery.data} />
          )}
          {view === 'cases' && caseWorkspaceQuery.isLoading && (
            <AdminPanelLoading label={t('auditControl.investigations.loadingWorkspace')} />
          )}
          {view === 'cases' && caseWorkspaceQuery.isError && (
            <AdminPanelError message={t('auditControl.investigations.workspaceError')} />
          )}
          {view === 'cases' && caseWorkspaceQuery.data && (
            <CaseDossier workspace={caseWorkspaceQuery.data} />
          )}
        </Box>

        <Box
          component="aside"
          aria-label={t('auditControl.investigations.actionRail')}
          sx={{
            gridColumn: { xs: '1', md: '1 / -1', xl: 'auto' },
            borderTop: { xs: 1, xl: 0 },
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          {view === 'findings' && findingContextQuery.data && (
            <FindingActionRail context={findingContextQuery.data} cases={cases} onSaved={refresh} />
          )}
          {view === 'cases' && caseWorkspaceQuery.data && (
            <CaseActionRail workspace={caseWorkspaceQuery.data} onSaved={refresh} />
          )}
        </Box>
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('auditControl.investigations.newCase')}</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              required
              label={t('auditControl.investigations.caseTitle')}
              value={caseTitle}
              onChange={(event) => setCaseTitle(event.target.value)}
            />
            <TextField
              multiline
              minRows={4}
              label={t('auditControl.investigations.caseDescription')}
              value={caseDescription}
              onChange={(event) => setCaseDescription(event.target.value)}
            />
            <TextField
              select
              label={t('auditControl.investigations.priority')}
              value={caseSeverity}
              onChange={(event) => setCaseSeverity(event.target.value as AuditCase['severity'])}
            >
              {PRIORITIES.map((item) => (
                <MenuItem key={item} value={item}>
                  {t(`auditControl.severity.${item}`)}
                </MenuItem>
              ))}
            </TextField>
            {view === 'findings' && selectedFindingId && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={linkNewCase}
                    onChange={(event) => setLinkNewCase(event.target.checked)}
                  />
                }
                label={t('auditControl.investigations.linkSelectedFinding')}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setCreateOpen(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={!caseTitle.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {t('common.actions.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
