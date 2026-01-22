// ----------------------------------------------------------------------

import type { AdminMenuNode, MenuCreatePayload, MenuUpdatePayload, MenuReorderPayload } from '@dwp-frontend/shared-utils';

import { useCallback } from 'react';
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
        showSnackbar('메뉴가 생성되었습니다.');
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
          showSnackbar('메뉴 키가 중복됩니다. 다른 키를 사용해주세요.', 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : '생성에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [createMutation, refetch, showSnackbar]
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
        showSnackbar('메뉴가 수정되었습니다.');
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
        showSnackbar(error instanceof Error ? error.message : '수정에 실패했습니다.', 'error');
        return false;
      }
    },
    [updateMutation, refetch, showSnackbar]
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
        showSnackbar('메뉴가 삭제되었습니다.');
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
            showSnackbar('하위 메뉴가 존재합니다. 하위 메뉴를 삭제하거나 이동한 후 다시 시도해주세요.', 'error');
          } else {
            showSnackbar('메뉴 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
          }
        } else {
          showSnackbar(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [deleteMutation, refetch, showSnackbar]
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
        showSnackbar('메뉴 순서가 변경되었습니다.');
        return true;
      } catch (error) {
        showSnackbar(error instanceof Error ? error.message : '정렬에 실패했습니다.', 'error');
        return false;
      }
    },
    [reorderMutation, refetch, showSnackbar]
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
