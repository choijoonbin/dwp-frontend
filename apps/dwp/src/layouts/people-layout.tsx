import { UsersRound } from 'lucide-react';

import { PEOPLE_NAVIGATION } from '../features/people/people-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function PeopleLayout() {
  return (
    <ProductAreaLayout
      areaKey="people"
      areaIcon={UsersRound}
      navigation={[{ id: 'explore', items: PEOPLE_NAVIGATION }]}
    />
  );
}
