import { Activity, Gauge, Lightbulb, ListChecks, Send } from 'lucide-react';

import type { WorkspaceWidgetDefinition } from '../../components/workspace-composer/workspace-composer-model';

export type ApprovalHomeWidgetKey =
  | 'decision-pulse'
  | 'focus-queue'
  | 'flow'
  | 'my-requests'
  | 'insights';

export const APPROVAL_HOME_WIDGET_REGISTRY: readonly WorkspaceWidgetDefinition<ApprovalHomeWidgetKey>[] =
  [
    {
      key: 'decision-pulse',
      icon: Gauge,
      canHide: false,
      defaultSize: 'full',
      allowedSizes: ['full'],
      defaultHeight: 'short',
      allowedHeights: ['short', 'standard'],
    },
    {
      key: 'focus-queue',
      icon: ListChecks,
      canHide: true,
      defaultSize: 'large',
      allowedSizes: ['medium', 'large', 'full'],
      defaultHeight: 'tall',
      allowedHeights: ['standard', 'tall', 'expanded'],
    },
    {
      key: 'flow',
      icon: Activity,
      canHide: true,
      defaultSize: 'medium',
      allowedSizes: ['medium', 'large', 'full'],
      defaultHeight: 'standard',
      allowedHeights: ['short', 'standard', 'tall'],
    },
    {
      key: 'my-requests',
      icon: Send,
      canHide: true,
      defaultSize: 'medium',
      allowedSizes: ['medium', 'large', 'full'],
      defaultHeight: 'standard',
      allowedHeights: ['short', 'standard', 'tall'],
    },
    {
      key: 'insights',
      icon: Lightbulb,
      canHide: true,
      defaultSize: 'medium',
      allowedSizes: ['compact', 'medium', 'large'],
      defaultHeight: 'standard',
      allowedHeights: ['short', 'standard', 'tall'],
    },
  ];
