import type { PiiPolicyItem, PiiFieldCatalogItem } from '@dwp-frontend/shared-utils';

import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

/** fieldKey → display name (Vendor IBAN, Bank Account, Tax ID) */
const DISPLAY_NAME_MAP: Record<string, string> = {
  IBAN: 'Vendor IBAN',
  VENDOR_IBAN: 'Vendor IBAN',
  BANK_ACCOUNT: 'Bank Account',
  TAX_ID: 'Tax ID',
};

const HANDLING_LABELS: Record<string, string> = {
  ALLOW: 'Allow',
  MASK: 'Mask',
  HASH_ONLY: 'Hash',
  ENCRYPT: 'Encrypt',
  FORBID: 'Forbid',
};

const HANDLING_COLORS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  ALLOW: 'success',
  MASK: 'info',
  HASH_ONLY: 'default',
  ENCRYPT: 'warning',
  FORBID: 'error',
};

type PiiFieldRowProps = {
  field: PiiFieldCatalogItem;
  policy?: PiiPolicyItem | null;
  onRowClick: () => void;
  onToggle: (enabled: boolean) => void;
  isUpdating?: boolean;
};

export const PiiFieldRow = ({
  field,
  policy,
  onRowClick,
  onToggle,
  isUpdating = false,
}: PiiFieldRowProps) => {
  const handling = policy?.handling ?? 'ALLOW';
  const isEnabled = handling !== 'ALLOW';
  const displayName = DISPLAY_NAME_MAP[field.fieldKey] ?? field.label;
  const maskedHint =
    isEnabled && field.sampleMaskedFormat
      ? `Preview: ${field.sampleMaskedFormat}`
      : null;

  return (
    <Box
      onClick={onRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick();
        }
      }}
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {displayName}
          </Typography>
          <Label
            color={HANDLING_COLORS[handling] ?? 'default'}
            variant="soft"
            sx={{ fontSize: 10 }}
          >
            {HANDLING_LABELS[handling] ?? handling}
          </Label>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {field.description ?? field.fieldKey}
        </Typography>
        {maskedHint && (
          <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 0.25 }}>
            {maskedHint}
          </Typography>
        )}
      </Box>
      <Stack direction="row" alignItems="center" spacing={1} onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={isEnabled}
          onChange={(_, checked) => onToggle(checked)}
          disabled={isUpdating}
        />
        <Iconify icon="solar:alt-arrow-right-linear" width={16} sx={{ color: 'text.disabled' }} />
      </Stack>
    </Box>
  );
};
