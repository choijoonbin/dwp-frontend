import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  FolderKanban,
  FolderPlus,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAuditCase,
  getAuditCaseWorkspace,
  getAuditFindingContext,
  listAuditCases,
  listAuditFindings,
  updateAuditFinding,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { AuditCaseActionRail, AuditFindingActionRail } from './audit-investigation-action-rails';
import { AUDIT_CASE_PRIORITIES, AUDIT_FINDING_STATES } from './audit-investigation-model';
import {
  AuditCaseDossier,
  AuditCaseQueueItem,
  AuditFindingDossier,
  AuditFindingQueueItem,
  AuditQueueMetric,
} from './audit-investigation-presenters';

import type { AuditCase } from '@dwp-frontend/shared-utils';
import type { AuditInvestigationView } from './audit-investigation-model';

export function AuditInvestigations() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: AuditInvestigationView = searchParams.get('view') === 'cases' ? 'cases' : 'findings';
  const selectedFindingId = searchParams.get('finding') ?? '';
  const selectedCaseId = searchParams.get('case') ?? '';
  const setView = useCallback(
    (nextView: AuditInvestigationView) => {
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
    return <ManagementPanelLoading label={t('auditControl.loading')} />;
  }
  if (findingsQuery.isError || casesQuery.isError) {
    return <ManagementPanelError message={t('auditControl.loadError')} />;
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
            onChange={(_, value: AuditInvestigationView | null) => value && setView(value)}
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
              {['ALL', ...AUDIT_FINDING_STATES].map((item) => (
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
        <AuditQueueMetric
          label={t('auditControl.investigations.queueOpen')}
          value={findings.filter((item) => !['RESOLVED', 'DISMISSED'].includes(item.status)).length}
          detail={t('auditControl.investigations.queueOpenHint')}
        />
        <AuditQueueMetric
          label={t('auditControl.investigations.queueCritical')}
          value={criticalCount}
          detail={t('auditControl.investigations.queueCriticalHint')}
          tone="error"
        />
        <AuditQueueMetric
          label={t('auditControl.investigations.queueUnassigned')}
          value={unassignedCount}
          detail={t('auditControl.investigations.queueUnassignedHint')}
          tone="warning"
        />
        <AuditQueueMetric
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
                  <AuditFindingQueueItem
                    key={item.findingId}
                    item={item}
                    selected={item.findingId === selectedFindingId}
                    onSelect={() => setSelectedFindingId(item.findingId)}
                  />
                ))
              : filteredCases.map((item) => (
                  <AuditCaseQueueItem
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
            <ManagementPanelLoading label={t('auditControl.investigations.loadingContext')} />
          )}
          {view === 'findings' && findingContextQuery.isError && (
            <ManagementPanelError message={t('auditControl.investigations.contextError')} />
          )}
          {view === 'findings' && findingContextQuery.data && (
            <AuditFindingDossier context={findingContextQuery.data} />
          )}
          {view === 'cases' && caseWorkspaceQuery.isLoading && (
            <ManagementPanelLoading label={t('auditControl.investigations.loadingWorkspace')} />
          )}
          {view === 'cases' && caseWorkspaceQuery.isError && (
            <ManagementPanelError message={t('auditControl.investigations.workspaceError')} />
          )}
          {view === 'cases' && caseWorkspaceQuery.data && (
            <AuditCaseDossier workspace={caseWorkspaceQuery.data} />
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
            <AuditFindingActionRail
              context={findingContextQuery.data}
              cases={cases}
              onSaved={refresh}
            />
          )}
          {view === 'cases' && caseWorkspaceQuery.data && (
            <AuditCaseActionRail workspace={caseWorkspaceQuery.data} onSaved={refresh} />
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
              {AUDIT_CASE_PRIORITIES.map((item) => (
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
