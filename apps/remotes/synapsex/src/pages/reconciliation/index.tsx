/**
 * Reconciliation — Runs list + start run CTA
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  useReconRunsQuery,
  type ReconRunListDto,
  useStartReconRunMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';
import { StartReconModal } from './components/start-recon-modal';

const RUN_TYPE_LABELS: Record<string, string> = {
  DOC_OPENITEM_MATCH: 'Doc vs Open Item',
  ACTION_EFFECT: 'Action Effect',
};

export const ReconciliationPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ingestion' | 'integrity'>('integrity');
  const [runTypeFilter, setRunTypeFilter] = useState<string>('all');
  const [startModalOpen, setStartModalOpen] = useState(false);

  const { data, isLoading, error } = useReconRunsQuery(
    runTypeFilter === 'all' ? undefined : (runTypeFilter as 'DOC_OPENITEM_MATCH' | 'ACTION_EFFECT')
  );
  const runs: ReconRunListDto[] = (() => {
    if (Array.isArray(data)) return data as ReconRunListDto[];
    if (data && typeof data === 'object' && 'items' in data) {
      const arr = (data as { items?: ReconRunListDto[] }).items;
      return Array.isArray(arr) ? arr : [];
    }
    if (data && typeof data === 'object' && 'runs' in data) {
      const arr = (data as { runs?: ReconRunListDto[] }).runs;
      return Array.isArray(arr) ? arr : [];
    }
    return [];
  })();
  const startMutation = useStartReconRunMutation();

  const handleStartRun = (runType: Parameters<typeof startMutation.mutate>[0]['runType']) => {
    startMutation.mutate(
      { runType },
      {
        onSuccess: (result) => {
          setStartModalOpen(false);
          if (result?.runId) navigate(`${SYNAPSE_ROUTES.RECONCILIATION}/${result.runId}`);
        },
      }
    );
  };

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Failed to load runs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:git-pull-request-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Reconciliation
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Validate ingestion integrity between SAP source events and normalized finance tables.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="solar:play-bold" width={18} />}
            onClick={() => setStartModalOpen(true)}
          >
            Start Run
          </Button>
        </Stack>

        <Tabs
          value={activeTab}
          onChange={(_, v: 'ingestion' | 'integrity') => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}
        >
          <Tab value="ingestion" label="Ingestion Health" />
          <Tab value="integrity" label="Integrity Report" />
        </Tabs>

        {activeTab === 'ingestion' && (
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Ingestion Health
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Monitor document and open-item ingestion pipeline health. Drill down to documents, open items, and lineage.
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Iconify icon="solar:document-bold" width={16} />}
                  onClick={() => navigate(SYNAPSE_ROUTES.DOCUMENTS)}
                >
                  Documents
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Iconify icon="solar:clipboard-list-bold" width={16} />}
                  onClick={() => navigate(SYNAPSE_ROUTES.OPEN_ITEMS)}
                >
                  Open Items
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Iconify icon="solar:link-circle-bold" width={16} />}
                  onClick={() => navigate(SYNAPSE_ROUTES.LINEAGE)}
                >
                  Lineage
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {activeTab === 'integrity' && (
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Runs
              </Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="recon-run-type-filter">Run Type</InputLabel>
                <Select
                  labelId="recon-run-type-filter"
                  label="Run Type"
                  value={runTypeFilter}
                  onChange={(e) => setRunTypeFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="DOC_OPENITEM_MATCH">Doc vs Open Item</MenuItem>
                  <MenuItem value="ACTION_EFFECT">Action Effect</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Run ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Pass</TableCell>
                    <TableCell align="right">Fail</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          Loading…
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                        <Stack alignItems="center" spacing={1}>
                          <Iconify icon="solar:git-pull-request-bold" width={48} sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary">
                            No runs yet
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Iconify icon="solar:play-bold" width={18} />}
                            onClick={() => setStartModalOpen(true)}
                          >
                            Start first run
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((r) => (
                      <TableRow
                        key={r.runId}
                        hover
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        onClick={() => navigate(`${SYNAPSE_ROUTES.RECONCILIATION}/${r.runId}`)}
                      >
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {r.runId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {RUN_TYPE_LABELS[r.runType] ?? r.runType}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Label
                            color={r.status === 'COMPLETED' ? 'success' : r.status === 'FAILED' ? 'error' : 'warning'}
                            sx={{ fontSize: '0.75rem' }}
                          >
                            {r.status}
                          </Label>
                        </TableCell>
                        <TableCell align="right">{r.passCount ?? 0}</TableCell>
                        <TableCell align="right">{r.failCount ?? 0}</TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {r.startedAt ? new Date(r.startedAt).toLocaleString() : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="small"
                            endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                            onClick={() => navigate(`${SYNAPSE_ROUTES.RECONCILIATION}/${r.runId}`)}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
        )}
      </Stack>

      <Dialog open={startModalOpen} onClose={() => setStartModalOpen(false)} maxWidth="xs" fullWidth>
        <StartReconModal
          open={startModalOpen}
          onClose={() => setStartModalOpen(false)}
          onSubmit={handleStartRun}
          isLoading={startMutation.isPending}
        />
      </Dialog>
    </Box>
  );
};
