import { useEffect, useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import {
  ActionButton,
  DatePickerField,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PAY004_QUERY_CONTRACT } from '../retirement-contract';
import { PAY004_DEFAULT_CRITERIA } from '../use-retirement-workbench';

import type { FormEvent } from 'react';
import type { Pay004Sort } from '../retirement-contract';
import type { Pay004Copy } from '../retirement-copy';
import type { Pay004WorkbenchCriteria } from '../use-retirement-workbench';

type CriteriaDraft = Readonly<{
  minimumAmount: string;
  policyKeys: string;
  caseStatuses: string;
  effectiveOn: string;
  sort: Pay004Sort;
}>;

function toDraft(criteria: Pay004WorkbenchCriteria): CriteriaDraft {
  return {
    minimumAmount: criteria.minimumAmount,
    policyKeys: criteria.policyKeys.join(', '),
    caseStatuses: criteria.caseStatuses.join(', '),
    effectiveOn: criteria.effectiveOn,
    sort: criteria.sort,
  };
}

function splitList(value: string): readonly string[] {
  return Object.freeze(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function fromDraft(draft: CriteriaDraft): Pay004WorkbenchCriteria {
  return Object.freeze({
    minimumAmount: draft.minimumAmount.trim(),
    policyKeys: splitList(draft.policyKeys),
    caseStatuses: splitList(draft.caseStatuses),
    effectiveOn: draft.effectiveOn.trim(),
    sort: draft.sort,
  });
}

export function RetirementQueryToolbar({
  criteria,
  copy,
  disabled,
  onApply,
  onReset,
}: Readonly<{
  criteria: Pay004WorkbenchCriteria;
  copy: Pay004Copy;
  disabled: boolean;
  onApply: (criteria: Pay004WorkbenchCriteria) => void;
  onReset: () => void;
}>) {
  const [draft, setDraft] = useState<CriteriaDraft>(() => toDraft(criteria));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(toDraft(criteria));
    setInvalid(false);
  }, [criteria]);

  const update = (next: Partial<CriteriaDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setInvalid(false);
  };
  const activeFilterCount = [
    criteria.minimumAmount,
    criteria.policyKeys.length,
    criteria.caseStatuses.length,
    criteria.effectiveOn,
  ].filter(Boolean).length;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      onApply(fromDraft(draft));
      setInvalid(false);
    } catch {
      setInvalid(true);
    }
  };
  const reset = () => {
    setDraft(toDraft(PAY004_DEFAULT_CRITERIA));
    setInvalid(false);
    onReset();
  };

  return (
    <Paper
      component="section"
      variant="outlined"
      data-testid="pay-004-query-toolbar"
      data-session-storage="tab"
      sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0, overflow: 'hidden' }}
    >
      <Box
        component="form"
        aria-label={copy.queryToolbarTitle}
        aria-describedby="pay004-query-toolbar-description pay004-query-toolbar-session"
        noValidate
        onSubmit={submit}
      >
        <Stack gap={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            minWidth={0}
          >
            <Box minWidth={0}>
              <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
                {copy.queryToolbarTitle}
              </Typography>
              <Typography
                id="pay004-query-toolbar-description"
                variant="body2"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {copy.queryToolbarDescription}
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="outlined"
              label={copy.activeFilterCount(activeFilterCount)}
            />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(5, minmax(0, 1fr))',
              },
              gap: 1.25,
              minWidth: 0,
            }}
          >
            <Box data-filter-key="retirementResult" minWidth={0}>
              <FormField
                id="pay004-minimum-amount"
                fullWidth
                size="small"
                label={copy.minimumAmountFilter}
                value={draft.minimumAmount}
                disabled={disabled}
                errorMessage={invalid ? copy.criteriaValidation : undefined}
                inputProps={{ inputMode: 'decimal', maxLength: 24 }}
                onChange={(event) => update({ minimumAmount: event.target.value })}
              />
            </Box>
            <Box data-filter-key="policyVersion" minWidth={0}>
              <FormField
                id="pay004-policy-keys"
                fullWidth
                size="small"
                label={copy.policyKeyFilter}
                placeholder={copy.policyKeyPlaceholder}
                value={draft.policyKeys}
                disabled={disabled}
                errorMessage={invalid ? copy.criteriaValidation : undefined}
                inputProps={{ maxLength: 512 }}
                onChange={(event) => update({ policyKeys: event.target.value })}
              />
            </Box>
            <Box data-filter-key="caseStatus" minWidth={0}>
              <FormField
                id="pay004-case-statuses"
                fullWidth
                size="small"
                label={copy.caseStatusFilter}
                placeholder={copy.caseStatusPlaceholder}
                value={draft.caseStatuses}
                disabled={disabled}
                errorMessage={invalid ? copy.criteriaValidation : undefined}
                inputProps={{ maxLength: 512 }}
                onChange={(event) => update({ caseStatuses: event.target.value })}
              />
            </Box>
            <Box data-filter-key="effectiveOn" minWidth={0}>
              <DatePickerField
                id="pay004-effective-on"
                fullWidth
                size="small"
                label={copy.effectiveOnFilter}
                value={draft.effectiveOn || null}
                disabled={disabled}
                errorMessage={invalid ? copy.criteriaValidation : undefined}
                onValueChange={(value) => update({ effectiveOn: value ?? '' })}
              />
            </Box>
            <FormControl
              fullWidth
              size="small"
              disabled={disabled}
              error={invalid}
              sx={{ minWidth: 0 }}
            >
              <InputLabel htmlFor="pay004-sort">{copy.sortLabel}</InputLabel>
              <Select
                native
                label={copy.sortLabel}
                value={draft.sort}
                inputProps={{
                  id: 'pay004-sort',
                  'data-sort-count': PAY004_QUERY_CONTRACT.sorts.length,
                }}
                sx={{ minWidth: 0 }}
                onChange={(event) => update({ sort: String(event.target.value) as Pay004Sort })}
              >
                {PAY004_QUERY_CONTRACT.sorts.map((sort) => (
                  <option key={sort} value={sort}>
                    {copy.sortLabels[sort]}
                  </option>
                ))}
              </Select>
            </FormControl>
          </Box>

          {invalid && <InlineFeedback severity="error">{copy.criteriaValidation}</InlineFeedback>}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography
              id="pay004-query-toolbar-session"
              variant="caption"
              color="text.secondary"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {copy.sessionSaved}
            </Typography>
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} gap={1} flexShrink={0}>
              <ActionButton
                type="button"
                intent="quiet"
                startIcon={<RotateCcw size={16} aria-hidden="true" />}
                disabled={disabled}
                onClick={reset}
                sx={{ minHeight: 44 }}
              >
                {copy.resetFilters}
              </ActionButton>
              <ActionButton
                type="submit"
                intent="primary"
                startIcon={<Filter size={16} aria-hidden="true" />}
                disabled={disabled}
                sx={{ minHeight: 44 }}
              >
                {copy.applyFilters}
              </ActionButton>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}
