// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import { memo, useMemo } from 'react';
import { PermissionGate } from '@dwp-frontend/design-system';
import { useCodesByResourceQuery, getSelectOptionsByGroup } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import { TrackingConfigSection } from './tracking-config-section';
import { flattenResourceTree } from '../adapters/resource-adapter';

import type { ResourceFormState } from '../types';

// ----------------------------------------------------------------------

type ResourceEditorModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  formData: ResourceFormState;
  validationErrors: Record<string, string>;
  resourcesTree: ResourceNode[];
  isLoading: boolean;
  onClose: () => void;
  onFormChange: <K extends keyof ResourceFormState>(field: K, value: ResourceFormState[K]) => void;
  onSubmit: () => void;
};

export const ResourceEditorModal = memo(({
  open,
  mode,
  formData,
  validationErrors,
  resourcesTree,
  isLoading,
  onClose,
  onFormChange,
  onSubmit,
}: ResourceEditorModalProps) => {
  // Get codes for resource types, categories, and kinds
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.resources');
  const resourceTypes = getSelectOptionsByGroup(codeMap, 'RESOURCE_TYPE');
  const resourceCategories = getSelectOptionsByGroup(codeMap, 'RESOURCE_CATEGORY');
  const resourceKinds = getSelectOptionsByGroup(codeMap, 'RESOURCE_KIND');

  // Flatten tree for parent selection (exclude current resource in edit mode)
  const flatResources = useMemo(() => {
    if (mode === 'edit' && formData.resourceKey) {
      // Find current resource ID from tree
      const findResourceId = (nodes: ResourceNode[]): string | undefined => {
        for (const node of nodes) {
          if (node.resourceKey === formData.resourceKey) return node.id;
          if (node.children) {
            const found = findResourceId(node.children);
            if (found) return found;
          }
        }
        return undefined;
      };
      const excludeId = findResourceId(resourcesTree);
      return flattenResourceTree(resourcesTree, excludeId);
    }
    return flattenResourceTree(resourcesTree);
  }, [resourcesTree, mode, formData.resourceKey]);

  const isCreateMode = mode === 'create';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isCreateMode ? '리소스 추가' : '리소스 편집'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="리소스명 *"
            fullWidth
            value={formData.resourceName}
            onChange={(e) => onFormChange('resourceName', e.target.value)}
            required
            error={!!validationErrors.resourceName}
            helperText={validationErrors.resourceName}
          />
          <TextField
            label="리소스 키 *"
            fullWidth
            value={formData.resourceKey}
            onChange={(e) => onFormChange('resourceKey', e.target.value)}
            required
            disabled={!isCreateMode}
            error={!!validationErrors.resourceKey}
            helperText={validationErrors.resourceKey}
          />
          <TextField
            select
            label="타입 *"
            fullWidth
            value={formData.resourceType}
            onChange={(e) => onFormChange('resourceType', e.target.value as 'MENU' | 'BUTTON' | 'API' | 'RESOURCE')}
            required
            disabled={codesLoading || resourceTypes.length === 0}
            helperText={codesLoading ? '코드 로딩 중...' : resourceTypes.length === 0 ? '코드 매핑 필요' : undefined}
          >
            {resourceTypes.length > 0 ? (
              resourceTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled value="">
                코드 매핑 필요
              </MenuItem>
            )}
          </TextField>
          <TextField
            label="Path"
            fullWidth
            value={formData.path}
            onChange={(e) => onFormChange('path', e.target.value)}
          />
          <TextField
            select
            label="부모 리소스"
            fullWidth
            value={formData.parentId}
            onChange={(e) => onFormChange('parentId', e.target.value)}
          >
            <MenuItem value="">없음</MenuItem>
            {flatResources.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.resourceName} ({r.resourceKey})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="정렬 순서"
            type="number"
            fullWidth
            value={formData.sortOrder}
            onChange={(e) => onFormChange('sortOrder', e.target.value)}
          />
          {/* Resource Category (if available) */}
          {resourceCategories.length > 0 && (
            <TextField
              select
              label="카테고리"
              fullWidth
              value={formData.resourceCategory || ''}
              onChange={(e) => onFormChange('resourceCategory', e.target.value)}
              disabled={codesLoading}
              helperText={codesLoading ? '코드 로딩 중...' : resourceCategories.length === 0 ? '코드 매핑 필요' : undefined}
            >
              <MenuItem value="">없음</MenuItem>
              {resourceCategories.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          {/* Resource Kind (if available) */}
          {resourceKinds.length > 0 && (
            <TextField
              select
              label="종류"
              fullWidth
              value={formData.resourceKind || ''}
              onChange={(e) => onFormChange('resourceKind', e.target.value)}
              disabled={codesLoading}
              helperText={codesLoading ? '코드 로딩 중...' : resourceKinds.length === 0 ? '코드 매핑 필요' : undefined}
            >
              <MenuItem value="">없음</MenuItem>
              {resourceKinds.map((kind) => (
                <MenuItem key={kind.value} value={kind.value}>
                  {kind.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <FormControlLabel
            control={
              <Switch checked={formData.enabled} onChange={(e) => onFormChange('enabled', e.target.checked)} />
            }
            label="활성화"
          />
          {/* Tracking Config Section */}
          <TrackingConfigSection formData={formData} validationErrors={validationErrors} onFormChange={onFormChange} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <PermissionGate resource="menu.admin.resources" permission={isCreateMode ? 'CREATE' : 'UPDATE'}>
          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={
              !formData.resourceName ||
              !formData.resourceKey ||
              (formData.trackingEnabled && formData.eventActions.length === 0) ||
              isLoading
            }
          >
            {isCreateMode ? '생성' : '저장'}
          </Button>
        </PermissionGate>
      </DialogActions>
    </Dialog>
  );
});

ResourceEditorModal.displayName = 'ResourceEditorModal';
