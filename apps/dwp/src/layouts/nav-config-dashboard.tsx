import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type NavItem = {
  title: string;
  path: string;
  icon: React.ReactNode;
  info?: React.ReactNode;
  group?: string;
};

export const navData: NavItem[] = [
  {
    group: 'Management',
    title: 'Dashboard',
    path: '/',
    icon: <Iconify width={22} icon="solar:home-angle-bold-duotone" />,
  },
  {
    group: 'Apps',
    title: 'Mail',
    path: '/mail',
    icon: <Iconify width={22} icon="solar:letter-bold" />,
  },
  {
    group: 'Apps',
    title: 'Chat',
    path: '/chat',
    icon: <Iconify width={22} icon="solar:chat-round-dots-bold" />,
  },
  {
    group: 'Apps',
    title: 'Approval',
    path: '/approval',
    icon: <Iconify width={22} icon="solar:clipboard-check-bold" />,
  },
];
