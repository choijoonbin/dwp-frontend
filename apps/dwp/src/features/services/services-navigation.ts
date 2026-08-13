import { Compass, FileClock, ListChecks } from 'lucide-react';

export const SERVICES_NAVIGATION = [
  {
    id: 'discover',
    items: [
      { id: 'discover', path: '/services/discover', icon: Compass },
      { id: 'my', path: '/services/my', icon: ListChecks },
      { id: 'drafts', path: '/services/drafts', icon: FileClock },
    ],
  },
] as const;
