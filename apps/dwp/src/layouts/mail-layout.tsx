import { MAIL_NAVIGATION } from '../features/mail/mail-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function MailLayout() {
  return (
    <ProductAreaLayout areaKey="mail" navigation={MAIL_NAVIGATION} translationNamespace="mail" />
  );
}
