import { create } from 'zustand';

// ----------------------------------------------------------------------

export type LayoutState = {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  activeMenu: string;
  actions: {
    toggleSidebar: () => void;
    toggleCollapse: () => void;
    setSidebarOpen: (open: boolean) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setActiveMenu: (menuId: string) => void;
  };
};

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  activeMenu: 'dashboard',
  actions: {
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    toggleCollapse: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    setActiveMenu: (menuId) => set({ activeMenu: menuId }),
  },
}));

export const useLayoutActions = () => useLayoutStore((state) => state.actions);
