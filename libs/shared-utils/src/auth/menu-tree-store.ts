import { create } from 'zustand';

import type { MenuNode } from './types';

// ----------------------------------------------------------------------

export type MenuTreeState = {
  menuTree: MenuNode[];
  isLoaded: boolean;
  actions: {
    setMenuTree: (menuTree: MenuNode[]) => void;
    clearMenuTree: () => void;
  };
};

export const useMenuTreeStore = create<MenuTreeState>((set) => ({
  menuTree: [],
  isLoaded: false,

  actions: {
    setMenuTree: (menuTree: MenuNode[]) => {
      set({ menuTree, isLoaded: true });
    },

    clearMenuTree: () => {
      set({
        menuTree: [],
        isLoaded: false,
      });
    },
  },
}));
