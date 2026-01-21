// ----------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { useAdminRoleMembersQuery } from '@dwp-frontend/shared-utils';


// ----------------------------------------------------------------------

/**
 * Hook for managing role members state
 */
export const useRoleMembersState = (roleId: string) => {
  const { data: roleMembers } = useAdminRoleMembersQuery(roleId);

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorSnackbar, setErrorSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  // Initialize selectedUserIds from roleMembers
  useEffect(() => {
    if (roleMembers) {
      setSelectedUserIds(new Set(roleMembers.map((u) => u.id)));
    }
  }, [roleMembers]);

  const handleToggleUser = useCallback((userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const showErrorSnackbar = useCallback((message: string) => {
    setErrorSnackbar({ open: true, message });
  }, []);

  const closeErrorSnackbar = useCallback(() => {
    setErrorSnackbar({ open: false, message: '' });
  }, []);

  return {
    selectedUserIds,
    dialogOpen,
    errorSnackbar,
    setSelectedUserIds,
    handleToggleUser,
    handleOpenDialog,
    handleCloseDialog,
    showErrorSnackbar,
    closeErrorSnackbar,
  };
};
