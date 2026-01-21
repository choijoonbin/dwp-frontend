// ----------------------------------------------------------------------

import type { UserSummary } from '@dwp-frontend/shared-utils';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAdminUserDetailQuery } from '@dwp-frontend/shared-utils';

import { toUserDetailModel } from '../adapters/user-adapter';

import type { UserFormState, SnackbarState } from '../types';

// ----------------------------------------------------------------------

const initialFormState: UserFormState = {
  userName: '',
  email: '',
  departmentId: '',
  status: 'ACTIVE',
  createLocalAccount: false,
  principal: '',
  password: '',
};

/**
 * EditorState Hook: 생성/수정/보기 모달 상태 관리
 */
export const useUserEditorState = () => {
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>('view');
  const [open, setOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<UserFormState>(initialFormState);
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch user detail when editing
  const shouldFetchDetail = mode === 'edit' && Boolean(selectedUser?.id);
  const { data: userDetail } = useAdminUserDetailQuery(shouldFetchDetail ? selectedUser!.id : '');

  // Initialize form from user (for edit mode)
  const initializeForm = useCallback((user: UserSummary | null, detail?: typeof userDetail) => {
    if (user && detail) {
      const model = toUserDetailModel(detail);
      setDraftForm({
        userName: model.userName,
        email: model.email || '',
        departmentId: model.departmentId || '',
        status: model.status,
        createLocalAccount: false, // Not applicable for edit
        principal: '',
        password: '',
      });
      setDirty(false);
      setValidationErrors({});
    } else {
      setDraftForm(initialFormState);
      setDirty(false);
      setValidationErrors({});
    }
  }, []);

  // Update form when userDetail is loaded
  useEffect(() => {
    if (mode === 'edit' && selectedUser && userDetail) {
      initializeForm(selectedUser, userDetail);
    }
  }, [mode, selectedUser, userDetail, initializeForm]);

  // Open create dialog
  const openCreateDialog = useCallback(() => {
    setMode('create');
    setSelectedUser(null);
    initializeForm(null);
    setOpen(true);
  }, [initializeForm]);

  // Open edit dialog
  const openEditDialog = useCallback(
    (user: UserSummary) => {
      setMode('edit');
      setSelectedUser(user);
      // Form will be initialized when userDetail is loaded
      setOpen(true);
    },
    []
  );

  // Close dialog (with dirty check)
  const closeDialog = useCallback(
    (force: boolean = false) => {
      if (!force && dirty && mode !== 'view') {
        // Return false to indicate confirmation needed
        return false;
      }
      setOpen(false);
      setMode('view');
      setDirty(false);
      setValidationErrors({});
      return true;
    },
    [dirty, mode]
  );

  // Update form field
  const updateFormField = useCallback(<K extends keyof UserFormState>(
    field: K,
    value: UserFormState[K]
  ) => {
    setDraftForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [validationErrors]);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    initializeForm(selectedUser, userDetail);
  }, [selectedUser, userDetail, initializeForm]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!draftForm.userName.trim()) {
      errors.userName = '사용자명을 입력하세요.';
    }
    if (draftForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftForm.email)) {
      errors.email = '올바른 이메일 형식이 아닙니다.';
    }
    if (draftForm.createLocalAccount && !draftForm.password) {
      errors.password = '로컬 계정 생성 시 비밀번호를 입력하세요.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [draftForm]);

  // Snackbar helpers
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // Computed: is create mode
  const isCreateMode = useMemo(() => mode === 'create', [mode]);
  const isEditMode = useMemo(() => mode === 'edit', [mode]);

  return {
    // State
    mode,
    open,
    draftForm,
    dirty,
    validationErrors,
    selectedUser,
    snackbar,
    // Computed
    isCreateMode,
    isEditMode,
    // Actions
    openCreateDialog,
    openEditDialog,
    closeDialog,
    updateFormField,
    resetForm,
    validateForm,
    setSelectedUser,
    showSnackbar,
    closeSnackbar,
  };
};
