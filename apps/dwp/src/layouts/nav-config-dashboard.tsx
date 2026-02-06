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
 * menuKey → default icon (BE에서 icon 미제공 시 사용)
 * 이상징후, 채권채무, 조치이력보관함 등과 동일하게 조치실행센터에도 아이콘 통일
 */
const MENU_KEY_TO_ICON: Record<string, string> = {
  'menu.autonomous-operations.cases': 'solar:clipboard-list-bold',
  'menu.autonomous-operations.anomalies': 'solar:danger-triangle-bold',
  'menu.autonomous-operations.optimization': 'solar:chart-2-bold',
  'menu.autonomous-operations.actions': 'solar:play-circle-bold',
  'menu.autonomous-operations.archive': 'solar:archive-bold',
  'menu.master-data-history.documents': 'solar:document-text-bold',
  'menu.master-data-history.open-items': 'solar:wallet-money-bold',
  'menu.master-data-history.entities': 'solar:users-group-rounded-bold',
  'menu.master-data-history.lineage': 'solar:git-branch-bold',
  'menu.knowledge-policy.rag': 'solar:book-bold',
  'menu.knowledge-policy.policies': 'solar:shield-check-bold',
  'menu.knowledge-policy.guardrails': 'solar:fence-bold',
  'menu.knowledge-policy.dictionary': 'solar:book-2-bold',
  'menu.knowledge-policy.feedback': 'solar:chat-round-dots-bold',
  'menu.reconciliation-audit.reconciliation': 'solar:document-add-bold',
  'menu.reconciliation-audit.action-recon': 'solar:git-compare-bold',
  'menu.reconciliation-audit.audit': 'solar:history-bold',
  'menu.reconciliation-audit.analytics': 'solar:chart-square-bold',
  'menu.governance-config.governance': 'solar:settings-bold',
  'menu.governance-config.agent-config': 'solar:magic-stick-3-bold',
  'menu.governance-config.integrations': 'solar:plug-circle-bold',
  'menu.governance-config.admin': 'solar:settings-bold',
};

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

  // Use backend icon if available, else menuKey fallback, else generic circle
  const iconString =
    node.icon && typeof node.icon === 'string' && node.icon.trim()
      ? node.icon.trim()
      : MENU_KEY_TO_ICON[node.menuKey] ?? 'solar:circle-bold';

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
