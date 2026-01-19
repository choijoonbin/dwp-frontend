import type { MenuNode } from '@dwp-frontend/shared-utils';

import { useMemo } from 'react';
import { useMenuTreeStore } from '@dwp-frontend/shared-utils';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type NavItem = {
  title: string;
  path: string;
  icon: React.ReactNode;
  info?: React.ReactNode;
  group?: string;
  resourceKey?: string; // 권한 체크용 리소스 키 (예: 'menu.admin')
  children?: NavItem[];
};

/**
 * Sort menu nodes by sortOrder, fallback to menuName
 */
const sortMenuNodes = (nodes: MenuNode[]): MenuNode[] =>
  [...nodes].sort((a, b) => {
    // First try sortOrder
    if (a.sortOrder != null && b.sortOrder != null) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.sortOrder != null) return -1;
    if (b.sortOrder != null) return 1;
    // Fallback to menuName alphabetical order
    return a.menuName.localeCompare(b.menuName);
  });

/**
 * Convert MenuNode to NavItem
 * - If path is missing, use first child's path as fallback
 * - Convert icon string to Iconify component
 * - Sort children by sortOrder (fallback to menuName)
 */
const convertMenuNodeToNavItem = (node: MenuNode): NavItem => {
  // Sort children by sortOrder (fallback to menuName)
  const sortedChildren = node.children
    ? sortMenuNodes(node.children).map(convertMenuNodeToNavItem)
    : undefined;

  // If path is missing and has children, use first child's path as fallback
  const path = node.path || (sortedChildren && sortedChildren.length > 0 ? sortedChildren[0].path : '#');

  // Use backend icon if available, otherwise fallback
  const iconString = node.icon && typeof node.icon === 'string' && node.icon.trim() 
    ? node.icon.trim() 
    : 'solar:circle-bold'; // Fallback icon only when backend icon is missing

  return {
    title: node.menuName,
    path,
    icon: <Iconify width={22} icon={iconString} />,
    group: node.group || undefined,
    resourceKey: node.menuKey,
    children: sortedChildren,
  };
};


/**
 * Get nav items from menu tree
 * Menu tree is already filtered by permissions on backend
 */
export const useNavData = (): NavItem[] => {
  const { menuTree, isLoaded } = useMenuTreeStore();

  return useMemo(() => {
    if (!isLoaded || !menuTree.length) {
      return [];
    }

    // Sort root nodes by sortOrder (fallback to menuName)
    const sortedTree = sortMenuNodes(menuTree);

    // Convert MenuNode[] to NavItem[]
    return sortedTree.map(convertMenuNodeToNavItem);
  }, [menuTree, isLoaded]);
};

// Backward compatibility: export as navData (empty array since we use menuTree now)
export const navData: NavItem[] = [];
