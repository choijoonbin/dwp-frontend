import { PEOPLE_NAVIGATION } from '../features/people/people-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function PeopleLayout() {
  return (
    <ProductAreaLayout
      areaKey="people"
      navigation={[{ id: 'explore', items: PEOPLE_NAVIGATION }]}
    />
  );
}
