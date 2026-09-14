import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ActionButton, PageCanvas } from '@dwp-frontend/design-system';
import { House, UsersRound, Wrench } from 'lucide-react';
import Stack from '@mui/material/Stack';
import { WorkplaceHome } from './workplace-home';
import { WorkplaceTeamContext } from './workplace-team-context';
import { WorkplaceFacilityRequests } from './workplace-facility-requests';

export function WorkplaceMemberWorkspace() {
  const { t } = useTranslation('rooms');
  const [params, setParams] = useSearchParams();
  const view =
    params.get('view') === 'team'
      ? 'team'
      : params.get('view') === 'requests'
        ? 'requests'
        : 'home';
  return (
    <>
      {view !== 'home' ? (
        <Stack
          component="nav"
          aria-label={t('workplace.experience.memberHome')}
          direction="row"
          gap={1}
          sx={{ px: { xs: 2, md: 3, xl: 4 }, pt: 2, flexWrap: 'wrap' }}
        >
          {[
            { value: 'home', label: 'memberHome', icon: House },
            { value: 'team', label: 'teamMenu', icon: UsersRound },
            { value: 'requests', label: 'facilityRequests', icon: Wrench },
          ].map(({ value, label, icon: Icon }) => (
            <ActionButton
              key={value}
              intent={view === value ? 'primary' : 'quiet'}
              aria-pressed={view === value}
              startIcon={<Icon size={16} />}
              onClick={() => {
                const next = new URLSearchParams(params);
                if (value === 'home') next.delete('view');
                else next.set('view', value);
                setParams(next, { replace: true });
              }}
            >
              {t(`workplace.experience.${label}`)}
            </ActionButton>
          ))}
        </Stack>
      ) : null}
      {view === 'team' ? (
        <WorkplaceTeamContext />
      ) : view === 'requests' ? (
        <PageCanvas>
          <WorkplaceFacilityRequests />
        </PageCanvas>
      ) : (
        <WorkplaceHome />
      )}
    </>
  );
}
