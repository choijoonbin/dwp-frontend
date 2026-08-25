import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import { useProductAreaNavigationAccess } from './product-area-navigation-access';

import type { GovernedProductAreaNavigationItem } from './product-area-permissions';
import type { ReactNode } from 'react';

export function ProductAreaNavigationItemAccessGuard({
  item,
  children,
  pending = null,
}: {
  item: GovernedProductAreaNavigationItem;
  children: ReactNode;
  pending?: ReactNode;
}) {
  const { decisionForItem } = useProductAreaNavigationAccess();
  const decision = decisionForItem(item);

  if (decision === 'loading') return pending;
  if (decision === 'allowed') return children;
  return <ProductSurfaceAccessState decision={{ state: decision }} />;
}
