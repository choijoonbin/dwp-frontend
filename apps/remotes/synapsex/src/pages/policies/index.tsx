/**
 * Policy Profiles — List + default badge
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { usePolicyProfilesQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';

// ----------------------------------------------------------------------

export const PoliciesPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data, isLoading, error } = usePolicyProfilesQuery();

  const profiles = data?.profiles ?? [];
  const defaultProfileId = data?.defaultProfileId;
  const rows = profiles.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.profileName.toLowerCase().includes(q) ||
      (p.scope ?? '').toLowerCase().includes(q)
    );
  });

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Failed to load profiles
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
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:tuning-2-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Policy Profiles
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Configure tenant/company/currency-aware detection rules and compliance thresholds.
            </Typography>
          </Box>
        </Stack>

        {/* Profiles Table */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Profiles
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Define &ldquo;what counts as duplicate&rdquo;, approval thresholds, and auto-block rules.
                </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Search profiles…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ width: 240 }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={16} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
            </Stack>

            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Profile</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell sx={{ width: 120 }}>Default</TableCell>
                    <TableCell sx={{ width: 110 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          Loading…
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                        <Typography variant="body2" color="text.secondary">
                          No profiles match the current search.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((p) => {
                      const isDefault = p.profileId === defaultProfileId || p.isDefault;
                      return (
                        <TableRow
                          key={p.profileId}
                          hover
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                          onClick={() => navigate(`${SYNAPSE_ROUTES.POLICIES}/${p.profileId}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {p.profileName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {p.profileId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {p.scope ?? '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {isDefault ? (
                              <Label color="primary" startIcon={<Iconify icon="solar:star-bold" width={14} />} sx={{ fontSize: '0.75rem' }}>
                                Default
                              </Label>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="small"
                              endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                              onClick={() => navigate(`${SYNAPSE_ROUTES.POLICIES}/${p.profileId}`)}
                            >
                              Open
                            </Button>
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
