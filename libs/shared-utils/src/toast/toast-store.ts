import { create } from 'zustand';
import { i18n } from '@dwp-frontend/shared-i18n';

// ----------------------------------------------------------------------

export type ToastSeverity = 'success' | 'error' | 'warning';

export type ToastAction = { label: string; href: string };

export type ToastAnchorOrigin = {
  vertical: 'top' | 'bottom';
  horizontal: 'left' | 'center' | 'right';
};

export type ToastState = {
  open: boolean;
  message: string;
  severity: ToastSeverity;
  action?: ToastAction;
  anchorOrigin: ToastAnchorOrigin;
};

export type ToastShowOptions = { anchorOrigin?: ToastAnchorOrigin };

export type ToastActions = {
  show: (
    message: string,
    severity?: ToastSeverity,
    action?: ToastAction,
    options?: ToastShowOptions
  ) => void;
  hide: () => void;
};

const defaultAnchor: ToastAnchorOrigin = {
  vertical: 'bottom',
  horizontal: 'center',
};

const initialState: ToastState = {
  open: false,
  message: '',
  severity: 'success',
  anchorOrigin: defaultAnchor,
};

export const useToastStore = create<ToastState & { actions: ToastActions }>((set) => ({
  ...initialState,

  actions: {
    show: (
      message: string,
      severity: ToastSeverity = 'success',
      action?: ToastAction,
      options?: ToastShowOptions
    ) => {
      set({
        open: true,
        message,
        severity,
        action,
        anchorOrigin: options?.anchorOrigin ?? defaultAnchor,
      });
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
 * options.anchorOrigin으로 스낵바 위치 지정 (예: 알림은 우측 상단).
 */
export const showToast = (
  message: string,
  severity: ToastSeverity = 'success',
  action?: ToastAction,
  options?: ToastShowOptions
): void => {
  useToastStore.getState().actions.show(message, severity, action, options);
};

/** RAG 학습 완료 시 토스트 (SSE rag_learned/rag_status 수신 시 호출) */
export const showRagLearnedToast = (): void => {
  showToast(i18n.t('toast.ragLearned', { ns: 'common' }), 'success');
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
