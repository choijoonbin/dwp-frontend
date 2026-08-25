import { closestCenter, pointerWithin } from '@dnd-kit/core';

import type { CollisionDetection } from '@dnd-kit/core';
import type { HomeAppGroupId } from '../../components/workspace-composer/app-launchpad-model';

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
  const pointerCollisions = pointerWithin(args);
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
  // A pointer inside the group but outside an item is an intentional empty-slot drop.
  // Returning a nearby item here makes the committed order disagree with the preview.
  return groupTarget ? [groupTarget] : closestCenter(args);
};
