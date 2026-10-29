export type NavigationPolicyCopy = Readonly<{
  title: string;
  description: string;
  refresh: string;
  scope: string;
  tenant: string;
  legalEntity: string;
  lifecycle: string;
  rollout: string;
  impactTitle: string;
  impactDescription: string;
  recoveryTitle: string;
  recoveryDescription: string;
  groupsTitle: string;
  defaultNode: string;
  moveUp: string;
  moveDown: string;
  loadingTitle: string;
  emptyTitle: string;
  deniedTitle: string;
  deniedDescription: string;
  unavailableTitle: string;
  staleTitle: string;
  partialTitle: string;
  commandUnavailable: string;
}>;

export function navigationPolicyCopy(t: TFunction<'hcm'>): NavigationPolicyCopy {
  const key = (name: string) => t(`administration.navigation.copy.${name}`);
  return Object.freeze({
    title: key('title'),
    description: key('description'),
    refresh: key('refresh'),
    scope: key('scope'),
    tenant: key('tenant'),
    legalEntity: key('legalEntity'),
    lifecycle: key('lifecycle'),
    rollout: key('rollout'),
    impactTitle: key('impactTitle'),
    impactDescription: key('impactDescription'),
    recoveryTitle: key('recoveryTitle'),
    recoveryDescription: key('recoveryDescription'),
    groupsTitle: key('groupsTitle'),
    defaultNode: key('defaultNode'),
    moveUp: key('moveUp'),
    moveDown: key('moveDown'),
    loadingTitle: key('loadingTitle'),
    emptyTitle: key('emptyTitle'),
    deniedTitle: key('deniedTitle'),
    deniedDescription: key('deniedDescription'),
    unavailableTitle: key('unavailableTitle'),
    staleTitle: key('staleTitle'),
    partialTitle: key('partialTitle'),
    commandUnavailable: key('commandUnavailable'),
  });
}
import type { TFunction } from 'i18next';
