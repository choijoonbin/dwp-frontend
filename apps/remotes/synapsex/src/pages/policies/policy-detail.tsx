/**
 * Policy Profile Detail — Thresholds table, PII policy matrix, effective policy preview
 */

import { useNavigate } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  useEffectivePolicyQuery,
  usePolicyProfileDetailQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';

type PolicyProfileDetailPageProps = {
  profileId: string;
};

function renderUnknownAsJson(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export const PolicyProfileDetailPage = ({ profileId }: PolicyProfileDetailPageProps) => {
  const navigate = useNavigate();

  const { data: profile, isLoading: profileLoading, error: profileError } = usePolicyProfileDetailQuery(profileId);
  const { data: effective, isLoading: effectiveLoading } = useEffectivePolicyQuery(profileId);

  if (profileLoading || profileError) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 8, textAlign: 'center' }}>
            {profileLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading profile…
              </Typography>
            ) : (
              <>
                <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Profile not found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {profileError instanceof Error ? profileError.message : 'Unknown error'}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="solar:arrow-left-linear" width={18} />}
                  onClick={() => navigate(SYNAPSE_ROUTES.POLICIES)}
                >
                  Back to Profiles
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!profile) return null;

  const thresholds = profile.thresholds as Record<string, unknown> | undefined;
  const piiPolicies = profile.piiPolicies as unknown[] | Record<string, unknown> | undefined;
  const dataProtection = profile.dataProtection as Record<string, unknown> | undefined;

  const thresholdEntries = thresholds ? Object.entries(thresholds) : [];
  const piiEntries = Array.isArray(piiPolicies)
    ? piiPolicies.map((p, i) => ({ key: `Item ${i + 1}`, value: p }))
    : piiPolicies
      ? Object.entries(piiPolicies).map(([k, v]) => ({ key: k, value: v }))
      : [];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <IconButton onClick={() => navigate(SYNAPSE_ROUTES.POLICIES)} sx={{ mt: 0.5 }}>
              <Iconify icon="solar:arrow-left-linear" width={20} />
            </IconButton>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {profile.profileName}
                </Typography>
                {profile.isDefault && (
                  <Label color="primary" startIcon={<Iconify icon="solar:star-bold" width={14} />} sx={{ fontSize: '0.75rem' }}>
                    Default
                  </Label>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {profile.profileId}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        {/* Thresholds Table */}
        {thresholdEntries.length > 0 && (
          <Card variant="outlined">
            <CardHeader
              title={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:slider-minimalistic-bold" width={20} />
                  <Typography variant="subtitle1">Thresholds</Typography>
                </Stack>
              }
              subheader="Detection and approval thresholds"
            />
            <CardContent sx={{ pt: 0 }}>
              <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Key</TableCell>
                      <TableCell>Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {thresholdEntries.map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{k}</TableCell>
                        <TableCell>{renderUnknownAsJson(v)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* PII Policy Matrix */}
        {piiEntries.length > 0 && (
          <Card variant="outlined">
            <CardHeader
              title={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:shield-user-bold" width={20} />
                  <Typography variant="subtitle1">PII Policy Matrix</Typography>
                </Stack>
              }
              subheader="PII handling rules by field/type"
            />
            <CardContent sx={{ pt: 0 }}>
              <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Field / Type</TableCell>
                      <TableCell>Policy</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {piiEntries.map(({ key, value }) => (
                      <TableRow key={key}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{key}</TableCell>
                        <TableCell>
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              p: 1,
                              fontSize: '0.75rem',
                              bgcolor: 'action.hover',
                              borderRadius: 1,
                              overflow: 'auto',
                              maxHeight: 120,
                            }}
                          >
                            {renderUnknownAsJson(value)}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* Data Protection */}
        {dataProtection && Object.keys(dataProtection).length > 0 && (
          <Card variant="outlined">
            <CardHeader
              title={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:shield-check-bold" width={20} />
                  <Typography variant="subtitle1">Data Protection</Typography>
                </Stack>
              }
            />
            <CardContent sx={{ pt: 0 }}>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  fontSize: '0.8rem',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                {JSON.stringify(dataProtection, null, 2)}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Effective Policy Preview */}
        <Card variant="outlined" sx={{ borderColor: 'primary.main', bgcolor: 'primary.lighter' }}>
          <CardHeader
            title={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Iconify icon="solar:eye-bold" width={20} sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle1">Effective Policy Preview</Typography>
              </Stack>
            }
            subheader="Resolved policy for this profile (with tenant/company context)"
          />
          <CardContent sx={{ pt: 0 }}>
            {effectiveLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading effective policy…
              </Typography>
            ) : effective ? (
              <Grid container spacing={2}>
                {effective.enabledBukrs && effective.enabledBukrs.length > 0 && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Enabled Company Codes
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {effective.enabledBukrs.map((b) => (
                        <Chip key={b} label={b} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      ))}
                    </Stack>
                  </Grid>
                )}
                {effective.enabledCurrencies && effective.enabledCurrencies.length > 0 && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Enabled Currencies
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {effective.enabledCurrencies.map((c) => (
                        <Chip key={c} label={c} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      ))}
                    </Stack>
                  </Grid>
                )}
                {Boolean(effective.thresholds || effective.piiPolicies || effective.dataProtection) && (
                  <Grid size={12}>
                    <Box
                      component="pre"
                      sx={{
                        p: 2,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        overflow: 'auto',
                        maxHeight: 180,
                      }}
                    >
                      {JSON.stringify(
                        {
                          thresholds: effective.thresholds,
                          piiPolicies: effective.piiPolicies,
                          dataProtection: effective.dataProtection,
                        },
                        null,
                        2
                      )}
                    </Box>
                  </Grid>
                )}
                {!effective.enabledBukrs?.length &&
                  !effective.enabledCurrencies?.length &&
                  !effective.thresholds &&
                  !effective.piiPolicies &&
                  !effective.dataProtection && (
                    <Grid size={12}>
                      <Typography variant="body2" color="text.secondary">
                        No effective overrides. Using profile defaults.
                      </Typography>
                    </Grid>
                  )}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Could not load effective policy.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
