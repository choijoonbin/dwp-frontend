// ----------------------------------------------------------------------

import { useMemo, useState, useCallback } from 'react';

import { toRoleDetailModel } from '../adapters/role-adapter';

import type { RoleSummary, RoleFormState, SnackbarState } from '../types';

// ----------------------------------------------------------------------

const initialFormState: RoleFormState = {
  roleName: '',
  roleCode: '',
  description: '',
  status: 'ACTIVE',
};

/**
 * EditorState Hook: 생성/수정/보기 모달 상태 관리
 * - mode: 'create' | 'edit' | 'view'
 * - open: boolean
 * - draftForm: RoleFormState
 * - dirty: boolean
 * - validationErrors: Record<string, string>
 */
export const useRoleEditorState = () => {
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>('view');
  const [open, setOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<RoleFormState>(initialFormState);
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedRole, setSelectedRole] = useState<RoleSummary | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Initialize form from role (for edit mode)
  const initializeForm = useCallback((role: RoleSummary | null) => {
    if (role) {
      const model = toRoleDetailModel(role);
      setDraftForm({
        roleName: model.roleName,
        roleCode: model.roleCode,
        description: model.description || '',
        status: model.status,
      });
      setDirty(false);
      setValidationErrors({});
    } else {
      setDraftForm(initialFormState);
      setDirty(false);
      setValidationErrors({});
    }
  }, []);

  // Open create dialog
  const openCreateDialog = useCallback(() => {
    setMode('create');
    setSelectedRole(null);
    initializeForm(null);
    setOpen(true);
  }, [initializeForm]);

  // Open edit dialog
  const openEditDialog = useCallback(
    (role: RoleSummary) => {
      setMode('edit');
      setSelectedRole(role);
      initializeForm(role);
      setOpen(true);
    },
    [initializeForm]
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
  const updateFormField = useCallback(<K extends keyof RoleFormState>(
    field: K,
    value: RoleFormState[K]
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
    initializeForm(selectedRole);
  }, [selectedRole, initializeForm]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!draftForm.roleName.trim()) {
      errors.roleName = '권한명을 입력하세요.';
    }
    if (!draftForm.roleCode.trim()) {
      errors.roleCode = '권한 코드를 입력하세요.';
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
    selectedRole,
    deleteDialogOpen,
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
    setDeleteDialogOpen,
    setSelectedRole,
    showSnackbar,
    closeSnackbar,
    // Legacy compatibility (will be removed in future)
    createDialogOpen: mode === 'create' && open,
    editDialogOpen: mode === 'edit' && open,
    setCreateDialogOpen: (value: boolean) => {
      if (value) openCreateDialog();
      else closeDialog(true);
    },
    setEditDialogOpen: (value: boolean) => {
      if (value && selectedRole) openEditDialog(selectedRole);
      else closeDialog(true);
    },
  };
};
