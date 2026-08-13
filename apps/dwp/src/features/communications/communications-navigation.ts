import { Bookmark, CircleAlert, Newspaper, Sparkles } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { CommunicationFeedScope } from '@dwp-frontend/shared-utils';

export type CommunicationsNavigationItem = {
  id: CommunicationFeedScope;
  path: string;
  icon: LucideIcon;
};

export type CommunicationsNavigationGroup = {
  id: 'discover' | 'library';
  items: readonly CommunicationsNavigationItem[];
};

export const COMMUNICATIONS_NAVIGATION: readonly CommunicationsNavigationGroup[] = [
  {
    id: 'discover',
    items: [
      { id: 'for-you', path: '/communications/for-you', icon: Sparkles },
      { id: 'all', path: '/communications/all', icon: Newspaper },
    ],
  },
  {
    id: 'library',
    items: [
      { id: 'required', path: '/communications/required', icon: CircleAlert },
      { id: 'saved', path: '/communications/saved', icon: Bookmark },
    ],
  },
] as const;
