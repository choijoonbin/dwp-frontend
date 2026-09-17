import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  foundationTokens,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  catalogOptionDefinitions,
  catalogOptionValueIsValid,
  workplaceServicesCopy,
} from './workplace-services-ui-model';

import type {
  WorkplaceServiceCatalogItem,
  WorkplaceServiceProviderState,
} from '@dwp-frontend/shared-utils';

function stateColor(state: WorkplaceServiceProviderState) {
  if (state === 'READY') return 'success' as const;
  if (state === 'DEGRADED' || state === 'STALE') return 'warning' as const;
  return 'default' as const;
}

export type ServiceOrderStage = 'catalog' | 'configure' | 'review';

export const serviceOrderStages: readonly ServiceOrderStage[] = ['catalog', 'configure', 'review'];

export const disclosureSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: foundationTokens.radius.control + 'px',
  overflow: 'clip',
  '& > summary': {
    minHeight: 44,
    px: 1.25,
    py: 0.75,
    cursor: 'pointer',
    listStyle: 'none',
    '&::-webkit-details-marker': { display: 'none' },
  },
  '&[open] .WorkplaceServiceDisclosure-icon': { transform: 'rotate(180deg)' },
} as const;

export function ServiceCatalogChoice({
  item,
  selected,
  disabled,
  onSelected,
}: {
  item: WorkplaceServiceCatalogItem;
  selected: boolean;
  disabled: boolean;
  onSelected: (selected: boolean) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const name = korean ? item.nameKo : item.nameEn;
  return (
    <Box
      sx={(theme) => ({
        ...workplaceMemberSoftSurface(theme),
        p: 1.25,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        minWidth: 0,
      })}
    >
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
        <FormControlLabel
          sx={{ m: 0, minWidth: 0, flex: 1, alignItems: 'flex-start', minHeight: 44 }}
          control={
            <Checkbox
              checked={selected}
              disabled={disabled || item.providerState !== 'READY'}
              onChange={(event) => onSelected(event.target.checked)}
              inputProps={{ 'aria-label': name }}
              sx={{ width: 44, height: 44, flex: '0 0 44px' }}
            />
          }
          label={
            <Box pt={0.9} minWidth={0}>
              <Typography component="h5" variant="subtitle2" fontWeight="fontWeightBold">
                {name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`workplace.services.catalog.categories.${item.category}`)} ·{' '}
                {formatNumber(item.unitPrice, undefined, locale)} {item.currency}
              </Typography>
            </Box>
          }
        />
        <Chip
          size="small"
          color={stateColor(item.providerState)}
          label={t(`workplace.services.providerStates.${item.providerState}`)}
        />
      </Stack>
      <Box component="details" sx={{ ...disclosureSx, mt: 1 }}>
        <Stack
          component="summary"
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Typography variant="body2" fontWeight="fontWeightMedium">
            {t('workplace.services.mobile.serviceDetails')}
          </Typography>
          <ChevronDown className="WorkplaceServiceDisclosure-icon" size={17} aria-hidden="true" />
        </Stack>
        <Stack spacing={1} px={1.25} pb={1.25}>
          <Typography variant="body2" color="text.secondary">
            {(korean ? item.descriptionKo : item.descriptionEn) || name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {korean ? item.cancellationPolicyKo : item.cancellationPolicyEn}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('workplace.services.catalog.slaSummary', {
              response: item.slaResponseMinutes,
              fulfillment: item.slaFulfillmentLeadMinutes,
            })}
          </Typography>
          {item.category === 'AV' && (
            <InlineFeedback severity="info">{t('workplace.services.avPinBoundary')}</InlineFeedback>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export function ServiceConfigurationCard({
  item,
  quantity,
  optionValues,
  disabled,
  defaultOpen,
  onQuantity,
  onOption,
}: {
  item: WorkplaceServiceCatalogItem;
  quantity: number;
  optionValues: Readonly<Record<string, unknown>>;
  disabled: boolean;
  defaultOpen: boolean;
  onQuantity: (quantity: number) => void;
  onOption: (key: string, value: unknown) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const name = korean ? item.nameKo : item.nameEn;
  const screenCopy = workplaceServicesCopy(locale);
  const options = catalogOptionDefinitions(item);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box
      component="details"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      sx={disclosureSx}
    >
      <Stack
        component="summary"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        <Box minWidth={0}>
          <Typography component="h5" variant="subtitle2" fontWeight="fontWeightBold">
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('workplace.services.quantity')}: {quantity}
          </Typography>
        </Box>
        <ChevronDown className="WorkplaceServiceDisclosure-icon" size={18} aria-hidden="true" />
      </Stack>
      <Stack spacing={1.25} px={1.25} pb={1.25}>
        <FormField
          size="small"
          type="number"
          label={t('workplace.services.quantity')}
          value={quantity}
          disabled={disabled}
          slotProps={{ htmlInput: { min: item.minimumQuantity, max: item.maximumQuantity } }}
          onChange={(event) => onQuantity(Number(event.target.value))}
          sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
        />
        <Typography variant="caption" color="text.secondary">
          {korean ? item.cancellationPolicyKo : item.cancellationPolicyEn}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.services.catalog.slaSummary', {
            response: item.slaResponseMinutes,
            fulfillment: item.slaFulfillmentLeadMinutes,
          })}
        </Typography>
        {options.length > 0 && (
          <Stack spacing={1} aria-label={t('workplace.services.optionConfiguration')}>
            {options.map((option) => {
              const label = `${korean ? option.labelKo : option.labelEn}${
                option.required ? ' *' : ''
              }`;
              const value = optionValues[option.key];
              const valid = catalogOptionValueIsValid(option, value);
              if (option.type === 'BOOLEAN') {
                return (
                  <FormControlLabel
                    key={option.key}
                    sx={{ minHeight: 44 }}
                    control={
                      <Checkbox
                        checked={value === true}
                        disabled={disabled}
                        onChange={(event) => onOption(option.key, event.target.checked)}
                        sx={{ width: 44, height: 44 }}
                      />
                    }
                    label={label}
                  />
                );
              }
              if (option.type === 'SINGLE_SELECT') {
                return (
                  <SelectField
                    key={option.key}
                    size="small"
                    label={label}
                    value={typeof value === 'string' ? value : ''}
                    disabled={disabled}
                    options={option.values.map((candidate) => ({
                      value: candidate,
                      label: candidate,
                    }))}
                    onValueChange={(value) => onOption(option.key, value)}
                    sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
                  />
                );
              }
              if (option.type === 'MULTI_SELECT') {
                return (
                  <FormField
                    key={option.key}
                    size="small"
                    label={label}
                    supportingText={t('workplace.services.multiSelectHint')}
                    value={Array.isArray(value) ? value.join(', ') : ''}
                    disabled={disabled}
                    onChange={(event) =>
                      onOption(
                        option.key,
                        event.target.value
                          .split(',')
                          .map((candidate) => candidate.trim())
                          .filter(Boolean)
                      )
                    }
                    sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
                  />
                );
              }
              return (
                <FormField
                  key={option.key}
                  size="small"
                  type={option.type === 'NUMBER' ? 'number' : 'text'}
                  label={label}
                  value={
                    option.type === 'NUMBER'
                      ? typeof value === 'number'
                        ? value
                        : ''
                      : typeof value === 'string'
                        ? value
                        : ''
                  }
                  supportingText={
                    option.type === 'NUMBER' && (option.minimum !== null || option.maximum !== null)
                      ? screenCopy.numberRange(option.minimum, option.maximum)
                      : undefined
                  }
                  errorMessage={
                    option.type !== 'NUMBER' || valid
                      ? undefined
                      : option.minimum !== null || option.maximum !== null
                        ? screenCopy.numberRange(option.minimum, option.maximum)
                        : screenCopy.numberRequired
                  }
                  disabled={disabled}
                  sx={{
                    '& .MuiInputBase-root': { minHeight: 44 },
                    '& .MuiFormHelperText-root.Mui-disabled': { color: 'text.primary' },
                  }}
                  slotProps={
                    option.type === 'NUMBER'
                      ? {
                          htmlInput: {
                            ...(option.minimum === null ? {} : { min: option.minimum }),
                            ...(option.maximum === null ? {} : { max: option.maximum }),
                          },
                        }
                      : undefined
                  }
                  onChange={(event) =>
                    onOption(
                      option.key,
                      option.type === 'NUMBER'
                        ? event.target.value === ''
                          ? null
                          : Number(event.target.value)
                        : event.target.value
                    )
                  }
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
