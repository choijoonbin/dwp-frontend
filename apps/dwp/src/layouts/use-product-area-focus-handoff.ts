import { useCallback, useEffect, useLayoutEffect, useRef, type FocusEvent } from 'react';

import {
  clearProductSurfaceFocusAfterNavigation,
  clearProductSurfaceFocus,
  deferProductSurfaceFocusClear,
  recordProductSurfaceFocus,
  synchronizeProductSurfaceFocus,
} from '../components/product-surface-focus-handoff';

import type { ProductPlane } from '../components/product-manifest';
import type { ShellMobileNavigationController } from '../features/shell/shell-mobile-navigation';

export function useProductAreaFocusHandoff({
  focusLocation,
  focusIdentityKey,
  presentationPlane,
  mobileNavigation,
  taskNavigatorPath,
}: {
  focusLocation: string;
  focusIdentityKey: string;
  presentationPlane: ProductPlane | undefined;
  mobileNavigation: ShellMobileNavigationController;
  taskNavigatorPath: string | null;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const mobileNavigationTargetRef = useRef<{
    resolveTarget: () => HTMLElement | null;
    originLocation: string;
    expectedLocation?: string;
  } | null>(null);
  const focusLocationRef = useRef(focusLocation);
  const focusIdentityRef = useRef(focusIdentityKey);
  focusLocationRef.current = focusLocation;
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (focusIdentityRef.current !== focusIdentityKey) {
      clearProductSurfaceFocus();
      focusIdentityRef.current = focusIdentityKey;
    } else if (shell && (presentationPlane === 'work' || presentationPlane === 'management')) {
      synchronizeProductSurfaceFocus(shell, presentationPlane, focusIdentityKey, focusLocation);
    }
  }, [focusIdentityKey, focusLocation, presentationPlane]);
  useLayoutEffect(
    () => () => clearProductSurfaceFocusAfterNavigation(focusLocationRef.current),
    []
  );
  const recordSurfaceFocus = (event: FocusEvent<HTMLElement>) => {
    if (presentationPlane !== 'work' && presentationPlane !== 'management') return;
    if (event.target instanceof HTMLElement) {
      recordProductSurfaceFocus(
        event.currentTarget,
        event.target,
        presentationPlane,
        focusIdentityKey,
        focusLocation
      );
    }
  };
  const deferSurfaceFocusClear = (event: FocusEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement) {
      deferProductSurfaceFocusClear(event.currentTarget, event.target, event.relatedTarget);
    }
  };
  const dismissMobileNavigation = () => {
    mobileNavigationTargetRef.current = null;
    clearProductSurfaceFocus();
    mobileNavigation.dismiss();
  };
  const navigateMobileNavigation = () => {
    mobileNavigationTargetRef.current = null;
    clearProductSurfaceFocus();
    mobileNavigation.navigate();
  };
  const queueNavigationTarget = (
    resolveTarget: () => HTMLElement | null,
    expectedLocation?: string
  ) => {
    mobileNavigationTargetRef.current = {
      resolveTarget,
      originLocation: focusLocationRef.current,
      expectedLocation,
    };
    clearProductSurfaceFocus();
  };
  const navigateMobileNavigationToTarget = (
    resolveTarget: () => HTMLElement | null,
    expectedLocation?: string
  ) => {
    queueNavigationTarget(resolveTarget, expectedLocation);
    mobileNavigation.navigate();
  };
  const focusMobileNavigationTarget = useCallback(() => {
    const pendingTarget = mobileNavigationTargetRef.current;
    if (
      !pendingTarget ||
      (pendingTarget.expectedLocation
        ? pendingTarget.expectedLocation !== focusLocationRef.current
        : pendingTarget.originLocation === focusLocationRef.current)
    ) {
      return false;
    }
    const target = pendingTarget.resolveTarget();
    if (!target?.isConnected) return false;
    target.focus({ preventScroll: true });
    if (document.activeElement !== target) return false;
    mobileNavigationTargetRef.current = null;
    return true;
  }, []);
  useEffect(() => {
    const pendingTarget = mobileNavigationTargetRef.current;
    if (mobileNavigation.open || !pendingTarget) return undefined;
    let frame = 0;
    let remainingFrames = 120;
    const transferFocus = () => {
      if (focusMobileNavigationTarget() || !mobileNavigationTargetRef.current) return;
      remainingFrames -= 1;
      if (remainingFrames <= 0) {
        mobileNavigationTargetRef.current = null;
        return;
      }
      frame = window.requestAnimationFrame(transferFocus);
    };
    frame = window.requestAnimationFrame(transferFocus);
    return () => window.cancelAnimationFrame(frame);
  }, [focusLocation, focusMobileNavigationTarget, mobileNavigation.open, taskNavigatorPath]);
  return {
    shellRef,
    recordSurfaceFocus,
    deferSurfaceFocusClear,
    dismissMobileNavigation,
    navigateMobileNavigation,
    queueNavigationTarget,
    navigateMobileNavigationToTarget,
    focusMobileNavigationTarget,
  };
}
