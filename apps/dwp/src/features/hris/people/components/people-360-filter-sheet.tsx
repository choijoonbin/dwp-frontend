import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  DatePickerField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { getPeople360Copy } from '../model/people-360-copy';

const STATUSES = ['ACTIVE', 'LEAVE', 'PENDING', 'SUSPENDED', 'TERMINATED'] as const;

function FilterFields({
  asOf,
  status,
  onAsOfChange,
  onStatusChange,
}: {
  asOf: string;
  status: string;
  onAsOfChange: (value: string | null) => void;
  onStatusChange: (value: string) => void;
}) {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  return (
    <>
      <SelectField
        size="small"
        label={copy.status}
        value={status}
        onValueChange={(value) => onStatusChange(String(value))}
        options={[
          { value: 'ALL', label: copy.allStatuses },
          ...STATUSES.map((value) => ({ value, label: value })),
        ]}
        sx={{ minWidth: 0, width: { xs: 1, md: 210 } }}
      />
      <DatePickerField
        size="small"
        label={copy.asOf}
        value={asOf}
        onValueChange={onAsOfChange}
        sx={{ minWidth: 0, width: { xs: 1, md: 190 } }}
      />
    </>
  );
}

export function People360FilterSheet({
  asOf,
  status,
  activeCount,
  onAsOfChange,
  onStatusChange,
  onReset,
}: {
  asOf: string;
  status: string;
  activeCount: number;
  onAsOfChange: (value: string | null) => void;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}) {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <>
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <ActionButton
          intent="secondary"
          size="small"
          startIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
          aria-expanded={open}
          aria-controls={titleId}
          onClick={() => setOpen(true)}
          fullWidth
        >
          {copy.filters}
          {activeCount > 0 ? ` (${activeCount})` : ''}
        </ActionButton>
      </Box>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        sx={{ display: { xs: 'none', md: 'flex' }, minWidth: 0 }}
      >
        <FilterFields
          asOf={asOf}
          status={status}
          onAsOfChange={onAsOfChange}
          onStatusChange={onStatusChange}
        />
        {activeCount > 0 && (
          <ActionButton intent="quiet" size="small" onClick={onReset}>
            {copy.resetFilters}
          </ActionButton>
        )}
      </Stack>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        transitionDuration={reduceMotion ? 0 : undefined}
        slotProps={{
          paper: {
            'aria-labelledby': titleId,
            sx: {
              borderTopLeftRadius: 'shape.borderRadius',
              borderTopRightRadius: 'shape.borderRadius',
              maxHeight: 'min(88dvh, 720px)',
              width: '100%',
              minWidth: 0,
            },
          },
        }}
      >
        <Stack sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ px: 2, py: 1.5 }}
          >
            <Typography id={titleId} component="h2" variant="h6">
              {copy.filters}
            </Typography>
            <ActionIconButton
              label={copy.closeFilters}
              tooltip={copy.closeFilters}
              onClick={() => setOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </ActionIconButton>
          </Stack>
          <Divider />
          <Stack gap={2} sx={{ p: 2, minWidth: 0, overflowY: 'auto' }}>
            <FilterFields
              asOf={asOf}
              status={status}
              onAsOfChange={onAsOfChange}
              onStatusChange={onStatusChange}
            />
          </Stack>
          <Divider />
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            justifyContent="flex-end"
            gap={1}
            sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <ActionButton intent="quiet" onClick={onReset}>
              {copy.resetFilters}
            </ActionButton>
            <ActionButton intent="primary" onClick={() => setOpen(false)}>
              {copy.applyFilters}
            </ActionButton>
          </Stack>
        </Stack>
      </Drawer>
    </>
  );
}
