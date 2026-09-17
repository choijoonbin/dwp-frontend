import { MAIL_NAVIGATION } from '../features/mail/mail-navigation';
import { resolveMailProductAreaMobileShell } from '../features/mail/mail-mobile-navigation';
import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function MailLayout() {
  return (
    <ProductAreaLayout
      areaKey="mail"
      manifest={MAIL_PRODUCT_MANIFEST}
      navigation={MAIL_NAVIGATION}
      resolveMobileShell={resolveMailProductAreaMobileShell}
      translationNamespace="mail"
    />
  );
}
