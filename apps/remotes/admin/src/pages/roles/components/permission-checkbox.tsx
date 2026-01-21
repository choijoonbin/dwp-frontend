// ----------------------------------------------------------------------

import { memo, useState } from 'react';
import { HttpError, useUpdateAdminRolePermissionsMutation } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import Snackbar from '@mui/material/Snackbar';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

type PermissionCheckboxProps = {
  resourceKey: string;
  permissionCode: string;
  roleId: string;
  checked: boolean;
  permissionMap: Map<string, Set<string>>;
  onPermissionToggle?: (resourceKey: string, permissionCode: string) => void;
  onSuccess: () => void;
  label: string;
};

export const PermissionCheckbox = memo(({
  resourceKey,
  permissionCode,
  roleId,
  checked,
  permissionMap,
  onPermissionToggle,
  onSuccess,
  label,
}: PermissionCheckboxProps) => {
  const updateMutation = useUpdateAdminRolePermissionsMutation();
  const [errorSnackbar, setErrorSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  const handleToggle = async () => {
    // If onPermissionToggle is provided, use dirty state mode (don't save immediately)
    if (onPermissionToggle) {
      onPermissionToggle(resourceKey, permissionCode);
      return;
    }

    // Otherwise, use immediate save mode (legacy behavior)
    const newMap = new Map(permissionMap);
    const codes = newMap.get(resourceKey) || new Set<string>();
    const newCodes = new Set(codes);

    if (newCodes.has(permissionCode)) {
      newCodes.delete(permissionCode);
    } else {
      newCodes.add(permissionCode);
    }

    if (newCodes.size === 0) {
      newMap.delete(resourceKey);
    } else {
      newMap.set(resourceKey, newCodes);
    }

    // Convert to new payload format: { items: [{ resourceKey, permissionCode, effect }] }
    const items = Array.from(newMap.entries()).flatMap(([resKey, permissionCodesSet]) =>
      Array.from(permissionCodesSet).map((permCode) => ({
        resourceKey: resKey,
        permissionCode: permCode,
        effect: 'ALLOW' as const, // Default to ALLOW for legacy checkbox
      }))
    );

    try {
      await updateMutation.mutateAsync({
        roleId,
        payload: { items },
      });
      onSuccess();
    } catch (error) {
      // Handle 409 Conflict or 403 Forbidden
      if (error instanceof HttpError && error.status === 409) {
        setErrorSnackbar({ open: true, message: '권한 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
      } else if (error instanceof HttpError && error.status === 403) {
        setErrorSnackbar({ open: true, message: '접근 권한이 없습니다.' });
      } else {
        setErrorSnackbar({ open: true, message: error instanceof Error ? error.message : '권한 변경에 실패했습니다.' });
      }
    }
  };

  return (
    <>
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={handleToggle} size="small" disabled={updateMutation.isPending} />}
        label={label}
      />
      <Snackbar
        open={errorSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setErrorSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setErrorSnackbar({ open: false, message: '' })} severity="error" sx={{ width: '100%' }}>
          {errorSnackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
});

PermissionCheckbox.displayName = 'PermissionCheckbox';
