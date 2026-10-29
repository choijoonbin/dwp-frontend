import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ActionButton, AutocompleteMultiField, InlineFeedback } from '@dwp-frontend/design-system';
import { listPeople, useAuth } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';

import {
  calendarAttendeeOptions,
  calendarResolveAttendeeValues,
} from './calendar-attendee-picker-model';

import type { CalendarEditorAttendee } from './calendar-event-editor-model';
import type { AutocompleteMultiFieldProps, FieldFeedbackProps } from '@dwp-frontend/design-system';
import type { AutocompleteProps } from '@mui/material/Autocomplete';

const ATTENDEE_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 275;

type CalendarFreeSoloMultiFieldProps<T> = Omit<
  AutocompleteProps<T, true, false, boolean>,
  'renderInput'
> &
  FieldFeedbackProps &
  Pick<AutocompleteMultiFieldProps<T>, 'label' | 'required' | 'textFieldProps'>;

/**
 * The shared field owns the rendered input while this local adapter keeps the
 * Calendar picker's existing optional free-solo value contract.
 */
function CalendarFreeSoloMultiField<T>(props: CalendarFreeSoloMultiFieldProps<T>) {
  return <AutocompleteMultiField<T> {...(props as unknown as AutocompleteMultiFieldProps<T>)} />;
}

export type CalendarExternalAttendeePolicyState = 'ALLOWED' | 'DENIED' | 'LOADING' | 'UNAVAILABLE';

function useDebouncedValue(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
}

export function CalendarAttendeePicker({
  scope,
  type,
  value,
  externalPolicyState,
  disabled = false,
  directoryEnabled = true,
  maxSelections,
  label,
  placeholder,
  supportingText,
  onChange,
}: Readonly<{
  scope: string;
  type: CalendarEditorAttendee['type'];
  value: readonly CalendarEditorAttendee[];
  externalPolicyState: CalendarExternalAttendeePolicyState;
  disabled?: boolean;
  directoryEnabled?: boolean;
  maxSelections?: number;
  label: string;
  placeholder: string;
  supportingText?: string;
  onChange: (value: readonly CalendarEditorAttendee[]) => void;
}>) {
  const { t } = useTranslation('calendar');
  const auth = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [invalidExternal, setInvalidExternal] = useState(false);
  const debouncedQuery = useDebouncedValue(inputValue);
  const peopleQuery = useInfiniteQuery({
    queryKey: [
      'calendar',
      'attendee-directory',
      scope,
      auth.user?.tenantId,
      auth.user?.userId,
      debouncedQuery,
    ],
    queryFn: ({ pageParam, signal }) =>
      listPeople({
        query: debouncedQuery || undefined,
        cursor: pageParam ?? undefined,
        size: ATTENDEE_PAGE_SIZE,
        signal,
        surface: 'directory',
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    staleTime: 30_000,
    retry: 1,
    enabled: !disabled && directoryEnabled,
  });
  const people = useMemo(
    () => peopleQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [peopleQuery.data?.pages]
  );
  const options = useMemo(
    () => calendarAttendeeOptions(value, people, type),
    [people, type, value]
  );
  const externalAllowed = externalPolicyState === 'ALLOWED';
  const policyHint = t(`event.attendeePicker.externalPolicy.${externalPolicyState}`);

  return (
    <Stack spacing={0.75}>
      <CalendarFreeSoloMultiField<CalendarEditorAttendee>
        freeSolo={externalAllowed}
        disabled={disabled}
        options={options}
        value={[...value]}
        inputValue={inputValue}
        onInputChange={(_, nextValue, reason) => {
          if (reason === 'input' || reason === 'clear') setInputValue(nextValue);
          if (reason === 'input') setInvalidExternal(false);
        }}
        onChange={(_, nextValue) => {
          const resolved = calendarResolveAttendeeValues(nextValue, type, externalAllowed);
          setInvalidExternal(resolved.invalidExternal || resolved.blockedExternal);
          onChange(resolved.attendees);
          if (!resolved.invalidExternal && !resolved.blockedExternal) setInputValue('');
        }}
        loading={peopleQuery.isFetching && !peopleQuery.isFetchingNextPage}
        filterSelectedOptions
        getOptionDisabled={(option) =>
          Boolean(
            maxSelections &&
            value.length >= maxSelections &&
            !value.some((selected) => selected.personId === option.personId)
          )
        }
        selectOnFocus
        handleHomeEndKeys
        getOptionLabel={(option) =>
          typeof option === 'string'
            ? option
            : option.workEmail
              ? `${option.displayName} · ${option.workEmail}`
              : option.displayName
        }
        isOptionEqualToValue={(option, selected) => option.personId === selected.personId}
        noOptionsText={
          debouncedQuery
            ? t('event.attendeePicker.noResults')
            : t('event.attendeePicker.searchPrompt')
        }
        renderOption={(props, option) => {
          const external = option.personId.startsWith('email:');
          return (
            <Box component="li" {...props} key={option.personId}>
              <ListItemText
                primary={option.displayName}
                secondary={
                  external ? t('event.attendeePicker.externalUnverified') : option.workEmail
                }
              />
            </Box>
          );
        }}
        renderTags={(values, getTagProps) =>
          values.map((attendee, index) => {
            if (typeof attendee === 'string') return null;
            const external = attendee.personId.startsWith('email:');
            return (
              <Chip
                {...getTagProps({ index })}
                key={attendee.personId}
                size="small"
                color={external ? 'warning' : 'default'}
                variant={external ? 'outlined' : 'filled'}
                label={
                  external
                    ? t('event.attendeePicker.externalChip', { email: attendee.workEmail })
                    : attendee.displayName
                }
              />
            );
          })
        }
        label={label}
        errorMessage={invalidExternal ? t('event.attendeePicker.invalidExternalEmail') : undefined}
        supportingText={
          invalidExternal ? undefined : [supportingText, policyHint].filter(Boolean).join(' · ')
        }
        textFieldProps={{
          placeholder: value.length ? undefined : placeholder,
          slotProps: {
            htmlInput: (ownerState) => ({
              ...ownerState.inputProps,
              autoComplete: 'off',
              inputMode: externalAllowed ? 'email' : 'search',
            }),
          },
        }}
      />
      {peopleQuery.isError ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void peopleQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('event.attendeePicker.loadError')}
        </InlineFeedback>
      ) : null}
      {peopleQuery.hasNextPage ? (
        <ActionButton
          intent="quiet"
          size="small"
          loading={peopleQuery.isFetchingNextPage}
          loadingLabel={t('event.attendeePicker.loadingMore')}
          onClick={() => void peopleQuery.fetchNextPage()}
          sx={{ alignSelf: 'flex-start' }}
        >
          {peopleQuery.isFetchNextPageError
            ? t('event.attendeePicker.retryMore')
            : t('event.attendeePicker.loadMore')}
        </ActionButton>
      ) : null}
    </Stack>
  );
}
