// ----------------------------------------------------------------------

import type { ResourceNode, ResourceCreatePayload, ResourceUpdatePayload } from '@dwp-frontend/shared-utils';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  trackEvent,
  getTenantId,
  HttpError,
  useCreateAdminResourceMutation,
  useUpdateAdminResourceMutation,
  useDeleteAdminResourceMutation,
} from '@dwp-frontend/shared-utils';

import type { ResourceFormState } from '../types';

// ----------------------------------------------------------------------

/**
 * Resource Actions Hook: CRUD mutation orchestration
 */
export const useResourceActions = (
  showSnackbar: (message: string, severity?: 'success' | 'error') => void,
  refetch: () => void
) => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  const createMutation = useCreateAdminResourceMutation();
  const updateMutation = useUpdateAdminResourceMutation();
  const deleteMutation = useDeleteAdminResourceMutation();

  // Invalidate resources queries after mutation
  const invalidateResourcesQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'resources', tenantId] });
    refetch();
  }, [queryClient, tenantId, refetch]);

  // Create resource
  const createResource = useCallback(
    async (formData: ResourceFormState) => {
      try {
        const payload: ResourceCreatePayload = {
          resourceName: formData.resourceName,
          resourceKey: formData.resourceKey,
          resourceType: formData.resourceType,
          resourceCategory: formData.resourceCategory || undefined,
          resourceKind: formData.resourceKind || undefined,
          path: formData.path || undefined,
          parentId: formData.parentId || undefined,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
          enabled: formData.enabled,
          trackingEnabled: formData.trackingEnabled,
          eventActions: formData.eventActions.length > 0 ? formData.eventActions : undefined,
        };

        trackEvent({
          resourceKey: 'btn.admin.resources.create',
          action: 'CLICK',
          label: '리소스 생성',
          metadata: {
            page: window.location.pathname,
            resourceName: formData.resourceName,
          },
        });

        await createMutation.mutateAsync(payload);
        invalidateResourcesQueries();
        showSnackbar('리소스가 생성되었습니다.');
        trackEvent({
          resourceKey: 'menu.admin.resources',
          action: 'CREATE',
          label: '리소스 생성 완료',
          metadata: {
            resourceName: formData.resourceName,
            resourceKey: formData.resourceKey,
          },
        });
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (duplicate resource key)
          showSnackbar('리소스 키가 중복됩니다. 다른 키를 사용해주세요.', 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : '생성에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [createMutation, invalidateResourcesQueries, showSnackbar]
  );

  // Update resource
  const updateResource = useCallback(
    async (resourceId: string, formData: ResourceFormState) => {
      try {
        const payload: ResourceUpdatePayload = {
          resourceName: formData.resourceName,
          resourceKey: formData.resourceKey,
          resourceType: formData.resourceType,
          resourceCategory: formData.resourceCategory || undefined,
          resourceKind: formData.resourceKind || undefined,
          path: formData.path || undefined,
          parentId: formData.parentId || undefined,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
          enabled: formData.enabled,
          trackingEnabled: formData.trackingEnabled,
          eventActions: formData.eventActions.length > 0 ? formData.eventActions : undefined,
        };

        trackEvent({
          resourceKey: 'btn.admin.resources.save',
          action: 'CLICK',
          label: '리소스 수정',
          metadata: {
            resourceId,
            resourceName: formData.resourceName,
          },
        });

        await updateMutation.mutateAsync({ resourceId, payload });
        invalidateResourcesQueries();
        showSnackbar('리소스가 수정되었습니다.');
        trackEvent({
          resourceKey: 'menu.admin.resources',
          action: 'UPDATE',
          label: '리소스 수정 완료',
          metadata: {
            resourceId,
            resourceName: formData.resourceName,
            resourceKey: formData.resourceKey,
          },
        });
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (duplicate resource key or child resources exist)
          const errorMessage = error.message || '';
          if (errorMessage.includes('하위') || errorMessage.includes('child')) {
            showSnackbar('하위 리소스가 존재합니다. 하위 리소스를 삭제하거나 이동한 후 다시 시도해주세요.', 'error');
          } else {
            showSnackbar('리소스 키가 중복됩니다. 다른 키를 사용해주세요.', 'error');
          }
        } else {
          showSnackbar(error instanceof Error ? error.message : '수정에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [updateMutation, invalidateResourcesQueries, showSnackbar]
  );

  // Delete resource
  const deleteResource = useCallback(
    async (resource: ResourceNode) => {
      try {
        trackEvent({
          resourceKey: 'btn.admin.resources.delete',
          action: 'CLICK',
          label: '리소스 삭제',
          metadata: {
            resourceId: resource.id,
            resourceName: resource.resourceName,
          },
        });

        await deleteMutation.mutateAsync(resource.id);
        invalidateResourcesQueries();
        showSnackbar('리소스가 삭제되었습니다.');
        trackEvent({
          resourceKey: 'menu.admin.resources',
          action: 'DELETE',
          label: '리소스 삭제 완료',
          metadata: {
            resourceId: resource.id,
            resourceName: resource.resourceName,
          },
        });
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (child resources exist)
          const errorMessage = error.message || '';
          if (errorMessage.includes('하위') || errorMessage.includes('child')) {
            showSnackbar('하위 리소스가 존재합니다. 하위 리소스를 삭제하거나 이동한 후 다시 시도해주세요.', 'error');
          } else {
            showSnackbar('리소스 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
          }
        } else {
          showSnackbar(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [deleteMutation, invalidateResourcesQueries, showSnackbar]
  );

  return {
    // Mutations
    createResource,
    updateResource,
    deleteResource,
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
