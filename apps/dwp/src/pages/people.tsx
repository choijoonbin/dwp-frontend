import { Navigate, useParams } from 'react-router-dom';
import { Network, UsersRound } from 'lucide-react';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';

import { ProductAreaPageHeader } from '../components/product-area-page-header';
import { PeopleDirectory } from '../features/people/directory/people-directory';
import { OrganizationExplorer } from '../features/people/organization/organization-chart-manager';
import {
  findPeopleNavigationItem,
  PEOPLE_DEFAULT_PATH,
} from '../features/people/people-navigation';

export default function PeoplePage() {
  const { view } = useParams();
  const page = findPeopleNavigationItem(view);
  if (!page) return <Navigate to={PEOPLE_DEFAULT_PATH} replace />;

  const directory = page.view === 'directory';
  return (
    <PageCanvas>
      <ProductAreaPageHeader
        area="people"
        view={page.view}
        icon={directory ? UsersRound : Network}
      />
      <Box sx={{ mt: 3 }}>
        {directory ? (
          <PeopleDirectory experience="directory" />
        ) : (
          <OrganizationExplorer experience="directory" />
        )}
      </Box>
    </PageCanvas>
  );
}
