import {
  CalendarCheck2,
  CheckCircle2,
  CirclePlay,
  Inbox,
  ListTodo,
  MessagesSquare,
} from 'lucide-react';

import type { ProductAreaNavigationGroup } from '../../layouts/product-area-layout';

export const WORK_NAVIGATION = [
  {
    id: 'work',
    items: [
      { view: 'queue', path: '/work/queue', icon: Inbox },
      { view: 'action-required', path: '/work/action-required', icon: ListTodo },
      { view: 'day-plan', path: '/work/day-plan', icon: CalendarCheck2 },
      { view: 'in-progress', path: '/work/in-progress', icon: CirclePlay },
      { view: 'awaiting-response', path: '/work/awaiting-response', icon: MessagesSquare },
      { view: 'completed', path: '/work/completed', icon: CheckCircle2 },
    ],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];
