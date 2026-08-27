import { MAIL_NAVIGATION } from '../features/mail/mail-navigation';
import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function MailLayout() {
  return (
    <ProductAreaLayout
      areaKey="mail"
      manifest={MAIL_PRODUCT_MANIFEST}
      navigation={MAIL_NAVIGATION}
      translationNamespace="mail"
    />
  );
}
