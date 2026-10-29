import { useQuery } from '@tanstack/react-query';
import { getMailHome } from '@dwp-frontend/shared-utils/api/mail-api';

import {
  mailNavigationForAccountAvailability,
  MAIL_NAVIGATION,
} from '../features/mail/mail-navigation';
import {
  MAIL_NAVIGATION_PROJECTION,
  renderMailNavigationMore,
} from '../features/mail/mail-navigation-more';
import { resolveMailProductAreaMobileShell } from '../features/mail/mail-mobile-navigation';
import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { ProductAreaLayout } from './product-area-layout-boundary';

export function MailLayout() {
  const accountAvailability = useQuery({
    queryKey: ['mail', 'home', 'scope-options'],
    queryFn: () => getMailHome(),
    staleTime: 60_000,
    retry: 1,
  });
  const navigation = accountAvailability.data
    ? mailNavigationForAccountAvailability(accountAvailability.data.accounts.length > 0)
    : MAIL_NAVIGATION;

  return (
    <ProductAreaLayout
      areaKey="mail"
      manifest={MAIL_PRODUCT_MANIFEST}
      navigation={navigation}
      shellNavigationProjection={MAIL_NAVIGATION_PROJECTION}
      renderNavigationItemChildren={renderMailNavigationMore}
      navigationChildrenPresentation="panel"
      resolveMobileShell={resolveMailProductAreaMobileShell}
      translationNamespace="mail"
    />
  );
}
