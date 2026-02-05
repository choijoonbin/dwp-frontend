// ----------------------------------------------------------------------

import type { AdminMenuNode, MenuCreatePayload, MenuUpdatePayload, MenuReorderPayload } from '@dwp-frontend/shared-utils';

import { useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import {
  HttpError,
  trackEvent,
  useCreateAdminMenuMutation,
  useUpdateAdminMenuMutation,
  useDeleteAdminMenuMutation,
  useReorderAdminMenusMutation,
} from '@dwp-frontend/shared-utils';

import type { MenuFormState } from '../types';

// ----------------------------------------------------------------------

/**
 * Menu Actions Hook: CRUD mutation orchestration
 */
export const useMenuActions = (
  showSnackbar: (message: string, severity?: 'success' | 'error') => void,
  refetch: () => void
) => {
  const { t } = useTranslation('admin');
  const createMutation = useCreateAdminMenuMutation();
  const updateMutation = useUpdateAdminMenuMutation();
  const deleteMutation = useDeleteAdminMenuMutation();
  const reorderMutation = useReorderAdminMenusMutation();

  // Create menu
  const createMenu = useCallback(
    async (formData: MenuFormState) => {
      try {
        const payload: MenuCreatePayload = {
          menuKey: formData.menuKey,
          menuName: formData.menuName,
          path: formData.path || undefined,
          icon: formData.icon || undefined,
          group: formData.group || undefined,
          parentId: formData.parentId || undefined,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
          enabled: formData.enabled,
        };

        trackEvent({
          resourceKey: 'btn.admin.menus.create',
          action: 'CLICK',
          label: '메뉴 생성',
          metadata: {
            page: window.location.pathname,
            menuName: formData.menuName,
          },
        });

        await createMutation.mutateAsync(payload);
        refetch();
        showSnackbar(t('toast.menuCreated'));
        trackEvent({
          resourceKey: 'menu.admin.menus',
          action: 'CREATE',
          label: '메뉴 생성 완료',
          metadata: {
            menuName: formData.menuName,
            menuKey: formData.menuKey,
          },
        });
        return true;
      } catch (error) {
        // Handle 409 Conflict (duplicate menu key)
        if (error instanceof HttpError && error.status === 409) {
          showSnackbar(t('error.duplicateMenuKey'), 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : t('error.createFailed'), 'error');
        }
        return false;
      }
    },
    [createMutation, refetch, showSnackbar, t]
  );

  // Update menu
  const updateMenu = useCallback(
    async (menuId: string, formData: MenuFormState) => {
      try {
        const payload: MenuUpdatePayload = {
          menuName: formData.menuName,
          path: formData.path || undefined,
          icon: formData.icon || undefined,
          group: formData.group || undefined,
          parentId: formData.parentId || undefined,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
          enabled: formData.enabled,
        };

        trackEvent({
          resourceKey: 'btn.admin.menus.save',
          action: 'CLICK',
          label: '메뉴 수정',
          metadata: {
            menuId,
            menuName: formData.menuName,
          },
        });

        await updateMutation.mutateAsync({ menuId, payload });
        refetch();
        showSnackbar(t('toast.menuUpdated'));
        trackEvent({
          resourceKey: 'menu.admin.menus',
          action: 'UPDATE',
          label: '메뉴 수정 완료',
          metadata: {
            menuId,
            menuName: formData.menuName,
            menuKey: formData.menuKey,
          },
        });
        return true;
      } catch (error) {
        showSnackbar(error instanceof Error ? error.message : t('error.updateFailed'), 'error');
        return false;
      }
    },
    [updateMutation, refetch, showSnackbar, t]
  );

  // Delete menu
  const deleteMenu = useCallback(
    async (menu: AdminMenuNode) => {
      try {
        trackEvent({
          resourceKey: 'btn.admin.menus.delete',
          action: 'CLICK',
          label: '메뉴 삭제',
          metadata: {
            menuId: menu.id,
            menuName: menu.menuName,
          },
        });

        await deleteMutation.mutateAsync(menu.id);
        refetch();
        showSnackbar(t('toast.menuDeleted'));
        trackEvent({
          resourceKey: 'menu.admin.menus',
          action: 'DELETE',
          label: '메뉴 삭제 완료',
          metadata: {
            menuId: menu.id,
            menuName: menu.menuName,
          },
        });
        return true;
      } catch (error) {
        // Handle 409 Conflict (child menus exist)
        if (error instanceof HttpError && error.status === 409) {
          const errorMessage = error.message || '';
          if (errorMessage.includes('하위') || errorMessage.includes('child')) {
            showSnackbar(t('error.hasChildrenMenu'), 'error');
          } else {
            showSnackbar(t('error.menuDeleteError'), 'error');
          }
        } else {
          showSnackbar(error instanceof Error ? error.message : t('error.deleteFailed'), 'error');
        }
        return false;
      }
    },
    [deleteMutation, refetch, showSnackbar, t]
  );

  // Reorder menu
  const reorderMenu = useCallback(
    async (menuId: string, direction: 'UP' | 'DOWN') => {
      try {
        const payload: MenuReorderPayload = {
          menuId,
          direction,
        };

        trackEvent({
          resourceKey: 'btn.admin.menus.reorder',
          action: 'CLICK',
          label: '메뉴 정렬',
          metadata: {
            menuId,
            direction,
          },
        });

        await reorderMutation.mutateAsync(payload);
        refetch();
        showSnackbar(t('toast.menuOrderChanged'));
        return true;
      } catch (error) {
        showSnackbar(error instanceof Error ? error.message : t('error.sortFailed'), 'error');
        return false;
      }
    },
    [reorderMutation, refetch, showSnackbar, t]
  );

  return {
    // Mutations
    createMenu,
    updateMenu,
    deleteMenu,
    reorderMenu,
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReordering: reorderMutation.isPending,
  };
};
