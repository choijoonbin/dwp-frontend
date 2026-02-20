import type { MenuNode } from '@dwp-frontend/shared-utils';

import { useMemo } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
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

/** BE가 Depth 1로 내려주는 '통합 워크벤치' 노드 식별 (최상단 고정용) */
const WORKBENCH_ROOT_KEYS = ['menu.command-center', 'menu.workbench'];

const isWorkbenchRootNode = (node: MenuNode): boolean =>
  (node.depth === 1 || node.depth == null) &&
  (WORKBENCH_ROOT_KEYS.includes(node.menuKey) || node.path === '/synapse/workbench');

/**
 * Sort menu nodes by sortOrder, fallback to menuKey (언어 변경 시 순서 유지)
 */
const sortMenuNodes = (nodes: MenuNode[]): MenuNode[] =>
  [...nodes].sort((a, b) => {
    if (a.sortOrder != null && b.sortOrder != null) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.sortOrder != null) return -1;
    if (b.sortOrder != null) return 1;
    return (a.menuKey ?? '').localeCompare(b.menuKey ?? '');
  });

/**
 * Sort root menu nodes: group order first (SynapseX → APPS → ADMIN), then within group
 * Depth 1 '통합 워크벤치'를 항상 가장 상단에, 나머지는 sortOrder 순.
 */
const sortRootMenuNodes = (nodes: MenuNode[]): MenuNode[] =>
  [...nodes].sort((a, b) => {
    const groupA = getGroupOrder(a.group);
    const groupB = getGroupOrder(b.group);
    if (groupA !== groupB) return groupA - groupB;
    const aIsWorkbench = isWorkbenchRootNode(a);
    const bIsWorkbench = isWorkbenchRootNode(b);
    if (aIsWorkbench && !bIsWorkbench) return -1;
    if (!aIsWorkbench && bIsWorkbench) return 1;
    return sortMenuNodes([a, b])[0] === a ? -1 : 1;
  });

/**
 * menuKey → default icon (BE에서 icon 미제공 시 사용)
 * 이상징후, 채권채무, 조치이력보관함 등과 동일하게 조치실행센터에도 아이콘 통일
 */
const MENU_KEY_TO_ICON: Record<string, string> = {
  'menu.command-center': 'solar:monitor-bold',
  'menu.workbench': 'solar:monitor-bold',
  'menu.autonomous-operations.workbench': 'solar:widget-bold',
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
  'menu.demo-control': 'solar:database-bold',
  'menu.governance-config.integrations': 'solar:plug-circle-bold',
  'menu.governance-config.admin': 'solar:settings-bold',
};

/**
 * Convert MenuNode to NavItem
 * - If path is missing, use first child's path as fallback
 * - Convert icon string to Iconify component
 * - Sort children by sortOrder (fallback to menuName)
 * - 거버넌스·설정 하위 메뉴는 FE i18n 적용 (BE menus/tree 미지원 시 fallback)
 */
/** 동일 화면(워크벤치) 중복 노출 방지: 자율 운영 센터 하위 "자율 작업대"는 상단 "통합 워크벤치"(menu.command-center)와 동일하므로 사이드바에서 제외 */
const WORKBENCH_CHILD_MENU_KEY = 'menu.autonomous-operations.workbench';

/** 케이스 상세·추론 등: 사이드바 제외, 워크벤치 내부 탭으로만 존재 */
const CASE_DETAIL_PATH_PATTERN = /^\/?(?:synapse\/)?cases\/[^/]+$/;
const SIDEBAR_EXCLUDED_MENU_KEY_SUBSTRINGS = ['case-detail', 'inference'];
const SIDEBAR_EXCLUDED_MENU_NAME_SUBSTRINGS = ['케이스 상세', '추론'];

const isExcludedFromSidebar = (n: MenuNode): boolean => {
  const path = (n.path ?? '').trim();
  if (path && CASE_DETAIL_PATH_PATTERN.test(path.replace(/^\//, ''))) return true;
  const key = (n.menuKey ?? '').toLowerCase();
  if (SIDEBAR_EXCLUDED_MENU_KEY_SUBSTRINGS.some((s) => key.includes(s))) return true;
  const name = (n.menuName ?? '').trim();
  if (SIDEBAR_EXCLUDED_MENU_NAME_SUBSTRINGS.some((s) => name.includes(s))) return true;
  return false;
};

const convertMenuNodeToNavItem = (
  node: MenuNode,
  t: (key: string) => string
): NavItem => {
  let rawChildren = node.children;
  if (node.menuKey === 'menu.autonomous-operations') {
    rawChildren = rawChildren?.filter((c) => c.menuKey !== WORKBENCH_CHILD_MENU_KEY);
  }
  rawChildren = rawChildren?.filter((c) => !isExcludedFromSidebar(c));
  const sortedChildren = rawChildren
    ? sortMenuNodes(rawChildren).map((c) => convertMenuNodeToNavItem(c, t))
    : undefined;

  // If path is missing and has children, use first child's path as fallback
  let path = node.path || (sortedChildren && sortedChildren.length > 0 ? sortedChildren[0].path : '#');
  // 통합 워크벤치 정규화: 레거시/다양한 키 모두 /synapse/workbench로 통일
  if (WORKBENCH_ROOT_KEYS.includes(node.menuKey) || path === '/synapse/command-center') {
    path = '/synapse/workbench';
  }

  // Use backend icon if available, else menuKey fallback, else generic circle
  const iconString =
    node.icon && typeof node.icon === 'string' && node.icon.trim()
      ? node.icon.trim()
      : MENU_KEY_TO_ICON[node.menuKey] ?? 'solar:circle-bold';

  // BE menuName 우선, 없을 때만 FE i18n fallback
  const apiName = (node.menuName ?? (node as MenuNode & { name?: string }).name ?? '').trim();
  let displayName = apiName;

  // 통합 워크벤치 명칭 통일 (예외: FE에서 고정)
  if (
    WORKBENCH_ROOT_KEYS.includes(node.menuKey) ||
    node.menuKey === 'menu.autonomous-operations.workbench'
  ) {
    displayName = apiName || t('menu.workbench');
  } else if (node.menuKey === 'menu.demo-control') {
    displayName = apiName || t('menu.governance-config.demo-control');
  } else if (!apiName) {
    // BE에서 menuName이 없을 때만 FE i18n fallback
    const menuGroups = [
      'menu.autonomous-operations',
      'menu.master-data-history',
      'menu.knowledge-policy',
      'menu.reconciliation-audit',
      'menu.governance-config',
    ];

    for (const groupPrefix of menuGroups) {
      if (node.menuKey === groupPrefix) {
        const groupKey = groupPrefix.replace('menu.', '');
        const translated = t(`menu.${groupKey}._label`);
        if (translated && translated !== `menu.${groupKey}._label`) {
          displayName = translated;
        }
        break;
      } else if (node.menuKey.startsWith(`${groupPrefix}.`)) {
        const groupKey = groupPrefix.replace('menu.', '');
        const subKey = node.menuKey.replace(`${groupPrefix}.`, '');
        const translated = t(`menu.${groupKey}.${subKey}`);
        if (translated && translated !== `menu.${groupKey}.${subKey}`) {
          displayName = translated;
        }
        break;
      }
    }
  }

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
 * Menu tree is already filtered by permissions on backend.
 * GNB Restoration: 모든 메뉴 그룹 노출 (SynapseX 포함 전체 트리 변환).
 */
export const useNavData = (): NavItem[] => {
  const { t } = useTranslation('common');
  const { menuTree, isLoaded } = useMenuTreeStore();

  return useMemo(() => {
    if (!isLoaded || !menuTree.length) {
      return [];
    }

    // Sort root: group order (SynapseX first) then sortOrder; children by sortOrder only
    const sortedTree = sortRootMenuNodes(menuTree);

    // 케이스 상세·추론 등 사이드바 제외 후 변환 (워크벤치 내부 탭으로만 존재)
    const result: NavItem[] = sortedTree
      .filter((node) => !isExcludedFromSidebar(node))
      .map((node) => convertMenuNodeToNavItem(node, t));

    // Phase 4: '용어·코드 사전'을 Knowledge & Policy에서 Governance & Config로 이동
    const knowledgePolicyItem = result.find((r) => r.resourceKey === 'menu.knowledge-policy');
    const governanceConfigItem = result.find((r) => r.resourceKey === 'menu.governance-config');
    if (knowledgePolicyItem?.children && governanceConfigItem) {
      const dictIndex = knowledgePolicyItem.children.findIndex((c) => c.resourceKey === 'menu.knowledge-policy.dictionary');
      if (dictIndex >= 0) {
        const dictItem = knowledgePolicyItem.children[dictIndex];
        knowledgePolicyItem.children = knowledgePolicyItem.children.filter((_, i) => i !== dictIndex);
        governanceConfigItem.children = [...(governanceConfigItem.children ?? []), dictItem].sort((a, b) =>
          (a.resourceKey ?? '').localeCompare(b.resourceKey ?? '')
        );
      }
    }

    return result;
  }, [menuTree, isLoaded, t]);
};

// Backward compatibility: export as navData (empty array since we use menuTree now)
export const navData: NavItem[] = [];
