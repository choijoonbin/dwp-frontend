import { create } from 'zustand';

// ----------------------------------------------------------------------

export type ToastSeverity = 'success' | 'error';

export type ToastState = {
  open: boolean;
  message: string;
  severity: ToastSeverity;
};

export type ToastActions = {
  show: (message: string, severity?: ToastSeverity) => void;
  hide: () => void;
};

const initialState: ToastState = {
  open: false,
  message: '',
  severity: 'success',
};

export const useToastStore = create<ToastState & { actions: ToastActions }>((set) => ({
  ...initialState,

  actions: {
    show: (message: string, severity: ToastSeverity = 'success') => {
      set({ open: true, message, severity });
    },
    hide: () => {
      set({ open: false });
    },
  },
}));

/**
 * 시스템 공통 안내/에러 메시지 표시.
 * GlobalSnackbar가 Host에 한 번 마운트되어 있어야 UI에 노출됨.
 * 메뉴/Remote 구분 없이 어디서든 호출 가능.
 */
export const showToast = (message: string, severity: ToastSeverity = 'success'): void => {
  useToastStore.getState().actions.show(message, severity);
};
