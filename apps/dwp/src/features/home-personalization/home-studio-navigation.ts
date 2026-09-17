import {
  Bot,
  History,
  LayoutDashboard,
  MonitorSmartphone,
  Palette,
  PanelsTopLeft,
  SlidersHorizontal,
} from 'lucide-react';

import type { ActiveHomeStudioSection } from './home-personalization-studio-contracts';

export function homeStudioNavigation({
  presentation,
  modePreset,
  advancedMode,
  legacyStore,
  composerEnabled,
}: {
  presentation: 'dialog' | 'page';
  modePreset: boolean;
  advancedMode: boolean;
  legacyStore: boolean;
  composerEnabled: boolean;
}): Array<{ key: ActiveHomeStudioSection; icon: typeof LayoutDashboard }> {
  return [
    ...(presentation === 'page' ? ([{ key: 'overview', icon: LayoutDashboard }] as const) : []),
    ...(modePreset ? ([{ key: 'mode', icon: PanelsTopLeft }] as const) : []),
    ...(advancedMode || presentation === 'page'
      ? ([{ key: 'layout', icon: PanelsTopLeft }] as const)
      : []),
    { key: 'appearance', icon: Palette },
    ...(!legacyStore
      ? [
          { key: 'profiles' as const, icon: LayoutDashboard },
          { key: 'content' as const, icon: SlidersHorizontal },
          { key: 'device' as const, icon: MonitorSmartphone },
          { key: 'templates' as const, icon: PanelsTopLeft },
          { key: 'history' as const, icon: History },
          ...(composerEnabled || presentation === 'page'
            ? ([{ key: 'ai' as const, icon: Bot }] as const)
            : []),
        ]
      : []),
  ];
}
