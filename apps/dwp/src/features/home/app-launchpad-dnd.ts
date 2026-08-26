import { closestCenter, pointerWithin } from '@dnd-kit/core';

import type { CollisionDetection } from '@dnd-kit/core';
import type { HomeAppGroupId } from '../../components/workspace-composer/app-launchpad-model';

type LaunchpadCollisionResult = ReturnType<CollisionDetection>;

const FOLDER_TARGET_PREFIX = 'folder-target::';
const GROUP_TARGET_PREFIX = 'group-target::';

export function folderTargetId(itemId: string): string {
  return `${FOLDER_TARGET_PREFIX}${itemId}`;
}

export function targetItemId(droppableId: string): string | null {
  return droppableId.startsWith(FOLDER_TARGET_PREFIX)
    ? droppableId.slice(FOLDER_TARGET_PREFIX.length)
    : null;
}

export function isLaunchpadOriginTarget(itemId: string, droppableId: string): boolean {
  return droppableId === itemId || targetItemId(droppableId) === itemId;
}

export function groupTargetId(groupId: HomeAppGroupId): string {
  return `${GROUP_TARGET_PREFIX}${groupId}`;
}

export function groupIdFromTarget(droppableId: string): HomeAppGroupId | null {
  if (!droppableId.startsWith(GROUP_TARGET_PREFIX)) return null;
  return droppableId.slice(GROUP_TARGET_PREFIX.length) || null;
}

export const launchpadCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);
  // The dragged tile follows the pointer and remains a registered droppable.
  // Excluding its own item/origin target lets the destination underneath win;
  // otherwise a valid pointer drop is reported as a no-op on the active tile.
  const pointerCollisions = pointerWithin(args).filter((collision) => {
    const collisionId = String(collision.id);
    return collisionId !== activeId && targetItemId(collisionId) !== activeId;
  });
  const folderTarget = pointerCollisions.find((collision) =>
    String(collision.id).startsWith(FOLDER_TARGET_PREFIX)
  );
  if (folderTarget) return [folderTarget];

  const itemTarget = pointerCollisions.find(
    (collision) => !String(collision.id).startsWith(GROUP_TARGET_PREFIX)
  );
  if (itemTarget) return [itemTarget];

  const groupTarget = pointerCollisions.find((collision) =>
    String(collision.id).startsWith(GROUP_TARGET_PREFIX)
  );
  // The component retains the last item collision while a same-group preview
  // footprint is underneath the pointer. Keep this low-priority container as
  // an explicit fallback for genuine empty-space and cross-group drops.
  return groupTarget ? [groupTarget] : closestCenter(args);
};

export function createLaunchpadCollisionDetection(
  lastItemCollisionRef: { current: LaunchpadCollisionResult },
  findGroupId: (itemId: string) => HomeAppGroupId | null
): CollisionDetection {
  return (args) => {
    const collisions = launchpadCollisionDetection(args);
    const firstCollision = collisions[0];
    if (!firstCollision) return collisions;

    const collisionId = String(firstCollision.id);
    const broadGroupId = groupIdFromTarget(collisionId);
    if (!broadGroupId) {
      lastItemCollisionRef.current = collisions;
      return collisions;
    }

    const previousCollision = lastItemCollisionRef.current[0];
    if (!previousCollision) return collisions;
    const previousId = String(previousCollision.id);
    const previousItemId = targetItemId(previousId) ?? previousId;
    return findGroupId(previousItemId) === broadGroupId ? lastItemCollisionRef.current : collisions;
  };
}
