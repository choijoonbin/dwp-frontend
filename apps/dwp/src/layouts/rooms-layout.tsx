import { ROOMS_NAVIGATION } from '../features/rooms/rooms-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function RoomsLayout() {
  return (
    <ProductAreaLayout areaKey="rooms" navigation={ROOMS_NAVIGATION} translationNamespace="rooms" />
  );
}
