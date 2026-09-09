import type { ProductPlane } from './product-manifest';

type ProductSurfaceFocusProvenance = {
  container: HTMLElement;
  identityKey: string;
  location: string;
  plane: ProductPlane;
  target: HTMLElement;
};

let focusProvenance: ProductSurfaceFocusProvenance | undefined;
let removeIntentListeners: (() => void) | undefined;

function currentLocation(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function uninstallIntentListeners(): void {
  const remove = removeIntentListeners;
  removeIntentListeners = undefined;
  remove?.();
}

function installIntentListeners(): void {
  if (removeIntentListeners || typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }
  const handlePointerDown = (event: Event) => {
    const captured = focusProvenance;
    if (!captured || !(event.target instanceof Node) || captured.target.contains(event.target)) {
      return;
    }
    globalThis.setTimeout(() => {
      if (focusProvenance !== captured || !captured.target.isConnected) return;
      const activeElement = document.activeElement;
      if (
        activeElement === captured.target ||
        (activeElement instanceof HTMLElement && captured.container.contains(activeElement))
      ) {
        return;
      }
      clearProductSurfaceFocus();
    }, 0);
  };
  const handleWindowBlur = () => clearProductSurfaceFocus();
  document.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('blur', handleWindowBlur);
  removeIntentListeners = () => {
    document.removeEventListener('pointerdown', handlePointerDown, true);
    window.removeEventListener('blur', handleWindowBlur);
  };
}

export function recordProductSurfaceFocus(
  container: HTMLElement,
  target: HTMLElement,
  plane: ProductPlane,
  identityKey: string,
  location: string
): void {
  focusProvenance = { container, target, plane, identityKey, location };
  installIntentListeners();
}

export function clearProductSurfaceFocus(): void {
  focusProvenance = undefined;
  uninstallIntentListeners();
}

export function deferProductSurfaceFocusClear(
  container: HTMLElement,
  blurredTarget: HTMLElement,
  relatedTarget?: EventTarget | null
): void {
  const captured = focusProvenance;
  if (
    captured?.target === blurredTarget &&
    relatedTarget instanceof HTMLElement &&
    relatedTarget !== document.body &&
    relatedTarget.isConnected &&
    !container.contains(relatedTarget)
  ) {
    clearProductSurfaceFocus();
  }
}

export function synchronizeProductSurfaceFocus(
  container: HTMLElement,
  plane: ProductPlane,
  identityKey: string,
  location: string
): void {
  const captured = focusProvenance;
  if (!captured) return;
  if (
    captured.identityKey !== identityKey ||
    captured.plane !== plane ||
    captured.location !== location
  ) {
    clearProductSurfaceFocus();
    return;
  }
  if (captured.target.isConnected && container.contains(captured.target)) {
    focusProvenance = { ...captured, container };
  }
}

export function clearProductSurfaceFocusAfterNavigation(location: string): void {
  if (focusProvenance && currentLocation() !== location) clearProductSurfaceFocus();
}

export function consumeRemovedProductSurfaceFocus(
  expectedPlane?: ProductPlane,
  expectedIdentityKey?: string
): ProductPlane | undefined {
  const captured = focusProvenance;
  focusProvenance = undefined;
  uninstallIntentListeners();
  if (
    !captured ||
    (expectedPlane !== undefined && captured.plane !== expectedPlane) ||
    (expectedIdentityKey !== undefined && captured.identityKey !== expectedIdentityKey) ||
    captured.location !== currentLocation() ||
    captured.target.isConnected
  ) {
    return undefined;
  }

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLElement &&
    activeElement !== document.body &&
    activeElement.isConnected
  ) {
    return undefined;
  }
  return captured.plane;
}
