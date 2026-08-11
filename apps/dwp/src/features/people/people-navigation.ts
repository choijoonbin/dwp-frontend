import { Network, UsersRound } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export type PeopleView = 'directory' | 'organization';

export type PeopleNavigationItem = {
  view: PeopleView;
  path: string;
  icon: LucideIcon;
};

export const PEOPLE_NAVIGATION: readonly PeopleNavigationItem[] = [
  { view: 'directory', path: '/people/directory', icon: UsersRound },
  { view: 'organization', path: '/people/organization', icon: Network },
];

export const PEOPLE_DEFAULT_PATH = PEOPLE_NAVIGATION[0].path;

export function findPeopleNavigationItem(view?: string): PeopleNavigationItem | undefined {
  return PEOPLE_NAVIGATION.find((item) => item.view === view);
}
