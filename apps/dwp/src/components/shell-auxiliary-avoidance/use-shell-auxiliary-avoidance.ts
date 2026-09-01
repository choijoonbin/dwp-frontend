import { useEffect, type RefObject } from 'react';

import {
  resolveShellAuxiliaryInlineClearance,
  type ShellAuxiliaryGeometry,
} from './shell-auxiliary-clearance';

const AVOIDANCE_TARGET_SELECTOR = '[data-shell-auxiliary-avoidance]';
const ACTIVE_ATTRIBUTE = 'data-shell-auxiliary-avoidance-active';
const CLEARANCE_ATTRIBUTE = 'data-shell-auxiliary-clearance';
const CLEARANCE_PROPERTY = '--dwp-shell-auxiliary-inline-clearance';

type InlinePaddingSnapshot = Readonly<{
  value: string;
  priority: string;
}>;

type UseShellAuxiliaryAvoidanceOptions = Readonly<{
  boundaryRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  safetyGap?: number;
}>;

export function useShellAuxiliaryAvoidance({
  boundaryRef,
  enabled = true,
  safetyGap = 16,
}: UseShellAuxiliaryAvoidanceOptions): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let animationFrame = 0;
    let observedBoundary: HTMLElement | null = null;
    const observedTargets = new Set<HTMLElement>();
    const observedAuxiliaryLayers = new Set<HTMLElement>();
    const originalInlinePadding = new WeakMap<HTMLElement, InlinePaddingSnapshot>();

    const clearTarget = (target: HTMLElement) => {
      target.removeAttribute(ACTIVE_ATTRIBUTE);
      target.removeAttribute(CLEARANCE_ATTRIBUTE);
      target.style.removeProperty(CLEARANCE_PROPERTY);
      const original = originalInlinePadding.get(target);
      if (!original) return;
      if (original.value) {
        target.style.setProperty('padding-inline-end', original.value, original.priority);
      } else target.style.removeProperty('padding-inline-end');
    };

    const auxiliaryGeometry = (): ShellAuxiliaryGeometry[] =>
      [...document.querySelectorAll<HTMLElement>('[data-shell-auxiliary-layer]')].map((layer) => ({
        rect: layer.getBoundingClientRect(),
        placement: layer.dataset.shellAuxiliaryPlacement,
        edge: layer.dataset.shellAuxiliaryEdge,
      }));

    const updateAvoidance = () => {
      animationFrame = 0;
      const layers = auxiliaryGeometry();
      observedTargets.forEach((target) => {
        const targetRect = target.getBoundingClientRect();
        const clearance = layers.reduce(
          (maximum, layer) =>
            Math.max(maximum, resolveShellAuxiliaryInlineClearance(targetRect, layer, safetyGap)),
          0
        );
        if (clearance <= 0) {
          clearTarget(target);
          return;
        }

        if (!originalInlinePadding.has(target)) {
          originalInlinePadding.set(target, {
            value: target.style.getPropertyValue('padding-inline-end'),
            priority: target.style.getPropertyPriority('padding-inline-end'),
          });
        }
        target.setAttribute(ACTIVE_ATTRIBUTE, 'true');
        target.setAttribute(CLEARANCE_ATTRIBUTE, String(clearance));
        target.style.setProperty(CLEARANCE_PROPERTY, `${clearance}px`);
        target.style.setProperty('padding-inline-end', `var(${CLEARANCE_PROPERTY})`);
      });
    };

    const queueAvoidanceUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateAvoidance);
    };

    const resizeObserver = new ResizeObserver(queueAvoidanceUpdate);
    const syncTargets = () => {
      const nextBoundary = boundaryRef.current;
      if (nextBoundary !== observedBoundary) {
        if (observedBoundary) resizeObserver.unobserve(observedBoundary);
        observedBoundary = nextBoundary;
        if (observedBoundary) resizeObserver.observe(observedBoundary);
      }
      const nextTargets = new Set(
        observedBoundary?.querySelectorAll<HTMLElement>(AVOIDANCE_TARGET_SELECTOR) ?? []
      );
      observedTargets.forEach((target) => {
        if (nextTargets.has(target)) return;
        resizeObserver.unobserve(target);
        clearTarget(target);
        observedTargets.delete(target);
      });
      nextTargets.forEach((target) => {
        if (observedTargets.has(target)) return;
        observedTargets.add(target);
        resizeObserver.observe(target);
      });
      queueAvoidanceUpdate();
    };
    const syncAuxiliaryLayers = () => {
      const nextLayers = new Set(
        document.querySelectorAll<HTMLElement>('[data-shell-auxiliary-layer]')
      );
      observedAuxiliaryLayers.forEach((layer) => {
        if (nextLayers.has(layer)) return;
        resizeObserver.unobserve(layer);
        observedAuxiliaryLayers.delete(layer);
      });
      nextLayers.forEach((layer) => {
        if (observedAuxiliaryLayers.has(layer)) return;
        observedAuxiliaryLayers.add(layer);
        resizeObserver.observe(layer);
      });
      queueAvoidanceUpdate();
    };

    const domObserver = new MutationObserver(() => {
      syncTargets();
      syncAuxiliaryLayers();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    syncTargets();
    syncAuxiliaryLayers();
    window.addEventListener('scroll', queueAvoidanceUpdate, { passive: true });
    window.addEventListener('resize', queueAvoidanceUpdate);
    updateAvoidance();

    return () => {
      resizeObserver.disconnect();
      domObserver.disconnect();
      observedTargets.forEach(clearTarget);
      window.removeEventListener('scroll', queueAvoidanceUpdate);
      window.removeEventListener('resize', queueAvoidanceUpdate);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [boundaryRef, enabled, safetyGap]);
}
