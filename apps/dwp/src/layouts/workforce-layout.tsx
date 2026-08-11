import { Workflow } from 'lucide-react';

import { WORKFORCE_NAVIGATION } from '../features/workforce/workforce-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function WorkforceLayout() {
  return (
    <ProductAreaLayout areaKey="workforce" areaIcon={Workflow} navigation={WORKFORCE_NAVIGATION} />
  );
}
