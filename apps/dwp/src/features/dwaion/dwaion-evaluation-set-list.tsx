import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EnterpriseDataGrid, LoadingState } from '@dwp-frontend/design-system';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import type { DwaionEvaluationSetSummary } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { GridColDef } from '@mui/x-data-grid';
import { useAdminRegistryCopy } from './dwaion-admin-registry';

type Props = {
  rows: DwaionEvaluationSetSummary[];
  selectedId: string | null;
  loading: boolean;
  failed: boolean;
  onSelect: (id: string) => void;
};

export function DwaionEvaluationSetList({ rows, selectedId, loading, failed, onSelect }: Props) {
  const { t } = useTranslation('work');
  const display = useDisplayDictionary();
  const copy = useAdminRegistryCopy();
  const mobile = useMediaQuery(useTheme().breakpoints.down('md'));
  const columns = useMemo<GridColDef<DwaionEvaluationSetSummary>[]>(
    () => [
      {
        field: 'name',
        headerName: t('dwaionAdmin.evaluation.columns.name'),
        minWidth: 160,
        flex: 1,
      },
      {
        field: 'lifecycleState',
        headerName: t('dwaionAdmin.evaluation.columns.state'),
        width: 90,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={
              row.lifecycleState === 'ACTIVE'
                ? 'success'
                : row.lifecycleState === 'DRAFT'
                  ? 'warning'
                  : 'default'
            }
            label={display('states', row.lifecycleState)}
          />
        ),
      },
      { field: 'caseCount', headerName: t('dwaionAdmin.evaluation.columns.cases'), width: 62 },
      {
        field: 'latestRunState',
        headerName: t('dwaionAdmin.evaluation.columns.lastRun'),
        minWidth: 105,
        flex: 0.55,
        valueGetter: (_, row) =>
          row.latestRunState
            ? display(
                row.latestRunState === 'CONFIGURATION_REQUIRED' ? 'outcomes' : 'states',
                row.latestRunState
              )
            : '—',
      },
    ],
    [t, display]
  );

  if (failed) return null;
  if (loading) return <LoadingState label={copy.loading} variant="skeleton" size="standard" />;
  if (!mobile)
    return (
      <EnterpriseDataGrid
        ariaLabel={t('dwaionAdmin.evaluation.tableLabel')}
        rows={rows}
        columns={columns}
        getRowId={(row) => row.evaluationSetId}
        rowHeight={64}
        hideFooter
        onRowClick={({ row }) => onSelect(row.evaluationSetId)}
        onCellKeyDown={({ row }, event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSelect(row.evaluationSetId);
          }
        }}
        sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />
    );
  return (
    <Box
      component="ul"
      aria-label={t('dwaionAdmin.evaluation.tableLabel')}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {rows.map((row) => (
        <Box component="li" key={row.evaluationSetId} sx={{ minWidth: 0 }}>
          <ButtonBase
            component="button"
            type="button"
            aria-pressed={row.evaluationSetId === selectedId}
            onClick={() => onSelect(row.evaluationSetId)}
            sx={{
              width: '100%',
              minWidth: 0,
              minHeight: 44,
              p: 2,
              display: 'grid',
              gap: 1,
              textAlign: 'left',
              justifyContent: 'stretch',
              borderBottom: 1,
              borderColor: 'divider',
              overflowWrap: 'anywhere',
              bgcolor: row.evaluationSetId === selectedId ? 'action.selected' : 'transparent',
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          >
            <Typography component="span" variant="subtitle2">
              {row.name}
            </Typography>
            {[
              [t('dwaionAdmin.evaluation.columns.state'), display('states', row.lifecycleState)],
              [t('dwaionAdmin.evaluation.columns.cases'), row.caseCount],
              [
                t('dwaionAdmin.evaluation.columns.lastRun'),
                row.latestRunState
                  ? display(
                      row.latestRunState === 'CONFIGURATION_REQUIRED' ? 'outcomes' : 'states',
                      row.latestRunState
                    )
                  : '—',
              ],
            ].map(([label, value]) => (
              <Typography key={label} component="span" variant="body2">
                {label}:{' '}
                <Box component="span" sx={{ fontWeight: 'fontWeightBold' }}>
                  {value}
                </Box>
              </Typography>
            ))}
          </ButtonBase>
        </Box>
      ))}
    </Box>
  );
}
