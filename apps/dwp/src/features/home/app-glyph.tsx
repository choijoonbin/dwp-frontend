import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  LifeBuoy,
  Mail,
  MessagesSquare,
  MonitorCog,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { GlyphSurface } from '@dwp-frontend/design-system';

import type { LucideIcon } from 'lucide-react';
import type { HomeAppDefinition, HomeAppIconKey } from './app-launchpad-model';

export const homeAppIconByKey: Record<HomeAppIconKey, LucideIcon> = {
  activity: Activity,
  admin: ShieldCheck,
  ask: Sparkles,
  collaboration: MessagesSquare,
  erp: Building2,
  knowledge: BookOpen,
  legacy: MonitorCog,
  mail: Mail,
  people: UsersRound,
  services: LifeBuoy,
  work: BriefcaseBusiness,
};

type AppGlyphProps = {
  app: Pick<HomeAppDefinition, 'iconKey' | 'tone'>;
  size?: number;
};

export function AppGlyph({ app, size = 52 }: AppGlyphProps) {
  const Icon = homeAppIconByKey[app.iconKey];

  return (
    <GlyphSurface size={size} tone={app.tone}>
      <Icon size={Math.round(size * 0.44)} strokeWidth={1.85} />
    </GlyphSurface>
  );
}
