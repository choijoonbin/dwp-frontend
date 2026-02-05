// ----------------------------------------------------------------------

import type { ResourceNode, ResourceCreatePayload, ResourceUpdatePayload } from '@dwp-frontend/shared-utils';

import { useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useQueryClient } from '@tanstack/react-query';
import {
  HttpError,
  trackEvent,
  getTenantId,
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
  const { t } = useTranslation('admin');
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
        showSnackbar(t('toast.resourceCreated'));
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
          showSnackbar(t('error.permissionDenied'), 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (duplicate resource key)
          showSnackbar(t('error.duplicateResourceKey'), 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : t('error.createFailed'), 'error');
        }
        return false;
      }
    },
    [createMutation, invalidateResourcesQueries, showSnackbar, t]
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
        showSnackbar(t('toast.resourceUpdated'));
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
          showSnackbar(t('error.permissionDenied'), 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (duplicate resource key or child resources exist)
          const errorMessage = error.message || '';
          if (errorMessage.includes('하위') || errorMessage.includes('child')) {
            showSnackbar(t('error.hasChildrenResource'), 'error');
          } else {
            showSnackbar(t('error.duplicateResourceKey'), 'error');
          }
        } else {
          showSnackbar(error instanceof Error ? error.message : t('error.updateFailed'), 'error');
        }
        return false;
      }
    },
    [updateMutation, invalidateResourcesQueries, showSnackbar, t]
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
        showSnackbar(t('toast.resourceDeleted'));
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
          showSnackbar(t('error.permissionDenied'), 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (child resources exist)
          const errorMessage = error.message || '';
          if (errorMessage.includes('하위') || errorMessage.includes('child')) {
            showSnackbar(t('error.hasChildrenResource'), 'error');
          } else {
            showSnackbar(t('error.resourceDeleteError'), 'error');
          }
        } else {
          showSnackbar(error instanceof Error ? error.message : t('error.deleteFailed'), 'error');
        }
        return false;
      }
    },
    [deleteMutation, invalidateResourcesQueries, showSnackbar, t]
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
