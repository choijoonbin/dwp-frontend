import { useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import { Iconify } from '@dwp-frontend/design-system';
import {
  showToast,
  type PiiPolicyItem,
  type PiiFieldCatalogItem,
  usePutPiiPoliciesBulkMutation,
} from '@dwp-frontend/shared-utils';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { PiiFieldRow } from './pii-field-row';
import { PiiPolicySheet } from './pii-policy-sheet';

type MaskingPolicyCardProps = {
  profileId: string | null;
  catalog: PiiFieldCatalogItem[];
  policiesByFieldKey: Map<string, PiiPolicyItem>;
  isLoading?: boolean;
  onSaved: () => void;
};

export const MaskingPolicyCard = ({
  profileId,
  catalog,
  policiesByFieldKey,
  isLoading = false,
  onSaved,
}: MaskingPolicyCardProps) => {
  const { t } = useTranslation('common');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<PiiFieldCatalogItem | null>(null);

  const bulkMutation = usePutPiiPoliciesBulkMutation();

  const handleRowClick = (field: PiiFieldCatalogItem) => {
    setSelectedField(field);
    setSheetOpen(true);
  };

  const handleToggle = (field: PiiFieldCatalogItem, enabled: boolean) => {
    if (!profileId) return;

    const currentPolicy = policiesByFieldKey.get(field.fieldKey);
    const newHandling: PiiPolicyItem['handling'] = enabled
      ? (currentPolicy?.handling && currentPolicy.handling !== 'ALLOW'
          ? currentPolicy.handling
          : 'MASK')
      : 'ALLOW';

    const updatedPolicy: PiiPolicyItem = {
      fieldKey: field.fieldKey,
      handling: newHandling,
      maskConfig: enabled ? currentPolicy?.maskConfig : undefined,
      hashAlgorithm: enabled ? currentPolicy?.hashAlgorithm : undefined,
    };

    const otherPolicies = Array.from(policiesByFieldKey.values()).filter(
      (p) => p.fieldKey !== field.fieldKey
    );
    const newPolicies = [...otherPolicies, updatedPolicy];

    bulkMutation.mutate(
      { profileId, policies: newPolicies },
      {
        onSuccess: () => {
          showToast(t('toast.savedWithAudit'));
          onSaved();
        },
        onError: (err) => {
          showToast(err instanceof Error ? err.message : t('toast.failedToSave'), 'error');
          onSaved();
        },
      }
    );
  };

  const selectedPolicy = selectedField
    ? policiesByFieldKey.get(selectedField.fieldKey) ?? null
    : null;

  const existingPolicies = Array.from(policiesByFieldKey.values());

  return (
    <>
      <Card variant="outlined">
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:lock-password-bold-duotone" width={18} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Masking Policy
              </Typography>
            </Stack>
          }
          subheader="Field-level controls for IBAN, account, tax IDs."
          sx={{ pb: 2 }}
        />
        <CardContent>
          <Stack spacing={1.5}>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rounded" height={56} />
              ))
            ) : catalog.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No PII fields in catalog.
              </Typography>
            ) : (
              catalog.map((field) => (
                <PiiFieldRow
                  key={field.fieldKey}
                  field={field}
                  policy={policiesByFieldKey.get(field.fieldKey)}
                  onRowClick={() => handleRowClick(field)}
                  onToggle={(enabled) => handleToggle(field, enabled)}
                  isUpdating={bulkMutation.isPending}
                />
              ))
            )}
          </Stack>
        </CardContent>
      </Card>

      <PiiPolicySheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setSelectedField(null);
        }}
        field={selectedField}
        policy={selectedPolicy}
        profileId={profileId ?? ''}
        existingPolicies={existingPolicies}
        onSaved={onSaved}
      />
    </>
  );
};
