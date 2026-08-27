import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { displayDate, surfaceLabel } from './saved-view-custody-ui';

import type { SavedViewOwnershipPreview } from '@dwp-frontend/shared-utils';
import type { GridColDef } from '@mui/x-data-grid';

export function useSavedViewCandidateColumns(): GridColDef<
  SavedViewOwnershipPreview['views'][number]
>[] {
  const { t } = useTranslation('admin');
  return useMemo(
    () => [
      {
        field: 'name',
        headerName: t('savedViewCustody.columns.view'),
        minWidth: 200,
        flex: 1.25,
      },
      {
        field: 'surfaceKey',
        headerName: t('savedViewCustody.columns.surface'),
        minWidth: 190,
        flex: 1,
        valueFormatter: (value) => surfaceLabel(String(value), t),
      },
      {
        field: 'scope',
        headerName: t('savedViewCustody.columns.scope'),
        minWidth: 180,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ height: '100%', minWidth: 0 }}>
            <Typography variant="body2">{t('savedViewCustody.scopes.' + row.scope)}</Typography>
            {row.scope === 'TEAM' && row.ownerGroupRef ? (
              <Typography variant="caption" color="text.secondary" noWrap title={row.ownerGroupRef}>
                {t('savedViewCustody.preview.teamGroup', { value: row.ownerGroupRef })}
              </Typography>
            ) : null}
          </Stack>
        ),
      },
      {
        field: 'updatedAt',
        headerName: t('savedViewCustody.columns.updatedAt'),
        width: 180,
        valueFormatter: (value) => displayDate(String(value)),
      },
    ],
    [t]
  );
}
