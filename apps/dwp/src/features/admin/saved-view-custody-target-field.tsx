import { forwardRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutocompleteField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { userIdentityLabel } from './saved-view-custody-ui';

import type {
  SavedViewCustodyIneligibilityReason,
  SavedViewCustodyUser,
} from '@dwp-frontend/shared-utils';
import type { TFunction } from 'i18next';
import type { Ref } from 'react';
import type { SavedViewTargetEligibilityFailure } from './saved-view-custody-model';

export function targetEligibilityReasonLabel(
  reason:
    SavedViewCustodyIneligibilityReason | Exclude<SavedViewTargetEligibilityFailure, 'UNKNOWN'>,
  t: TFunction<'admin'>
) {
  return t('savedViewCustody.eligibility.reasons.' + reason);
}

function targetOptionLabel(user: SavedViewCustodyUser, t: TFunction<'admin'>) {
  const identity = userIdentityLabel(user);
  if (user.eligibilityStatus !== 'INELIGIBLE') return identity;
  const reasons = (user.ineligibilityReasons ?? []).map((reason) =>
    targetEligibilityReasonLabel(reason, t)
  );
  return identity + ' · ' + (reasons.join(', ') || t('savedViewCustody.eligibility.ineligible'));
}

export function SavedViewCustodyTargetField({
  value,
  options,
  loading,
  disabled,
  errorMessage,
  inputRef,
  label,
  supportingText,
  reopenOnReady = false,
  onInputChange,
  onChange,
}: {
  value: SavedViewCustodyUser | null;
  options: SavedViewCustodyUser[];
  loading: boolean;
  disabled: boolean;
  errorMessage?: string;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  supportingText: string;
  reopenOnReady?: boolean;
  onInputChange: (value: string) => void;
  onChange: (value: SavedViewCustodyUser | null) => void;
}) {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (reopenOnReady && !loading && !disabled) setOpen(true);
    else if (!reopenOnReady) setOpen(false);
  }, [disabled, loading, reopenOnReady]);
  return (
    <AutocompleteField<SavedViewCustodyUser>
      required
      disabled={disabled}
      label={label}
      supportingText={supportingText}
      errorMessage={errorMessage}
      textFieldProps={{ inputRef }}
      value={value}
      options={options}
      loading={loading}
      open={open}
      loadingText={t('savedViewCustody.fields.loadingUsers')}
      noOptionsText={t('savedViewCustody.fields.noActiveUsers')}
      openOnFocus
      filterOptions={(values) => values}
      getOptionDisabled={(option) => option.eligibilityStatus === 'INELIGIBLE'}
      getOptionLabel={(option) => targetOptionLabel(option, t)}
      isOptionEqualToValue={(option, selected) => option.userId === selected.userId}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <Box component="li" key={key} {...optionProps}>
            <Stack gap={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={650} sx={{ overflowWrap: 'anywhere' }}>
                {userIdentityLabel(option)}
              </Typography>
              <Typography
                variant="caption"
                color={
                  option.eligibilityStatus === 'INELIGIBLE' ? 'warning.main' : 'text.secondary'
                }
                sx={{ overflowWrap: 'anywhere' }}
              >
                {option.eligibilityStatus === 'INELIGIBLE'
                  ? (option.ineligibilityReasons ?? [])
                      .map((reason) => targetEligibilityReasonLabel(reason, t))
                      .join(' · ') || t('savedViewCustody.eligibility.ineligible')
                  : option.eligibilityStatus === 'ELIGIBLE'
                    ? t('savedViewCustody.eligibility.eligible')
                    : t('savedViewCustody.eligibility.notEvaluated')}
              </Typography>
            </Stack>
          </Box>
        );
      }}
      onInputChange={(_, nextValue, reason) => {
        if (reason === 'input' || reason === 'clear') onInputChange(nextValue);
      }}
      onChange={(_, nextValue) => onChange(nextValue)}
      onClick={() => {
        if (!disabled) setOpen(true);
      }}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    />
  );
}

export const SavedViewTargetEligibilityNotice = forwardRef<
  HTMLDivElement,
  {
    reason: Exclude<SavedViewTargetEligibilityFailure, 'UNKNOWN'>;
    targetName?: string | null;
  }
>(function SavedViewTargetEligibilityNotice({ reason, targetName }, ref) {
  const { t } = useTranslation('admin');
  return (
    <Alert ref={ref} severity="warning" aria-live="assertive">
      <Stack gap={0.5}>
        <Typography variant="body2" fontWeight={700}>
          {t('savedViewCustody.eligibility.runtimeTitle', { target: targetName ?? '-' })}
        </Typography>
        <Typography variant="body2">{targetEligibilityReasonLabel(reason, t)}</Typography>
        <Typography variant="body2">{t('savedViewCustody.eligibility.guidance')}</Typography>
      </Stack>
    </Alert>
  );
});
