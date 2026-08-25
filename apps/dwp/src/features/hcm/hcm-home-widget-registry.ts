import { Activity, ContactRound, LayoutGrid, UsersRound } from 'lucide-react';

import type { WorkspaceWidgetDefinition } from '../../components/workspace-composer/workspace-composer-model';

export type HcmHomeWidgetKey = 'quick-actions' | 'people-signals' | 'profile' | 'team';

export const HCM_HOME_WIDGET_REGISTRY: readonly WorkspaceWidgetDefinition<HcmHomeWidgetKey>[] = [
  {
    key: 'people-signals',
    icon: Activity,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['large', 'full'],
    defaultHeight: 'standard',
    allowedHeights: ['short', 'standard', 'tall'],
  },
  {
    key: 'quick-actions',
    icon: LayoutGrid,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['medium', 'large', 'full'],
    defaultHeight: 'short',
    allowedHeights: ['short', 'standard'],
  },
  {
    key: 'profile',
    icon: ContactRound,
    canHide: true,
    defaultSize: 'compact',
    allowedSizes: ['compact', 'medium'],
    defaultHeight: 'standard',
    allowedHeights: ['short', 'standard', 'tall'],
  },
  {
    key: 'team',
    icon: UsersRound,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['medium', 'large', 'full'],
    defaultHeight: 'tall',
    allowedHeights: ['standard', 'tall', 'expanded'],
    audience: 'manager',
  },
];
