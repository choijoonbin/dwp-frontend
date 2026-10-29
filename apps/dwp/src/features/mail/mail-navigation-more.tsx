import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import type {
  ProductNavigationItem,
  ProductShellNavigationProjection,
} from '../../components/product-manifest';
import type { ProductAreaNavigationItemChildrenContext } from '../../layouts/product-area-layout';

import { findMailNavigationItem, MAIL_NAVIGATION } from './mail-navigation';

const LOW_FREQUENCY_VIEWS = new Set(['archive', 'spam', 'trash', 'folders']);

export const MAIL_NAVIGATION_PROJECTION: ProductShellNavigationProjection = {
  project(authorizedPaths) {
    return MAIL_NAVIGATION.flatMap((group) => {
      const authorizedItems = group.items.filter((item) => authorizedPaths.has(item.path));
      if (group.id !== 'mailbox')
        return authorizedItems.length ? [{ ...group, items: authorizedItems }] : [];
      const lowFrequencyItems = authorizedItems.filter((item) =>
        LOW_FREQUENCY_VIEWS.has(item.view)
      );
      const primaryItems: ProductNavigationItem[] = authorizedItems.filter(
        (item) => !LOW_FREQUENCY_VIEWS.has(item.view)
      );
      if (lowFrequencyItems.length) {
        primaryItems.push({
          ...lowFrequencyItems[0],
          view: 'more',
          icon: MoreHorizontal,
          activePathPrefixes: lowFrequencyItems.map((item) => item.path),
        });
      }
      return primaryItems.length ? [{ ...group, items: primaryItems }] : [];
    });
  },
  resolveSelectedView(pathname) {
    const item = findMailNavigationItem(pathname);
    return item && LOW_FREQUENCY_VIEWS.has(item.view) ? 'more' : item?.view;
  },
};

export function renderMailNavigationMore({
  item,
  onNavigate,
}: ProductAreaNavigationItemChildrenContext) {
  if (item.view !== 'more') return null;
  return <MailNavigationMore item={item} onNavigate={onNavigate} />;
}

function MailNavigationMore({
  item,
  onNavigate,
}: Pick<ProductAreaNavigationItemChildrenContext, 'item' | 'onNavigate'>) {
  const { t } = useTranslation('mail');
  const authorizedPaths = new Set(item.activePathPrefixes ?? []);
  return (
    <List disablePadding aria-label={t('navigation.items.mail.more.label')}>
      {MAIL_NAVIGATION.find((group) => group.id === 'mailbox')
        ?.items.filter(
          (candidate) =>
            LOW_FREQUENCY_VIEWS.has(candidate.view) && authorizedPaths.has(candidate.path)
        )
        .map((candidate) => {
          const Icon = candidate.icon;
          return (
            <ListItemButton
              key={candidate.path}
              component={NavLink}
              to={candidate.path}
              onClick={onNavigate}
              sx={{ minHeight: 44, borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon size={18} />
              </ListItemIcon>
              <ListItemText primary={t(`navigation.items.mail.${candidate.view}.label`)} />
            </ListItemButton>
          );
        })}
    </List>
  );
}
