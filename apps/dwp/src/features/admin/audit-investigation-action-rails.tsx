import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Circle,
  Download,
  FileCheck2,
  FolderKanban,
  ListChecks,
  LockKeyhole,
  MessageSquarePlus,
  Search,
  UserRoundCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addAuditCaseNote,
  createAuditCaseTask,
  ensureAuditCaseClosureReport,
  getAuditCaseClosureReport,
  updateAuditCase,
  updateAuditCaseTask,
  updateAuditFinding,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { ActionButton } from '@dwp-frontend/design-system';

import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  AUDIT_CASE_PRIORITIES,
  AUDIT_CASE_STATES,
  AUDIT_FINDING_STATES,
} from './audit-investigation-model';
import { AuditInvestigationSectionHeading } from './audit-investigation-presenters';

import type {
  AuditCase,
  AuditCaseClosureReport,
  AuditCaseTask,
  AuditCaseWorkspace,
  AuditFinding,
  AuditFindingContext,
} from '@dwp-frontend/shared-utils';

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

export function AuditFindingActionRail({
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
      <AuditInvestigationSectionHeading
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
          {AUDIT_FINDING_STATES.map((item) => (
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
      <AuditInvestigationSectionHeading
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

export function AuditCaseActionRail({
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
      <AuditInvestigationSectionHeading
        icon={FolderKanban}
        title={t('auditControl.investigations.caseControl')}
      />
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
          {AUDIT_CASE_STATES.map((state) => (
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
          <AuditInvestigationSectionHeading
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
      <AuditInvestigationSectionHeading
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
          {AUDIT_CASE_PRIORITIES.map((priority) => (
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
      <AuditInvestigationSectionHeading
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
