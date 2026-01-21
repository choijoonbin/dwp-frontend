// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import { useState, useEffect, useCallback } from 'react';

import type { SnackbarState, ResourceFormState } from '../types';

// ----------------------------------------------------------------------

const initialFormState: ResourceFormState = {
  resourceName: '',
  resourceKey: '',
  resourceType: 'MENU',
  resourceCategory: undefined,
  resourceKind: undefined,
  path: '',
  parentId: '',
  sortOrder: '',
  enabled: true,
  trackingEnabled: false,
  eventActions: [],
};

/**
 * EditorState Hook: 생성/수정 모달 상태 관리
 */
export const useResourceEditorState = () => {
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [open, setOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<ResourceFormState>(initialFormState);
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedResource, setSelectedResource] = useState<ResourceNode | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Initialize form from resource (for edit mode)
  const initializeForm = useCallback((resource: ResourceNode | null) => {
    if (resource) {
      setDraftForm({
        resourceName: resource.resourceName || '',
        resourceKey: resource.resourceKey || '',
        resourceType: resource.resourceType || 'MENU',
        resourceCategory: (resource as { resourceCategory?: string }).resourceCategory,
        resourceKind: (resource as { resourceKind?: string }).resourceKind,
        path: resource.path || '',
        parentId: resource.parentId || '',
        sortOrder: resource.sortOrder?.toString() || '',
        enabled: resource.enabled ?? true,
        trackingEnabled: resource.trackingEnabled ?? false,
        eventActions: resource.eventActions || [],
      });
      setDirty(false);
      setValidationErrors({});
    } else {
      setDraftForm(initialFormState);
      setDirty(false);
      setValidationErrors({});
    }
  }, []);

  // Update form when resource changes
  useEffect(() => {
    if (selectedResource && mode === 'edit') {
      initializeForm(selectedResource);
    }
  }, [selectedResource, mode, initializeForm]);

  // Open create dialog
  const openCreateDialog = useCallback(() => {
    setMode('create');
    setSelectedResource(null);
    initializeForm(null);
    setOpen(true);
  }, [initializeForm]);

  // Open edit dialog
  const openEditDialog = useCallback(
    (resource: ResourceNode) => {
      setMode('edit');
      setSelectedResource(resource);
      initializeForm(resource);
      setOpen(true);
    },
    [initializeForm]
  );

  // Close dialog (with dirty check)
  const closeDialog = useCallback(
    (force: boolean = false) => {
      if (!force && dirty && mode !== 'create') {
        // Return false to indicate confirmation needed
        return false;
      }
      setOpen(false);
      setDirty(false);
      setValidationErrors({});
      return true;
    },
    [dirty, mode]
  );

  // Update form field
  const updateFormField = useCallback(<K extends keyof ResourceFormState>(
    field: K,
    value: ResourceFormState[K]
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
    initializeForm(selectedResource);
  }, [selectedResource, initializeForm]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!draftForm.resourceName.trim()) {
      errors.resourceName = '리소스명을 입력하세요.';
    }
    if (!draftForm.resourceKey.trim()) {
      errors.resourceKey = '리소스 키를 입력하세요.';
    }
    // If tracking is enabled, eventActions must be selected
    if (draftForm.trackingEnabled && draftForm.eventActions.length === 0) {
      errors.eventActions = '이벤트 추적 활성화 시 이벤트 액션을 선택해야 합니다.';
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
    selectedResource,
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
    setSelectedResource,
    showSnackbar,
    closeSnackbar,
  };
};
