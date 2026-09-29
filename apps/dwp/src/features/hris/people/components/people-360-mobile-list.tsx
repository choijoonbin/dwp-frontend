import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../../../../components/person-avatar';
import { getPeople360Copy } from '../model/people-360-copy';
import { people360Decision } from '../model/people-360-view-model';

import type { People360Person } from '../model/people-360-view-model';

export function people360StatusColor(status?: string): 'success' | 'warning' | 'default' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'LEAVE' || status === 'PENDING' || status === 'SUSPENDED') return 'warning';
  return 'default';
}

export function People360MobileList({
  rows,
  onSelect,
}: {
  rows: readonly People360Person[];
  onSelect: (personId: string) => void;
}) {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);

  return (
    <Box
      component="ul"
      aria-label={copy.title}
      sx={{
        display: { xs: 'grid', md: 'none' },
        gridTemplateColumns: 'minmax(0, 1fr)',
        p: 1,
        m: 0,
        gap: 1,
        listStyle: 'none',
        minWidth: 0,
      }}
    >
      {rows.map((row) => {
        const personId = row.person.personId;
        const displayName = row.person.displayName || copy.undisclosedPerson;
        const assignment = row.primaryAssignment;
        const employment = row.employment;
        const title = assignment?.businessTitle || assignment?.jobProfileName;
        const organization = assignment?.organizationName;
        return (
          <Box component="li" key={personId} minWidth={0}>
            <ButtonBase
              onClick={() => onSelect(personId)}
              aria-label={copy.openPerson(displayName)}
              sx={{
                display: 'block',
                width: '100%',
                minHeight: 44,
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 'shape.borderRadius',
                textAlign: 'left',
                bgcolor: 'background.paper',
                '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              <Stack gap={1} minWidth={0}>
                <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0}>
                  <PersonAvatar name={displayName} size={38} />
                  <Box minWidth={0} flex={1}>
                    <Typography
                      component="span"
                      variant="subtitle2"
                      display="block"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {displayName}
                    </Typography>
                    {title && (
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {title}
                      </Typography>
                    )}
                    {organization && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', overflowWrap: 'anywhere' }}
                      >
                        {organization}
                      </Typography>
                    )}
                  </Box>
                  {people360Decision(row, 'employment.workerStatus') !== 'OMIT' && (
                    <Chip
                      label={employment?.workerStatus || copy.notAvailable}
                      size="small"
                      color={people360StatusColor(employment?.workerStatus)}
                      variant="outlined"
                      sx={{ flexShrink: 0, maxWidth: '45%' }}
                    />
                  )}
                </Stack>
                <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
                  <Chip size="small" variant="outlined" label={row.access.scope} />
                  {row.state === 'PARTIAL' && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={copy.partialState}
                    />
                  )}
                </Stack>
              </Stack>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
