/**
 * 실시간 알림 전역 상태 (Zustand)
 * 웹소켓 수신 → add → 배지/드롭다운/토스트 연동
 */

import { create } from 'zustand';

// ----------------------------------------------------------------------

/** 카테고리별 아이콘/라벨 매핑 (학습 완료, 승인 완료, 이상 징후 발견 등) */
export type NotificationCategory =
  | 'training_complete'   // 학습 완료
  | 'approval_complete'  // 승인 완료
  | 'anomaly_detected'   // 이상 징후 발견
  | 'info'
  | 'warning'
  | 'error';

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: number;
  isUnRead: boolean;
  /** 링크 등 메타 (선택) */
  link?: string;
};

type NotificationState = {
  items: NotificationItem[];
  maxItems: number;
};

type NotificationActions = {
  add: (item: Omit<NotificationItem, 'id' | 'createdAt' | 'isUnRead'> & { id?: string }) => NotificationItem;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  clear: () => void;
  getUnreadCount: () => number;
};

const DEFAULT_MAX = 100;

export const useNotificationStore = create<NotificationState & NotificationActions>((set, get) => ({
  items: [],
  maxItems: DEFAULT_MAX,

  add: (payload) => {
    const id = payload.id ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: NotificationItem = {
      ...payload,
      id,
      createdAt: Date.now(),
      isUnRead: true,
    };
    set((state) => ({
      items: [item, ...state.items].slice(0, state.maxItems),
    }));
    return item;
  },

  markAllAsRead: () =>
    set((state) => ({
      items: state.items.map((n) => ({ ...n, isUnRead: false })),
    })),

  markAsRead: (id) =>
    set((state) => ({
      items: state.items.map((n) => (n.id === id ? { ...n, isUnRead: false } : n)),
    })),

  clear: () => set({ items: [] }),

  getUnreadCount: () => get().items.filter((n) => n.isUnRead).length,
}));
