import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ContactRound,
  FileCheck2,
  LifeBuoy,
  Mail,
  MessagesSquare,
  MonitorCog,
  Newspaper,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from 'lucide-react';
import { GlyphSurface } from '@dwp-frontend/design-system';

import type { LucideIcon } from 'lucide-react';
import type {
  HomeAppDefinition,
  HomeAppIconKey,
} from '../../components/workspace-composer/app-launchpad-model';

export const homeAppIconByKey: Record<HomeAppIconKey, LucideIcon> = {
  activity: Activity,
  admin: ShieldCheck,
  approvals: FileCheck2,
  ask: Sparkles,
  collaboration: MessagesSquare,
  calendar: CalendarDays,
  communications: Newspaper,
  erp: Building2,
  knowledge: BookOpen,
  legacy: MonitorCog,
  mail: Mail,
  hcm: ContactRound,
  hris: ContactRound,
  people: UsersRound,
  services: LifeBuoy,
  workforce: Workflow,
  work: BriefcaseBusiness,
};

type AppGlyphProps = {
  app: Pick<HomeAppDefinition, 'iconKey' | 'tone'>;
  size?: number;
  variant?: 'glass' | 'soft';
};

export function AppGlyph({ app, size = 52, variant = 'glass' }: AppGlyphProps) {
  const Icon = homeAppIconByKey[app.iconKey];

  return (
    <GlyphSurface size={size} tone={app.tone} variant={variant}>
      <Icon size={Math.round(size * 0.44)} strokeWidth={1.85} />
    </GlyphSurface>
  );
}
