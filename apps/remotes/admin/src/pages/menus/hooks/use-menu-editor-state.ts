// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { useState, useEffect, useCallback } from 'react';

import type { SnackbarState, MenuFormState } from '../types';

// ----------------------------------------------------------------------

const initialFormState: MenuFormState = {
  menuKey: '',
  menuName: '',
  path: '',
  icon: '',
  group: '',
  parentId: '',
  sortOrder: '',
  enabled: true,
};

/**
 * EditorState Hook: 생성/수정 모달 상태 관리
 */
export const useMenuEditorState = () => {
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [open, setOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<MenuFormState>(initialFormState);
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedMenu, setSelectedMenu] = useState<AdminMenuNode | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Initialize form from menu (for edit mode)
  const initializeForm = useCallback((menu: AdminMenuNode | null) => {
    if (menu) {
      setDraftForm({
        menuKey: menu.menuKey || '',
        menuName: menu.menuName || '',
        path: menu.path || '',
        icon: menu.icon || '',
        group: menu.group || '',
        parentId: menu.parentId || '',
        sortOrder: menu.sortOrder?.toString() || '',
        enabled: menu.enabled ?? true,
      });
      setDirty(false);
      setValidationErrors({});
    } else {
      setDraftForm(initialFormState);
      setDirty(false);
      setValidationErrors({});
    }
  }, []);

  // Update form when menu changes (for detail editor)
  useEffect(() => {
    if (selectedMenu) {
      initializeForm(selectedMenu);
    }
  }, [selectedMenu, initializeForm]);

  // Open create dialog
  const openCreateDialog = useCallback((parentId?: string) => {
    setMode('create');
    setSelectedMenu(null);
    initializeForm(null);
    if (parentId) {
      setDraftForm((prev) => ({ ...prev, parentId }));
    }
    setOpen(true);
  }, [initializeForm]);

  // Open edit dialog
  const openEditDialog = useCallback(
    (menu: AdminMenuNode) => {
      setMode('edit');
      setSelectedMenu(menu);
      initializeForm(menu);
      setOpen(true);
    },
    [initializeForm]
  );

  // Close dialog
  const closeDialog = useCallback(() => {
    setOpen(false);
    setDirty(false);
    setValidationErrors({});
  }, []);

  const resetForm = useCallback(() => {
    if (selectedMenu) {
      initializeForm(selectedMenu);
    } else {
      initializeForm(null);
    }
  }, [initializeForm, selectedMenu]);

  // Update form field
  const updateFormField = useCallback(<K extends keyof MenuFormState>(
    field: K,
    value: MenuFormState[K]
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

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!draftForm.menuKey.trim()) {
      errors.menuKey = '메뉴 키를 입력하세요.';
    }
    if (!draftForm.menuName.trim()) {
      errors.menuName = '메뉴명을 입력하세요.';
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
  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit';

  return {
    // State
    mode,
    open,
    draftForm,
    dirty,
    validationErrors,
    selectedMenu,
    snackbar,
    // Computed
    isCreateMode,
    isEditMode,
    // Actions
    openCreateDialog,
    openEditDialog,
    closeDialog,
    resetForm,
    updateFormField,
    validateForm,
    setSelectedMenu,
    showSnackbar,
    closeSnackbar,
  };
};
