import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function ApprovalLayout() {
  return (
    <ProductAreaLayout
      areaKey="approvals"
      navigation={APPROVAL_NAVIGATION}
      translationNamespace="approvals"
    />
  );
}
