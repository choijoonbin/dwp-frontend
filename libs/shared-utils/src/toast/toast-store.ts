import { create } from 'zustand';

type ToastSeverity = 'success' | 'error' | 'warning';
type ToastAction = { label: string; href: string };

type ToastState = {
  open: boolean;
  message: string;
  severity: ToastSeverity;
  action?: ToastAction;
  anchorOrigin: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  show: (message: string, severity?: ToastSeverity, action?: ToastAction) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  open: false,
  message: '',
  severity: 'success',
  anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
  show: (message, severity = 'success', action) => set({ open: true, message, severity, action }),
  hide: () => set({ open: false, action: undefined }),
}));

export function showToast(
  message: string,
  severity: ToastSeverity = 'success',
  action?: ToastAction
): void {
  useToastStore.getState().show(message, severity, action);
}

export function useToast() {
  return {
    success: (message: string) => showToast(message, 'success'),
    error: (message: string, action?: ToastAction) => showToast(message, 'error', action),
    warning: (message: string) => showToast(message, 'warning'),
  };
}
