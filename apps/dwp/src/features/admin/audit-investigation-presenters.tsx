import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Database,
  FileCheck2,
  MessageSquarePlus,
  Network,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { formatDate, formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import { alpha } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { severityColor } from './audit-ui';

import type { ReactNode } from 'react';
import type {
  AuditCase,
  AuditCaseActivity,
  AuditCaseEntity,
  AuditCaseWorkspace,
  AuditEvent,
  AuditFinding,
  AuditFindingContext,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

export function AuditQueueMetric({
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

export function AuditInvestigationSectionHeading({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  action?: ReactNode;
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

export function AuditFindingQueueItem({
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

export function AuditCaseQueueItem({
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

export function AuditFindingDossier({ context }: { context: AuditFindingContext }) {
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
        <AuditInvestigationSectionHeading
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
        <AuditInvestigationSectionHeading
          icon={Activity}
          title={t('auditControl.investigations.signalTimeline')}
          detail={t('auditControl.investigations.signalTimelineHint', { count: timeline.length })}
        />
        <EventTimeline events={timeline} />
      </Box>

      {primary && (
        <Box sx={{ px: { xs: 2, lg: 2.5 }, py: 2.5 }}>
          <AuditInvestigationSectionHeading
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

export function AuditCaseDossier({ workspace }: { workspace: AuditCaseWorkspace }) {
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
        <AuditInvestigationSectionHeading
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
        <AuditInvestigationSectionHeading
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
        <AuditInvestigationSectionHeading
          icon={Activity}
          title={t('auditControl.investigations.activityTimeline')}
          detail={t('auditControl.investigations.activityTimelineHint')}
        />
        <ActivityTimeline activities={workspace.activities} />
      </Box>
    </Box>
  );
}
