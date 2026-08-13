import {
  Activity,
  ContactRound,
  LayoutGrid,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import type { WorkspaceWidgetDefinition } from '../workspace-composer/workspace-composer-model';

export type HrisHomeWidgetKey =
  'quick-actions' | 'people-signals' | 'attention' | 'profile' | 'team' | 'operations';

export const HRIS_HOME_WIDGET_REGISTRY: readonly WorkspaceWidgetDefinition<HrisHomeWidgetKey>[] = [
  {
    key: 'quick-actions',
    icon: LayoutGrid,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['medium', 'large', 'full'],
  },
  {
    key: 'people-signals',
    icon: Activity,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['large', 'full'],
  },
  {
    key: 'attention',
    icon: ShieldCheck,
    canHide: true,
    defaultSize: 'large',
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
