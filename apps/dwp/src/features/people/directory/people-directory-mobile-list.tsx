import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { PersonAvatar } from './person-avatar';

import type { PersonSummary } from '@dwp-frontend/shared-utils';

export function statusColor(status?: string | null): 'success' | 'warning' | 'default' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'LEAVE' || status === 'PENDING') return 'warning';
  return 'default';
}

export function PeopleDirectoryMobileList({
  rows,
  onSelect,
}: {
  rows: PersonSummary[];
  onSelect: (personId: string) => void;
}) {
  const { t } = useTranslation('workforce');

  return (
    <Box
      component="ul"
      aria-label={t('people.title')}
      sx={{
        display: { xs: 'block', md: 'none' },
        p: 0,
        m: 0,
        listStyle: 'none',
        '& > li + li': { borderTop: 1, borderColor: 'divider' },
      }}
    >
      {rows.map((row) => {
        const title = row.businessTitle || row.jobProfileName || t('people.notAvailable');
        const organization = row.organizationName || t('people.notAvailable');
        const location = row.locationName || t('people.notAvailable');
        return (
          <Box component="li" key={row.personId}>
            <ButtonBase
              onClick={() => onSelect(row.personId)}
              aria-label={`${row.displayName}, ${title}, ${organization}, ${t('people.detail.title')}`}
              sx={{
                display: 'block',
                width: '100%',
                p: 1.5,
                textAlign: 'left',
                borderRadius: 0,
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: -2,
                },
              }}
            >
              <Stack gap={1} sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="flex-start" gap={1.25}>
                  <PersonAvatar name={row.displayName} size={38} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box
                      component="span"
                      sx={{ display: 'block', typography: 'body2', fontWeight: 'fontWeightBold' }}
                    >
                      {row.displayName}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        display: 'block',
                        typography: 'caption',
                        color: 'text.secondary',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {row.workEmail || row.personId}
                    </Box>
                  </Box>
                  <Chip
                    label={t(`people.status.${row.workerStatus}`, {
                      defaultValue: row.workerStatus || t('people.notAvailable'),
                    })}
                    size="small"
                    color={statusColor(row.workerStatus)}
                    variant="outlined"
                    sx={{ flexShrink: 0 }}
                  />
                </Stack>
                <Box sx={{ pl: 6.25, minWidth: 0 }}>
                  <Box
                    component="span"
                    sx={{ display: 'block', typography: 'body2', overflowWrap: 'anywhere' }}
                  >
                    {title}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      mt: 0.25,
                      typography: 'caption',
                      color: 'text.secondary',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {[organization, location].join(' · ')}
                  </Box>
                  {row.managerDisplayName && (
                    <Box
                      component="span"
                      sx={{
                        display: 'block',
                        mt: 0.25,
                        typography: 'caption',
                        color: 'text.secondary',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {t('people.columns.manager')}: {row.managerDisplayName}
                    </Box>
                  )}
                </Box>
              </Stack>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
