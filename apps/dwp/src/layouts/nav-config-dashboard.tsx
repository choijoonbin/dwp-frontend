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

/** 그룹 표시 순서: 낮은 인덱스가 먼저. SynapseX를 APPS/ADMIN보다 앞에 표시 */
const GROUP_ORDER: Record<string, number> = {
  SynapseX: 0,
  APPS: 1,
  ADMIN: 2,
};

const getGroupOrder = (group: string | null | undefined): number =>
  group != null && group in GROUP_ORDER ? GROUP_ORDER[group] : 99;

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
 * Sort root menu nodes: group order first (SynapseX → APPS → ADMIN), then sortOrder within group.
 * Tree API가 menus 배열을 APPS/ADMIN 먼저 내려줘도, 통합 관제 센터(SynapseX)가 먼저 보이도록 함.
 */
const sortRootMenuNodes = (nodes: MenuNode[]): MenuNode[] =>
  [...nodes].sort((a, b) => {
    const groupA = getGroupOrder(a.group);
    const groupB = getGroupOrder(b.group);
    if (groupA !== groupB) return groupA - groupB;
    return sortMenuNodes([a, b])[0] === a ? -1 : 1;
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

  // menuName 우선, 없으면 name fallback (BE menus/tree가 언어별 menuName 반환)
  const displayName =
    node.menuName ?? (node as MenuNode & { name?: string }).name ?? '';
  return {
    title: displayName,
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

    // Sort root: group order (SynapseX first) then sortOrder; children by sortOrder only
    const sortedTree = sortRootMenuNodes(menuTree);

    // Convert MenuNode[] to NavItem[]
    return sortedTree.map(convertMenuNodeToNavItem);
  }, [menuTree, isLoaded]);
};

// Backward compatibility: export as navData (empty array since we use menuTree now)
export const navData: NavItem[] = [];
