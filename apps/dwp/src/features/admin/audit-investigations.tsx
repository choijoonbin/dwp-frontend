import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  ChevronRight,
  FileSearch,
  FolderPlus,
  RefreshCw,
  ShieldAlert,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAuditCase,
  listAuditCases,
  listAuditFindings,
  updateAuditCase,
  updateAuditFinding,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { RiskScore, severityColor } from './audit-ui';

import type { AuditCase, AuditFinding } from '@dwp-frontend/shared-utils';

type View = 'findings' | 'cases';

export function AuditInvestigations() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('findings');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<AuditFinding | null>(null);
  const [selectedCase, setSelectedCase] = useState('');
  const [findingStatus, setFindingStatus] = useState<AuditFinding['status']>('OPEN');
  const [resolution, setResolution] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [caseSeverity, setCaseSeverity] = useState<AuditCase['severity']>('MEDIUM');

  const findingsQuery = useQuery({
    queryKey: ['audit-control', 'findings', status],
    queryFn: () => listAuditFindings(status),
  });
  const casesQuery = useQuery({ queryKey: ['audit-control', 'cases'], queryFn: listAuditCases });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'findings'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'cases'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'overview'] }),
    ]);
  };

  const findingMutation = useMutation({
    mutationFn: () =>
      updateAuditFinding(selected!.findingId, {
        status: findingStatus,
        assignedTo: auth.user?.userId ? String(auth.user.userId) : undefined,
        resolution: resolution || undefined,
        caseId: selectedCase || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('auditControl.investigations.findingUpdated'));
      setSelected(null);
      await refresh();
    },
    onError: () => toast.error(t('common.operationError')),
  });

  const caseMutation = useMutation({
    mutationFn: () =>
      createAuditCase({
        title: caseTitle,
        description: caseDescription || undefined,
        severity: caseSeverity,
        ownerActorId: auth.user?.userId ? String(auth.user.userId) : undefined,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setCaseTitle('');
      setCaseDescription('');
      toast.success(t('auditControl.investigations.caseCreated'));
      await refresh();
    },
    onError: () => toast.error(t('common.operationError')),
  });

  const caseStatusMutation = useMutation({
    mutationFn: ({ item, next }: { item: AuditCase; next: AuditCase['status'] }) =>
      updateAuditCase(item.caseId, {
        title: item.title,
        description: item.description ?? undefined,
        severity: item.severity,
        status: next,
        ownerActorId: item.ownerActorId ?? undefined,
        resolution:
          next === 'CLOSED'
            ? item.resolution || t('auditControl.investigations.closedResolution')
            : (item.resolution ?? undefined),
      }),
    onSuccess: async () => {
      toast.success(t('auditControl.investigations.caseUpdated'));
      await refresh();
    },
    onError: () => toast.error(t('common.operationError')),
  });

  const openFinding = (finding: AuditFinding) => {
    setSelected(finding);
    setFindingStatus(finding.status);
    setSelectedCase(finding.caseId ?? '');
    setResolution(finding.resolution ?? '');
  };

  if (findingsQuery.isLoading || casesQuery.isLoading)
    return <AdminPanelLoading label={t('auditControl.loading')} />;
  if (findingsQuery.isError || casesQuery.isError)
    return <AdminPanelError message={t('auditControl.loadError')} />;

  const findings = findingsQuery.data ?? [];
  const cases = casesQuery.data ?? [];

  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ minHeight: 64, px: 2 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, value: View | null) => value && setView(value)}
          aria-label={t('auditControl.investigations.views')}
        >
          <ToggleButton value="findings">
            <ShieldAlert size={16} />
            {t('auditControl.investigations.findings')}
            <Chip size="small" label={findings.length} sx={{ ml: 0.75 }} />
          </ToggleButton>
          <ToggleButton value="cases">
            <FileSearch size={16} />
            {t('auditControl.investigations.cases')}
            <Chip size="small" label={cases.length} sx={{ ml: 0.75 }} />
          </ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" justifyContent="flex-end" gap={1}>
          {view === 'findings' && (
            <TextField
              select
              size="small"
              label={t('auditControl.investigations.status')}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              sx={{ minWidth: 156 }}
            >
              {['ALL', 'OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].map(
                (item) => (
                  <MenuItem key={item} value={item}>
                    {t(`auditControl.findingStatus.${item}`)}
                  </MenuItem>
                )
              )}
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
            onClick={() => setCreateOpen(true)}
          >
            {t('auditControl.investigations.newCase')}
          </Button>
        </Stack>
      </Stack>
      <Divider />

      {view === 'findings' ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table aria-label={t('auditControl.investigations.findings')} sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('auditControl.investigations.priority')}</TableCell>
                <TableCell>{t('auditControl.investigations.finding')}</TableCell>
                <TableCell>{t('auditControl.events.columns.source')}</TableCell>
                <TableCell>{t('auditControl.investigations.firstLast')}</TableCell>
                <TableCell>{t('auditControl.investigations.owner')}</TableCell>
                <TableCell>{t('auditControl.investigations.status')}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {findings.map((finding) => (
                <TableRow
                  key={finding.findingId}
                  hover
                  onClick={() => openFinding(finding)}
                  sx={{ height: 68, cursor: 'pointer' }}
                >
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={severityColor(finding.severity)}
                        label={t(`auditControl.severity.${finding.severity}`)}
                      />
                      <RiskScore value={finding.riskScore} />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {finding.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {finding.ruleKey} /{' '}
                      {t('auditControl.investigations.occurrences', {
                        count: finding.occurrenceCount,
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell>{finding.sourceService}</TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">
                      {formatDate(finding.firstSeenAt, { dateStyle: 'short', timeStyle: 'short' })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(finding.lastSeenAt, { dateStyle: 'short', timeStyle: 'short' })}
                    </Typography>
                  </TableCell>
                  <TableCell>{finding.assignedTo || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`auditControl.findingStatus.${finding.status}`)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <ChevronRight size={17} />
                  </TableCell>
                </TableRow>
              ))}
              {!findings.length && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CheckCircle2 size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {t('auditControl.investigations.noFindings')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table aria-label={t('auditControl.investigations.cases')} sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('auditControl.investigations.caseNumber')}</TableCell>
                <TableCell>{t('auditControl.investigations.caseTitle')}</TableCell>
                <TableCell>{t('auditControl.investigations.priority')}</TableCell>
                <TableCell>{t('auditControl.investigations.owner')}</TableCell>
                <TableCell>{t('auditControl.investigations.evidence')}</TableCell>
                <TableCell>{t('auditControl.investigations.updated')}</TableCell>
                <TableCell>{t('auditControl.investigations.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.map((item) => (
                <TableRow key={item.caseId} sx={{ height: 68 }}>
                  <TableCell>#{item.caseNumber}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {item.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={severityColor(item.severity)}
                      label={t(`auditControl.severity.${item.severity}`)}
                    />
                  </TableCell>
                  <TableCell>{item.ownerActorId || '—'}</TableCell>
                  <TableCell>
                    {t('auditControl.investigations.evidenceCount', {
                      events: item.linkedEvents,
                      findings: item.linkedFindings,
                    })}
                  </TableCell>
                  <TableCell>
                    {formatDate(item.updatedAt, { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={item.status}
                      slotProps={{
                        select: {
                          SelectDisplayProps: {
                            'aria-label': `${t('auditControl.investigations.status')}: ${item.title}`,
                          },
                        },
                      }}
                      onChange={(event) =>
                        caseStatusMutation.mutate({
                          item,
                          next: event.target.value as AuditCase['status'],
                        })
                      }
                      sx={{ minWidth: 150 }}
                    >
                      {['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'].map((state) => (
                        <MenuItem key={state} value={state}>
                          {t(`auditControl.caseStatus.${state}`)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 }, maxWidth: '100%' } } }}
      >
        {selected && (
          <Box>
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              gap={2}
              sx={{ p: 2.5 }}
            >
              <Box>
                <Chip
                  size="small"
                  color={severityColor(selected.severity)}
                  variant="outlined"
                  label={t(`auditControl.severity.${selected.severity}`)}
                />
                <Typography component="h2" variant="h5" sx={{ mt: 1.25 }}>
                  {selected.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {selected.description}
                </Typography>
              </Box>
              <IconButton aria-label={t('common.actions.close')} onClick={() => setSelected(null)}>
                <X size={20} />
              </IconButton>
            </Stack>
            <Divider />
            <Stack gap={2} sx={{ p: 2.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    {t('auditControl.investigations.risk')}
                  </Typography>
                  <RiskScore value={selected.riskScore} />
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    {t('auditControl.events.columns.source')}
                  </Typography>
                  <Typography variant="body2">{selected.sourceService}</Typography>
                </Box>
              </Box>
              <TextField
                select
                label={t('auditControl.investigations.status')}
                value={findingStatus}
                onChange={(event) => setFindingStatus(event.target.value as AuditFinding['status'])}
              >
                {['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].map((item) => (
                  <MenuItem key={item} value={item}>
                    {t(`auditControl.findingStatus.${item}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('auditControl.investigations.linkCase')}
                value={selectedCase}
                onChange={(event) => setSelectedCase(event.target.value)}
              >
                <MenuItem value="">{t('auditControl.investigations.noCase')}</MenuItem>
                {cases.map((item) => (
                  <MenuItem key={item.caseId} value={item.caseId}>
                    #{item.caseNumber} {item.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                multiline
                minRows={4}
                label={t('auditControl.investigations.resolution')}
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
              />
              <Button
                variant="contained"
                startIcon={<UserRoundCheck size={17} />}
                disabled={findingMutation.isPending}
                onClick={() => findingMutation.mutate()}
              >
                {t('auditControl.investigations.saveFinding')}
              </Button>
            </Stack>
          </Box>
        )}
      </Drawer>

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
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => (
                <MenuItem key={item} value={item}>
                  {t(`auditControl.severity.${item}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setCreateOpen(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            startIcon={<FolderPlus size={17} />}
            disabled={!caseTitle.trim() || caseMutation.isPending}
            onClick={() => caseMutation.mutate()}
          >
            {t('common.actions.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
