import { create } from 'zustand';
import { i18n } from '@dwp-frontend/shared-i18n';

// ----------------------------------------------------------------------

export type ToastSeverity = 'success' | 'error' | 'warning';

export type ToastAction = { label: string; href: string };

export type ToastState = {
  open: boolean;
  message: string;
  severity: ToastSeverity;
  action?: ToastAction;
};

export type ToastActions = {
  show: (message: string, severity?: ToastSeverity, action?: ToastAction) => void;
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
    show: (message: string, severity: ToastSeverity = 'success', action?: ToastAction) => {
      set({ open: true, message, severity, action });
    },
    hide: () => {
      set({ open: false, action: undefined });
    },
  },
}));

/**
 * 시스템 공통 안내/에러 메시지 표시.
 * GlobalSnackbar가 Host에 한 번 마운트되어 있어야 UI에 노출됨.
 * 메뉴/Remote 구분 없이 어디서든 호출 가능.
 */
export const showToast = (
  message: string,
  severity: ToastSeverity = 'success',
  action?: ToastAction
): void => {
  useToastStore.getState().actions.show(message, severity, action);
};

/**
 * Action 실패 시 auditId가 있으면 Audit 상세 링크와 함께 toast 표시
 */
export const showToastWithAuditLink = (
  message: string,
  auditId?: string
): void => {
  if (auditId) {
    showToast(message, 'error', {
      label: i18n.t('toast.auditView', { ns: 'common' }),
      href: `/synapse/audit?auditId=${auditId}`,
    });
  } else {
    showToast(message, 'error');
  }
};

/**
 * Toast 호출 훅 — showToast 래퍼
 * LanguagePopover 등에서 사용
 */
export const useToast = () => ({
  success: (message: string) => showToast(message, 'success'),
  error: (message: string, action?: ToastAction) => showToast(message, 'error', action),
  warning: (message: string) => showToast(message, 'warning'),
});
