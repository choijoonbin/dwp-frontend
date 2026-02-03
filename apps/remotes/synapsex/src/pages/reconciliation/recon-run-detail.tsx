/**
 * Reconciliation Run Detail — PASS/FAIL results + drill-down links
 */

import { useNavigate } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { useReconRunDetailQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';

// Parse resourceKey to build link: doc:1000-123-2024 -> /documents/1000/123/2024, case:123 -> /cases/123
function parseResourceLink(resourceType: string, resourceKey: string): { path: string; label: string } | null {
  const lower = resourceType.toLowerCase();
  if (lower === 'doc' || lower === 'document') {
    const parts = resourceKey.split('-');
    if (parts.length >= 3) {
      return {
        path: `${SYNAPSE_ROUTES.DOCUMENTS}/${parts[0]}/${parts[1]}/${parts[2]}`,
        label: resourceKey,
      };
    }
  }
  if (lower === 'case') {
    return {
      path: `${SYNAPSE_ROUTES.CASES}/${resourceKey}`,
      label: resourceKey,
    };
  }
  return null;
}

type ReconRunDetailPageProps = {
  runId: string;
};

export const ReconRunDetailPage = ({ runId }: ReconRunDetailPageProps) => {
  const navigate = useNavigate();
  const { data: run, isLoading, error } = useReconRunDetailQuery(runId);

  if (isLoading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Loading run…
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error || !run) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 8, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Run not found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:arrow-left-linear" width={18} />}
              onClick={() => navigate(SYNAPSE_ROUTES.RECONCILIATION)}
            >
              Back to Runs
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const results = run.results ?? [];
  const passResults = results.filter((r) => r.status === 'PASS');
  const failResults = results.filter((r) => r.status === 'FAIL');

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <IconButton onClick={() => navigate(SYNAPSE_ROUTES.RECONCILIATION)} sx={{ mt: 0.5 }}>
              <Iconify icon="solar:arrow-left-linear" width={20} />
            </IconButton>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Run {run.runId}
                </Typography>
                <Label
                  color={run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'error' : 'warning'}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {run.status}
                </Label>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {run.runType} · Started {run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary">
                Pass
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                {run.passCount ?? passResults.length}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary">
                Fail
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                {run.failCount ?? failResults.length}
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Results
            </Typography>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Resource</TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          No results
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    results.map((r) => {
                      const link = parseResourceLink(r.resourceType, r.resourceKey);
                      return (
                        <TableRow key={r.resultId} hover>
                          <TableCell>
                            <Label
                              color={r.status === 'PASS' ? 'success' : 'error'}
                              startIcon={
                                <Iconify
                                  icon={r.status === 'PASS' ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
                                  width={14}
                                />
                              }
                              sx={{ fontSize: '0.75rem' }}
                            >
                              {r.status}
                            </Label>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{r.resourceType}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {r.resourceKey}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {link ? (
                              <Button
                                size="small"
                                endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                                onClick={() => navigate(link.path)}
                              >
                                Open
                              </Button>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
