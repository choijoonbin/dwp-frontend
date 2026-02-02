import type { SelectChangeEvent } from '@mui/material/Select';

import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../routes';
import { mockEntities } from '../data/mock-data';

import type { Entity } from '../data/mock-data';

// ----------------------------------------------------------------------

const getRiskColor = (score: number): 'error' | 'warning' | 'default' => {
  if (score > 80) return 'error';
  if (score > 50) return 'warning';
  return 'default';
};

const getTrendIcon = (trend: 'up' | 'down' | 'stable'): string => {
  if (trend === 'up') return 'solar:arrow-up-bold';
  if (trend === 'down') return 'solar:arrow-down-bold';
  return 'solar:minus-circle-bold';
};

// ----------------------------------------------------------------------

/** 거래처 허브 */
export const EntitiesPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [previewEntity, setPreviewEntity] = useState<Entity | null>(null);

  const filteredEntities = useMemo(
    () =>
      mockEntities.filter((entity) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (!entity.code.toLowerCase().includes(query) && !entity.name.toLowerCase().includes(query)) {
            return false;
          }
        }
        if (selectedType !== 'all' && entity.type !== selectedType) return false;
        if (selectedRiskLevel === 'critical' && entity.riskScore <= 80) return false;
        if (selectedRiskLevel === 'high' && (entity.riskScore <= 50 || entity.riskScore > 80)) return false;
        if (selectedRiskLevel === 'normal' && entity.riskScore > 50) return false;
        return true;
      }),
    [searchQuery, selectedType, selectedRiskLevel]
  );

  const entityTypes = useMemo(() => Array.from(new Set(mockEntities.map((e) => e.type))), []);

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
              <Iconify icon="solar:users-group-rounded-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Entity Hub
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Vendor/Customer master with risk profiles and transaction history
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
            sx={{ bgcolor: 'transparent' }}
          >
            Export
          </Button>
        </Stack>

        {/* Filters */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search entity code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Select
                  fullWidth
                  size="small"
                  value={selectedType}
                  onChange={(e: SelectChangeEvent) => setSelectedType(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All Types</MenuItem>
                  {entityTypes.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Select
                  fullWidth
                  size="small"
                  value={selectedRiskLevel}
                  onChange={(e: SelectChangeEvent) => setSelectedRiskLevel(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All Risk</MenuItem>
                  <MenuItem value="critical">Critical (80+)</MenuItem>
                  <MenuItem value="high">High (50-80)</MenuItem>
                  <MenuItem value="normal">Normal (&lt;50)</MenuItem>
                </Select>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Table */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: previewEntity ? 8 : 12 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Entity ID</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Risk Score</TableCell>
                        <TableCell align="right">Open Items</TableCell>
                        <TableCell align="right">Anomalies</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredEntities.slice(0, 50).map((entity) => {
                        const riskColor = getRiskColor(entity.riskScore);
                        const trendIcon = getTrendIcon(entity.riskTrend);
                        return (
                          <TableRow
                            key={entity.id}
                            hover
                            sx={{
                              cursor: 'pointer',
                              bgcolor: previewEntity?.id === entity.id ? 'action.selected' : 'transparent',
                            }}
                            onClick={() => setPreviewEntity(entity)}
                          >
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                {entity.code}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {entity.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {entity.country}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={entity.type}
                                size="small"
                                variant="outlined"
                                color={entity.type === 'vendor' ? 'primary' : 'info'}
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Label color={riskColor} sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                  {entity.riskScore}
                                </Label>
                                <Iconify icon={trendIcon} width={12} sx={{ color: 'text.secondary' }} />
                              </Stack>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="caption">{entity.openItemsCount}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="caption">{entity.recentAnomaliesCount || 0}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                component={Link}
                                to={`${SYNAPSE_ROUTES.ENTITY_DETAIL.replace(':id', entity.id)}`}
                                size="small"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Iconify icon="solar:arrow-right-up-linear" width={16} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredEntities.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                            <Stack alignItems="center" spacing={1}>
                              <Iconify icon="solar:users-group-rounded-bold" width={48} sx={{ color: 'text.disabled' }} />
                              <Typography variant="body2" color="text.secondary">
                                No entities found
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Preview Panel */}
          {previewEntity && (
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card variant="outlined" sx={{ position: 'sticky', top: 80 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Iconify icon="solar:buildings-2-bold" width={16} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Entity Preview
                      </Typography>
                    </Stack>
                    <IconButton size="small" onClick={() => setPreviewEntity(null)}>
                      <Iconify icon="solar:close-circle-bold" width={18} />
                    </IconButton>
                  </Stack>

                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Entity Code
                      </Typography>
                      <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {previewEntity.code}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {previewEntity.name}
                      </Typography>
                    </Box>

                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Type
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {previewEntity.type}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Country
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {previewEntity.country}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Open Items
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {previewEntity.openItemsCount}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Anomalies
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                          {previewEntity.recentAnomaliesCount || 0}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">
                          Risk Score
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                          <Label
                            color={getRiskColor(previewEntity.riskScore)}
                            sx={{ fontSize: '1rem', fontWeight: 700 }}
                          >
                            {previewEntity.riskScore}
                          </Label>
                          <Iconify
                            icon={getTrendIcon(previewEntity.riskTrend)}
                            width={14}
                            sx={{ color: 'text.secondary' }}
                          />
                        </Stack>
                      </Grid>
                    </Grid>

                    <Stack spacing={1} sx={{ pt: 2 }}>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.ENTITY_DETAIL.replace(':id', previewEntity.id)}`}
                        variant="contained"
                        size="small"
                        fullWidth
                        startIcon={<Iconify icon="solar:eye-bold" width={16} />}
                      >
                        Open Profile
                      </Button>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.LINEAGE}?entityId=${previewEntity.id}`}
                        variant="outlined"
                        size="small"
                        fullWidth
                        startIcon={<Iconify icon="solar:link-bold" width={16} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        View Lineage
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Stack>
    </Box>
  );
};
