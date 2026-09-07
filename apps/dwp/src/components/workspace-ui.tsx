import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { SectionHeader } from '@dwp-frontend/design-system';

type SectionHeadingProps = {
  id: string;
  icon: LucideIcon;
  title: string;
  meta?: ReactNode;
  divider?: boolean;
};

export function SectionHeading({ id, icon, title, meta, divider }: SectionHeadingProps) {
  return <SectionHeader id={id} icon={icon} title={title} meta={meta} divider={divider} />;
}
