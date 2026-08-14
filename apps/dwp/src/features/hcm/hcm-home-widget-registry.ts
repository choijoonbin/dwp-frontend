import { Activity, ContactRound, LayoutGrid, UserRoundCheck, UsersRound } from 'lucide-react';

import type { WorkspaceWidgetDefinition } from '../../components/workspace-composer/workspace-composer-model';

export type HcmHomeWidgetKey =
  | 'quick-actions'
  | 'people-signals'
  | 'profile'
  | 'team'
  | 'operations';

export const HCM_HOME_WIDGET_REGISTRY: readonly WorkspaceWidgetDefinition<HcmHomeWidgetKey>[] = [
  {
    key: 'people-signals',
    icon: Activity,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['large', 'full'],
  },
  {
    key: 'quick-actions',
    icon: LayoutGrid,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['medium', 'large', 'full'],
  },
  {
    key: 'profile',
    icon: ContactRound,
    canHide: true,
    defaultSize: 'compact',
    allowedSizes: ['compact', 'medium'],
  },
  {
    key: 'team',
    icon: UsersRound,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['medium', 'large', 'full'],
    audience: 'manager',
  },
  {
    key: 'operations',
    icon: UserRoundCheck,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['large', 'full'],
    audience: 'operator',
  },
];
