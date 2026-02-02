import { useMemo } from 'react';

import { useMenuTreeStore } from './menu-tree-store';

import type { MenuNode } from './types';

// ----------------------------------------------------------------------

/**
 * 메뉴 트리에서 모든 path를 수집하여 pathname Set으로 반환.
 * Tree API 응답(path: "menu.command-center", "/cases" 등)을 그대로 사용하며,
 * 선행 슬래시가 없으면 붙여서 브라우저 pathname과 일치시킴.
 * Host의 PathnameDispatcher에서 "이 pathname이 메뉴에 등록된 경로인지" 판별할 때 사용.
 */
export const getAllPathnamesFromMenuTree = (nodes: MenuNode[]): Set<string> => {
  const set = new Set<string>();

  const visit = (list: MenuNode[]) => {
    for (const node of list) {
      const p = node.path?.trim();
      if (p) {
        const pathname = p.startsWith('/') ? p : `/${p}`;
        set.add(pathname);
      }
      if (node.children?.length) visit(node.children);
    }
  };

  visit(nodes);
  return set;
};

/**
 * 메뉴 트리 Store에서 등록된 pathname Set을 구독.
 * 동적으로 등록된 URL만 사용하려면 PathnameDispatcher 등에서 이 훅을 사용.
 */
export const useMenuTreePathnames = (): Set<string> => {
  const menuTree = useMenuTreeStore((state) => state.menuTree);
  return useMemo(() => getAllPathnamesFromMenuTree(menuTree), [menuTree]);
};
