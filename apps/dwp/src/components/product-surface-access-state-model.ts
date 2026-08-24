import type { SurfaceDeniedState } from '../features/shell/product-surface-context';

export type ProductSurfaceAccessAction = 'retry' | 'return' | 'select-scope' | 'request-access';

export type ProductSurfaceAccessPresentation = {
  titleKey: string;
  descriptionKey: string;
  primaryAction?: ProductSurfaceAccessAction;
  secondaryAction?: ProductSurfaceAccessAction;
  tone: 'permission' | 'attention' | 'error';
};

const ACCESS_PRESENTATIONS = {
  'app-denied': {
    titleKey: 'productSurface.access.appDenied.title',
    descriptionKey: 'productSurface.access.appDenied.description',
    primaryAction: 'request-access',
    secondaryAction: 'return',
    tone: 'permission',
  },
  'surface-denied': {
    titleKey: 'productSurface.access.surfaceDenied.title',
    descriptionKey: 'productSurface.access.surfaceDenied.description',
    primaryAction: 'request-access',
    secondaryAction: 'return',
    tone: 'permission',
  },
  'route-denied': {
    titleKey: 'productSurface.access.routeDenied.title',
    descriptionKey: 'productSurface.access.routeDenied.description',
    primaryAction: 'return',
    tone: 'permission',
  },
  'scope-selection-required': {
    titleKey: 'productSurface.access.scopeSelectionRequired.title',
    descriptionKey: 'productSurface.access.scopeSelectionRequired.description',
    primaryAction: 'select-scope',
    secondaryAction: 'return',
    tone: 'attention',
  },
  'scope-invalid': {
    titleKey: 'productSurface.access.scopeInvalid.title',
    descriptionKey: 'productSurface.access.scopeInvalid.description',
    primaryAction: 'select-scope',
    secondaryAction: 'return',
    tone: 'attention',
  },
  expired: {
    titleKey: 'productSurface.access.expired.title',
    descriptionKey: 'productSurface.access.expired.description',
    primaryAction: 'request-access',
    secondaryAction: 'return',
    tone: 'attention',
  },
  'activation-required': {
    titleKey: 'productSurface.access.activationRequired.title',
    descriptionKey: 'productSurface.access.activationRequired.description',
    primaryAction: 'request-access',
    secondaryAction: 'return',
    tone: 'attention',
  },
  'step-up-required': {
    titleKey: 'productSurface.access.stepUpRequired.title',
    descriptionKey: 'productSurface.access.stepUpRequired.description',
    primaryAction: 'retry',
    secondaryAction: 'return',
    tone: 'attention',
  },
  'sod-conflict': {
    titleKey: 'productSurface.access.sodConflict.title',
    descriptionKey: 'productSurface.access.sodConflict.description',
    primaryAction: 'return',
    tone: 'permission',
  },
  'support-scope-denied': {
    titleKey: 'productSurface.access.supportScopeDenied.title',
    descriptionKey: 'productSurface.access.supportScopeDenied.description',
    primaryAction: 'return',
    tone: 'permission',
  },
  'authority-unavailable': {
    titleKey: 'productSurface.access.authorityUnavailable.title',
    descriptionKey: 'productSurface.access.authorityUnavailable.description',
    primaryAction: 'retry',
    secondaryAction: 'return',
    tone: 'error',
  },
} as const satisfies Record<SurfaceDeniedState, ProductSurfaceAccessPresentation>;

export function getProductSurfaceAccessPresentation(
  state: SurfaceDeniedState
): ProductSurfaceAccessPresentation {
  return ACCESS_PRESENTATIONS[state];
}
