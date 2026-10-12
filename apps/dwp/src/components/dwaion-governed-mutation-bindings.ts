import type { ProductSurfaceMutationBinding } from './use-product-surface-governed-mutation';

export type DwaionMutationRouteContractKey =
  `route.dwaion.${'work' | 'management'}.${string}.action`;

const DWAION_ACTION_PATTERN = /^route\.dwaion\.(work|management)\.[a-z0-9][a-z0-9._-]*\.action$/u;

/**
 * Projects a DWAI-ON action identity without shipping the complete product command registry into
 * the Workspace global launcher. Exact authority still fails closed against the signed snapshot.
 */
export function resolveDwaionMutationBinding(
  routeContractKey: DwaionMutationRouteContractKey
): ProductSurfaceMutationBinding {
  const match = DWAION_ACTION_PATTERN.exec(routeContractKey);
  if (!match) throw new Error(`Invalid DWAI-ON mutation route: ${routeContractKey}`);
  const management = match[1] === 'management';
  return Object.freeze({
    productKey: 'dwaion',
    surfaceKey: management ? 'dwaion.management' : 'dwaion.work',
    routeContractKey,
    taskKind: management ? 'ADMINISTRATION' : 'WORK',
  });
}
