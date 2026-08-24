import { useTranslation } from 'react-i18next';
import { ErrorState, GuidedEmptyState } from '@dwp-frontend/design-system';

import { getProductSurfaceAccessPresentation } from './product-surface-access-state-model';

import type { ProductSurfaceAccessAction } from './product-surface-access-state-model';
import type { SurfaceDecision } from '../features/shell/product-surface-context';

export type ProductSurfaceAccessStateActions = Partial<
  Record<ProductSurfaceAccessAction, () => void>
>;

const ACTION_LABEL_KEYS: Record<ProductSurfaceAccessAction, string> = {
  retry: 'productSurface.actions.retry',
  return: 'productSurface.actions.return',
  'select-scope': 'productSurface.actions.selectScope',
  'request-access': 'productSurface.actions.requestAccess',
};

export function ProductSurfaceAccessState({
  decision,
  actions = {},
}: {
  decision: Exclude<SurfaceDecision, { state: 'allowed' }>;
  actions?: ProductSurfaceAccessStateActions;
}) {
  const { t } = useTranslation('common');
  const presentation = getProductSurfaceAccessPresentation(decision.state);
  const primaryAction = presentation.primaryAction;
  const secondaryAction = presentation.secondaryAction;
  const primaryHandler = primaryAction ? actions[primaryAction] : undefined;
  const secondaryHandler = secondaryAction ? actions[secondaryAction] : undefined;

  if (presentation.tone === 'error') {
    return (
      <ErrorState
        title={t(presentation.titleKey)}
        description={t(presentation.descriptionKey)}
        retryLabel={
          primaryAction && primaryHandler ? t(ACTION_LABEL_KEYS[primaryAction]) : undefined
        }
        onRetry={primaryHandler}
        size="page"
      />
    );
  }

  return (
    <GuidedEmptyState
      kind={presentation.tone === 'permission' ? 'permission' : 'empty'}
      title={t(presentation.titleKey)}
      description={t(presentation.descriptionKey)}
      actionLabel={
        primaryAction && primaryHandler ? t(ACTION_LABEL_KEYS[primaryAction]) : undefined
      }
      onAction={primaryHandler}
      secondaryActionLabel={
        secondaryAction && secondaryHandler ? t(ACTION_LABEL_KEYS[secondaryAction]) : undefined
      }
      onSecondaryAction={secondaryHandler}
      size="page"
    />
  );
}
